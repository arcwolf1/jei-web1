import { itemKeyHash } from 'src/jei/indexing/key';
import type { ItemKey } from 'src/jei/types';
import type { LpFlowData } from './types';
import type { ProductionLineEdge, ProductionLineNode } from './productionLine';
import { collapseProductionLineIntermediateItems } from './productionLine';

function finiteOr(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toPerMinute(amountPerSecond: number): number {
  return finiteOr(amountPerSecond, 0) * 60;
}

type ItemTotals = {
  key: ItemKey;
  produced: number;
  consumed: number;
  external: number;
  unproduceable: number;
  target: number;
  surplus: number;
};

type OutputContribution = {
  recipeId: string;
  key: ItemKey;
  amountPerSecond: number;
  ordinal: number;
};

export function buildLpProductionLineModel(args: {
  flow: LpFlowData;
  collapseIntermediateItems?: boolean;
}): { nodes: ProductionLineNode[]; edges: ProductionLineEdge[] } {
  const itemTotalsByHash = new Map<string, ItemTotals>();
  const outputContribsByHash = new Map<string, OutputContribution[]>();
  const fluidTotalsByKey = new Map<string, { id: string; unit?: string; produced: number; consumed: number }>();

  const ensureItemTotals = (key: ItemKey): ItemTotals => {
    const hash = itemKeyHash(key);
    const prev = itemTotalsByHash.get(hash);
    if (prev) return prev;
    const next: ItemTotals = {
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

  const addFluid = (id: string, unit: string | undefined, field: 'produced' | 'consumed', amount: number) => {
    const key = unit ? `${id}:${unit}` : id;
    const prev = fluidTotalsByKey.get(key) ?? { id, ...(unit ? { unit } : {}), produced: 0, consumed: 0 };
    prev[field] += amount;
    fluidTotalsByKey.set(key, prev);
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

  args.flow.recipes.forEach((recipe, recipeOrdinal) => {
    recipe.inputItems.forEach(({ key, amountPerSecond }) => {
      ensureItemTotals(key).consumed += amountPerSecond;
    });
    recipe.outputItems.forEach(({ key, amountPerSecond }) => {
      ensureItemTotals(key).produced += amountPerSecond;
      const hash = itemKeyHash(key);
      const bucket = outputContribsByHash.get(hash) ?? [];
      bucket.push({
        recipeId: recipe.recipeId,
        key,
        amountPerSecond,
        ordinal: recipeOrdinal,
      });
      outputContribsByHash.set(hash, bucket);
    });
    recipe.inputFluids.forEach(({ id, unit, amountPerSecond }) =>
      addFluid(id, unit, 'consumed', amountPerSecond),
    );
    recipe.outputFluids.forEach(({ id, unit, amountPerSecond }) =>
      addFluid(id, unit, 'produced', amountPerSecond),
    );
  });

  const outputAllocByRecipeAndHash = new Map<string, { key: ItemKey; used: number; surplus: number }>();
  outputContribsByHash.forEach((contribs, hash) => {
    const totalProduced = contribs.reduce((sum, entry) => sum + entry.amountPerSecond, 0);
    const totalSurplus = Math.max(0, itemTotalsByHash.get(hash)?.surplus ?? 0);
    let remainingUsed = Math.max(0, totalProduced - totalSurplus);

    contribs
      .slice()
      .sort((a, b) => a.ordinal - b.ordinal || a.recipeId.localeCompare(b.recipeId))
      .forEach((entry) => {
        const used = Math.min(entry.amountPerSecond, remainingUsed);
        const surplus = Math.max(0, entry.amountPerSecond - used);
        remainingUsed -= used;
        outputAllocByRecipeAndHash.set(`${entry.recipeId}|${hash}`, {
          key: entry.key,
          used,
          surplus,
        });
      });
  });

  const nodes: ProductionLineNode[] = [];
  const edgesByKey = new Map<string, ProductionLineEdge>();

  const addEdge = (edge: Omit<Extract<ProductionLineEdge, { kind: 'item' }>, 'id'> | Omit<Extract<ProductionLineEdge, { kind: 'fluid' }>, 'id'>) => {
    const key =
      edge.kind === 'item'
        ? `${edge.source}->${edge.target}:i:${itemKeyHash(edge.itemKey)}:${edge.recovery ? 'r' : edge.surplus ? 's' : 'n'}`
        : `${edge.source}->${edge.target}:f:${edge.fluidId}:${edge.unit ?? ''}`;
    const prev = edgesByKey.get(key);
    if (!prev) {
      edgesByKey.set(key, { ...edge, id: `e:${key}` } as ProductionLineEdge);
      return;
    }
    prev.amount += edge.amount;
  };

  const baseItemNodeIdByHash = new Map<string, string>();
  const surplusItemNodeIdByHash = new Map<string, string>();
  itemTotalsByHash.forEach((totals, hash) => {
    const usedProduced = Math.max(0, totals.produced - totals.surplus);
    const totalSupply = usedProduced + totals.external + totals.unproduceable;
    const baseAmount = Math.max(totalSupply, totals.consumed, totals.target);
    if (baseAmount > 1e-9) {
      const nodeId = `i:base:${hash}`;
      baseItemNodeIdByHash.set(hash, nodeId);
      nodes.push({
        kind: 'item',
        nodeId,
        itemKey: totals.key,
        amount: toPerMinute(baseAmount),
        ...(totals.target > 1e-9 ? { isRoot: true } : {}),
      });
    }
    if (totals.surplus > 1e-9) {
      const nodeId = `i:sur:${hash}`;
      surplusItemNodeIdByHash.set(hash, nodeId);
      nodes.push({
        kind: 'item',
        nodeId,
        itemKey: totals.key,
        amount: toPerMinute(totals.surplus),
        isSurplus: true,
      });
    }
  });

  fluidTotalsByKey.forEach((totals, key) => {
    nodes.push({
      kind: 'fluid',
      nodeId: `f:${key}`,
      id: totals.id,
      ...(totals.unit ? { unit: totals.unit } : {}),
      amount: toPerMinute(Math.max(totals.produced, totals.consumed)),
    });
  });

  args.flow.recipes.forEach((recipe) => {
    const outputItemKeys = recipe.outputItems.map((item) => item.key);
    const outputDetails = recipe.outputItems.map(({ key, amountPerSecond }) => {
      const hash = itemKeyHash(key);
      const allocation = outputAllocByRecipeAndHash.get(`${recipe.recipeId}|${hash}`);
      const used = allocation?.used ?? 0;
      const surplus = allocation?.surplus ?? 0;
      const machineCountOwn =
        amountPerSecond > 1e-12 ? recipe.machineCount * (used / amountPerSecond) : 0;
      return {
        key,
        demanded: toPerMinute(used),
        machineCountOwn,
        surplusRate: toPerMinute(surplus),
      };
    });
    nodes.push({
      kind: 'machine',
      nodeId: `m:${recipe.recipeId}`,
      recipeId: recipe.recipeId,
      recipeTypeKey: recipe.recipeTypeKey,
      outputItemKeys,
      outputDetails,
      amount: toPerMinute(
        recipe.outputItems.reduce((sum, item) => sum + item.amountPerSecond, 0)
        || recipe.outputFluids.reduce((sum, fluid) => sum + fluid.amountPerSecond, 0),
      ),
      ...(recipe.machineId ? { machineItemId: recipe.machineId } : {}),
      ...(recipe.machineName ? { machineName: recipe.machineName } : {}),
      machineCount: recipe.machineCount,
      machines: recipe.machineCount,
    });
  });

  args.flow.recipes.forEach((recipe) => {
    const machineId = `m:${recipe.recipeId}`;

    recipe.inputItems.forEach(({ key, amountPerSecond }) => {
      const hash = itemKeyHash(key);
      const source = baseItemNodeIdByHash.get(hash);
      if (!source || amountPerSecond <= 1e-9) return;
      addEdge({
        kind: 'item',
        source,
        target: machineId,
        itemKey: key,
        amount: toPerMinute(amountPerSecond),
      });
    });

    recipe.outputItems.forEach(({ key }) => {
      const hash = itemKeyHash(key);
      const allocation = outputAllocByRecipeAndHash.get(`${recipe.recipeId}|${hash}`);
      if (!allocation) return;
      if (allocation.used > 1e-9) {
        const target = baseItemNodeIdByHash.get(hash);
        if (target) {
          addEdge({
            kind: 'item',
            source: machineId,
            target,
            itemKey: key,
            amount: toPerMinute(allocation.used),
          });
        }
      }
      if (allocation.surplus > 1e-9) {
        const target = surplusItemNodeIdByHash.get(hash);
        if (target) {
          addEdge({
            kind: 'item',
            source: machineId,
            target,
            itemKey: key,
            amount: toPerMinute(allocation.surplus),
            surplus: true,
          });
        }
      }
    });

    recipe.inputFluids.forEach(({ id, unit, amountPerSecond }) => {
      if (amountPerSecond <= 1e-9) return;
      const source = `f:${unit ? `${id}:${unit}` : id}`;
      addEdge({
        kind: 'fluid',
        source,
        target: machineId,
        fluidId: id,
        ...(unit ? { unit } : {}),
        amount: toPerMinute(amountPerSecond),
      });
    });

    recipe.outputFluids.forEach(({ id, unit, amountPerSecond }) => {
      if (amountPerSecond <= 1e-9) return;
      const target = `f:${unit ? `${id}:${unit}` : id}`;
      addEdge({
        kind: 'fluid',
        source: machineId,
        target,
        fluidId: id,
        ...(unit ? { unit } : {}),
        amount: toPerMinute(amountPerSecond),
      });
    });
  });

  let model = { nodes, edges: Array.from(edgesByKey.values()) };
  if (args.collapseIntermediateItems) {
    model = collapseProductionLineIntermediateItems(model.nodes, model.edges);
  }
  return model;
}
