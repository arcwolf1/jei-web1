import { describe, expect, it } from 'vitest';
import type { Recipe, RecipeTypeDef } from '../types';
import type { JeiIndex } from '../indexing/buildIndex';
import { itemKeyHash } from '../indexing/key';
import { normalizeRecipe } from './recipeAdapter';
import { buildMatrixState } from './matrixState';
import { rational } from './rational';
import { ObjectiveType, ObjectiveUnit } from './types';

function createIndex(recipes: Recipe[], producing: Record<string, string[]>): JeiIndex {
  return {
    itemsByKeyHash: new Map(),
    itemKeyHashesByItemId: new Map(),
    recipeTypesByKey: new Map<string, RecipeTypeDef>([
      [
        't',
        {
          key: 't',
          displayName: 'Test Machine',
          renderer: 'slot_layout',
        } as unknown as RecipeTypeDef,
      ],
    ]),
    recipesById: new Map<string, Recipe>(recipes.map((r) => [r.id, r])),
    producingByKeyHash: new Map<string, string[]>(
      Object.entries(producing).map(([itemId, recipeIds]) => [
        itemKeyHash({ id: itemId }),
        recipeIds,
      ]),
    ),
    consumingByKeyHash: new Map(),
    producingByItemId: new Map(),
    consumingByItemId: new Map(),
    itemIdsByTagId: new Map(),
    tagIdsByItemId: new Map(),
  };
}

