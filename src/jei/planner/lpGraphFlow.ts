import { itemKeyHash } from 'src/jei/indexing/key';
import type { ItemId, ItemKey } from 'src/jei/types';
import type { LpFlowData } from './types';

export type LpGraphFlowNode =
  | {
      kind: 'item';
      nodeId: string;
      itemKey: ItemKey;
      amountPerSecond: number;
      machineItemId?: ItemId;
      machineName?: string;
      machineCount?: number;
      power?: number;
    }
  | {
      kind: 'fluid';
      nodeId: string;
      id: string;
      unit?: string;
      amountPerSecond: number;
    };

export type LpGraphFlowEdge =
  | {
      kind: 'item';
      id: string;
      source: string;
      target: string;
      itemKey: ItemKey;
      amountPerSecond: number;
    }
  | {
      kind: 'fluid';
      id: string;
      source: string;
      target: string;
      fluidId: string;
      unit?: string;
      amountPerSecond: number;
    };

type LpGraphFlowEdgeInput =
  | {
      kind: 'item';
      source: string;
      target: string;
      itemKey: ItemKey;
      amountPerSecond: number;
    }
  | {
      kind: 'fluid';
      source: string;
      target: string;
      fluidId: string;
      unit?: string;
      amountPerSecond: number;
    };

type ItemTotals = {
  key: ItemKey;
  produced: number;
  consumed: number;
  external: number;
  unproduceable: number;
  target: number;
  surplus: number;
};

type ProviderChunk = {
  nodeId: string;
  amountPerSecond: number;
};

type ConsumerChunk = {
  nodeId: string;
  amountPerSecond: number;
};

