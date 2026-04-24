import { describe, expect, it } from 'vitest';
import { itemKeyHash } from '../indexing/key';
import { buildLpQuantFlowModel } from './quantFlow';
import type { LpFlowData } from './types';

describe('buildLpQuantFlowModel', () => {
  it('keeps inert xiranite waste visible when LP uses it as an intermediate recycled input', () => {
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

    const model = buildLpQuantFlowModel({ flow });
    const lowpolyNodeId = `qi:base:${itemKeyHash({ id: 'item_liquid_xiranite_lowpoly' })}`;
    const polyNodeId = `qi:base:${itemKeyHash({ id: 'item_liquid_xiranite_poly' })}`;

    expect(
      model.nodes.find(
        (node) => node.kind === 'item' && node.itemKey.id === 'item_liquid_xiranite_lowpoly',
      ),
    ).toBeDefined();

    expect(
      model.edges.find(
        (edge) =>
          edge.kind === 'item' &&
          edge.itemKey.id === 'item_liquid_xiranite_lowpoly' &&
          edge.source === lowpolyNodeId &&
          edge.target === polyNodeId,
      ),
    ).toBeDefined();
  });

  it('keeps surplus byproducts visible in LP quant flow', () => {
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

    const model = buildLpQuantFlowModel({ flow });

    expect(
      model.nodes.find((node) => node.kind === 'item' && node.itemKey.id === 'item_by'),
    ).toBeDefined();
    expect(
      model.edges.find(
        (edge) =>
          edge.kind === 'item' &&
          edge.itemKey.id === 'item_raw' &&
          edge.target === `qi:base:${itemKeyHash({ id: 'item_by' })}`,
      ),
    ).toBeDefined();
  });
});
