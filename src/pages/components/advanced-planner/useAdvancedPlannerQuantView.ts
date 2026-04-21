import { computed, type ComputedRef, type Ref } from 'vue';
import { itemKeyHash } from 'src/jei/indexing/key';
import { buildLpQuantFlowModel, buildQuantFlowModel } from 'src/jei/planner/quantFlow';
import type { EnhancedBuildTreeResult, RequirementNode } from 'src/jei/planner/planner';
import type { PlannerNodePosition, PlannerTargetUnit } from 'src/jei/planner/plannerUi';
import type { PlannerResult } from 'src/jei/planner/types';
import type { ItemKey } from 'src/jei/types';
import type { QuantFlowEdge, QuantFlowNode } from 'src/jei/planner/quantFlow';

type PlannerResultLike = {
  lpFlow?: PlannerResult['lpFlow'] | null;
};

type QuantLayoutHints = {
  orderByNodeId: Map<string, number>;
  depthByNodeId: Map<string, number>;
  signature: string;
};

function quantFlowNodeIdOfRequirementNode(node: RequirementNode): string {
  if (node.kind === 'item') return `qi:base:${itemKeyHash(node.itemKey)}`;
  return `qf:${node.unit ? `${node.id}:${node.unit}` : node.id}`;
}

function buildQuantLayoutHints(tree: EnhancedBuildTreeResult | null): QuantLayoutHints {
  const orderByNodeId = new Map<string, number>();
  const depthByNodeId = new Map<string, number>();
  if (!tree) return { orderByNodeId, depthByNodeId, signature: '' };

  const roots =
    tree.root.kind === 'item' && tree.root.itemKey.id === '__multi_target__'
      ? tree.root.children
      : [tree.root];

  let visitOrder = 0;
  const visit = (node: RequirementNode, depth: number) => {
    const nodeId = quantFlowNodeIdOfRequirementNode(node);
    if (!orderByNodeId.has(nodeId)) orderByNodeId.set(nodeId, visitOrder);
    depthByNodeId.set(nodeId, Math.min(depthByNodeId.get(nodeId) ?? Number.POSITIVE_INFINITY, depth));
    visitOrder += 1;
    if (node.kind === 'item') node.children.forEach((child) => visit(child, depth + 1));
  };

  roots.forEach((root) => visit(root, 0));
  const signature = [...orderByNodeId.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([nodeId, order]) => `${nodeId}:${order}:${depthByNodeId.get(nodeId) ?? 0}`)
    .join('|');
  return { orderByNodeId, depthByNodeId, signature };
}

