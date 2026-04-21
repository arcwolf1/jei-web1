import { computed, type ComputedRef, type Ref } from 'vue';
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3';
import { itemKeyHash } from 'src/jei/indexing/key';
import { buildLpProductionLineModel } from 'src/jei/planner/lpFlow';
import { buildProductionLineModel } from 'src/jei/planner/productionLine';
import { MarkerType, type Edge, type Node } from '@vue-flow/core';
import type { EnhancedBuildTreeResult } from 'src/jei/planner/planner';
import type {
  PlannerGraphRenderer,
  PlannerNodePosition,
  PlannerTargetUnit,
} from 'src/jei/planner/plannerUi';
import type { PlannerResult } from 'src/jei/planner/types';
import type { ItemDef, ItemKey } from 'src/jei/types';
import type {
  LineFlowEdgeData,
  LineFlowFluidData,
  LineFlowItemData,
  LineFlowMachineData,
} from 'src/pages/components/advanced-planner/advancedPlanner.types';

type RecoverySourceLike = {
  recovery?: boolean;
  recoverySourceItemKey?: ItemKey;
  recoverySourceRecipeId?: string;
  recoverySourceRecipeTypeKey?: string;
};

type PlannerResultLike = {
  lpFlow?: PlannerResult['lpFlow'] | null;
};