export function buildLpGraphFlowModel(args: { flow: LpFlowData; includeFluids?: boolean }): {
  nodes: LpGraphFlowNode[];
  edges: LpGraphFlowEdge[];
} {
  const includeFluids = args.includeFluids !== false;
  const EPS = 1e-12;

  const itemTotalsByHash = new Map<string, ItemTotals>();
  const fluidTotalsByKey = new Map<
    string,
    { id: string; unit?: string; produced: number; consumed: number }
  >();
  const nodeById = new Map<string, LpGraphFlowNode>();
  const edgeById = new Map<string, LpGraphFlowEdge>();
  const providersByHash = new Map<string, ProviderChunk[]>();
  const consumersByHash = new Map<string, ConsumerChunk[]>();

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

  const ensureFluidTotals = (id: string, unit?: string) => {
    const key = unit ? `${id}:${unit}` : id;
    const prev = fluidTotalsByKey.get(key);
    if (prev) return { key, totals: prev };
    const next = { id, ...(unit ? { unit } : {}), produced: 0, consumed: 0 };
    fluidTotalsByKey.set(key, next);
    return { key, totals: next };
  };

  const pushProvider = (hash: string, chunk: ProviderChunk) => {
    const list = providersByHash.get(hash) ?? [];
    list.push(chunk);
    providersByHash.set(hash, list);
  };

  const pushConsumer = (hash: string, chunk: ConsumerChunk) => {
    const list = consumersByHash.get(hash) ?? [];
    list.push(chunk);
    consumersByHash.set(hash, list);
  };

  const addEdge = (edge: LpGraphFlowEdgeInput) => {
    const id =
      edge.kind === 'item'
        ? `lge:${edge.source}->${edge.target}:i:${itemKeyHash(edge.itemKey)}`
        : `lge:${edge.source}->${edge.target}:f:${edge.fluidId}:${edge.unit ?? ''}`;
    const prev = edgeById.get(id);
    if (!prev) {
      edgeById.set(id, { ...edge, id } as LpGraphFlowEdge);
      return;
    }
    prev.amountPerSecond += edge.amountPerSecond;
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

  const usedOutputByRecipeAndHash = new Map<string, number>();
  args.flow.recipes.forEach((recipe) => {
    recipe.outputItems.forEach((output) => {
      const hash = itemKeyHash(output.key);
      const totals = itemTotalsByHash.get(hash);
      const totalProduced = totals?.produced ?? 0;
      const totalUsed = Math.max(0, totalProduced - (totals?.surplus ?? 0));
      const usedRatio = totalProduced > EPS ? totalUsed / totalProduced : 0;
      usedOutputByRecipeAndHash.set(
        `${recipe.recipeId}|${hash}`,
        Math.min(output.amountPerSecond, output.amountPerSecond * usedRatio),
      );
    });
  });

  args.flow.recipes.forEach((recipe) => {
    const usedOutputs = recipe.outputItems
      .map((output) => ({
        key: output.key,
        producedPerSecond: output.amountPerSecond,
        usedPerSecond:
          usedOutputByRecipeAndHash.get(`${recipe.recipeId}|${itemKeyHash(output.key)}`) ?? 0,
      }))
      .filter((output) => output.usedPerSecond > EPS || output.producedPerSecond > EPS);

    const visibleOutputs = usedOutputs.filter((output) => output.producedPerSecond > EPS);
    const totalVisibleOutputs = visibleOutputs.reduce(
      (sum, output) => sum + output.producedPerSecond,
      0,
    );

    usedOutputs.forEach((output) => {
      const hash = itemKeyHash(output.key);
      const nodeId = `lgn:item:${recipe.recipeId}:${hash}`;
      nodeById.set(nodeId, {
        kind: 'item',
        nodeId,
        itemKey: output.key,
        amountPerSecond: output.producedPerSecond,
        ...(recipe.machineId ? { machineItemId: recipe.machineId } : {}),
        ...(recipe.machineName ? { machineName: recipe.machineName } : {}),
        ...(recipe.machineCount !== undefined ? { machineCount: recipe.machineCount } : {}),
        ...(recipe.power !== undefined ? { power: recipe.power } : {}),
      });
      if (output.usedPerSecond > EPS) {
        pushProvider(hash, { nodeId, amountPerSecond: output.usedPerSecond });
      }
    });

    if (totalVisibleOutputs <= EPS) return;

    recipe.inputItems.forEach((input) => {
      const hash = itemKeyHash(input.key);
      visibleOutputs.forEach((output) => {
        const consumerNodeId = `lgn:item:${recipe.recipeId}:${itemKeyHash(output.key)}`;
        const amountPerSecond =
          input.amountPerSecond * (output.producedPerSecond / totalVisibleOutputs);
        if (amountPerSecond <= EPS) return;
        pushConsumer(hash, { nodeId: consumerNodeId, amountPerSecond });
      });
    });

    if (includeFluids) {
      recipe.inputFluids.forEach((input) => {
        const fluidNodeId = `lgn:fluid:${input.unit ? `${input.id}:${input.unit}` : input.id}`;
        visibleOutputs.forEach((output) => {
          const consumerNodeId = `lgn:item:${recipe.recipeId}:${itemKeyHash(output.key)}`;
          const amountPerSecond =
            input.amountPerSecond * (output.producedPerSecond / totalVisibleOutputs);
          if (amountPerSecond <= EPS) return;
          addEdge({
            kind: 'fluid',
            source: consumerNodeId,
            target: fluidNodeId,
            fluidId: input.id,
            ...(input.unit ? { unit: input.unit } : {}),
            amountPerSecond,
          });
        });
      });
    }
  });

  itemTotalsByHash.forEach((totals, hash) => {
    const suppliedPerSecond = totals.external + totals.unproduceable;
    if (suppliedPerSecond <= EPS) return;
    const nodeId = `lgn:raw:${hash}`;
    nodeById.set(nodeId, {
      kind: 'item',
      nodeId,
      itemKey: totals.key,
      amountPerSecond: suppliedPerSecond,
    });
    pushProvider(hash, { nodeId, amountPerSecond: suppliedPerSecond });
  });

  if (includeFluids) {
    fluidTotalsByKey.forEach((totals, key) => {
      const amountPerSecond = Math.max(totals.produced, totals.consumed);
      if (amountPerSecond <= EPS) return;
      nodeById.set(`lgn:fluid:${key}`, {
        kind: 'fluid',
        nodeId: `lgn:fluid:${key}`,
        id: totals.id,
        ...(totals.unit ? { unit: totals.unit } : {}),
        amountPerSecond,
      });
    });
  }

  consumersByHash.forEach((consumers, hash) => {
    const providers = (providersByHash.get(hash) ?? [])
      .map((chunk) => ({ ...chunk }))
      .sort((a, b) => a.nodeId.localeCompare(b.nodeId));
    const consumersSorted = consumers
      .map((chunk) => ({ ...chunk }))
      .sort((a, b) => a.nodeId.localeCompare(b.nodeId));
    const key = itemTotalsByHash.get(hash)?.key;
    if (!key) return;

    let providerIdx = 0;
    let consumerIdx = 0;
    while (providerIdx < providers.length && consumerIdx < consumersSorted.length) {
      const provider = providers[providerIdx]!;
      const consumer = consumersSorted[consumerIdx]!;
      const amountPerSecond = Math.min(provider.amountPerSecond, consumer.amountPerSecond);
      if (amountPerSecond > EPS) {
        addEdge({
          kind: 'item',
          source: consumer.nodeId,
          target: provider.nodeId,
          itemKey: key,
          amountPerSecond,
        });
      }
      provider.amountPerSecond -= amountPerSecond;
      consumer.amountPerSecond -= amountPerSecond;
      if (provider.amountPerSecond <= EPS) providerIdx += 1;
      if (consumer.amountPerSecond <= EPS) consumerIdx += 1;
    }
  });

  return {
    nodes: Array.from(nodeById.values()),
    edges: Array.from(edgeById.values()),
  };
}
