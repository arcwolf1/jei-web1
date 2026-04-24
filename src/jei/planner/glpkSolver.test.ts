import { describe, expect, it } from 'vitest';
import type { Recipe, RecipeTypeDef } from '../types';
import type { JeiIndex } from '../indexing/buildIndex';
import { itemKeyHash } from '../indexing/key';
import { buildMatrixState } from './matrixState';
import { solveLp } from './glpkSolver';
import { rational } from './rational';
import { ObjectiveType, ObjectiveUnit, ResultType } from './types';

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

describe('solveLp integerMachines', () => {
  it.skip('allows integer machines to satisfy demand with reduced discrete rates before adding another machine', async () => {
    const recipes: Recipe[] = [
      {
        id: 'rA',
        type: 't',
        slotContents: {
          out1: { kind: 'item', id: 'A', amount: 1 },
        },
        params: { time: 1 },
      } as unknown as Recipe,
    ];

    const state = buildMatrixState({
      objectives: [
        {
          id: 'obj-a',
          targetId: 'A',
          value: rational(30),
          unit: ObjectiveUnit.PerMinute,
          type: ObjectiveType.Output,
        },
      ],
      index: createIndex(recipes, { A: ['rA'] }),
      selectedRecipeIdByItemKeyHash: new Map(),
      selectedItemIdByTagId: new Map(),
      defaultNs: 'test',
    });

    const fractional = await solveLp(state);
    expect(fractional.resultType).toBe(ResultType.Solved);
    expect(fractional.recipeRates.get('rA')).toBeCloseTo(0.5, 6);
    expect(fractional.surpluses.get(itemKeyHash({ id: 'A' })) ?? 0).toBeCloseTo(0, 6);

    const integer = await solveLp(state, undefined, {
      integerMachines: true,
      discreteMachineRates: true,
    });
    expect(integer.resultType).toBe(ResultType.Solved);
    expect(integer.recipeMachineCounts.get('rA')).toBeCloseTo(1, 6);
    expect(integer.recipeRates.get('rA')).toBeCloseTo(0.5, 6);
    expect(integer.surpluses.get(itemKeyHash({ id: 'A' })) ?? 0).toBeCloseTo(0, 6);

    const integerWholeMachines = await solveLp(state, undefined, {
      integerMachines: true,
      discreteMachineRates: false,
    });
    expect(integerWholeMachines.resultType).toBe(ResultType.Solved);
    expect(integerWholeMachines.recipeMachineCounts.get('rA')).toBeCloseTo(1, 6);
    expect(integerWholeMachines.recipeRates.get('rA')).toBeCloseTo(1, 6);
    expect(integerWholeMachines.surpluses.get(itemKeyHash({ id: 'A' })) ?? 0).toBeCloseTo(0.5, 6);
  });
});
