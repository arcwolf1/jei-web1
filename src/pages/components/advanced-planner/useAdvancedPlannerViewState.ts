import { type ComputedRef, type Ref } from 'vue';
import { finiteOr } from 'src/pages/components/advanced-planner/advancedPlannerViewUtils';
import type {
  AdvancedPlannerTab,
  AdvancedPlannerViewState,
  PlannerGraphRenderer,
  PlannerNodePosition,
  PlannerTargetUnit,
} from 'src/jei/planner/plannerUi';

function nodePositionMapToRecord(
  value: Map<string, PlannerNodePosition>,
): Record<string, PlannerNodePosition> {
  const out: Record<string, PlannerNodePosition> = {};
  value.forEach((pos, id) => {
    const x = finiteOr(pos?.x, Number.NaN);
    const y = finiteOr(pos?.y, Number.NaN);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    out[id] = { x, y };
  });
  return out;
}

function recordToNodePositionMap(
  value: Record<string, PlannerNodePosition> | undefined,
): Map<string, PlannerNodePosition> {
  const out = new Map<string, PlannerNodePosition>();
  if (!value || typeof value !== 'object') return out;
  Object.entries(value).forEach(([id, pos]) => {
    const x = finiteOr(pos?.x, Number.NaN);
    const y = finiteOr(pos?.y, Number.NaN);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    out.set(id, { x, y });
  });
  return out;
}

export function useAdvancedPlannerViewState(input: {
  activeTab: Ref<AdvancedPlannerTab>;
  lineDisplayUnit: Ref<PlannerTargetUnit>;
  lineCollapseIntermediate: Ref<boolean>;
  lineIncludeCycleSeeds: Ref<boolean>;
  selectedLineNodeId: Ref<string | null>;
  lineNodePositionsVueFlow: Ref<Map<string, PlannerNodePosition>>;
  lineNodePositionsG6: Ref<Map<string, PlannerNodePosition>>;
  quantDisplayUnit: Ref<PlannerTargetUnit>;
  quantShowFluids: Ref<boolean>;
  quantWidthByRate: Ref<boolean>;
  quantNodePositions: Ref<Map<string, PlannerNodePosition>>;
  calcDisplayUnit: Ref<PlannerTargetUnit>;
  productionLineRenderer: ComputedRef<PlannerGraphRenderer>;
  isAdvancedPlannerTab: (value: unknown) => value is AdvancedPlannerTab;
  isPlannerTargetUnit: (value: unknown) => value is PlannerTargetUnit;
}): {
  lineNodePositionsForRenderer: (
    renderer: PlannerGraphRenderer,
  ) => Map<string, PlannerNodePosition>;
  setLineNodePositionsForRenderer: (
    renderer: PlannerGraphRenderer,
    value: Map<string, PlannerNodePosition>,
  ) => void;
  buildSavedViewState: () => AdvancedPlannerViewState;
  applySavedViewState: (viewState: AdvancedPlannerViewState | undefined) => void;
} {
  const lineNodePositionsForRenderer = (
    renderer: PlannerGraphRenderer,
  ): Map<string, PlannerNodePosition> =>
    renderer === 'g6'
      ? input.lineNodePositionsG6.value
      : input.lineNodePositionsVueFlow.value;

  const setLineNodePositionsForRenderer = (
    renderer: PlannerGraphRenderer,
    value: Map<string, PlannerNodePosition>,
  ): void => {
    if (renderer === 'g6') {
      input.lineNodePositionsG6.value = value;
      return;
    }
    input.lineNodePositionsVueFlow.value = value;
  };

  const buildSavedViewState = (): AdvancedPlannerViewState => ({
    activeTab: input.activeTab.value,
    line: {
      displayUnit: input.lineDisplayUnit.value,
      collapseIntermediate: input.lineCollapseIntermediate.value,
      includeCycleSeeds: input.lineIncludeCycleSeeds.value,
      selectedNodeId: input.selectedLineNodeId.value,
      nodePositions: nodePositionMapToRecord(
        lineNodePositionsForRenderer(input.productionLineRenderer.value),
      ),
      nodePositionsByRenderer: {
        vue_flow: nodePositionMapToRecord(input.lineNodePositionsVueFlow.value),
        g6: nodePositionMapToRecord(input.lineNodePositionsG6.value),
      },
    },
    quant: {
      displayUnit: input.quantDisplayUnit.value,
      showFluids: input.quantShowFluids.value,
      widthByRate: input.quantWidthByRate.value,
      nodePositions: nodePositionMapToRecord(input.quantNodePositions.value),
    },
    calc: {
      displayUnit: input.calcDisplayUnit.value,
    },
  });

  const applySavedViewState = (viewState: AdvancedPlannerViewState | undefined): void => {
    if (input.isAdvancedPlannerTab(viewState?.activeTab)) {
      input.activeTab.value = viewState.activeTab;
    }

    const lineView = viewState?.line;
    if (input.isPlannerTargetUnit(lineView?.displayUnit)) {
      input.lineDisplayUnit.value = lineView.displayUnit;
    }
    if (typeof lineView?.collapseIntermediate === 'boolean') {
      input.lineCollapseIntermediate.value = lineView.collapseIntermediate;
    }
    if (typeof lineView?.includeCycleSeeds === 'boolean') {
      input.lineIncludeCycleSeeds.value = lineView.includeCycleSeeds;
    }
    input.selectedLineNodeId.value =
      typeof lineView?.selectedNodeId === 'string' ? lineView.selectedNodeId : null;
    const vueFlowPositions = lineView?.nodePositionsByRenderer?.vue_flow;
    const g6Positions = lineView?.nodePositionsByRenderer?.g6;
    const fallbackPositions = recordToNodePositionMap(lineView?.nodePositions);
    input.lineNodePositionsVueFlow.value =
      vueFlowPositions !== undefined
        ? recordToNodePositionMap(vueFlowPositions)
        : new Map(fallbackPositions);
    input.lineNodePositionsG6.value =
      g6Positions !== undefined ? recordToNodePositionMap(g6Positions) : fallbackPositions;

    const quantView = viewState?.quant;
    if (input.isPlannerTargetUnit(quantView?.displayUnit)) {
      input.quantDisplayUnit.value = quantView.displayUnit;
    }
    if (typeof quantView?.showFluids === 'boolean') {
      input.quantShowFluids.value = quantView.showFluids;
    }
    if (typeof quantView?.widthByRate === 'boolean') {
      input.quantWidthByRate.value = quantView.widthByRate;
    }
    input.quantNodePositions.value = recordToNodePositionMap(quantView?.nodePositions);

    const calcView = viewState?.calc;
    if (input.isPlannerTargetUnit(calcView?.displayUnit)) {
      input.calcDisplayUnit.value = calcView.displayUnit;
    }
  };

  return {
    lineNodePositionsForRenderer,
    setLineNodePositionsForRenderer,
    buildSavedViewState,
    applySavedViewState,
  };
}
