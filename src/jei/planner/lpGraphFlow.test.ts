import { itemKeyHash } from '../indexing/key';
import type { LpFlowData } from './types';
import { buildLpGraphFlowModel } from './lpGraphFlow';
import { describe, expect, it } from 'vitest';

describe('buildLpGraphFlowModel', () => {
  it('keeps multiple producers visible for the same LP item and connects consumers to the recycled source', () => {
    const flow: LpFlowData = {
      recipes: [
        {
          recipeId: 'mix_pool_1',
          recipeTypeKey: 'mix_pool_1',
          ratePerSecond: 0.8,
          machineCount: 0.2,
          inputItems: [
            { key: { id: 'item_liquid_sewage' }, amountPerSecond: 0.8 },
            { key: { id: 'item_liquid_xiranite' }, amountPerSecond: 0.8 },
          ],
          outputItems: [
            { key: { id: 'item_liquid_xiranite_lowpoly' }, amountPerSecond: 0.8 },
            { key: { id: 'item_liquid_xiranite_poly' }, amountPerSecond: 0.8 },
          ],
          inputFluids: [],
          outputFluids: [],
        },
        {
          recipeId: 'liquid_purifier_1',
          recipeTypeKey: 'liquid_purifier_1',
          ratePerSecond: 0.2,
          machineCount: 0.1,
          inputItems: [{ key: { id: 'item_liquid_xiranite_lowpoly' }, amountPerSecond: 0.8 }],
          outputItems: [
            { key: { id: 'item_liquid_water' }, amountPerSecond: 0.2 },
            { key: { id: 'item_liquid_xiranite_poly' }, amountPerSecond: 0.2 },
          ],
          inputFluids: [],
          outputFluids: [],
        },
      ],
      targets: [{ key: { id: 'item_liquid_xiranite_poly' }, amountPerSecond: 1 }],
      externalInputs: [],
      unproduceableInputs: [],
      surpluses: [],
    };

    const model = buildLpGraphFlowModel({ flow });
    const polyHash = itemKeyHash({ id: 'item_liquid_xiranite_poly' });
    const lowpolyHash = itemKeyHash({ id: 'item_liquid_xiranite_lowpoly' });

    const polyNodes = model.nodes.filter(
      (node) => node.kind === 'item' && node.itemKey.id === 'item_liquid_xiranite_poly',
    );

    expect(polyNodes).toHaveLength(2);
    expect(
      model.edges.find(
        (edge) =>
          edge.kind === 'item' &&
          edge.source === `lgn:item:liquid_purifier_1:${polyHash}` &&
          edge.target === `lgn:item:mix_pool_1:${lowpolyHash}`,
      ),
    ).toBeDefined();
  });

  it('keeps surplus byproduct nodes attached to the recipe input chain', () => {
    const flow: LpFlowData = {
      recipes: [
        {
          recipeId: 'poly',
          recipeTypeKey: 'poly',
          ratePerSecond: 1,
          machineCount: 1,
          inputItems: [{ key: { id: 'item_raw' }, amountPerSecond: 1 }],
          outputItems: [
            { key: { id: 'item_main' }, amountPerSecond: 1 },
            { key: { id: 'item_by' }, amountPerSecond: 1 },
          ],
          inputFluids: [],
          outputFluids: [],
        },
      ],
      targets: [{ key: { id: 'item_main' }, amountPerSecond: 1 }],
      externalInputs: [{ key: { id: 'item_raw' }, amountPerSecond: 1 }],
      unproduceableInputs: [],
      surpluses: [{ key: { id: 'item_by' }, amountPerSecond: 1 }],
    };

    const model = buildLpGraphFlowModel({ flow });

    expect(
      model.edges.find(
        (edge) =>
          edge.kind === 'item' &&
          edge.source === `lgn:item:poly:${itemKeyHash({ id: 'item_by' })}` &&
          edge.target === `lgn:raw:${itemKeyHash({ id: 'item_raw' })}`,
      ),
    ).toBeDefined();
  });
});
