import { describe, expect, it } from 'vitest';
import { buildLpProductionLineModel } from './lpFlow';
import type { LpFlowData } from './types';

describe('buildLpProductionLineModel', () => {
  it('preserves multiple LP producers when collapsing an intermediate item', () => {
    const flow: LpFlowData = {
      recipes: [
        {
          recipeId: 'r1',
          recipeTypeKey: 'machine',
          ratePerSecond: 2,
          machineCount: 1,
          inputItems: [],
          outputItems: [{ key: { id: 'MID' }, amountPerSecond: 2 }],
          inputFluids: [],
          outputFluids: [],
        },
        {
          recipeId: 'r2',
          recipeTypeKey: 'machine',
          ratePerSecond: 3,
          machineCount: 1,
          inputItems: [],
          outputItems: [{ key: { id: 'MID' }, amountPerSecond: 3 }],
          inputFluids: [],
          outputFluids: [],
        },
        {
          recipeId: 'use',
          recipeTypeKey: 'machine',
          ratePerSecond: 5,
          machineCount: 1,
          inputItems: [{ key: { id: 'MID' }, amountPerSecond: 5 }],
          outputItems: [{ key: { id: 'ROOT' }, amountPerSecond: 5 }],
          inputFluids: [],
          outputFluids: [],
        },
      ],
      targets: [{ key: { id: 'ROOT' }, amountPerSecond: 5 }],
      externalInputs: [],
      unproduceableInputs: [],
      surpluses: [],
    };

    const model = buildLpProductionLineModel({
      flow,
      collapseIntermediateItems: true,
    });

    expect(model.nodes.find((n) => n.kind === 'item' && n.itemKey.id === 'MID')).toBeUndefined();

    const directEdges = model.edges.filter(
      (e) =>
        e.kind === 'item'
        && e.itemKey.id === 'MID'
        && (e.source === 'm:r1' || e.source === 'm:r2')
        && e.target === 'm:use',
    );

    expect(
      directEdges
        .map((e) => `${e.source}:${e.amount}`)
        .sort(),
    ).toEqual(['m:r1:120', 'm:r2:180']);
  });

  it('keeps visible byproduct surplus from LP outputs', () => {
    const flow: LpFlowData = {
      recipes: [
        {
          recipeId: 'poly',
          recipeTypeKey: 'reactor',
          ratePerSecond: 1,
          machineCount: 2,
          inputItems: [{ key: { id: 'RAW' }, amountPerSecond: 1 }],
          outputItems: [
            { key: { id: 'MAIN' }, amountPerSecond: 1 },
            { key: { id: 'BY' }, amountPerSecond: 1 },
          ],
          inputFluids: [],
          outputFluids: [],
        },
      ],
      targets: [{ key: { id: 'MAIN' }, amountPerSecond: 1 }],
      externalInputs: [],
      unproduceableInputs: [{ key: { id: 'RAW' }, amountPerSecond: 1 }],
      surpluses: [{ key: { id: 'BY' }, amountPerSecond: 1 }],
    };

    const model = buildLpProductionLineModel({ flow });

    const surplusNode = model.nodes.find(
      (n) => n.kind === 'item' && n.itemKey.id === 'BY' && n.isSurplus,
    );
    expect(surplusNode).toMatchObject({
      kind: 'item',
      amount: 60,
      isSurplus: true,
    });

    const surplusEdge = model.edges.find(
      (e) =>
        e.kind === 'item'
        && e.itemKey.id === 'BY'
        && e.source === 'm:poly'
        && e.target === surplusNode?.nodeId,
    );
    expect(surplusEdge).toMatchObject({
      kind: 'item',
      amount: 60,
      surplus: true,
    });

    const machineNode = model.nodes.find(
      (n) => n.kind === 'machine' && n.recipeId === 'poly',
    );
    expect(machineNode && machineNode.kind === 'machine' ? machineNode.outputDetails : undefined)
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: { id: 'MAIN' },
            demanded: 60,
            surplusRate: 0,
          }),
          expect.objectContaining({
            key: { id: 'BY' },
            demanded: 0,
            surplusRate: 60,
          }),
        ]),
      );
  });
});
