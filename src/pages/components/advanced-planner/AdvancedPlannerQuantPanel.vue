<template>
  <div :class="['planner__pagefull', { 'planner__pagefull--active': quantPageFull }]">
    <advanced-planner-viewport-toolbar
      :page-full="quantPageFull"
      :fullscreen="quantFullscreen"
      @update:page-full="emit('update:quant-page-full', $event)"
      @toggle-fullscreen="emit('toggle-fullscreen')"
    >
      <div class="text-caption text-grey-8">{{ t('displayUnit') }}</div>
      <q-select
        dense
        filled
        emit-value
        map-options
        popup-content-class="planner__select-menu"
        style="min-width: 120px"
        :options="targetUnitOptions"
        :model-value="quantDisplayUnit"
        @update:model-value="emit('update:quant-display-unit', $event as PlannerTargetUnit)"
      />
      <q-toggle
        :model-value="quantShowFluids"
        dense
        :label="t('showFluids')"
        @update:model-value="emit('update:quant-show-fluids', !!$event)"
      />
      <q-toggle
        :model-value="quantWidthByRate"
        dense
        :label="t('lineWidthByRate')"
        @update:model-value="emit('update:quant-width-by-rate', !!$event)"
      />
      <q-btn-toggle
        dense
        outlined
        no-caps
        toggle-color="primary"
        :model-value="quantFlowRenderer"
        :options="[
          { label: t('nodeGraph'), value: 'nodes' },
          { label: t('sankeyGraph'), value: 'sankey' },
        ]"
        @update:model-value="
          emit('update:quant-flow-renderer', ($event as 'nodes' | 'sankey') ?? 'nodes')
        "
      />
    </advanced-planner-viewport-toolbar>

    <div
      v-if="quantNodeCount"
      ref="flowWrapEl"
      class="planner__flow"
      :class="{ 'planner__flow--fullscreen': quantFullscreen }"
    >
      <quant-flow-view
        :mode="quantFlowRenderer"
        :model="quantModel"
        :node-positions="quantNodePositionsRecord"
        :item-defs-by-key-hash="itemDefsByKeyHash"
        :display-unit="quantDisplayUnit"
        :width-by-rate="quantWidthByRate"
        :belt-speed="beltSpeed"
        :line-width-curve-config="lineWidthCurveConfig"
        :line-width-scale="quantLineWidthScale"
        :machine-count-decimals="machineCountDecimals"
        @node-drag-stop="emit('node-drag-stop', $event)"
        @item-click="emit('item-click', $event)"
        @item-mouseenter="emit('item-mouseenter', $event)"
        @item-mouseleave="emit('item-mouseleave')"
      />
    </div>
    <div v-else class="text-center text-grey q-pa-lg">{{ t('noNodes') }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import QuantFlowView from 'src/jei/components/QuantFlowView.vue';
import AdvancedPlannerViewportToolbar from 'src/pages/components/advanced-planner/AdvancedPlannerViewportToolbar.vue';
import type { LineWidthCurveConfig } from 'src/jei/planner/lineWidthCurve';
import type { QuantFlowEdge, QuantFlowNode } from 'src/jei/planner/quantFlow';
import type { PlannerTargetUnit } from 'src/jei/planner/plannerUi';
import type { ItemDef, ItemKey } from 'src/jei/types';

defineProps<{
  itemDefsByKeyHash: Record<string, ItemDef>;
  targetUnitOptions: Array<{ label: string; value: string }>;
  quantPageFull: boolean;
  quantFullscreen: boolean;
  quantDisplayUnit: PlannerTargetUnit;
  quantShowFluids: boolean;
  quantWidthByRate: boolean;
  quantFlowRenderer: 'nodes' | 'sankey';
  quantNodeCount: number;
  quantModel: { nodes: QuantFlowNode[]; edges: QuantFlowEdge[] };
  quantNodePositionsRecord: Record<string, { x: number; y: number }>;
  beltSpeed: number;
  lineWidthCurveConfig: LineWidthCurveConfig;
  quantLineWidthScale: number;
  machineCountDecimals: number;
}>();

const emit = defineEmits<{
  'update:quant-page-full': [value: boolean];
  'toggle-fullscreen': [];
  'update:quant-display-unit': [value: PlannerTargetUnit];
  'update:quant-show-fluids': [value: boolean];
  'update:quant-width-by-rate': [value: boolean];
  'update:quant-flow-renderer': [value: 'nodes' | 'sankey'];
  'node-drag-stop': [event: { node: { id: string; position: { x: number; y: number } } }];
  'item-click': [itemKey: ItemKey];
  'item-mouseenter': [keyHash: string];
  'item-mouseleave': [];
}>();

const { t } = useI18n();
const flowWrapEl = ref<HTMLElement | null>(null);

defineExpose({
  getFlowWrapEl: () => flowWrapEl.value,
});
</script>
