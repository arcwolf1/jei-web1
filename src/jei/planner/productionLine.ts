import type { ItemKey } from 'src/jei/types';
import { itemKeyHash } from 'src/jei/indexing/key';
import type { EnhancedRequirementNode, RequirementNode } from './planner';

type AnyNode = RequirementNode | EnhancedRequirementNode;

export type ProductionLineNode =
  | {
    kind: 'item';
    nodeId: string;
    itemKey: ItemKey;
    amount: number;
    seedAmount?: number;
    isRoot?: true;
    isSurplus?: true;
    recovery?: true;
    recoverySourceItemKey?: ItemKey;
    recoverySourceRecipeId?: string;
    recoverySourceRecipeTypeKey?: string;
  }
  | {
    kind: 'fluid';
    nodeId: string;
    id: string;
    amount: number;
    unit?: string;
  }
  | {
    kind: 'machine';
    nodeId: string;
    recipeId: string;
    recipeTypeKey?: string;
    /** All output item keys produced by this recipe (may be > 1 for multi-output recipes). */
    outputItemKeys: ItemKey[];
    /**
     * Per-output breakdown. Populated for multi-output recipes.
     * `demanded` = total rate consumed downstream.
     * `machineCountOwn` = machines needed purely for this output (can be fractional).
     * `surplusRate` = capacity – demanded (> 0 only when another output drove a higher machine count).
     */
    outputDetails?: {
      key: ItemKey;
      demanded: number;
      machineCountOwn: number;
      surplusRate: number;
    }[];
    amount: number;
    machineItemId?: string;
    machineName?: string;
    machineCount?: number;
    machines?: number;
  };

export type ProductionLineEdge =
  | {
    kind: 'item';
    id: string;
    source: string;
    target: string;
    itemKey: ItemKey;
    amount: number;
    recovery?: true;
    surplus?: true;
  }
  | {
    kind: 'fluid';
    id: string;
    source: string;
    target: string;
    fluidId: string;
    unit?: string;
    amount: number;
  };

type ItemEdge = Extract<ProductionLineEdge, { kind: 'item' }>;
type FluidEdge = Extract<ProductionLineEdge, { kind: 'fluid' }>;
type ItemEdgeDraft = Omit<ItemEdge, 'id'>;
type FluidEdgeDraft = Omit<FluidEdge, 'id'>;
type EdgeDraft = ItemEdgeDraft | FluidEdgeDraft;

function finiteOr(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

type RecoveryItemMeta = {
  recovery?: boolean;
  recoverySourceItemKey?: ItemKey;
  recoverySourceRecipeId?: string;
  recoverySourceRecipeTypeKey?: string;
};

type ItemNodeAgg = {
  itemKey: ItemKey;
  seedAmount: number;
  isRoot?: true;
  isSurplus?: true;
  recovery?: true;
  recoverySourceItemKey?: ItemKey;
  recoverySourceRecipeId?: string;
  recoverySourceRecipeTypeKey?: string;
};

function productionLineMergeEdgeKey(e: EdgeDraft): string {
  return e.kind === 'item'
    ? `${e.source}->${e.target}:i:${itemKeyHash(e.itemKey)}:${e.recovery ? 'r' : e.surplus ? 's' : 'n'}`
    : `${e.source}->${e.target}:f:${e.fluidId}:${e.unit ?? ''}`;
}

function mergeProductionLineEdges(
  edges: Iterable<EdgeDraft | ProductionLineEdge>,
): ProductionLineEdge[] {
  const merged = new Map<string, ProductionLineEdge>();
  for (const edge of edges) {
    if (edge.kind === 'item') {
      const draft: ItemEdgeDraft = {
        kind: 'item',
        source: edge.source,
        target: edge.target,
        itemKey: edge.itemKey,
        amount: edge.amount,
      };
      if (edge.recovery) draft.recovery = true;
      if (edge.surplus) draft.surplus = true;

      const key = productionLineMergeEdgeKey(draft);
      const prev = merged.get(key);
      if (!prev) {
        merged.set(key, { ...draft, id: `e:${key}` });
        continue;
      }
      prev.amount += draft.amount;
      continue;
    }

    const draft: FluidEdgeDraft = {
      kind: 'fluid',
      source: edge.source,
      target: edge.target,
      fluidId: edge.fluidId,
      amount: edge.amount,
    };
    if (edge.unit) draft.unit = edge.unit;

    const key = productionLineMergeEdgeKey(draft);
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, { ...draft, id: `e:${key}` });
      continue;
    }
    prev.amount += draft.amount;
  }
  return Array.from(merged.values());
}

