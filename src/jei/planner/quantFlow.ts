import type { ItemKey } from 'src/jei/types';
import { itemKeyHash } from 'src/jei/indexing/key';
import type { EnhancedRequirementNode, RequirementNode } from './planner';
import type { LpFlowData } from './types';

type AnyNode = RequirementNode | EnhancedRequirementNode;

export type QuantFlowNode =
  | {
      kind: 'item';
      nodeId: string;
      itemKey: ItemKey;
      amount: number;
      isRoot?: true;
      recovery?: true;
      machineItemId?: string;
      machineName?: string;
      machineCount?: number;
    }
  | {
      kind: 'fluid';
      nodeId: string;
      id: string;
      unit?: string;
      amount: number;
    };

export type QuantFlowEdge =
  | {
      kind: 'item';
      id: string;
      source: string;
      target: string;
      itemKey: ItemKey;
      amount: number;
      recovery?: true;
      recoveryFirstLeg?: true;
      machineItemId?: string;
      machineName?: string;
      machineCount?: number;
    }
  | {
      kind: 'fluid';
      id: string;
      source: string;
      target: string;
      fluidId: string;
      unit?: string;
      amount: number;
      machineItemId?: string;
      machineName?: string;
      machineCount?: number;
    };

type QuantFlowEdgeInput =
  | {
      kind: 'item';
      source: string;
      target: string;
      itemKey: ItemKey;
      amount: number;
      recovery?: true;
      recoveryFirstLeg?: true;
      machineItemId?: string;
      machineName?: string;
      machineCount?: number;
    }
  | {
      kind: 'fluid';
      source: string;
      target: string;
      fluidId: string;
      unit?: string;
      amount: number;
      machineItemId?: string;
      machineName?: string;
      machineCount?: number;
    };

type MachineMeta = {
  machineItemId?: string;
  machineName?: string;
  machineCount?: number;
};

