import { describe, expect, it } from 'vitest';
import type { PackData, Recipe, RecipeTypeDef } from '../types';
import type { JeiIndex } from '../indexing/buildIndex';
import { itemKeyHash } from '../indexing/key';
import { buildRequirementTree, type RequirementNode } from './planner';

function createIndex(recipes: Recipe[], producing: Record<string, string[]>): JeiIndex {
  return {
    itemsByKeyHash: new Map(),
    itemKeyHashesByItemId: new Map(),
    recipeTypesByKey: new Map<string, RecipeTypeDef>([['t', { key: 't' } as unknown as RecipeTypeDef]]),
    recipesById: new Map<string, Recipe>(recipes.map((r) => [r.id, r])),
    producingByKeyHash: new Map<string, string[]>(
      Object.entries(producing).map(([itemId, recipeIds]) => [itemKeyHash({ id: itemId }), recipeIds]),
    ),
    consumingByKeyHash: new Map(),
    producingByItemId: new Map(),
    consumingByItemId: new Map(),
    itemIdsByTagId: new Map(),
    tagIdsByItemId: new Map(),
  };
}

function createPack(): PackData {
  return {
    manifest: { gameId: 'test' } as unknown as PackData['manifest'],
    items: [],
    recipeTypes: [],
    recipes: [],
  } as unknown as PackData;
}

function collectCycleNodes(root: RequirementNode): Array<Extract<RequirementNode, { kind: 'item' }>> {
  const nodes: Array<Extract<RequirementNode, { kind: 'item' }>> = [];
  const walk = (node: RequirementNode) => {
    if (node.kind !== 'item') return;
    if (node.cycle) nodes.push(node);
    node.children.forEach(walk);
  };
  walk(root);
  return nodes;
}

describe('planner recovery cycle handling', () => {
  it('reduces external cycle input when recovery is enabled', () => {
    const recipes: Recipe[] = [
      {
        id: 'rA',
        type: 't',
        slotContents: {
          out: { kind: 'item', id: 'A', amount: 1 },
          in: { kind: 'item', id: 'B', amount: 1 },
        },
      } as unknown as Recipe,
      {
        id: 'rB',
        type: 't',
        slotContents: {
          out: { kind: 'item', id: 'B', amount: 1 },
          in1: { kind: 'item', id: 'A', amount: 2 },
          in2: { kind: 'item', id: 'R', amount: 1 },
        },
      } as unknown as Recipe,
    ];
    const index = createIndex(recipes, { A: ['rA'], B: ['rB'] });
    const pack = createPack();

    const baseArgs = {
      pack,
      index,
      rootItemKey: { id: 'B' },
      targetAmount: 10,
      selectedRecipeIdByItemKeyHash: new Map<string, string>(),
      selectedItemIdByTagId: new Map<string, string>(),
    };

    const withoutRecovery = buildRequirementTree({
      ...baseArgs,
      useProductRecovery: false,
    });
    const withRecovery = buildRequirementTree({
      ...baseArgs,
      useProductRecovery: true,
    });

    expect(withoutRecovery.leafItemTotals.get('B')).toBeCloseTo(20, 8);
    expect(withRecovery.leafItemTotals.get('B')).toBeCloseTo(10, 8);
    // External non-cyclic ingredient still comes from normal upstream expansion.
    expect(withRecovery.leafItemTotals.get('R')).toBeCloseTo(10, 8);
  });

  it('keeps growth-cycle seed behavior unchanged when recovery is enabled', () => {
    const recipes: Recipe[] = [
      {
        id: 'rA',
        type: 't',
        slotContents: {
          out: { kind: 'item', id: 'A', amount: 2 },
          in: { kind: 'item', id: 'B', amount: 1 },
        },
      } as unknown as Recipe,
      {
        id: 'rB',
        type: 't',
        slotContents: {
          out: { kind: 'item', id: 'B', amount: 1 },
          in: { kind: 'item', id: 'A', amount: 1 },
        },
      } as unknown as Recipe,
    ];
    const index = createIndex(recipes, { A: ['rA'], B: ['rB'] });
    const pack = createPack();

    const result = buildRequirementTree({
      pack,
      index,
      rootItemKey: { id: 'B' },
      targetAmount: 10,
      selectedRecipeIdByItemKeyHash: new Map<string, string>(),
      selectedItemIdByTagId: new Map<string, string>(),
      useProductRecovery: true,
    });

    const cycles = collectCycleNodes(result.root);
    expect(cycles.length).toBeGreaterThan(0);
    const seedNode = cycles[0]!;
    expect(seedNode.cycleSeed).toBe(true);
    expect(seedNode.amount).toBeCloseTo(1, 8);
  });

  it('applies recovery from upstream multi-output recipes to downstream inputs', () => {
    const recipes: Recipe[] = [
      {
        id: 'rLiquid',
        type: 't',
        slotContents: {
          in1: { kind: 'item', id: 'B', amount: 1 },
          in2: { kind: 'item', id: 'G', amount: 1 },
          out1: { kind: 'item', id: 'A', amount: 1 },
          out2: { kind: 'item', id: 'Y', amount: 1 },
        },
      } as unknown as Recipe,
      {
        id: 'rDock',
        type: 't',
        slotContents: {
          in1: { kind: 'item', id: 'A', amount: 2 },
          in2: { kind: 'item', id: 'X', amount: 1 },
          out1: { kind: 'item', id: 'C', amount: 1 },
          out2: { kind: 'item', id: 'B', amount: 1 },
        },
      } as unknown as Recipe,
    ];
    const index = createIndex(recipes, { A: ['rLiquid'], C: ['rDock'] });
    const pack = createPack();

    const baseArgs = {
      pack,
      index,
      rootItemKey: { id: 'C' },
      targetAmount: 10,
      selectedRecipeIdByItemKeyHash: new Map<string, string>(),
      selectedItemIdByTagId: new Map<string, string>(),
    };

    const withoutRecovery = buildRequirementTree({
      ...baseArgs,
      useProductRecovery: false,
    });
    const withRecovery = buildRequirementTree({
      ...baseArgs,
      useProductRecovery: true,
    });

    // Gross B needed = 20 (for rLiquid runs), dock byproduct recovers 10 -> net 10.
    expect(withoutRecovery.leafItemTotals.get('B')).toBeCloseTo(20, 8);
    expect(withRecovery.leafItemTotals.get('B')).toBeCloseTo(10, 8);
    // Non-recovered inputs stay unchanged.
    expect(withRecovery.leafItemTotals.get('G')).toBeCloseTo(20, 8);
    expect(withRecovery.leafItemTotals.get('X')).toBeCloseTo(10, 8);
  });
});
