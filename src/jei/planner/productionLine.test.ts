import { describe, expect, it } from 'vitest';
import type { RequirementNode } from './planner';
import { buildProductionLineModel } from './productionLine';

function itemNode(args: {
  nodeId: string;
  itemId: string;
  amount: number;
  recipeIdUsed?: string;
  children?: RequirementNode[];
}): Extract<RequirementNode, { kind: 'item' }> {
  return {
    kind: 'item',
    nodeId: args.nodeId,
    itemKey: { id: args.itemId },
    amount: args.amount,
    ...(args.recipeIdUsed ? { recipeIdUsed: args.recipeIdUsed } : {}),
    children: args.children ?? [],
    catalysts: [],
    cycle: false,
  };
}

describe('buildProductionLineModel collapseIntermediateItems', () => {
  it('preserves all producer contributions when collapsing an intermediate item', () => {
    const root = itemNode({
      nodeId: 'root',
      itemId: 'ROOT',
      amount: 10,
      recipeIdUsed: 'rRoot',
      children: [
        itemNode({
          nodeId: 'mid-from-r1',
          itemId: 'MID',
          amount: 4,
          recipeIdUsed: 'r1',
          children: [itemNode({ nodeId: 'raw-a', itemId: 'RAW_A', amount: 4 })],
        }),
        itemNode({
          nodeId: 'mid-from-r2',
          itemId: 'MID',
          amount: 6,
          recipeIdUsed: 'r2',
          children: [itemNode({ nodeId: 'raw-b', itemId: 'RAW_B', amount: 6 })],
        }),
      ],
    });

    const model = buildProductionLineModel({
      root,
      rootItemKey: { id: 'ROOT' },
      collapseIntermediateItems: true,
    });

    expect(model.nodes.find((n) => n.kind === 'item' && n.itemKey.id === 'MID')).toBeUndefined();

    const directEdges = model.edges.filter(
      (e) =>
        e.kind === 'item'
        && e.itemKey.id === 'MID'
        && (e.source === 'm:r1' || e.source === 'm:r2')
        && e.target === 'm:rRoot',
    );

    expect(
      directEdges
        .map((e) => `${e.source}:${e.amount}`)
        .sort(),
    ).toEqual(['m:r1:4', 'm:r2:6']);
  });

  it('splits collapsed intermediate flow across multiple producers and consumers without losing rate', () => {
    const root = itemNode({
      nodeId: 'root',
      itemId: 'ROOT',
      amount: 10,
      recipeIdUsed: 'rRoot',
      children: [
        itemNode({
          nodeId: 'c1',
          itemId: 'C1',
          amount: 4,
          recipeIdUsed: 'rC1',
          children: [
            itemNode({
              nodeId: 'mid-for-c1',
              itemId: 'MID',
              amount: 4,
              recipeIdUsed: 'r1',
              children: [itemNode({ nodeId: 'raw-a', itemId: 'RAW_A', amount: 4 })],
            }),
          ],
        }),
        itemNode({
          nodeId: 'c2',
          itemId: 'C2',
          amount: 6,
          recipeIdUsed: 'rC2',
          children: [
            itemNode({
              nodeId: 'mid-for-c2',
              itemId: 'MID',
              amount: 6,
              recipeIdUsed: 'r2',
              children: [itemNode({ nodeId: 'raw-b', itemId: 'RAW_B', amount: 6 })],
            }),
          ],
        }),
      ],
    });

    const model = buildProductionLineModel({
      root,
      rootItemKey: { id: 'ROOT' },
      collapseIntermediateItems: true,
    });

    expect(model.nodes.find((n) => n.kind === 'item' && n.itemKey.id === 'MID')).toBeUndefined();

    const bridged = model.edges.filter(
      (e) =>
        e.kind === 'item'
        && e.itemKey.id === 'MID'
        && (e.source === 'm:r1' || e.source === 'm:r2')
        && (e.target === 'm:rC1' || e.target === 'm:rC2'),
    );

    const bySource = new Map<string, number>();
    const byTarget = new Map<string, number>();
    bridged.forEach((edge) => {
      bySource.set(edge.source, (bySource.get(edge.source) ?? 0) + edge.amount);
      byTarget.set(edge.target, (byTarget.get(edge.target) ?? 0) + edge.amount);
    });

    expect(bySource.get('m:r1')).toBe(4);
    expect(bySource.get('m:r2')).toBe(6);
    expect(byTarget.get('m:rC1')).toBe(4);
    expect(byTarget.get('m:rC2')).toBe(6);
  });
});