function finiteOr(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toPerMinute(amountPerSecond: number): number {
  return finiteOr(amountPerSecond, 0) * 60;
}

type LpQuantItemTotals = {
  key: ItemKey;
  produced: number;
  consumed: number;
  external: number;
  unproduceable: number;
  target: number;
  surplus: number;
};

export function buildLpQuantFlowModel(args: { flow: LpFlowData; includeFluids?: boolean }): {
  nodes: QuantFlowNode[];
  edges: QuantFlowEdge[];
} {
  const includeFluids = args.includeFluids !== false;
  const itemTotalsByHash = new Map<string, LpQuantItemTotals>();
  const fluidTotalsByKey = new Map<
    string,
    { id: string; unit?: string; produced: number; consumed: number }
  >();
  const edgeByKey = new Map<string, QuantFlowEdge>();
  const EPS = 1e-12;

  const ensureItemTotals = (key: ItemKey): LpQuantItemTotals => {
    const hash = itemKeyHash(key);
    const prev = itemTotalsByHash.get(hash);
    if (prev) return prev;
    const next: LpQuantItemTotals = {
      key,
      produced: 0,
      consumed: 0,
      external: 0,
      unproduceable: 0,
      target: 0,
      surplus: 0,
    };
    itemTotalsByHash.set(hash, next);
    return next;
  };

  const ensureFluidTotals = (id: string, unit?: string) => {
    const key = unit ? `${id}:${unit}` : id;
    const prev = fluidTotalsByKey.get(key);
    if (prev) return { key, totals: prev };
    const next = { id, ...(unit ? { unit } : {}), produced: 0, consumed: 0 };
    fluidTotalsByKey.set(key, next);
    return { key, totals: next };
  };

  const addEdge = (edge: QuantFlowEdgeInput) => {
    const key =
      edge.kind === 'item'
        ? `${edge.source}->${edge.target}:i:${itemKeyHash(edge.itemKey)}:${edge.recoveryFirstLeg ? 'fl' : edge.recovery ? 'r' : 'n'}`
        : `${edge.source}->${edge.target}:f:${edge.fluidId}:${edge.unit ?? ''}`;
    const prev = edgeByKey.get(key);
    if (!prev) {
      edgeByKey.set(key, { ...edge, id: `qe:${key}` } as QuantFlowEdge);
      return;
    }
    prev.amount += edge.amount;
    if (edge.machineCount !== undefined) {
      const prevMachineCount = finiteOr((prev as { machineCount?: unknown }).machineCount, 0);
      (prev as { machineCount?: number }).machineCount = prevMachineCount + edge.machineCount;
    }
    if (
      'machineItemId' in edge &&
      edge.machineItemId &&
      !('machineItemId' in prev && prev.machineItemId)
    ) {
      (prev as { machineItemId?: string }).machineItemId = edge.machineItemId;
    }
    if ('machineName' in edge && edge.machineName && !('machineName' in prev && prev.machineName)) {
      (prev as { machineName?: string }).machineName = edge.machineName;
    }
  };

  args.flow.targets.forEach(({ key, amountPerSecond }) => {
    ensureItemTotals(key).target += amountPerSecond;
  });
  args.flow.externalInputs.forEach(({ key, amountPerSecond }) => {
    ensureItemTotals(key).external += amountPerSecond;
  });
  args.flow.unproduceableInputs.forEach(({ key, amountPerSecond }) => {
    ensureItemTotals(key).unproduceable += amountPerSecond;
  });
  args.flow.surpluses.forEach(({ key, amountPerSecond }) => {
    ensureItemTotals(key).surplus += amountPerSecond;
  });

  args.flow.recipes.forEach((recipe) => {
    recipe.inputItems.forEach(({ key, amountPerSecond }) => {
      ensureItemTotals(key).consumed += amountPerSecond;
    });
    recipe.outputItems.forEach(({ key, amountPerSecond }) => {
      ensureItemTotals(key).produced += amountPerSecond;
    });
    recipe.inputFluids.forEach(({ id, unit, amountPerSecond }) => {
      ensureFluidTotals(id, unit).totals.consumed += amountPerSecond;
    });
    recipe.outputFluids.forEach(({ id, unit, amountPerSecond }) => {
      ensureFluidTotals(id, unit).totals.produced += amountPerSecond;
    });
  });

  const nodes: QuantFlowNode[] = [];
  itemTotalsByHash.forEach((totals, hash) => {
    const amount = Math.max(
      totals.produced + totals.external + totals.unproduceable,
      totals.consumed,
      totals.target,
      totals.surplus,
    );
    if (amount <= EPS) return;
    nodes.push({
      kind: 'item',
      nodeId: `qi:base:${hash}`,
      itemKey: totals.key,
      amount: toPerMinute(amount),
      ...(totals.target > EPS ? { isRoot: true } : {}),
    });
  });

  if (includeFluids) {
    fluidTotalsByKey.forEach((totals, key) => {
      const amount = Math.max(totals.produced, totals.consumed);
      if (amount <= EPS) return;
      nodes.push({
        kind: 'fluid',
        nodeId: `qf:${key}`,
        id: totals.id,
        ...(totals.unit ? { unit: totals.unit } : {}),
        amount: toPerMinute(amount),
      });
    });
  }

  args.flow.recipes.forEach((recipe) => {
    const visibleOutputs = recipe.outputItems
      .map((output) => ({
        key: output.key,
        amountPerSecond: output.amountPerSecond,
      }))
      .filter((output) => output.amountPerSecond > EPS);
    const totalVisibleOutputs = visibleOutputs.reduce(
      (sum, output) => sum + output.amountPerSecond,
      0,
    );
    if (totalVisibleOutputs <= EPS) return;

    recipe.inputItems.forEach((input) => {
      const sourceId = `qi:base:${itemKeyHash(input.key)}`;
      visibleOutputs.forEach((output) => {
        const targetId = `qi:base:${itemKeyHash(output.key)}`;
        const amount = input.amountPerSecond * (output.amountPerSecond / totalVisibleOutputs);
        if (amount <= EPS) return;
        addEdge({
          kind: 'item',
          source: sourceId,
          target: targetId,
          itemKey: input.key,
          amount: toPerMinute(amount),
          ...(recipe.machineId ? { machineItemId: recipe.machineId } : {}),
          ...(recipe.machineName ? { machineName: recipe.machineName } : {}),
          ...(recipe.machineCount !== undefined ? { machineCount: recipe.machineCount } : {}),
        });
      });
    });

    if (includeFluids) {
      recipe.inputFluids.forEach((input) => {
        const sourceId = `qf:${input.unit ? `${input.id}:${input.unit}` : input.id}`;
        visibleOutputs.forEach((output) => {
          const targetId = `qi:base:${itemKeyHash(output.key)}`;
          const amount = input.amountPerSecond * (output.amountPerSecond / totalVisibleOutputs);
          if (amount <= EPS) return;
          addEdge({
            kind: 'fluid',
            source: sourceId,
            target: targetId,
            fluidId: input.id,
            ...(input.unit ? { unit: input.unit } : {}),
            amount: toPerMinute(amount),
            ...(recipe.machineId ? { machineItemId: recipe.machineId } : {}),
            ...(recipe.machineName ? { machineName: recipe.machineName } : {}),
            ...(recipe.machineCount !== undefined ? { machineCount: recipe.machineCount } : {}),
          });
        });
      });
    }
  });

  return { nodes, edges: Array.from(edgeByKey.values()) };
}

export function buildQuantFlowModel(args: {
  root: AnyNode;
  rootItemKey?: ItemKey;
  includeFluids?: boolean;
}): { nodes: QuantFlowNode[]; edges: QuantFlowEdge[] } {
  const includeFluids = args.includeFluids !== false;
  const rootItemKey =
    args.rootItemKey ?? (args.root.kind === 'item' ? args.root.itemKey : undefined);
  const rootHash = rootItemKey ? itemKeyHash(rootItemKey) : null;

  const itemByNodeKey = new Map<
    string,
    {
      itemKey: ItemKey;
      amount: number;
      isRoot?: true;
      recovery?: true;
      machineItemId?: string;
      machineName?: string;
      machineCount?: number;
    }
  >();
  const fluidByNodeKey = new Map<string, { id: string; unit?: string; amount: number }>();
  const edgeByKey = new Map<string, QuantFlowEdge>();

  const itemNodeKey = (node: Extract<AnyNode, { kind: 'item' }>) => {
    const h = itemKeyHash(node.itemKey);
    return `base:${h}`;
  };

  const nodeMachineMeta = (node: Extract<AnyNode, { kind: 'item' }>): MachineMeta => {
    const machineItemId =
      typeof (node as { machineItemId?: unknown }).machineItemId === 'string'
        ? (node as { machineItemId?: string }).machineItemId
        : undefined;
    const machineName =
      typeof (node as { machineName?: unknown }).machineName === 'string'
        ? (node as { machineName?: string }).machineName
        : undefined;
    const machineCountRaw = finiteOr(
      (node as { machineCount?: unknown }).machineCount,
      finiteOr((node as { machines?: unknown }).machines, 0),
    );
    const machineCount =
      Number.isFinite(machineCountRaw) && machineCountRaw > 0 ? machineCountRaw : undefined;
    return {
      ...(machineItemId ? { machineItemId } : {}),
      ...(machineName ? { machineName } : {}),
      ...(machineCount !== undefined ? { machineCount } : {}),
    };
  };

  const ensureItem = (node: Extract<AnyNode, { kind: 'item' }>) => {
    const key = itemNodeKey(node);
    const nodeId = `qi:${key}`;
    const prev = itemByNodeKey.get(key);
    if (!prev) {
      itemByNodeKey.set(key, {
        itemKey: node.itemKey,
        amount: 0,
        ...(node.recovery ? { recovery: true } : {}),
        ...(!node.recovery && rootHash === itemKeyHash(node.itemKey) ? { isRoot: true } : {}),
      });
    } else if (node.recovery) {
      prev.recovery = true;
    }
    return { key, nodeId };
  };

  const ensureFluid = (id: string, unit?: string) => {
    const key = unit ? `${id}:${unit}` : id;
    const nodeId = `qf:${key}`;
    const prev = fluidByNodeKey.get(key);
    if (!prev) fluidByNodeKey.set(key, { id, ...(unit ? { unit } : {}), amount: 0 });
    return { key, nodeId };
  };

  const addEdge = (edge: QuantFlowEdgeInput) => {
    const key =
      edge.kind === 'item'
        ? `${edge.source}->${edge.target}:i:${itemKeyHash(edge.itemKey)}:${edge.recoveryFirstLeg ? 'fl' : edge.recovery ? 'r' : 'n'}`
        : `${edge.source}->${edge.target}:f:${edge.fluidId}:${edge.unit ?? ''}`;
    const prev = edgeByKey.get(key);
    if (!prev) {
      edgeByKey.set(key, { ...edge, id: `qe:${key}` } as QuantFlowEdge);
      return;
    }
    prev.amount += edge.amount;
    if (edge.kind === 'item' && edge.recovery) {
      (prev as { recovery?: true }).recovery = true;
    }
    const machineCount = finiteOr(edge.machineCount, 0);
    if (machineCount > 0) {
      const prevMachineCount = finiteOr((prev as { machineCount?: unknown }).machineCount, 0);
      (prev as { machineCount?: number }).machineCount = prevMachineCount + machineCount;
    }
    if (
      'machineItemId' in edge &&
      edge.machineItemId &&
      !('machineItemId' in prev && prev.machineItemId)
    ) {
      (prev as { machineItemId?: string }).machineItemId = edge.machineItemId;
    }
    if ('machineName' in edge && edge.machineName && !('machineName' in prev && prev.machineName)) {
      (prev as { machineName?: string }).machineName = edge.machineName;
    }
  };

  const recoverySourceKey = (recipeId: string, sourceItemKey: ItemKey, recipeTypeKey?: string) =>
    `${recipeId}|${itemKeyHash(sourceItemKey)}|${recipeTypeKey ?? ''}`;
  const sourceNodeIdsByRecoveryKey = new Map<string, string[]>();
  const sourceQuantNodeIdByPlannerNodeId = new Map<string, string>();
  const sourcePlannerNodeIdByQuantNodeId = new Map<string, string>();
  const sourceMachineMetaByQuantNodeId = new Map<string, MachineMeta>();
  const incomingItemSourcesByPlannerNodeId = new Map<
    string,
    Array<{ sourceNodeId: string; amount: number }>
  >();
  const collectRecoverySources = (node: AnyNode) => {
    if (node.kind !== 'item') return;
    if (!node.recovery && node.recipeIdUsed) {
      const key = recoverySourceKey(node.recipeIdUsed, node.itemKey, node.recipeTypeKeyUsed);
      const sourceNodeId = `qi:${itemNodeKey(node)}`;
      sourceQuantNodeIdByPlannerNodeId.set(node.nodeId, sourceNodeId);
      sourcePlannerNodeIdByQuantNodeId.set(sourceNodeId, node.nodeId);
      const machineMeta = nodeMachineMeta(node);
      if (
        machineMeta.machineItemId ||
        machineMeta.machineName ||
        machineMeta.machineCount !== undefined
      ) {
        sourceMachineMetaByQuantNodeId.set(sourceNodeId, machineMeta);
      }
      const bucket = sourceNodeIdsByRecoveryKey.get(key) ?? [];
      if (!bucket.includes(sourceNodeId)) bucket.push(sourceNodeId);
      sourceNodeIdsByRecoveryKey.set(key, bucket);
    }
    node.children.forEach((child) => {
      if (child.kind === 'item') collectRecoverySources(child);
    });
  };
  collectRecoverySources(args.root);

  const walk = (node: AnyNode) => {
    if (node.kind === 'item') {
      const self = ensureItem(node);
      const selfAgg = itemByNodeKey.get(self.key);
      if (selfAgg) {
        selfAgg.amount += finiteOr(node.amount, 0);
        const machineMeta = nodeMachineMeta(node);
        if (machineMeta.machineItemId && !selfAgg.machineItemId) {
          selfAgg.machineItemId = machineMeta.machineItemId;
        }
        if (machineMeta.machineName && !selfAgg.machineName) {
          selfAgg.machineName = machineMeta.machineName;
        }
        if (machineMeta.machineCount !== undefined) {
          selfAgg.machineCount = finiteOr(selfAgg.machineCount, 0) + machineMeta.machineCount;
        }
      }

      node.children.forEach((child) => {
        if (child.kind === 'item') {
          const childNode = ensureItem(child);
          const cycleAmountNeeded = finiteOr(
            (child as unknown as { cycleAmountNeeded?: unknown }).cycleAmountNeeded,
            0,
          );
          const amount =
            child.cycleSeed && cycleAmountNeeded > 0
              ? cycleAmountNeeded
              : finiteOr(child.amount, 0);
          const machineMeta = nodeMachineMeta(node);
          addEdge({
            kind: 'item',
            source: childNode.nodeId,
            target: self.nodeId,
            itemKey: child.itemKey,
            amount,
            ...(machineMeta.machineItemId ? { machineItemId: machineMeta.machineItemId } : {}),
            ...(machineMeta.machineName ? { machineName: machineMeta.machineName } : {}),
            ...(machineMeta.machineCount !== undefined
              ? { machineCount: machineMeta.machineCount }
              : {}),
          });
          if (!child.recovery) {
            const incoming = incomingItemSourcesByPlannerNodeId.get(node.nodeId) ?? [];
            incoming.push({ sourceNodeId: childNode.nodeId, amount });
            incomingItemSourcesByPlannerNodeId.set(node.nodeId, incoming);
          }
          if (child.recovery && child.recoverySourceRecipeId && child.recoverySourceItemKey) {
            const sourcePlannerNodeId =
              typeof (child as { recoverySourceNodeId?: unknown }).recoverySourceNodeId === 'string'
                ? (child as { recoverySourceNodeId: string }).recoverySourceNodeId
                : '';
            const key = recoverySourceKey(
              child.recoverySourceRecipeId,
              child.recoverySourceItemKey,
              child.recoverySourceRecipeTypeKey,
            );
            const sourceCandidates = sourceNodeIdsByRecoveryKey.get(key) ?? [];
            const sourceFromPlanner = sourcePlannerNodeId
              ? sourceQuantNodeIdByPlannerNodeId.get(sourcePlannerNodeId)
              : undefined;
            const sourceNodeId =
              (sourceFromPlanner && sourceFromPlanner !== self.nodeId
                ? sourceFromPlanner
                : undefined) ?? sourceCandidates.find((id) => id !== self.nodeId);
            if (sourceNodeId && sourceNodeId !== self.nodeId) {
              const sourceMachineMeta = sourceMachineMetaByQuantNodeId.get(sourceNodeId);
              const sourceParentPlannerNodeId = sourcePlannerNodeIdByQuantNodeId.get(sourceNodeId);
              const incomingSources = sourceParentPlannerNodeId
                ? (incomingItemSourcesByPlannerNodeId.get(sourceParentPlannerNodeId) ?? [])
                : [];
              const firstLegSource = incomingSources
                .slice()
                .sort((a, b) => b.amount - a.amount)[0]?.sourceNodeId;
              if (firstLegSource && firstLegSource !== sourceNodeId) {
                addEdge({
                  kind: 'item',
                  source: firstLegSource,
                  target: sourceNodeId,
                  itemKey: child.itemKey,
                  amount,
                  recovery: true,
                  recoveryFirstLeg: true,
                });
              }
              addEdge({
                kind: 'item',
                source: sourceNodeId,
                target: childNode.nodeId,
                itemKey: child.itemKey,
                amount,
                recovery: true,
                ...(sourceMachineMeta?.machineItemId
                  ? { machineItemId: sourceMachineMeta.machineItemId }
                  : {}),
                ...(sourceMachineMeta?.machineName
                  ? { machineName: sourceMachineMeta.machineName }
                  : {}),
                ...(sourceMachineMeta?.machineCount !== undefined
                  ? { machineCount: sourceMachineMeta.machineCount }
                  : {}),
              });
            }
          }
        } else if (includeFluids) {
          const childFluid = ensureFluid(child.id, child.unit);
          const machineMeta = nodeMachineMeta(node);
          addEdge({
            kind: 'fluid',
            source: childFluid.nodeId,
            target: self.nodeId,
            fluidId: child.id,
            ...(child.unit ? { unit: child.unit } : {}),
            amount: finiteOr(child.amount, 0),
            ...(machineMeta.machineItemId ? { machineItemId: machineMeta.machineItemId } : {}),
            ...(machineMeta.machineName ? { machineName: machineMeta.machineName } : {}),
            ...(machineMeta.machineCount !== undefined
              ? { machineCount: machineMeta.machineCount }
              : {}),
          });
        }
      });
      node.children.forEach(walk);
      return;
    }

    if (!includeFluids) return;
    const fluid = ensureFluid(node.id, node.unit);
    const agg = fluidByNodeKey.get(fluid.key);
    if (agg) agg.amount += finiteOr(node.amount, 0);
  };

  walk(args.root);

  const nodes: QuantFlowNode[] = [];
  itemByNodeKey.forEach((v, key) => {
    nodes.push({
      kind: 'item',
      nodeId: `qi:${key}`,
      itemKey: v.itemKey,
      amount: v.amount,
      ...(v.isRoot ? { isRoot: true } : {}),
      ...(v.recovery ? { recovery: true } : {}),
      ...(v.machineItemId ? { machineItemId: v.machineItemId } : {}),
      ...(v.machineName ? { machineName: v.machineName } : {}),
      ...(v.machineCount !== undefined ? { machineCount: v.machineCount } : {}),
    });
  });
  if (includeFluids) {
    fluidByNodeKey.forEach((v, key) => {
      nodes.push({
        kind: 'fluid',
        nodeId: `qf:${key}`,
        id: v.id,
        ...(v.unit ? { unit: v.unit } : {}),
        amount: v.amount,
      });
    });
  }

  return { nodes, edges: Array.from(edgeByKey.values()) };
}
