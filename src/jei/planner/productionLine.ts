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
    outputItemKey: ItemKey;
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
  recovery?: true;
  recoverySourceItemKey?: ItemKey;
  recoverySourceRecipeId?: string;
  recoverySourceRecipeTypeKey?: string;
};

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
      outputItemKey: ItemKey;
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

  const machineKeyFor = (recipeId: string, outputItemKey: ItemKey) =>
    `${recipeId}:${itemKeyHash(outputItemKey)}`;

  const ensureMachineByRecipe = (args2: {
    recipeId: string;
    outputItemKey: ItemKey;
    recipeTypeKey?: string;
    machineItemId?: string;
    machineName?: string;
  }) => {
    const k = machineKeyFor(args2.recipeId, args2.outputItemKey);
    const prev = machineByKey.get(k);
    if (!prev) {
      machineByKey.set(k, {
        recipeId: args2.recipeId,
        ...(args2.recipeTypeKey ? { recipeTypeKey: args2.recipeTypeKey } : {}),
        outputItemKey: args2.outputItemKey,
        amount: 0,
        ...(args2.machineItemId ? { machineItemId: args2.machineItemId } : {}),
        ...(args2.machineName ? { machineName: args2.machineName } : {}),
      });
    } else {
      if (!prev.machineItemId && args2.machineItemId) prev.machineItemId = args2.machineItemId;
      if (!prev.machineName && args2.machineName) prev.machineName = args2.machineName;
      if (!prev.recipeTypeKey && args2.recipeTypeKey) prev.recipeTypeKey = args2.recipeTypeKey;
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

  const addMachineTotals = (machineKey: string, node: Extract<AnyNode, { kind: 'item' }>) => {
    const m = machineByKey.get(machineKey);
    if (!m) return;
    const mc = finiteOr((node as unknown as { machineCount?: unknown }).machineCount, 0);
    const machines = finiteOr((node as unknown as { machines?: unknown }).machines, 0);
    if (Number.isFinite(mc) && mc > 0) m.machineCount = (m.machineCount ?? 0) + mc;
    if (Number.isFinite(machines) && machines > 0) m.machines = (m.machines ?? 0) + machines;
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
    const machine = canBuildMachine ? ensureMachine(node) : null;
    if (machine) {
      const mAgg = machineByKey.get(machine.key)!;
      mAgg.amount += finiteOr(node.amount, 0);
      addMachineTotals(machine.key, node);
      addEdge({
        kind: 'item',
        source: machine.id,
        target: item.id,
        itemKey: node.itemKey,
        amount: finiteOr(node.amount, 0),
      });

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
    }

    if (node.children.length) node.children.forEach(walk);
  };

  walk(args.root);

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
    const amount = amountByNodeId.get(nodeId) ?? 0;
    nodes.push({
      kind: 'item',
      nodeId,
      itemKey: v.itemKey,
      amount,
      ...(v.seedAmount > 0 ? { seedAmount: v.seedAmount } : {}),
      ...(v.isRoot ? { isRoot: true } : {}),
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
  machineByKey.forEach((v, k) => {
    nodes.push({
      kind: 'machine',
      nodeId: `m:${k}`,
      recipeId: v.recipeId,
      ...(v.recipeTypeKey ? { recipeTypeKey: v.recipeTypeKey } : {}),
      outputItemKey: v.outputItemKey,
      amount: v.amount,
      ...(v.machineItemId ? { machineItemId: v.machineItemId } : {}),
      ...(v.machineName ? { machineName: v.machineName } : {}),
      ...(v.machineCount !== undefined ? { machineCount: v.machineCount } : {}),
      ...(v.machines !== undefined ? { machines: v.machines } : {}),
    });
  });

  let edges: ProductionLineEdge[] = Array.from(edgeByKey.values());

  if (collapseIntermediateItems) {
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
      const incoming = (incomingByItem.get(n.nodeId) ?? []).filter((e) => e.source.startsWith('m:'));
      const outgoing = (outgoingByItem.get(n.nodeId) ?? []).filter((e) => e.target.startsWith('m:'));
      const keep =
        !!n.isRoot ||
        !!n.recovery ||
        (n.seedAmount ?? 0) > 0 ||
        incoming.length === 0 ||
        outgoing.length === 0;
      if (keep) return;

      const producer = incoming
        .slice()
        .sort((a, b) => b.amount - a.amount)[0];
      if (!producer) return;

      incoming.forEach((e) => removeEdgeIds.add(e.id));
      outgoing.forEach((e) => removeEdgeIds.add(e.id));
      removedItemNodeIds.add(n.nodeId);

      outgoing.forEach((cons) => {
        addedEdges.push({
          kind: 'item',
          source: producer.source,
          target: cons.target,
          itemKey: cons.itemKey,
          amount: cons.amount,
          ...(cons.recovery ? { recovery: true } : {}),
        });
      });
    });

    const mergeEdgeKey = (e: EdgeDraft) =>
      e.kind === 'item'
        ? `${e.source}->${e.target}:i:${itemKeyHash(e.itemKey)}:${e.recovery ? 'r' : 'n'}`
        : `${e.source}->${e.target}:f:${e.fluidId}:${e.unit ?? ''}`;

    const merged = new Map<string, ProductionLineEdge>();
    const addMerged = (e: EdgeDraft) => {
      const k = mergeEdgeKey(e);
      const prev = merged.get(k);
      if (!prev) {
        merged.set(k, { ...(e as ProductionLineEdge), id: `e:${k}` });
        return;
      }
      prev.amount += e.amount;
    };

    edges
      .filter((e) => !removeEdgeIds.has(e.id))
      .filter((e) => !removedItemNodeIds.has(e.source) && !removedItemNodeIds.has(e.target))
      .forEach((e) => {
        if (e.kind === 'item') {
          addMerged({
            kind: 'item',
            source: e.source,
            target: e.target,
            itemKey: e.itemKey,
            amount: e.amount,
            ...(e.recovery ? { recovery: true } : {}),
          });
        } else {
          addMerged({
            kind: 'fluid',
            source: e.source,
            target: e.target,
            fluidId: e.fluidId,
            ...(e.unit ? { unit: e.unit } : {}),
            amount: e.amount,
          });
        }
      });
    addedEdges.forEach((e) => addMerged(e));

    edges = Array.from(merged.values());
    nodes = nodes.filter((n) => !removedItemNodeIds.has(n.nodeId));

    const amountByFinalNodeId = new Map<string, number>();
    edges.forEach((e) => {
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

    nodes = nodes.map((n) => {
      if (n.kind === 'item') return { ...n, amount: amountByFinalNodeId.get(n.nodeId) ?? 0 };
      if (n.kind === 'fluid') return { ...n, amount: amountByFinalNodeId.get(n.nodeId) ?? 0 };
      return n;
    });
  }

  return { nodes, edges };
}