export function collapseProductionLineIntermediateItems(
  nodes: ProductionLineNode[],
  edges: ProductionLineEdge[],
): { nodes: ProductionLineNode[]; edges: ProductionLineEdge[] } {
  const collapseTolerance = 1e-9;
  const itemNodes = nodes.filter((n): n is Extract<ProductionLineNode, { kind: 'item' }> => n.kind === 'item');
  const removedItemNodeIds = new Set<string>();
  const removeEdgeIds = new Set<string>();
  const addedEdges: EdgeDraft[] = [];

  const incomingByItem = new Map<string, ItemEdge[]>();
  const outgoingByItem = new Map<string, ItemEdge[]>();
  itemNodes.forEach((n) => {
    incomingByItem.set(n.nodeId, []);
    outgoingByItem.set(n.nodeId, []);
  });
  edges.forEach((e) => {
    if (e.kind !== 'item') return;
    if (e.target.startsWith('i:')) (incomingByItem.get(e.target) ?? []).push(e);
    if (e.source.startsWith('i:')) (outgoingByItem.get(e.source) ?? []).push(e);
  });

  itemNodes.forEach((n) => {
    const incomingAll = incomingByItem.get(n.nodeId) ?? [];
    const outgoingAll = outgoingByItem.get(n.nodeId) ?? [];
    const incoming = incomingAll.filter((e) => e.source.startsWith('m:'));
    const outgoing = outgoingAll.filter((e) => e.target.startsWith('m:'));
    const keep =
      !!n.isRoot ||
      !!n.recovery ||
      !!n.isSurplus ||
      (n.seedAmount ?? 0) > 0 ||
      incoming.length !== incomingAll.length ||
      outgoing.length !== outgoingAll.length ||
      incoming.length === 0 ||
      outgoing.length === 0;
    if (keep) return;

    const producerChunks = incoming
      .slice()
      .sort((a, b) => a.source.localeCompare(b.source) || a.id.localeCompare(b.id))
      .map((edge) => ({ source: edge.source, amount: edge.amount }));
    const consumerChunks = outgoing
      .slice()
      .sort((a, b) => a.target.localeCompare(b.target) || a.id.localeCompare(b.id))
      .map((edge) => ({
        target: edge.target,
        itemKey: edge.itemKey,
        recovery: edge.recovery,
        amount: edge.amount,
      }));

    const bridgedEdges: EdgeDraft[] = [];
    let producerIdx = 0;
    let consumerIdx = 0;
    while (producerIdx < producerChunks.length && consumerIdx < consumerChunks.length) {
      const producer = producerChunks[producerIdx]!;
      const consumer = consumerChunks[consumerIdx]!;
      const amount = Math.min(producer.amount, consumer.amount);
      if (amount > collapseTolerance) {
        bridgedEdges.push({
          kind: 'item',
          source: producer.source,
          target: consumer.target,
          itemKey: consumer.itemKey,
          amount,
          ...(consumer.recovery ? { recovery: true } : {}),
        });
      }

      producer.amount -= amount;
      consumer.amount -= amount;
      if (producer.amount <= collapseTolerance) producerIdx += 1;
      if (consumer.amount <= collapseTolerance) consumerIdx += 1;
    }

    const leftoverIncoming = producerChunks.reduce(
      (sum, chunk) => sum + (chunk.amount > collapseTolerance ? chunk.amount : 0),
      0,
    );
    const leftoverOutgoing = consumerChunks.reduce(
      (sum, chunk) => sum + (chunk.amount > collapseTolerance ? chunk.amount : 0),
      0,
    );
    if (leftoverIncoming > collapseTolerance || leftoverOutgoing > collapseTolerance) return;

    incoming.forEach((e) => removeEdgeIds.add(e.id));
    outgoing.forEach((e) => removeEdgeIds.add(e.id));
    removedItemNodeIds.add(n.nodeId);
    addedEdges.push(...bridgedEdges);
  });

  const nextEdges = mergeProductionLineEdges(
    [
      ...edges
        .filter((e) => !removeEdgeIds.has(e.id))
        .filter((e) => !removedItemNodeIds.has(e.source) && !removedItemNodeIds.has(e.target)),
      ...addedEdges,
    ],
  );

  let nextNodes = nodes.filter((n) => !removedItemNodeIds.has(n.nodeId));

  const amountByFinalNodeId = new Map<string, number>();
  nextEdges.forEach((e) => {
    if (e.kind === 'item') {
      const isFromMachine = e.source.startsWith('m:');
      const isToMachine = e.target.startsWith('m:');
      const isFromItem = e.source.startsWith('i:');
      const isToItem = e.target.startsWith('i:');
      if (isFromMachine && isToItem) {
        amountByFinalNodeId.set(e.target, (amountByFinalNodeId.get(e.target) ?? 0) + e.amount);
      } else if (isFromItem && isToMachine) {
        amountByFinalNodeId.set(e.source, (amountByFinalNodeId.get(e.source) ?? 0) + e.amount);
      }
    } else {
      amountByFinalNodeId.set(e.source, (amountByFinalNodeId.get(e.source) ?? 0) + e.amount);
    }
  });

  nextNodes = nextNodes.map((n) => {
    if (n.kind === 'item') return { ...n, amount: amountByFinalNodeId.get(n.nodeId) ?? 0 };
    if (n.kind === 'fluid') return { ...n, amount: amountByFinalNodeId.get(n.nodeId) ?? 0 };
    return n;
  });

  return { nodes: nextNodes, edges: nextEdges };
}

