import type { ItemKey } from 'src/jei/types';
import { itemKeyHash } from 'src/jei/indexing/key';
import type { EnhancedRequirementNode, RequirementNode } from './planner';

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

function finiteOr(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function buildQuantFlowModel(args: {
  root: AnyNode;
  rootItemKey?: ItemKey;
  includeFluids?: boolean;
}): { nodes: QuantFlowNode[]; edges: QuantFlowEdge[] } {
  const includeFluids = args.includeFluids !== false;
  const rootItemKey = args.rootItemKey ?? (args.root.kind === 'item' ? args.root.itemKey : undefined);
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

  const nodeMachineMeta = (
    node: Extract<AnyNode, { kind: 'item' }>,
  ): { machineItemId?: string; machineName?: string; machineCount?: number } => {
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
      Number.isFinite(machineCountRaw) && machineCountRaw > 0
        ? machineCountRaw
        : undefined;
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
        ...(!node.recovery && rootHash === itemKeyHash(node.itemKey) ? { isRoot: true } : {}),
      });
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
        ? `${edge.source}->${edge.target}:i:${itemKeyHash(edge.itemKey)}`
        : `${edge.source}->${edge.target}:f:${edge.fluidId}:${edge.unit ?? ''}`;
    const prev = edgeByKey.get(key);
    if (!prev) {
      edgeByKey.set(key, { ...edge, id: `qe:${key}` } as QuantFlowEdge);
      return;
    }
    prev.amount += edge.amount;
    const machineCount = finiteOr(edge.machineCount, 0);
    if (machineCount > 0) {
      const prevMachineCount = finiteOr(
        (prev as { machineCount?: unknown }).machineCount,
        0,
      );
      (prev as { machineCount?: number }).machineCount = prevMachineCount + machineCount;
    }
    if ('machineItemId' in edge && edge.machineItemId && !('machineItemId' in prev && prev.machineItemId)) {
      (prev as { machineItemId?: string }).machineItemId = edge.machineItemId;
    }
    if ('machineName' in edge && edge.machineName && !('machineName' in prev && prev.machineName)) {
      (prev as { machineName?: string }).machineName = edge.machineName;
    }
  };

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
            child.cycleSeed && cycleAmountNeeded > 0 ? cycleAmountNeeded : finiteOr(child.amount, 0);
          const machineMeta = nodeMachineMeta(node);
          addEdge({
            kind: 'item',
            source: childNode.nodeId,
            target: self.nodeId,
            itemKey: child.itemKey,
            amount,
            ...(child.recovery ? { recovery: true } : {}),
            ...(machineMeta.machineItemId ? { machineItemId: machineMeta.machineItemId } : {}),
            ...(machineMeta.machineName ? { machineName: machineMeta.machineName } : {}),
            ...(machineMeta.machineCount !== undefined
              ? { machineCount: machineMeta.machineCount }
              : {}),
          });
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