export function useAdvancedPlannerQuantView(input: {
  lpMode: Ref<boolean>;
  lpResult: Ref<PlannerResultLike | null>;
  mergedTree: Ref<EnhancedBuildTreeResult | null>;
  quantShowFluids: Ref<boolean>;
  quantDisplayUnit: Ref<PlannerTargetUnit>;
  quantWidthByRate: Ref<boolean>;
  quantFlowRenderer: ComputedRef<'nodes' | 'sankey'>;
  quantNodePositions: Ref<Map<string, PlannerNodePosition>>;
  quantAutoLayoutCache: Map<string, Record<string, PlannerNodePosition>>;
  targetRootHashes: ComputedRef<Set<string>>;
  itemName: (itemKey: ItemKey) => string;
  finiteOr: (n: unknown, fallback: number) => number;
}): {
  quantModel: ComputedRef<{ nodes: QuantFlowNode[]; edges: QuantFlowEdge[] }>;
  quantNodePositionsRecord: ComputedRef<Record<string, PlannerNodePosition>>;
} {
  const quantModel = computed<ReturnType<typeof buildQuantFlowModel>>(() => {
    if (input.lpMode.value && input.lpResult.value?.lpFlow) {
      return buildLpQuantFlowModel({
        flow: input.lpResult.value.lpFlow,
        includeFluids: input.quantShowFluids.value,
      });
    }
    if (!input.mergedTree.value) return { nodes: [], edges: [] };

    const roots =
      input.mergedTree.value.root.kind === 'item' &&
      input.mergedTree.value.root.itemKey.id === '__multi_target__'
        ? input.mergedTree.value.root.children
        : [input.mergedTree.value.root];

    const mergedNodeById = new Map<string, ReturnType<typeof buildQuantFlowModel>['nodes'][number]>();
    const mergedEdgeById = new Map<string, ReturnType<typeof buildQuantFlowModel>['edges'][number]>();

    roots.forEach((root) => {
      const params: Parameters<typeof buildQuantFlowModel>[0] = {
        root,
        includeFluids: input.quantShowFluids.value,
      };
      if (root.kind === 'item') params.rootItemKey = root.itemKey;
      const model = buildQuantFlowModel(params);

      model.nodes.forEach((node) => {
        const previous = mergedNodeById.get(node.nodeId);
        if (!previous) {
          mergedNodeById.set(node.nodeId, { ...node });
          return;
        }

        if (node.kind === 'item' && previous.kind === 'item') {
          previous.amount += node.amount;
          if (node.isRoot) previous.isRoot = true;
          if (node.recovery) previous.recovery = true;
          if (node.machineItemId && !previous.machineItemId) previous.machineItemId = node.machineItemId;
          if (node.machineName && !previous.machineName) previous.machineName = node.machineName;
          if (node.machineCount !== undefined) previous.machineCount = (previous.machineCount ?? 0) + node.machineCount;
        } else if (node.kind === 'fluid' && previous.kind === 'fluid') {
          previous.amount += node.amount;
        }
      });

      model.edges.forEach((edge) => {
        const previous = mergedEdgeById.get(edge.id);
        if (!previous) {
          mergedEdgeById.set(edge.id, { ...edge });
          return;
        }
        previous.amount += edge.amount;
        if (edge.machineItemId && !previous.machineItemId) previous.machineItemId = edge.machineItemId;
        if (edge.machineName && !previous.machineName) previous.machineName = edge.machineName;
        if (edge.machineCount !== undefined) previous.machineCount = (previous.machineCount ?? 0) + edge.machineCount;
      });
    });

    mergedNodeById.forEach((node) => {
      if (node.kind !== 'item') return;
      const hash = itemKeyHash(node.itemKey);
      if (input.targetRootHashes.value.has(hash) && !node.recovery) node.isRoot = true;
    });

    return { nodes: Array.from(mergedNodeById.values()), edges: Array.from(mergedEdgeById.values()) };
  });

  const quantLayoutHints = computed(() =>
    buildQuantLayoutHints(input.lpMode.value ? null : input.mergedTree.value),
  );

  const quantNodePositionsRecord = computed<Record<string, PlannerNodePosition>>(() => {
    if (input.quantFlowRenderer.value !== 'nodes') {
      const out: Record<string, PlannerNodePosition> = {};
      input.quantNodePositions.value.forEach((pos, id) => {
        out[id] = { ...pos };
      });
      return out;
    }

    const model = quantModel.value;
    if (!model.nodes.length) return {};

    const nodeW = 232;
    const nodeH = 132;
    const pad = 24;
    const gapY = 44;
    const layerXGap = nodeW + 92;
    const nodeIdSet = new Set(model.nodes.map((node) => node.nodeId));
    const layoutHints = quantLayoutHints.value;
    const signature = `quant-v3:${input.quantDisplayUnit.value}:${input.quantWidthByRate.value ? 1 : 0}:${model.nodes
      .map((node) => `${node.nodeId}:${node.kind}:${input.finiteOr(node.amount, 0)}:${node.kind === 'item' ? itemKeyHash(node.itemKey) : `${node.id}:${node.unit ?? ''}`}`)
      .join('|')}::${model.edges
      .map((edge) => `${edge.source}>${edge.target}:${edge.kind}:${input.finiteOr(edge.amount, 0)}`)
      .join('|')}::${layoutHints.signature}`;
    const cachedLayout = input.quantAutoLayoutCache.get(signature) ?? null;

    if (!cachedLayout) {
      const ids = model.nodes.map((node) => node.nodeId);
      const out = new Map<string, string[]>();
      const inp = new Map<string, string[]>();
      const outWeight = new Map<string, Map<string, number>>();
      const inpWeight = new Map<string, Map<string, number>>();
      ids.forEach((id) => {
        out.set(id, []);
        inp.set(id, []);
        outWeight.set(id, new Map());
        inpWeight.set(id, new Map());
      });
      model.edges.forEach((edge) => {
        (out.get(edge.source) ?? []).push(edge.target);
        (inp.get(edge.target) ?? []).push(edge.source);
        const edgeWeight = 1 + Math.log1p(Math.max(0, Math.abs(input.finiteOr(edge.amount, 0))));
        outWeight.set(
          edge.source,
          (outWeight.get(edge.source) ?? new Map()).set(
            edge.target,
            (outWeight.get(edge.source)?.get(edge.target) ?? 0) + edgeWeight,
          ),
        );
        inpWeight.set(
          edge.target,
          (inpWeight.get(edge.target) ?? new Map()).set(
            edge.source,
            (inpWeight.get(edge.target)?.get(edge.source) ?? 0) + edgeWeight,
          ),
        );
      });

      const nodeLabelById = new Map(
        model.nodes.map(
          (node) => [node.nodeId, node.kind === 'item' ? input.itemName(node.itemKey) : node.id] as const,
        ),
      );
      const nodeById = new Map(model.nodes.map((node) => [node.nodeId, node] as const));
      const nodeFlowWeightById = new Map(
        model.nodes.map((node) => [node.nodeId, Math.abs(input.finiteOr(node.amount, 0))] as const),
      );

      const compareNodePriority = (left: string, right: string) => {
        const byTreeOrder =
          (layoutHints.orderByNodeId.get(left) ?? Number.POSITIVE_INFINITY)
          - (layoutHints.orderByNodeId.get(right) ?? Number.POSITIVE_INFINITY);
        if (Math.abs(byTreeOrder) > 1e-9) return byTreeOrder;
        const byDepth =
          (layoutHints.depthByNodeId.get(left) ?? Number.POSITIVE_INFINITY)
          - (layoutHints.depthByNodeId.get(right) ?? Number.POSITIVE_INFINITY);
        if (Math.abs(byDepth) > 1e-9) return byDepth;
        const leftNode = nodeById.get(left);
        const rightNode = nodeById.get(right);
        const byRoot =
          (leftNode?.kind === 'item' && leftNode.isRoot ? 0 : 1)
          - (rightNode?.kind === 'item' && rightNode.isRoot ? 0 : 1);
        if (byRoot !== 0) return byRoot;
        const byAmount = (nodeFlowWeightById.get(right) ?? 0) - (nodeFlowWeightById.get(left) ?? 0);
        if (Math.abs(byAmount) > 1e-9) return byAmount;
        return (nodeLabelById.get(left) ?? left).localeCompare(nodeLabelById.get(right) ?? right);
      };

      const hintedDepths = ids
        .map((id) => layoutHints.depthByNodeId.get(id))
        .filter((value): value is number => value !== undefined && Number.isFinite(value));
      const maxHintDepth = hintedDepths.length ? Math.max(...hintedDepths) : 0;
      const layerByNode = new Map<string, number>();
      ids.forEach((id) => {
        const hintedDepth = layoutHints.depthByNodeId.get(id);
        if (hintedDepth !== undefined && Number.isFinite(hintedDepth)) {
          layerByNode.set(id, Math.max(0, maxHintDepth - hintedDepth));
          return;
        }
        layerByNode.set(id, 0);
      });

      const topoOrder = [...ids].sort((left, right) => {
        const byLayer = (layerByNode.get(left) ?? 0) - (layerByNode.get(right) ?? 0);
        if (byLayer !== 0) return byLayer;
        return compareNodePriority(left, right);
      });
      for (let pass = 0; pass < 3; pass += 1) {
        topoOrder.forEach((nodeId) => {
          const currentLayer = layerByNode.get(nodeId) ?? 0;
          (out.get(nodeId) ?? []).forEach((nextId) => {
            if ((layerByNode.get(nextId) ?? 0) <= currentLayer) {
              layerByNode.set(nextId, currentLayer + 1);
            }
          });
        });
      }

      const maxLayer = Math.max(0, ...ids.map((id) => layerByNode.get(id) ?? 0));
      const fallbackOrder = [...ids].sort(compareNodePriority);
      const fallbackRankByNode = new Map(
        fallbackOrder.map((nodeId, index) => [nodeId, index] as const),
      );
      const rootNodeIds = fallbackOrder.filter((nodeId) => {
        const node = nodeById.get(nodeId);
        return node?.kind === 'item' && node.isRoot;
      });

      const laneScoreByNode = new Map<string, number>();
      rootNodeIds.forEach((nodeId, index) => laneScoreByNode.set(nodeId, index));
      for (let layer = maxLayer; layer >= 0; layer -= 1) {
        fallbackOrder
          .filter((nodeId) => (layerByNode.get(nodeId) ?? 0) === layer)
          .forEach((nodeId) => {
            if (laneScoreByNode.has(nodeId)) return;
            const downstream = Array.from(outWeight.get(nodeId)?.entries() ?? [])
              .map(([nextId, weight]) => ({
                nextId,
                weight,
                lane: laneScoreByNode.get(nextId),
                nextLayer: layerByNode.get(nextId) ?? 0,
              }))
              .filter((entry): entry is { nextId: string; weight: number; lane: number; nextLayer: number } =>
                entry.lane !== undefined && entry.nextLayer > layer,
              );
            if (downstream.length) {
              const totalWeight = downstream.reduce((sum, entry) => sum + entry.weight, 0);
              const weightedLane =
                totalWeight > 0
                  ? downstream.reduce((sum, entry) => sum + entry.lane * entry.weight, 0) / totalWeight
                  : downstream.reduce((sum, entry) => sum + entry.lane, 0) / downstream.length;
              laneScoreByNode.set(nodeId, weightedLane);
              return;
            }
            laneScoreByNode.set(nodeId, fallbackRankByNode.get(nodeId) ?? 0);
          });
      }

      const nodesByLayer = new Map<number, string[]>();
      for (let layer = 0; layer <= maxLayer; layer += 1) nodesByLayer.set(layer, []);
      ids.forEach((nodeId) => {
        (nodesByLayer.get(layerByNode.get(nodeId) ?? 0) ?? []).push(nodeId);
      });
      nodesByLayer.forEach((nodeIds) =>
        nodeIds.sort((left, right) => {
          const byLane =
            (laneScoreByNode.get(left) ?? Number.POSITIVE_INFINITY)
            - (laneScoreByNode.get(right) ?? Number.POSITIVE_INFINITY);
          if (Math.abs(byLane) > 1e-9) return byLane;
          const byPriority = compareNodePriority(left, right);
          if (byPriority !== 0) return byPriority;
          return (nodeFlowWeightById.get(right) ?? 0) - (nodeFlowWeightById.get(left) ?? 0);
        }),
      );

      const nodeOrderIndex = new Map<string, number>();
      const refreshNodeOrderIndex = () => {
        nodesByLayer.forEach((nodeIds) =>
          nodeIds.forEach((nodeId, order) => nodeOrderIndex.set(nodeId, order)),
        );
      };
      const baryNode = (neighborEntries: Array<{ nodeId: string; weight: number }>) => {
        if (!neighborEntries.length) return Number.POSITIVE_INFINITY;
        let sum = 0;
        let count = 0;
        neighborEntries.forEach(({ nodeId, weight }) => {
          const order = nodeOrderIndex.get(nodeId);
          if (order === undefined) return;
          sum += order * weight;
          count += weight;
        });
        return count ? sum / count : Number.POSITIVE_INFINITY;
      };
      const stableSortNodes = (nodeIds: string[], scoreFn: (nodeId: string) => number) => {
        const withScore = nodeIds.map((nodeId, order) => ({
          nodeId,
          order,
          score: scoreFn(nodeId),
          lane: laneScoreByNode.get(nodeId) ?? Number.POSITIVE_INFINITY,
          priority: fallbackRankByNode.get(nodeId) ?? Number.POSITIVE_INFINITY,
          flow: nodeFlowWeightById.get(nodeId) ?? 0,
        }));
        withScore.sort(
          (left, right) =>
            left.score - right.score ||
            left.lane - right.lane ||
            left.priority - right.priority ||
            right.flow - left.flow ||
            left.order - right.order,
        );
        return withScore.map((entry) => entry.nodeId);
      };

      refreshNodeOrderIndex();
      for (let pass = 0; pass < 6; pass += 1) {
        for (let layer = 1; layer <= maxLayer; layer += 1) {
          const nodeIds = nodesByLayer.get(layer) ?? [];
          nodesByLayer.set(
            layer,
            stableSortNodes(nodeIds, (nodeId) =>
              baryNode(
                Array.from(inpWeight.get(nodeId)?.entries() ?? [])
                  .map(([neighborNodeId, weight]) => ({
                    nodeId: neighborNodeId,
                    weight,
                    neighborLayer: layerByNode.get(neighborNodeId) ?? 0,
                  }))
                  .filter((entry) => entry.neighborLayer < layer)
                  .map(({ nodeId: neighborNodeId, weight }) => ({ nodeId: neighborNodeId, weight })),
              ),
            ),
          );
          refreshNodeOrderIndex();
        }
        for (let layer = maxLayer - 1; layer >= 0; layer -= 1) {
          const nodeIds = nodesByLayer.get(layer) ?? [];
          nodesByLayer.set(
            layer,
            stableSortNodes(nodeIds, (nodeId) =>
              baryNode(
                Array.from(outWeight.get(nodeId)?.entries() ?? [])
                  .map(([neighborNodeId, weight]) => ({
                    nodeId: neighborNodeId,
                    weight,
                    neighborLayer: layerByNode.get(neighborNodeId) ?? 0,
                  }))
                  .filter((entry) => entry.neighborLayer > layer)
                  .map(({ nodeId: neighborNodeId, weight }) => ({ nodeId: neighborNodeId, weight })),
              ),
            ),
          );
          refreshNodeOrderIndex();
        }
      }

      const layerHeightById = new Map<number, number>();
      let maxLayerHeight = 0;
      for (let layer = 0; layer <= maxLayer; layer += 1) {
        const nodeIds = nodesByLayer.get(layer) ?? [];
        const layerHeight = nodeIds.length * nodeH + Math.max(0, nodeIds.length - 1) * gapY;
        layerHeightById.set(layer, layerHeight);
        maxLayerHeight = Math.max(maxLayerHeight, layerHeight);
      }

      const initialPositionById = new Map<string, PlannerNodePosition>();
      for (let layer = 0; layer <= maxLayer; layer += 1) {
        const nodeIds = nodesByLayer.get(layer) ?? [];
        let cursorY = pad + Math.max(0, (maxLayerHeight - (layerHeightById.get(layer) ?? 0)) / 2);
        nodeIds.forEach((nodeId) => {
          initialPositionById.set(nodeId, {
            x: pad + nodeW / 2 + layer * layerXGap,
            y: cursorY + nodeH / 2,
          });
          cursorY += nodeH + gapY;
        });
      }

      input.quantAutoLayoutCache.set(signature, Object.fromEntries(initialPositionById.entries()));
      if (input.quantAutoLayoutCache.size > 24) {
        const oldestKey = input.quantAutoLayoutCache.keys().next().value;
        if (typeof oldestKey === 'string') input.quantAutoLayoutCache.delete(oldestKey);
      }
    }

    const mergedPositions: Record<string, PlannerNodePosition> = {
      ...(input.quantAutoLayoutCache.get(signature) ?? cachedLayout ?? {}),
    };
    input.quantNodePositions.value.forEach((pos, id) => {
      if (!nodeIdSet.has(id)) return;
      mergedPositions[id] = { x: pos.x, y: pos.y };
    });
    return mergedPositions;
  });

  return {
    quantModel,
    quantNodePositionsRecord,
  };
}