export function buildProductionLineModel(args: {
  root: AnyNode;
  rootItemKey?: ItemKey;
  includeCycleSeeds?: boolean;
  collapseIntermediateItems?: boolean;
}): { nodes: ProductionLineNode[]; edges: ProductionLineEdge[] } {
  const rootItemKey = args.rootItemKey ?? (args.root.kind === 'item' ? args.root.itemKey : undefined);
  const includeCycleSeeds = !!args.includeCycleSeeds;
  const collapseIntermediateItems = !!args.collapseIntermediateItems;

  const baseItemNodeKey = (key: ItemKey) => `base:${itemKeyHash(key)}`;
  const recoveryItemNodeKey = (
    key: ItemKey,
    recoverySourceItemKey?: ItemKey,
    recoverySourceRecipeId?: string,
    recoverySourceRecipeTypeKey?: string,
  ) => {
    const sourceItemHash = recoverySourceItemKey ? itemKeyHash(recoverySourceItemKey) : '';
    return `rec:${itemKeyHash(key)}:${sourceItemHash}:${recoverySourceRecipeId ?? ''}:${recoverySourceRecipeTypeKey ?? ''}`;
  };
  const rootNodeKey = rootItemKey ? baseItemNodeKey(rootItemKey) : null;

  const itemByNodeKey = new Map<string, ItemNodeAgg>();
  const fluidById = new Map<string, { id: string; unit?: string }>();
  const machineByKey = new Map<
    string,
    {
      recipeId: string;
      recipeTypeKey?: string;
      /** All distinct output item keys registered for this recipe. First = primary. */
      outputItemKeys: ItemKey[];
      /** Per-output data: demanded rate and own machine count for each output. */
      outputDetails: {
        key: ItemKey;
        demanded: number;
        machineCountOwn: number;
      }[];
      amount: number;
      machineItemId?: string;
      machineName?: string;
      machineCount?: number;
      machines?: number;
    }
  >();
  const edgeByKey = new Map<string, ProductionLineEdge>();

  const ensureItem = (
    key: ItemKey,
    recoveryMeta?: RecoveryItemMeta,
  ): { id: string; nodeKey: string } => {
    const nodeKey = recoveryMeta?.recovery
      ? recoveryItemNodeKey(
          key,
          recoveryMeta.recoverySourceItemKey,
          recoveryMeta.recoverySourceRecipeId,
          recoveryMeta.recoverySourceRecipeTypeKey,
        )
      : baseItemNodeKey(key);
    const nodeId = `i:${nodeKey}`;
    if (itemByNodeKey.has(nodeKey)) return { id: nodeId, nodeKey };
    itemByNodeKey.set(nodeKey, {
      itemKey: key,
      seedAmount: 0,
      ...(nodeKey === rootNodeKey ? { isRoot: true } : {}),
      ...(recoveryMeta?.recovery ? { recovery: true } : {}),
      ...(recoveryMeta?.recoverySourceItemKey
        ? { recoverySourceItemKey: recoveryMeta.recoverySourceItemKey }
        : {}),
      ...(recoveryMeta?.recoverySourceRecipeId
        ? { recoverySourceRecipeId: recoveryMeta.recoverySourceRecipeId }
        : {}),
      ...(recoveryMeta?.recoverySourceRecipeTypeKey
        ? { recoverySourceRecipeTypeKey: recoveryMeta.recoverySourceRecipeTypeKey }
        : {}),
    });
    return { id: nodeId, nodeKey };
  };

  const ensureFluid = (id: string, unit?: string) => {
    const k = unit ? `${id}:${unit}` : id;
    const prev = fluidById.get(k);
    if (!prev) fluidById.set(k, { id, ...(unit ? { unit } : {}) });
    return { id: `f:${k}`, key: k };
  };

  // Machine key uses only recipeId so that multi-output recipes share one node.
  const machineKeyFor = (recipeId: string) => recipeId;

  const ensureMachineByRecipe = (args2: {
    recipeId: string;
    outputItemKey: ItemKey;
    recipeTypeKey?: string;
    machineItemId?: string;
    machineName?: string;
  }) => {
    const k = machineKeyFor(args2.recipeId);
    const prev = machineByKey.get(k);
    if (!prev) {
      machineByKey.set(k, {
        recipeId: args2.recipeId,
        ...(args2.recipeTypeKey ? { recipeTypeKey: args2.recipeTypeKey } : {}),
        outputItemKeys: [args2.outputItemKey],
        outputDetails: [],
        amount: 0,
        ...(args2.machineItemId ? { machineItemId: args2.machineItemId } : {}),
        ...(args2.machineName ? { machineName: args2.machineName } : {}),
      });
    } else {
      if (!prev.machineItemId && args2.machineItemId) prev.machineItemId = args2.machineItemId;
      if (!prev.machineName && args2.machineName) prev.machineName = args2.machineName;
      if (!prev.recipeTypeKey && args2.recipeTypeKey) prev.recipeTypeKey = args2.recipeTypeKey;
      // Append outputItemKey if not already present (multi-output case)
      const h = itemKeyHash(args2.outputItemKey);
      if (!prev.outputItemKeys.some((k2) => itemKeyHash(k2) === h)) {
        prev.outputItemKeys.push(args2.outputItemKey);
      }
    }
    return { id: `m:${k}`, key: k };
  };

  const ensureMachine = (node: Extract<AnyNode, { kind: 'item' }>) => {
    const recipeId = node.recipeIdUsed;
    if (!recipeId) return null;
    return ensureMachineByRecipe({
      recipeId,
      outputItemKey: node.itemKey,
      ...(node.recipeTypeKeyUsed ? { recipeTypeKey: node.recipeTypeKeyUsed } : {}),
      ...(node.machineItemId ? { machineItemId: node.machineItemId } : {}),
      ...(node.machineName ? { machineName: node.machineName } : {}),
    });
  };

  const ensureRecoverySourceMachine = (node: Extract<AnyNode, { kind: 'item' }>) => {
    if (!node.recovery || !node.recoverySourceRecipeId || !node.recoverySourceItemKey) return null;
    return ensureMachineByRecipe({
      recipeId: node.recoverySourceRecipeId,
      outputItemKey: node.recoverySourceItemKey,
      ...(node.recoverySourceRecipeTypeKey ? { recipeTypeKey: node.recoverySourceRecipeTypeKey } : {}),
    });
  };

  const addEdge = (edge: EdgeDraft) => {
    const k =
      edge.kind === 'item'
        ? `${edge.source}->${edge.target}:i:${itemKeyHash(edge.itemKey)}:${edge.recovery ? 'r' : 'n'}`
        : `${edge.source}->${edge.target}:f:${edge.fluidId}:${edge.unit ?? ''}`;
    const prev = edgeByKey.get(k);
    if (!prev) {
      edgeByKey.set(k, { ...(edge as ProductionLineEdge), id: `e:${k}` });
      return;
    }
    prev.amount += edge.amount;
  };

  const addMachineTotals = (
    machineKey: string,
    node: Extract<AnyNode, { kind: 'item' }>,
    mode: 'sum' | 'max' = 'sum',
  ) => {
    const m = machineByKey.get(machineKey);
    if (!m) return;
    const mc = finiteOr((node as unknown as { machineCount?: unknown }).machineCount, 0);
    const machines = finiteOr((node as unknown as { machines?: unknown }).machines, 0);
    if (mode === 'max') {
      if (Number.isFinite(mc) && mc > 0) m.machineCount = Math.max(m.machineCount ?? 0, mc);
      if (Number.isFinite(machines) && machines > 0) m.machines = Math.max(m.machines ?? 0, machines);
    } else {
      if (Number.isFinite(mc) && mc > 0) m.machineCount = (m.machineCount ?? 0) + mc;
      if (Number.isFinite(machines) && machines > 0) m.machines = (m.machines ?? 0) + machines;
    }
  };

  /** Register all child→machine input edges (item + fluid). Called only when new capacity is added. */
  const processChildInputEdges = (
    machine: { id: string; key: string },
    node: Extract<AnyNode, { kind: 'item' }>,
  ) => {
    node.children.forEach((c) => {
      if (c.kind === 'item') {
        const childItem = ensureItem(
          c.itemKey,
          c.recovery
            ? {
                recovery: true,
                ...(c.recoverySourceItemKey ? { recoverySourceItemKey: c.recoverySourceItemKey } : {}),
                ...(c.recoverySourceRecipeId ? { recoverySourceRecipeId: c.recoverySourceRecipeId } : {}),
                ...(c.recoverySourceRecipeTypeKey
                  ? { recoverySourceRecipeTypeKey: c.recoverySourceRecipeTypeKey }
                  : {}),
              }
            : undefined,
        );
        const cycleAmountNeeded = finiteOr(
          (c as unknown as { cycleAmountNeeded?: unknown }).cycleAmountNeeded,
          0,
        );
        const amount = c.cycleSeed && cycleAmountNeeded > 0 ? cycleAmountNeeded : finiteOr(c.amount, 0);
        addEdge({
          kind: 'item',
          source: childItem.id,
          target: machine.id,
          itemKey: c.itemKey,
          amount,
          ...(c.recovery ? { recovery: true } : {}),
        });
        if (c.recovery) {
          const sourceMachine = ensureRecoverySourceMachine(c);
          if (sourceMachine) {
            addEdge({
              kind: 'item',
              source: sourceMachine.id,
              target: childItem.id,
              itemKey: c.itemKey,
              amount,
              recovery: true,
            });
          }
        }
      } else {
        const childFluid = ensureFluid(c.id, c.unit);
        addEdge({
          kind: 'fluid',
          source: childFluid.id,
          target: machine.id,
          fluidId: c.id,
          ...(c.unit ? { unit: c.unit } : {}),
          amount: finiteOr(c.amount, 0),
        });
      }
    });
  };

  const walk = (node: AnyNode) => {
    if (node.kind === 'fluid') {
      ensureFluid(node.id, node.unit);
      return;
    }

    const item = ensureItem(
      node.itemKey,
      node.recovery
        ? {
            recovery: true,
            ...(node.recoverySourceItemKey ? { recoverySourceItemKey: node.recoverySourceItemKey } : {}),
            ...(node.recoverySourceRecipeId ? { recoverySourceRecipeId: node.recoverySourceRecipeId } : {}),
            ...(node.recoverySourceRecipeTypeKey
              ? { recoverySourceRecipeTypeKey: node.recoverySourceRecipeTypeKey }
              : {}),
          }
        : undefined,
    );
    const itemAgg = itemByNodeKey.get(item.nodeKey)!;
    const seedAmount = finiteOr(
      (node as unknown as { cycleSeedAmount?: unknown }).cycleSeedAmount,
      0,
    );
    if (includeCycleSeeds && node.cycleSeed && seedAmount > 0) {
      itemAgg.seedAmount += seedAmount;
    }

    const canBuildMachine = !!node.recipeIdUsed && !node.cycle && !node.recovery;
    // Pre-check BEFORE ensureMachine modifies the map, so we can distinguish three cases:
    //  A) Machine didn't exist yet → first-ever visit → SUM + process input edges
    //  B) Machine existed, but this outputItemKey was not registered → secondary output of a
    //     multi-output recipe → same physical machines → MAX, skip re-adding input edges
    //  C) Machine existed, this outputItemKey was already registered → independent additional
    //     demand for the same recipe output → SUM + process input edges
    const machinePreExists =
      canBuildMachine && machineByKey.has(machineKeyFor(node.recipeIdUsed!));
    const outputKeyPreExists = machinePreExists && (() => {
      const existingAgg = machineByKey.get(machineKeyFor(node.recipeIdUsed!))!;
      const h = itemKeyHash(node.itemKey);
      return existingAgg.outputItemKeys.some((k2) => itemKeyHash(k2) === h);
    })();
    const machine = canBuildMachine ? ensureMachine(node) : null;
    if (machine) {
      const mAgg = machineByKey.get(machine.key)!;
      const mc = finiteOr((node as unknown as { machineCount?: unknown }).machineCount, 0);
      const ownMachines = finiteOr((node as unknown as { machines?: unknown }).machines, 0);
      const ownMachineCount = ownMachines > 0 ? ownMachines : mc > 0 ? mc : 0;
      const detailMergeMode: 'sum' | 'max' =
        machinePreExists && !outputKeyPreExists ? 'max' : 'sum';

      if (!machinePreExists) {
        // Case A: first-ever visit for this recipe.
        mAgg.amount += finiteOr(node.amount, 0);
        addMachineTotals(machine.key, node, 'sum');
        processChildInputEdges(machine, node);
      } else if (!outputKeyPreExists) {
        // Case B: secondary output of multi-output recipe (same physical machines).
        // Use MAX so we don't double-count machines already counted for the primary output.
        addMachineTotals(machine.key, node, 'max');
        // Do NOT re-add input edges (same machines → same inputs already registered).
      } else {
        // Case C: same outputItemKey seen again → independent additional demand.
        mAgg.amount += finiteOr(node.amount, 0);
        addMachineTotals(machine.key, node, 'sum');
        processChildInputEdges(machine, node);
      }

      // Accumulate per-output details (demanded rate & own machine count).
      const itemH = itemKeyHash(node.itemKey);
      const existing = mAgg.outputDetails.find((d) => itemKeyHash(d.key) === itemH);
      if (!existing) {
        mAgg.outputDetails.push({
          key: node.itemKey,
          demanded: finiteOr(node.amount, 0),
          machineCountOwn: ownMachineCount,
        });
      } else {
        existing.demanded += finiteOr(node.amount, 0);
        if (detailMergeMode === 'max') {
          existing.machineCountOwn = Math.max(existing.machineCountOwn, ownMachineCount);
        } else {
          existing.machineCountOwn += ownMachineCount;
        }
      }

      // Output edge: machine → this item node (always add, distinct per outputItemKey)
      addEdge({
        kind: 'item',
        source: machine.id,
        target: item.id,
        itemKey: node.itemKey,
        amount: finiteOr(node.amount, 0),
      });
    }

    if (node.children.length) node.children.forEach(walk);
  };

  walk(args.root);

  const machineNodes: ProductionLineNode[] = [];
  machineByKey.forEach((v, k) => {
    const effectiveMachineCount = (v.machines ?? 0) > 0 ? (v.machines ?? 0) : (v.machineCount ?? 0);
    // Compute per-output surplus: when another output drove a higher machine count, the
    // capacity for this output exceeds what was demanded.
    const outputDetailsWithSurplus = v.outputDetails.map((d) => {
      let surplusRate = 0;
      if (effectiveMachineCount > 0 && d.machineCountOwn > 0 && d.machineCountOwn < effectiveMachineCount) {
        // capacity = demanded / machineCountOwn * effectiveMachineCount
        const capacity = (d.demanded / d.machineCountOwn) * effectiveMachineCount;
        surplusRate = Math.max(0, capacity - d.demanded);
      }
      return { ...d, surplusRate };
    });

    machineNodes.push({
      kind: 'machine',
      nodeId: `m:${k}`,
      recipeId: v.recipeId,
      ...(v.recipeTypeKey ? { recipeTypeKey: v.recipeTypeKey } : {}),
      outputItemKeys: v.outputItemKeys,
      ...(outputDetailsWithSurplus.length > 0 ? { outputDetails: outputDetailsWithSurplus } : {}),
      amount: v.amount,
      ...(v.machineItemId ? { machineItemId: v.machineItemId } : {}),
      ...(v.machineName ? { machineName: v.machineName } : {}),
      ...(v.machineCount !== undefined ? { machineCount: v.machineCount } : {}),
      ...(v.machines !== undefined ? { machines: v.machines } : {}),
    });

    // Emit surplus item nodes + edges for outputs that have idle capacity.
    outputDetailsWithSurplus.forEach((d) => {
      if (d.surplusRate < 1e-9) return;
      // Node key for this surplus output: no shared node with demand nodes.
      const surplusNodeKey = `surplus:m:${k}:${itemKeyHash(d.key)}`;
      const surplusNodeId = `i:${surplusNodeKey}`;
      if (!itemByNodeKey.has(surplusNodeKey)) {
        itemByNodeKey.set(surplusNodeKey, { itemKey: d.key, seedAmount: d.surplusRate, isSurplus: true });
      } else {
        itemByNodeKey.get(surplusNodeKey)!.seedAmount += d.surplusRate; // reuse seedAmount as accumulator
      }
      edgeByKey.set(`m:${k}->surplus:${itemKeyHash(d.key)}`, {
        id: `e:surplus:m:${k}->surplus:${itemKeyHash(d.key)}`,
        kind: 'item',
        source: `m:${k}`,
        target: surplusNodeId,
        itemKey: d.key,
        amount: d.surplusRate,
        surplus: true,
      });
    });
  });

  const amountByNodeId = new Map<string, number>();
  Array.from(edgeByKey.values()).forEach((e) => {
    if (e.kind === 'item') {
      const isFromMachine = e.source.startsWith('m:');
      const isToMachine = e.target.startsWith('m:');
      if (isFromMachine) {
        amountByNodeId.set(e.target, (amountByNodeId.get(e.target) ?? 0) + e.amount);
      } else if (isToMachine) {
        amountByNodeId.set(e.source, (amountByNodeId.get(e.source) ?? 0) + e.amount);
      }
    } else {
      amountByNodeId.set(e.source, (amountByNodeId.get(e.source) ?? 0) + e.amount);
    }
  });

  let nodes: ProductionLineNode[] = [];
  itemByNodeKey.forEach((v, key) => {
    const nodeId = `i:${key}`;
    const amount = v.isSurplus ? v.seedAmount : (amountByNodeId.get(nodeId) ?? 0);
    nodes.push({
      kind: 'item',
      nodeId,
      itemKey: v.itemKey,
      amount,
      ...(v.seedAmount > 0 && !v.isSurplus ? { seedAmount: v.seedAmount } : {}),
      ...(v.isRoot ? { isRoot: true } : {}),
      ...(v.isSurplus ? { isSurplus: true } : {}),
      ...(v.recovery ? { recovery: true } : {}),
      ...(v.recoverySourceItemKey ? { recoverySourceItemKey: v.recoverySourceItemKey } : {}),
      ...(v.recoverySourceRecipeId ? { recoverySourceRecipeId: v.recoverySourceRecipeId } : {}),
      ...(v.recoverySourceRecipeTypeKey
        ? { recoverySourceRecipeTypeKey: v.recoverySourceRecipeTypeKey }
        : {}),
    });
  });
  fluidById.forEach((v, k) => {
    const nodeId = `f:${k}`;
    const amount = amountByNodeId.get(nodeId) ?? 0;
    nodes.push({
      kind: 'fluid',
      nodeId,
      id: v.id,
      ...(v.unit ? { unit: v.unit } : {}),
      amount,
    });
  });
  nodes.push(...machineNodes);

  let edges: ProductionLineEdge[] = Array.from(edgeByKey.values());

  if (collapseIntermediateItems) {
    ({ nodes, edges } = collapseProductionLineIntermediateItems(nodes, edges));
  }

  return { nodes, edges };
}
