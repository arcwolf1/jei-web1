import { describe, expect, it } from 'vitest';
import { itemKeyHash } from '../indexing/key';
import { mergeLpRecipeSelections } from './lpSelections';
import type { LpFlowData } from './types';

describe('mergeLpRecipeSelections', () => {
  it('prefers the dominant LP producer for an item instead of the last iterated byproduct recipe', () => {
    const flow: LpFlowData = {
      recipes: [
        {
          recipeId: 'pump',
          recipeTypeKey: 'pump',
          ratePerSecond: 2.3666,
          machineCount: 2.3666,
          inputItems: [],
          outputItems: [{ key: { id: 'water' }, amountPerSecond: 2.3666 }],
          inputFluids: [],
          outputFluids: [],
        },
        {
          recipeId: 'purifier',
          recipeTypeKey: 'purifier',
          ratePerSecond: 0.0333,
          machineCount: 0.0666,
          inputItems: [{ key: { id: 'lowpoly' }, amountPerSecond: 0.1333 }],
          outputItems: [
            { key: { id: 'water' }, amountPerSecond: 0.0333 },
            { key: { id: 'poly' }, amountPerSecond: 0.0333 },
          ],
          inputFluids: [],
          outputFluids: [],
        },
      ],
      targets: [],
      externalInputs: [],
      unproduceableInputs: [],
      surpluses: [],
    };

    const merged = mergeLpRecipeSelections({
      base: new Map<string, string>(),
      lpFlow: flow,
    });

    expect(merged.get(itemKeyHash({ id: 'water' }))).toBe('pump');
    expect(merged.get(itemKeyHash({ id: 'poly' }))).toBe('purifier');
  });
});