export function useAdvancedPlannerLineView(input: {
  lpMode: Ref<boolean>;
  lpResult: Ref<PlannerResultLike | null>;
  mergedTree: Ref<EnhancedBuildTreeResult | null>;
  lineIncludeCycleSeeds: Ref<boolean>;
  lineCollapseIntermediate: Ref<boolean>;
  lineDisplayUnit: Ref<PlannerTargetUnit>;
  selectedLineNodeId: Ref<string | null>;
  lineRenderer: ComputedRef<PlannerGraphRenderer>;
  lineIntermediateColoring: ComputedRef<boolean>;
  targetRootHashes: ComputedRef<Set<string>>;
  lineNodePositionsForRenderer: (
    renderer: PlannerGraphRenderer,
  ) => Map<string, PlannerNodePosition>;
  lineAutoLayoutCache: Map<string, Record<string, PlannerNodePosition>>;
  itemDefsByKeyHash: ComputedRef<Record<string, ItemDef> | undefined>;
  itemName: (itemKey: ItemKey) => string;
  formatAmount: (n: number) => string | number;
  displayRateFromAmount: (amountPerMinute: number, unit: PlannerTargetUnit) => number;
  unitSuffix: (unit: PlannerTargetUnit) => string;
  formatMachineCountForDisplay: (value: unknown) => number;
  lineEdgeBaseWidthFromRate: (amountPerMinute: number) => number;
  lineEdgeStrokeWidth: (
    edge: Edge,
    emphasis: 'normal' | 'toRoot' | 'connected' | 'path' | 'fromLeaf',
  ) => number;
  recoverySourceText: (node: RecoverySourceLike) => string;
  isForcedRawKey: (itemKey: ItemKey) => boolean;
  itemColorOfDef: (def?: ItemDef) => string | null;
}): {
  lineFlowNodes: ComputedRef<Node[]>;
  lineFlowEdgesStyled: ComputedRef<Edge[]>;
  selectedLineItemData: ComputedRef<LineFlowItemData | null>;
  selectedLineItemForcedRaw: ComputedRef<boolean>;
} {
  const lineModel = computed<ReturnType<typeof buildProductionLineModel>>(() => {
    if (input.lpMode.value && input.lpResult.value?.lpFlow) {
      return buildLpProductionLineModel({
        flow: input.lpResult.value.lpFlow,
        collapseIntermediateItems: input.lineCollapseIntermediate.value,
      });
    }
    if (!input.mergedTree.value) return { nodes: [], edges: [] };

    const roots =
      input.mergedTree.value.root.kind === 'item' &&
      input.mergedTree.value.root.itemKey.id === '__multi_target__'
        ? input.mergedTree.value.root.children
        : [input.mergedTree.value.root];

    const mergedNodeById = new Map<
      string,
      ReturnType<typeof buildProductionLineModel>['nodes'][number]
    >();
    const mergedEdgeById = new Map<
      string,
      ReturnType<typeof buildProductionLineModel>['edges'][number]
    >();

    roots.forEach((root) => {
      const params: Parameters<typeof buildProductionLineModel>[0] = {
        root,
        includeCycleSeeds: input.lineIncludeCycleSeeds.value,
        collapseIntermediateItems: input.lineCollapseIntermediate.value,
      };
      if (root.kind === 'item') {
        params.rootItemKey = root.itemKey;
      }
      const model = buildProductionLineModel(params);

      model.nodes.forEach((node) => {
        const previous = mergedNodeById.get(node.nodeId);
        if (!previous) {
          mergedNodeById.set(node.nodeId, { ...node });
          return;
        }

        if (node.kind === 'item' && previous.kind === 'item') {
          previous.amount += node.amount;
          if (node.seedAmount !== undefined) {
            previous.seedAmount = (previous.seedAmount ?? 0) + node.seedAmount;
          }
          if (node.isRoot) previous.isRoot = true;
        } else if (node.kind === 'fluid' && previous.kind === 'fluid') {
          previous.amount += node.amount;
        } else if (node.kind === 'machine' && previous.kind === 'machine') {
          previous.amount += node.amount;
          if (node.machineCount !== undefined) {
            previous.machineCount = (previous.machineCount ?? 0) + node.machineCount;
          }
          if (node.machines !== undefined) {
            previous.machines = (previous.machines ?? 0) + node.machines;
          }
          if (!previous.machineItemId && node.machineItemId)
            previous.machineItemId = node.machineItemId;
          if (!previous.machineName && node.machineName) previous.machineName = node.machineName;
          node.outputItemKeys.forEach((outputKey) => {
            const outputHash = itemKeyHash(outputKey);
            if (!previous.outputItemKeys.some((value) => itemKeyHash(value) === outputHash)) {
              previous.outputItemKeys.push(outputKey);
            }
          });
          if (node.outputDetails?.length) {
            if (!previous.outputDetails) previous.outputDetails = [];
            node.outputDetails.forEach((detail) => {
              const detailHash = itemKeyHash(detail.key);
              const existing = previous.outputDetails!.find(
                (value) => itemKeyHash(value.key) === detailHash,
              );
              if (!existing) {
                previous.outputDetails!.push({ ...detail });
                return;
              }
              existing.demanded += detail.demanded;
              existing.machineCountOwn += detail.machineCountOwn;
              existing.surplusRate += detail.surplusRate;
            });
          }
        }
      });

      model.edges.forEach((edge) => {
        const previous = mergedEdgeById.get(edge.id);
        if (!previous) {
          mergedEdgeById.set(edge.id, { ...edge });
          return;
        }
        previous.amount += edge.amount;
      });
    });

    mergedNodeById.forEach((node) => {
      if (node.kind !== 'item') return;
      const hash = itemKeyHash(node.itemKey);
      if (input.targetRootHashes.value.has(hash)) node.isRoot = true;
    });

    return {
      nodes: Array.from(mergedNodeById.values()),
      edges: Array.from(mergedEdgeById.values()),
    };
  });

  const lineFlow = computed(() => {
    const model = lineModel.value;
    if (!model.nodes.length) return { nodes: [] as Node[], edges: [] as Edge[] };

    const lineRenderer = input.lineRenderer.value;
    const isG6Renderer = lineRenderer === 'g6';
    const titleById = new Map<string, string>();
    const unit = input.lineDisplayUnit.value;
    const unitText = input.unitSuffix(unit);

    const nodes: Node[] = model.nodes.map((node) => {
      if (node.kind === 'item') {
        const base = `${input.formatAmount(input.displayRateFromAmount(node.amount, unit))}${unitText}`;
        const seed =
          input.lineIncludeCycleSeeds.value && node.seedAmount && node.seedAmount > 0
            ? ` (seed ${input.formatAmount(node.seedAmount)})`
            : '';
        const subtitle = node.isSurplus ? `冗余 +${base}` : `${base}${seed}`;
        const title = input.itemName(node.itemKey);
        const recoverySource = node.recovery ? input.recoverySourceText(node) : '';
        titleById.set(node.nodeId, title);
        return {
          id: node.nodeId,
          type: 'lineItemNode',
          position: { x: 0, y: 0 },
          draggable: true,
          selectable: true,
          data: {
            itemKey: node.itemKey,
            title,
            subtitle,
            isRoot: !!node.isRoot,
            ...(node.isSurplus ? { isSurplus: true } : {}),
            forcedRaw: !node.isSurplus && !node.recovery && input.isForcedRawKey(node.itemKey),
            ...(node.recovery ? { recovery: true, recoverySource } : {}),
            inPorts: 0,
            outPorts: 0,
          } satisfies LineFlowItemData,
        };
      }
      if (node.kind === 'fluid') {
        const subtitle = `${input.formatAmount(input.displayRateFromAmount(node.amount, unit))}${unitText}${node.unit ?? ''}`;
        titleById.set(node.nodeId, node.id);
        return {
          id: node.nodeId,
          type: 'lineFluidNode',
          position: { x: 0, y: 0 },
          draggable: true,
          selectable: true,
          data: {
            title: node.id,
            subtitle,
            inPorts: 0,
            outPorts: 0,
          } satisfies LineFlowFluidData,
        };
      }

      const title = node.machineName ?? node.recipeTypeKey ?? node.recipeId;
      const primaryOutput = node.outputItemKeys[0];
      const outputName = primaryOutput ? input.itemName(primaryOutput) : title;
      const outputDetails = node.outputDetails ?? [];
      const totalProduced = outputDetails.reduce(
        (sum, detail) => sum + detail.demanded + Math.max(0, detail.surplusRate),
        0,
      );
      const totalUsed = outputDetails.reduce((sum, detail) => sum + detail.demanded, 0);
      const subtitle =
        outputDetails.length > 0
          ? `总产 ${input.formatAmount(input.displayRateFromAmount(totalProduced, unit))}${unitText} / 已用 ${input.formatAmount(input.displayRateFromAmount(totalUsed, unit))}${unitText}`
          : `${outputName} ${input.formatAmount(input.displayRateFromAmount(node.amount, unit))}${unitText}`;
      titleById.set(node.nodeId, title);
      return {
        id: node.nodeId,
        type: 'lineMachineNode',
        position: { x: 0, y: 0 },
        draggable: true,
        selectable: true,
        data: {
          title,
          subtitle,
          ...(node.machineItemId ? { machineItemId: node.machineItemId } : {}),
          ...(node.machineCount !== undefined
            ? (() => {
                const machineCount = input.formatMachineCountForDisplay(node.machineCount);
                return machineCount > 0 ? { machineCount } : {};
              })()
            : {}),
          outputItemKeys: node.outputItemKeys,
          ...(node.outputDetails
            ? {
                outputDetails: node.outputDetails.map((detail) => ({
                  ...detail,
                  outputName: input.itemName(detail.key),
                  demandedText: `${input.formatAmount(input.displayRateFromAmount(detail.demanded, unit))}${unitText}`,
                  usedText: `${input.formatAmount(input.displayRateFromAmount(detail.demanded, unit))}${unitText}`,
                  producedText: `${input.formatAmount(input.displayRateFromAmount(detail.demanded + Math.max(0, detail.surplusRate), unit))}${unitText}`,
                  ...(detail.surplusRate > 1e-9
                    ? {
                        surplusText: `${input.formatAmount(input.displayRateFromAmount(detail.surplusRate, unit))}${unitText}`,
                      }
                    : {}),
                })),
              }
            : {}),
          inPorts: 0,
          outPorts: 0,
        } satisfies LineFlowMachineData,
      };
    });

    const edges: Edge[] = model.edges.map((edge) => {
      const recovery = edge.kind === 'item' && edge.recovery;
      const surplus = edge.kind === 'item' && edge.surplus;
      const label = `${input.formatAmount(input.displayRateFromAmount(edge.amount, unit))}${unitText}${recovery ? ' ♻' : surplus ? ' □' : ''}`;
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        zIndex: 2000,
        type: 'default',
        curvature: 0.35,
        label,
        labelBgPadding: [6, 3],
        labelBgBorderRadius: 6,
        style: {
          strokeWidth: input.lineEdgeBaseWidthFromRate(edge.amount),
          ...(recovery ? { stroke: '#26a69a', strokeDasharray: '6 4' } : {}),
          ...(surplus ? { stroke: '#f59e0b', strokeDasharray: '6 4', opacity: 0.75 } : {}),
        },
        data: {
          kind: edge.kind,
          ...(edge.kind === 'item' ? { itemKey: edge.itemKey } : { fluidId: edge.fluidId }),
          ...(recovery ? { recovery: true } : {}),
          ...(surplus ? { surplus: true } : {}),
        } satisfies LineFlowEdgeData,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 10,
          height: 10,
          markerUnits: 'userSpaceOnUse',
          strokeWidth: 1.5,
        },
      };
    });

    const inEdgesByTarget = new Map<string, Edge[]>();
    const outEdgesBySource = new Map<string, Edge[]>();
    nodes.forEach((node) => {
      inEdgesByTarget.set(node.id, []);
      outEdgesBySource.set(node.id, []);
    });
    edges.forEach((edge) => {
      (outEdgesBySource.get(edge.source) ?? []).push(edge);
      (inEdgesByTarget.get(edge.target) ?? []).push(edge);
    });

    const MAX_PORTS = 10;
    nodes.forEach((node) => {
      const inList = inEdgesByTarget.get(node.id) ?? [];
      const outList = outEdgesBySource.get(node.id) ?? [];
      const inPorts = inList.length ? Math.min(MAX_PORTS, Math.max(1, inList.length)) : 0;
      const outPorts = outList.length ? Math.min(MAX_PORTS, Math.max(1, outList.length)) : 0;
      (node.data as LineFlowItemData | LineFlowMachineData | LineFlowFluidData).inPorts = inPorts;
      (node.data as LineFlowItemData | LineFlowMachineData | LineFlowFluidData).outPorts = outPorts;
    });

    const approximateTextWidth = (text: string, fontSize: number) =>
      Math.ceil(Array.from(text).length * fontSize * 0.58);
    const g6MachineOutputLines = (data: LineFlowMachineData) => {
      const details = data.outputDetails ?? [];
      if (!details.length) return [] as string[];
      return details.map((detail) => {
        const surplus = detail.surplusText ? ` 冗余${detail.surplusText}` : '';
        return `${detail.outputName} 总${detail.producedText} 已用${detail.usedText}${surplus}`;
      });
    };
    const layoutSizeByNodeId = new Map<string, { width: number; height: number }>();
    nodes.forEach((node) => {
      if (!isG6Renderer) {
        layoutSizeByNodeId.set(node.id, { width: 340, height: 64 });
        return;
      }
      const data = (node.data ?? {}) as LineFlowItemData | LineFlowMachineData | LineFlowFluidData;
      const title = `${data.title ?? ''}`;
      const subtitle = `${data.subtitle ?? ''}`;
      const detailLines =
        node.type === 'lineMachineNode' ? g6MachineOutputLines(data as LineFlowMachineData) : [];
      const lines = [title, subtitle, ...detailLines].filter((line) => line.trim().length > 0);
      const labelWidth = Math.max(...lines.map((line) => approximateTextWidth(line, 14)), 0);
      const width =
        node.type === 'lineMachineNode'
          ? Math.max(280, Math.min(540, labelWidth + 150))
          : node.type === 'lineFluidNode'
            ? Math.max(200, Math.min(320, labelWidth + 88))
            : Math.max(220, Math.min(360, labelWidth + 110));
      const height =
        node.type === 'lineMachineNode'
          ? Math.max(132, Math.min(300, 88 + lines.length * 20))
          : Math.max(112, Math.min(220, 78 + lines.length * 18));
      layoutSizeByNodeId.set(node.id, { width, height });
    });

    const nodeW = Math.max(
      ...Array.from(layoutSizeByNodeId.values()).map((size) => size.width),
      340,
    );
    const nodeH = Math.max(
      ...Array.from(layoutSizeByNodeId.values()).map((size) => size.height),
      64,
    );
    const gapY = 48;
    const pad = 18;
    const saved = input.lineNodePositionsForRenderer(lineRenderer);
    const layoutSignature = `${lineRenderer}:${unit}:${nodes
      .map((node) => {
        const data = (node.data ?? {}) as {
          title?: string;
          subtitle?: string;
          outputDetails?: Array<{
            outputName?: string;
            producedText?: string;
            usedText?: string;
            surplusText?: string;
          }>;
        };
        const outputs = Array.isArray(data.outputDetails)
          ? data.outputDetails
              .map(
                (detail) =>
                  `${detail.outputName ?? ''}:${detail.producedText ?? ''}:${detail.usedText ?? ''}:${detail.surplusText ?? ''}`,
              )
              .join('~')
          : '';
        return `${node.id}:${data.title ?? ''}:${data.subtitle ?? ''}:${outputs}`;
      })
      .join('|')}::${edges.map((edge) => `${edge.source}>${edge.target}`).join('|')}`;
    const cachedLayout = input.lineAutoLayoutCache.get(layoutSignature) ?? null;

    const nodeCenterFromPosition = (nodeId: string, position: PlannerNodePosition) => {
      if (isG6Renderer) return { x: position.x, y: position.y };
      const size = layoutSizeByNodeId.get(nodeId) ?? { width: nodeW, height: nodeH };
      return { x: position.x + size.width / 2, y: position.y + size.height / 2 };
    };

    const nodePositionFromCenter = (
      nodeId: string,
      centerX: number,
      centerY: number,
    ): PlannerNodePosition => {
      if (isG6Renderer) return { x: centerX, y: centerY };
      const size = layoutSizeByNodeId.get(nodeId) ?? { width: nodeW, height: nodeH };
      return { x: centerX - size.width / 2, y: centerY - size.height / 2 };
    };

    if (!cachedLayout) {
      const ids = nodes.map((node) => node.id);
      const out = new Map<string, string[]>();
      const inp = new Map<string, string[]>();
      ids.forEach((id) => {
        out.set(id, []);
        inp.set(id, []);
      });
      edges.forEach((edge) => {
        (out.get(edge.source) ?? []).push(edge.target);
        (inp.get(edge.target) ?? []).push(edge.source);
      });

      const tarjanIndex = new Map<string, number>();
      const low = new Map<string, number>();
      const onStack = new Set<string>();
      const stack: string[] = [];
      let index = 0;
      const comps: string[][] = [];

      const strongconnect = (value: string) => {
        tarjanIndex.set(value, index);
        low.set(value, index);
        index += 1;
        stack.push(value);
        onStack.add(value);

        (out.get(value) ?? []).forEach((nextValue) => {
          if (!tarjanIndex.has(nextValue)) {
            strongconnect(nextValue);
            low.set(value, Math.min(low.get(value) ?? 0, low.get(nextValue) ?? 0));
          } else if (onStack.has(nextValue)) {
            low.set(value, Math.min(low.get(value) ?? 0, tarjanIndex.get(nextValue) ?? 0));
          }
        });

        if ((low.get(value) ?? 0) === (tarjanIndex.get(value) ?? 0)) {
          const comp: string[] = [];
          while (stack.length) {
            const nextValue = stack.pop()!;
            onStack.delete(nextValue);
            comp.push(nextValue);
            if (nextValue === value) break;
          }
          comps.push(comp);
        }
      };

      ids.forEach((id) => {
        if (!tarjanIndex.has(id)) strongconnect(id);
      });

      const compById = new Map<string, number>();
      comps.forEach((comp, compId) => comp.forEach((id) => compById.set(id, compId)));

      const compIds = comps.map((_comp, compId) => compId);
      const compOut = new Map<number, number[]>();
      const compInp = new Map<number, number[]>();
      const compOutSeen = new Map<number, Set<number>>();
      const compInpSeen = new Map<number, Set<number>>();
      compIds.forEach((compId) => {
        compOut.set(compId, []);
        compInp.set(compId, []);
        compOutSeen.set(compId, new Set());
        compInpSeen.set(compId, new Set());
      });

      const compLabel = (compId: number) =>
        [...(comps[compId] ?? [])].sort((left, right) =>
          (titleById.get(left) ?? left).localeCompare(titleById.get(right) ?? right),
        )[0] ?? `comp:${compId}`;

      edges.forEach((edge) => {
        const sourceComp = compById.get(edge.source);
        const targetComp = compById.get(edge.target);
        if (sourceComp === undefined || targetComp === undefined || sourceComp === targetComp)
          return;
        if (!compOutSeen.get(sourceComp)?.has(targetComp)) {
          compOutSeen.get(sourceComp)?.add(targetComp);
          (compOut.get(sourceComp) ?? []).push(targetComp);
        }
        if (!compInpSeen.get(targetComp)?.has(sourceComp)) {
          compInpSeen.get(targetComp)?.add(sourceComp);
          (compInp.get(targetComp) ?? []).push(sourceComp);
        }
      });

      const compIndeg = new Map<number, number>();
      compIds.forEach((compId) => compIndeg.set(compId, (compInp.get(compId) ?? []).length));
      const compQueue = compIds
        .filter((compId) => (compIndeg.get(compId) ?? 0) === 0)
        .sort((left, right) => compLabel(left).localeCompare(compLabel(right)));

      const compTopo: number[] = [];
      while (compQueue.length) {
        const compId = compQueue.shift()!;
        compTopo.push(compId);
        (compOut.get(compId) ?? []).forEach((nextCompId) => {
          compIndeg.set(nextCompId, (compIndeg.get(nextCompId) ?? 0) - 1);
          if ((compIndeg.get(nextCompId) ?? 0) === 0) {
            compQueue.push(nextCompId);
            compQueue.sort((left, right) => compLabel(left).localeCompare(compLabel(right)));
          }
        });
      }
      const topoCompSet = new Set(compTopo);
      compIds.forEach((compId) => {
        if (!topoCompSet.has(compId)) compTopo.push(compId);
      });

      const layerByComp = new Map<number, number>();
      compTopo.forEach((compId) => layerByComp.set(compId, 0));
      compTopo.forEach((compId) => {
        const baseLayer = layerByComp.get(compId) ?? 0;
        (compOut.get(compId) ?? []).forEach((nextCompId) => {
          const previousLayer = layerByComp.get(nextCompId) ?? 0;
          if (baseLayer + 1 > previousLayer) layerByComp.set(nextCompId, baseLayer + 1);
        });
      });

      const maxLayer = Math.max(0, ...compIds.map((compId) => layerByComp.get(compId) ?? 0));
      const compsByLayer = new Map<number, number[]>();
      for (let layer = 0; layer <= maxLayer; layer += 1) compsByLayer.set(layer, []);
      compIds.forEach((compId) => {
        const layer = layerByComp.get(compId) ?? 0;
        (compsByLayer.get(layer) ?? []).push(compId);
      });

      compsByLayer.forEach((compList) =>
        compList.sort((left, right) => compLabel(left).localeCompare(compLabel(right))),
      );

      const compOrderIndex = new Map<number, number>();
      const refreshCompOrderIndex = () => {
        compsByLayer.forEach((compList) =>
          compList.forEach((compId, order) => compOrderIndex.set(compId, order)),
        );
      };
      refreshCompOrderIndex();

      const baryComp = (neighborCompIds: number[]) => {
        if (!neighborCompIds.length) return Number.POSITIVE_INFINITY;
        let sum = 0;
        let count = 0;
        neighborCompIds.forEach((neighborCompId) => {
          const order = compOrderIndex.get(neighborCompId);
          if (order === undefined) return;
          sum += order;
          count += 1;
        });
        return count ? sum / count : Number.POSITIVE_INFINITY;
      };

      const stableSortComps = (compList: number[], scoreFn: (compId: number) => number) => {
        const withScore = compList.map((compId, order) => ({
          compId,
          order,
          score: scoreFn(compId),
        }));
        withScore.sort((left, right) => left.score - right.score || left.order - right.order);
        return withScore.map((entry) => entry.compId);
      };

      for (let pass = 0; pass < 6; pass += 1) {
        for (let layer = 1; layer <= maxLayer; layer += 1) {
          const compList = compsByLayer.get(layer) ?? [];
          compsByLayer.set(
            layer,
            stableSortComps(compList, (compId) => baryComp(compInp.get(compId) ?? [])),
          );
          refreshCompOrderIndex();
        }
        for (let layer = maxLayer - 1; layer >= 0; layer -= 1) {
          const compList = compsByLayer.get(layer) ?? [];
          compsByLayer.set(
            layer,
            stableSortComps(compList, (compId) => baryComp(compOut.get(compId) ?? [])),
          );
          refreshCompOrderIndex();
        }
      }

      const compRadiusById = new Map<number, number>();
      const compStackGapById = new Map<number, number>();
      const compHalfHeightById = new Map<number, number>();
      const compCenterById = new Map<number, { x: number; y: number }>();
      const layerXGap = nodeW + (isG6Renderer ? 72 : 120);
      compIds.forEach((compId) => {
        const size = comps[compId]?.length ?? 0;
        const stackGap = size > 1 ? nodeH + 28 : 0;
        const compRadius = isG6Renderer && size > 1 ? Math.max(42, Math.sqrt(size) * 34) : 0;
        compRadiusById.set(compId, compRadius);
        compStackGapById.set(compId, stackGap);
        compHalfHeightById.set(
          compId,
          isG6Renderer && size > 1
            ? compRadius + nodeH / 2
            : size > 1
              ? ((size - 1) * stackGap) / 2 + nodeH / 2
              : nodeH / 2,
        );
      });
      compsByLayer.forEach((compList, layer) => {
        let cursorY = pad;
        compList.forEach((compId) => {
          const halfHeight = compHalfHeightById.get(compId) ?? nodeH / 2;
          const centerY = cursorY + halfHeight;
          const centerX = pad + nodeW / 2 + layer * layerXGap;
          compCenterById.set(compId, { x: centerX, y: centerY });
          cursorY += halfHeight * 2 + gapY;
        });
      });

      const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
      compIds.forEach((compId) => {
        const center = compCenterById.get(compId);
        if (!center) return;
        const stackGap = compStackGapById.get(compId) ?? 0;
        const orderedNodeIds = [...(comps[compId] ?? [])].sort((left, right) =>
          (titleById.get(left) ?? left).localeCompare(titleById.get(right) ?? right),
        );
        if (orderedNodeIds.length <= 1) {
          const node = nodeById.get(orderedNodeIds[0] ?? '');
          if (node) {
            node.position = nodePositionFromCenter(node.id, center.x, center.y);
          }
          return;
        }
        if (isG6Renderer) {
          const compRadius = compRadiusById.get(compId) ?? 0;
          const radiusX = Math.max(38, compRadius);
          const radiusY = Math.max(26, Math.min(nodeH * 0.92, compRadius * 0.78));
          orderedNodeIds.forEach((nodeId, order) => {
            const node = nodeById.get(nodeId);
            if (!node) return;
            const angle = (order / orderedNodeIds.length) * Math.PI * 2;
            node.position = nodePositionFromCenter(
              node.id,
              center.x + Math.cos(angle) * radiusX,
              center.y + Math.sin(angle) * radiusY,
            );
          });
          return;
        }
        orderedNodeIds.forEach((nodeId, order) => {
          const node = nodeById.get(nodeId);
          if (!node) return;
          const offsetY = (order - (orderedNodeIds.length - 1) / 2) * stackGap;
          node.position = nodePositionFromCenter(node.id, center.x, center.y + offsetY);
        });
      });

      type SimNode = {
        id: string;
        x: number;
        y: number;
        vx?: number;
        vy?: number;
        targetX: number;
        targetY: number;
        compId: number;
        radius: number;
      };
      type SimLink = {
        source: string;
        target: string;
        sameComp: boolean;
        layerGap: number;
      };

      const simNodes: SimNode[] = nodes.map((node) => {
        const compId = compById.get(node.id) ?? 0;
        const center = nodeCenterFromPosition(node.id, node.position);
        const size = layoutSizeByNodeId.get(node.id) ?? { width: nodeW, height: nodeH };
        return {
          id: node.id,
          x: center.x,
          y: center.y,
          targetX: center.x,
          targetY: center.y,
          compId,
          radius: Math.max(size.width, size.height) / 2 + (isG6Renderer ? 8 : 0),
        };
      });
      const simLinks: SimLink[] = edges.map((edge) => {
        const sourceComp = compById.get(edge.source) ?? 0;
        const targetComp = compById.get(edge.target) ?? 0;
        return {
          source: edge.source,
          target: edge.target,
          sameComp: sourceComp === targetComp,
          layerGap: Math.max(
            1,
            Math.abs((layerByComp.get(targetComp) ?? 0) - (layerByComp.get(sourceComp) ?? 0)),
          ),
        };
      });

      const minCenterX = pad + nodeW / 2;
      const minCenterY = pad + nodeH / 2;
      const simulation = forceSimulation(simNodes)
        .force('charge', forceManyBody().strength(-620))
        .force(
          'link',
          forceLink<SimNode, SimLink>(simLinks)
            .id((node: SimNode) => node.id)
            .distance((link: SimLink) =>
              link.sameComp
                ? nodeH + 40
                : Math.max(
                    isG6Renderer ? 150 : 180,
                    link.layerGap *
                      (nodeW + (isG6Renderer ? 36 : 64)) *
                      (isG6Renderer ? 0.58 : 0.72),
                  ),
            )
            .strength((link: SimLink) => (link.sameComp ? (isG6Renderer ? 0.16 : 0.24) : 0.1)),
        )
        .force(
          'x',
          forceX((node: SimNode) => node.targetX).strength((node: SimNode) => {
            const inCycle = (comps[node.compId]?.length ?? 0) > 1;
            if (!inCycle) return 0.34;
            return isG6Renderer ? 0.24 : 0.42;
          }),
        )
        .force(
          'y',
          forceY((node: SimNode) => node.targetY).strength((node: SimNode) => {
            const inCycle = (comps[node.compId]?.length ?? 0) > 1;
            if (!inCycle) return 0.26;
            return isG6Renderer ? 0.16 : 0.22;
          }),
        )
        .force(
          'collide',
          forceCollide((node: SimNode) => node.radius)
            .iterations(2)
            .strength(1),
        )
        .stop();

      const tickCount = Math.max(20, Math.min(48, Math.ceil(nodes.length)));
      for (let tick = 0; tick < tickCount; tick += 1) {
        simulation.tick();
        simNodes.forEach((node) => {
          const compCenter = compCenterById.get(node.compId);
          const compRadius = compRadiusById.get(node.compId) ?? 0;
          const compHalfHeight = compHalfHeightById.get(node.compId) ?? nodeH / 2;
          const xSlack = Math.max(nodeW * 0.22, compRadius + nodeW * 0.16);
          const ySlack = Math.max(nodeH * 1.1, compHalfHeight + nodeH * 0.45);
          if (compCenter) {
            node.x = Math.max(compCenter.x - xSlack, Math.min(compCenter.x + xSlack, node.x));
            node.y = Math.max(compCenter.y - ySlack, Math.min(compCenter.y + ySlack, node.y));
          }
          node.x = Math.max(minCenterX, node.x);
          node.y = Math.max(minCenterY, node.y);
        });
      }

      simNodes.forEach((simNode) => {
        const node = nodeById.get(simNode.id);
        if (!node) return;
        node.position = nodePositionFromCenter(simNode.id, simNode.x, simNode.y);
      });

      const resolveNodeOverlaps = (passes: number) => {
        const xThreshold = nodeW + 40;
        const yThreshold = nodeH + 18;
        for (let pass = 0; pass < passes; pass += 1) {
          const orderedNodes = [...nodes].sort(
            (left, right) =>
              left.position.x - right.position.x || left.position.y - right.position.y,
          );
          for (let i = 0; i < orderedNodes.length; i += 1) {
            const left = orderedNodes[i]!;
            for (let j = i + 1; j < orderedNodes.length; j += 1) {
              const right = orderedNodes[j]!;
              if (right.position.x - left.position.x > xThreshold) break;
              const leftCenter = nodeCenterFromPosition(left.id, left.position);
              const rightCenter = nodeCenterFromPosition(right.id, right.position);
              const dx = rightCenter.x - leftCenter.x;
              const dy = rightCenter.y - leftCenter.y;
              const overlapX = nodeW + 24 - Math.abs(dx);
              const overlapY = yThreshold - Math.abs(dy);
              if (overlapX <= 0 || overlapY <= 0) continue;
              const sameComp = compById.get(left.id) === compById.get(right.id);
              const preferVertical = sameComp || Math.abs(dx) < nodeW * 0.55;
              if (preferVertical) {
                const push = overlapY / 2 + 2;
                const dir = dy >= 0 ? 1 : -1;
                left.position = nodePositionFromCenter(
                  left.id,
                  leftCenter.x,
                  leftCenter.y - push * dir,
                );
                right.position = nodePositionFromCenter(
                  right.id,
                  rightCenter.x,
                  rightCenter.y + push * dir,
                );
              } else {
                const push = overlapX / 2 + 2;
                const dir = dx >= 0 ? 1 : -1;
                left.position = nodePositionFromCenter(
                  left.id,
                  leftCenter.x - push * dir,
                  leftCenter.y,
                );
                right.position = nodePositionFromCenter(
                  right.id,
                  rightCenter.x + push * dir,
                  rightCenter.y,
                );
              }
              left.position.x = Math.max(pad, left.position.x);
              left.position.y = Math.max(pad, left.position.y);
              right.position.x = Math.max(pad, right.position.x);
              right.position.y = Math.max(pad, right.position.y);
            }
          }
        }
      };

      resolveNodeOverlaps(3);

      const cachedPositions = Object.fromEntries(
        nodes.map((node) => [node.id, { x: node.position.x, y: node.position.y }]),
      );
      input.lineAutoLayoutCache.set(layoutSignature, cachedPositions);
      if (input.lineAutoLayoutCache.size > 24) {
        const oldestKey = input.lineAutoLayoutCache.keys().next().value;
        if (typeof oldestKey === 'string') input.lineAutoLayoutCache.delete(oldestKey);
      }
    }

    const baseLayout = input.lineAutoLayoutCache.get(layoutSignature) ?? cachedLayout;
    if (baseLayout) {
      nodes.forEach((node) => {
        const pos = baseLayout[node.id];
        if (pos) node.position = { ...pos };
      });
    }
    if (saved.size) {
      nodes.forEach((node) => {
        const pos = saved.get(node.id);
        if (pos) node.position = { ...pos };
      });
    }

    const posById = new Map(nodes.map((node) => [node.id, node.position] as const));
    nodes.forEach((node) => {
      const nx = posById.get(node.id)?.x ?? 0;
      const inList = (inEdgesByTarget.get(node.id) ?? []).slice().sort((left, right) => {
        const leftY = posById.get(left.source)?.y ?? 0;
        const rightY = posById.get(right.source)?.y ?? 0;
        if (leftY !== rightY) return leftY - rightY;
        const leftX = posById.get(left.source)?.x ?? 0;
        const rightX = posById.get(right.source)?.x ?? 0;
        return Math.abs(rightX - nx) - Math.abs(leftX - nx);
      });
      const outList = (outEdgesBySource.get(node.id) ?? []).slice().sort((left, right) => {
        const leftY = posById.get(left.target)?.y ?? 0;
        const rightY = posById.get(right.target)?.y ?? 0;
        if (leftY !== rightY) return leftY - rightY;
        const leftX = posById.get(left.target)?.x ?? 0;
        const rightX = posById.get(right.target)?.x ?? 0;
        return Math.abs(rightX - nx) - Math.abs(leftX - nx);
      });
      inList.forEach((edge, index) => {
        edge.targetHandle = `t${index % MAX_PORTS}`;
      });
      outList.forEach((edge, index) => {
        edge.sourceHandle = `s${index % MAX_PORTS}`;
      });
    });

    return { nodes, edges };
  });

  const lineFlowNodes = computed(() =>
    lineFlow.value.nodes.map((node) => ({
      ...node,
      draggable: true,
    })),
  );

  const selectedLineItemData = computed<LineFlowItemData | null>(() => {
    const selectedId = input.selectedLineNodeId.value;
    if (!selectedId) return null;
    const node = lineFlowNodes.value.find(
      (value) => value.id === selectedId && value.type === 'lineItemNode',
    );
    if (!node) return null;
    return node.data as LineFlowItemData;
  });

  const selectedLineItemForcedRaw = computed(() => {
    const node = selectedLineItemData.value;
    if (!node) return false;
    return input.isForcedRawKey(node.itemKey);
  });

  const lineFlowEdges = computed(() => lineFlow.value.edges);

  const lineEdgeBaseStroke = (edge: Edge): string | null => {
    const data = (edge.data ?? {}) as Partial<LineFlowEdgeData>;
    if (data.kind === 'fluid') return '#0ea5e9';
    if (data.kind === 'item' && data.itemKey) {
      const color = input.itemColorOfDef(
        input.itemDefsByKeyHash.value?.[itemKeyHash(data.itemKey)],
      );
      if (color) return color;
    }
    return null;
  };

  const lineFlowEdgesStyled = computed(() => {
    const selectedId = input.selectedLineNodeId.value;
    if (!selectedId) {
      return lineFlowEdges.value.map((edge) => ({
        ...edge,
        style: {
          ...(edge.style ?? {}),
          ...(input.lineIntermediateColoring.value
            ? (() => {
                const stroke = lineEdgeBaseStroke(edge);
                return stroke ? { stroke } : {};
              })()
            : {}),
          strokeWidth: input.lineEdgeStrokeWidth(edge, 'normal'),
        },
        ...(edge.zIndex !== undefined ? { zIndex: edge.zIndex } : {}),
      }));
    }

    const outEdgesBySource = new Map<string, Edge[]>();
    const inEdgesByTarget = new Map<string, Edge[]>();
    lineFlowEdges.value.forEach((edge) => {
      if (!outEdgesBySource.has(edge.source)) outEdgesBySource.set(edge.source, []);
      if (!inEdgesByTarget.has(edge.target)) inEdgesByTarget.set(edge.target, []);
      outEdgesBySource.get(edge.source)!.push(edge);
      inEdgesByTarget.get(edge.target)!.push(edge);
    });

    const downstreamEdgeIds = new Set<string>();
    const upstreamEdgeIds = new Set<string>();
    const downstreamNodeIds = new Set<string>();

    const walkDownstream = (start: string) => {
      const visited = new Set<string>();
      const queue = [start];
      visited.add(start);
      downstreamNodeIds.add(start);
      while (queue.length) {
        const current = queue.shift()!;
        (outEdgesBySource.get(current) ?? []).forEach((edge) => {
          downstreamEdgeIds.add(edge.id);
          if (!visited.has(edge.target)) {
            visited.add(edge.target);
            downstreamNodeIds.add(edge.target);
            queue.push(edge.target);
          }
        });
      }
    };

    const walkUpstream = (start: string) => {
      const visited = new Set<string>();
      const queue = [start];
      visited.add(start);
      while (queue.length) {
        const current = queue.shift()!;
        (inEdgesByTarget.get(current) ?? []).forEach((edge) => {
          upstreamEdgeIds.add(edge.id);
          if (!visited.has(edge.source)) {
            visited.add(edge.source);
            queue.push(edge.source);
          }
        });
      }
    };

    walkDownstream(selectedId);
    walkUpstream(selectedId);

    const rootItemIds = new Set(
      lineFlowNodes.value
        .filter((node) => node.type === 'lineItemNode' && (node.data as LineFlowItemData).isRoot)
        .map((node) => node.id),
    );
    const itemIds = new Set(
      lineFlowNodes.value.filter((node) => node.type === 'lineItemNode').map((node) => node.id),
    );
    const incomingFromMachine = new Set<string>();
    lineFlowEdges.value.forEach((edge) => {
      if (edge.source.startsWith('m:') && itemIds.has(edge.target))
        incomingFromMachine.add(edge.target);
    });
    const leafItemIds = new Set(Array.from(itemIds).filter((id) => !incomingFromMachine.has(id)));

    return lineFlowEdges.value.map((edge) => {
      const connected = edge.source === selectedId || edge.target === selectedId;
      const inPath = downstreamEdgeIds.has(edge.id) || upstreamEdgeIds.has(edge.id);
      const toRoot = rootItemIds.has(edge.target) && downstreamNodeIds.has(edge.target);
      const fromLeaf = leafItemIds.has(edge.source);
      const style = toRoot
        ? {
            ...(edge.style ?? {}),
            stroke: '#7e57c2',
            strokeWidth: input.lineEdgeStrokeWidth(edge, 'toRoot'),
            opacity: 0.95,
          }
        : connected
          ? {
              ...(edge.style ?? {}),
              stroke: 'var(--q-primary)',
              strokeWidth: input.lineEdgeStrokeWidth(edge, 'connected'),
              opacity: 1,
            }
          : inPath
            ? {
                ...(edge.style ?? {}),
                stroke: 'var(--q-secondary)',
                strokeWidth: input.lineEdgeStrokeWidth(edge, 'path'),
                opacity: 0.9,
              }
            : fromLeaf
              ? {
                  ...(edge.style ?? {}),
                  stroke: '#f9a825',
                  strokeWidth: input.lineEdgeStrokeWidth(edge, 'fromLeaf'),
                  opacity: 0.85,
                }
              : {
                  ...(edge.style ?? {}),
                  strokeWidth: input.lineEdgeStrokeWidth(edge, 'normal'),
                  opacity: 0.2,
                };
      const result: Edge = {
        ...edge,
        style,
      };
      if (connected) {
        result.zIndex = 3000;
      } else if (inPath) {
        result.zIndex = 2500;
      } else if (edge.zIndex !== undefined) {
        result.zIndex = edge.zIndex;
      }
      return result;
    });
  });

  return {
    lineFlowNodes,
    lineFlowEdgesStyled,
    selectedLineItemData,
    selectedLineItemForcedRaw,
  };
}