describe('lp planner core', () => {
  it('nets self-loop item inputs and outputs before LP normalization', () => {
    const recipe: Recipe = {
      id: 'looped',
      type: 't',
      slotContents: {
        in1: { kind: 'item', id: 'A', amount: 2 },
        in2: { kind: 'item', id: 'B', amount: 1 },
        out1: { kind: 'item', id: 'A', amount: 5 },
        out2: { kind: 'item', id: 'C', amount: 1 },
      },
      params: { time: 2 },
    } as unknown as Recipe;

    const normalized = normalizeRecipe(recipe, undefined);

    expect(normalized.inputItems).toEqual([{ key: { id: 'B' }, amount: 1 }]);
    expect(normalized.outputItems).toEqual([
      { key: { id: 'A' }, amount: 3 },
      { key: { id: 'C' }, amount: 1 },
    ]);
    expect(normalized.inputByHash.has(itemKeyHash({ id: 'A' }))).toBe(false);
    expect(normalized.outputByHash.get(itemKeyHash({ id: 'A' }))).toBe(3);
  });

  it('defaults to one deterministic producer chain per item in LP mode', () => {
    const recipes: Recipe[] = [
      {
        id: 'rDirect',
        type: 't',
        slotContents: {
          in1: { kind: 'item', id: 'X', amount: 1 },
          out1: { kind: 'item', id: 'A', amount: 1 },
        },
      } as unknown as Recipe,
      {
        id: 'rRecycle',
        type: 't',
        slotContents: {
          in1: { kind: 'item', id: 'B', amount: 1 },
          out1: { kind: 'item', id: 'A', amount: 1 },
        },
      } as unknown as Recipe,
      {
        id: 'rB',
        type: 't',
        slotContents: {
          in1: { kind: 'item', id: 'Y', amount: 1 },
          out1: { kind: 'item', id: 'B', amount: 1 },
        },
      } as unknown as Recipe,
    ];

    const index = createIndex(recipes, {
      A: ['rDirect', 'rRecycle'],
      B: ['rB'],
    });

    const state = buildMatrixState({
      objectives: [
        {
          id: 'obj-a',
          targetId: 'A',
          value: rational(60),
          unit: ObjectiveUnit.PerMinute,
          type: ObjectiveType.Output,
        },
      ],
      index,
      selectedRecipeIdByItemKeyHash: new Map(),
      selectedItemIdByTagId: new Map(),
      defaultNs: 'test',
    });

    expect(Array.from(state.recipes.keys())).toEqual(['rDirect']);
    expect(state.normalizedRecipes.has('rDirect')).toBe(true);
    expect(state.itemKeyByHash.has(itemKeyHash({ id: 'X' }))).toBe(true);
    expect(state.itemKeyByHash.has(itemKeyHash({ id: 'Y' }))).toBe(false);
  });

  it('includes all reachable producers when single-chain preference is disabled', () => {
    const recipes: Recipe[] = [
      {
        id: 'rDirect',
        type: 't',
        slotContents: {
          in1: { kind: 'item', id: 'X', amount: 1 },
          out1: { kind: 'item', id: 'A', amount: 1 },
        },
      } as unknown as Recipe,
      {
        id: 'rRecycle',
        type: 't',
        slotContents: {
          in1: { kind: 'item', id: 'B', amount: 1 },
          out1: { kind: 'item', id: 'A', amount: 1 },
        },
      } as unknown as Recipe,
      {
        id: 'rB',
        type: 't',
        slotContents: {
          in1: { kind: 'item', id: 'Y', amount: 1 },
          out1: { kind: 'item', id: 'B', amount: 1 },
        },
      } as unknown as Recipe,
    ];

    const index = createIndex(recipes, {
      A: ['rDirect', 'rRecycle'],
      B: ['rB'],
    });

    const state = buildMatrixState({
      objectives: [
        {
          id: 'obj-a',
          targetId: 'A',
          value: rational(60),
          unit: ObjectiveUnit.PerMinute,
          type: ObjectiveType.Output,
        },
      ],
      index,
      selectedRecipeIdByItemKeyHash: new Map(),
      selectedItemIdByTagId: new Map(),
      defaultNs: 'test',
      preferSingleRecipeChain: false,
    });

    expect(Array.from(state.recipes.keys())).toEqual(['rDirect', 'rRecycle', 'rB']);
    expect(state.normalizedRecipes.has('rRecycle')).toBe(true);
    expect(state.normalizedRecipes.has('rB')).toBe(true);
  });

  it('uses the preselected recipe deterministically when single-chain preference is enabled', () => {
    const recipes: Recipe[] = [
      {
        id: 'rDirect',
        type: 't',
        slotContents: {
          in1: { kind: 'item', id: 'X', amount: 1 },
          out1: { kind: 'item', id: 'A', amount: 1 },
        },
      } as unknown as Recipe,
      {
        id: 'rRecycle',
        type: 't',
        slotContents: {
          in1: { kind: 'item', id: 'B', amount: 1 },
          out1: { kind: 'item', id: 'A', amount: 1 },
        },
      } as unknown as Recipe,
      {
        id: 'rB',
        type: 't',
        slotContents: {
          in1: { kind: 'item', id: 'Y', amount: 1 },
          out1: { kind: 'item', id: 'B', amount: 1 },
        },
      } as unknown as Recipe,
    ];

    const state = buildMatrixState({
      objectives: [
        {
          id: 'obj-a',
          targetId: 'A',
          value: rational(60),
          unit: ObjectiveUnit.PerMinute,
          type: ObjectiveType.Output,
        },
      ],
      index: createIndex(recipes, {
        A: ['rDirect', 'rRecycle'],
        B: ['rB'],
      }),
      selectedRecipeIdByItemKeyHash: new Map([[itemKeyHash({ id: 'A' }), 'rRecycle']]),
      selectedItemIdByTagId: new Map(),
      defaultNs: 'test',
    });

    expect(Array.from(state.recipes.keys())).toEqual(['rRecycle', 'rB']);
    expect(state.normalizedRecipes.has('rDirect')).toBe(false);
    expect(state.normalizedRecipes.has('rRecycle')).toBe(true);
    expect(state.normalizedRecipes.has('rB')).toBe(true);
  });

  it('treats forced raw items as external inputs instead of expanding their producers', () => {
    const recipes: Recipe[] = [
      {
        id: 'smelt_ore',
        type: 't',
        slotContents: {
          in1: { kind: 'item', id: 'ORE', amount: 1 },
          out1: { kind: 'item', id: 'PLATE', amount: 1 },
        },
      } as unknown as Recipe,
      {
        id: 'mine_ore',
        type: 't',
        slotContents: {
          out1: { kind: 'item', id: 'ORE', amount: 1 },
        },
      } as unknown as Recipe,
    ];

    const state = buildMatrixState({
      objectives: [
        {
          id: 'obj-plate',
          targetId: 'PLATE',
          value: rational(60),
          unit: ObjectiveUnit.PerMinute,
          type: ObjectiveType.Output,
        },
      ],
      index: createIndex(recipes, {
        PLATE: ['smelt_ore'],
        ORE: ['mine_ore'],
      }),
      selectedRecipeIdByItemKeyHash: new Map(),
      selectedItemIdByTagId: new Map(),
      forcedRawItemKeyHashes: new Set([itemKeyHash({ id: 'ORE' })]),
      defaultNs: 'test',
    });

    expect(state.normalizedRecipes.has('smelt_ore')).toBe(true);
    expect(state.normalizedRecipes.has('mine_ore')).toBe(false);
    expect(state.unproduceableIds.has(itemKeyHash({ id: 'ORE' }))).toBe(true);
  });
});
