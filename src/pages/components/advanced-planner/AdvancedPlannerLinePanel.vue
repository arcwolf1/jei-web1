<template>
  <div :class="['planner__pagefull', { 'planner__pagefull--active': linePageFull }]">
    <advanced-planner-viewport-toolbar
      :page-full="linePageFull"
      :fullscreen="lineFullscreen"
      @update:page-full="emit('update:line-page-full', $event)"
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
        :model-value="lineDisplayUnit"
        @update:model-value="emit('update:line-display-unit', $event as PlannerTargetUnit)"
      />
      <q-toggle
        :model-value="lineCollapseIntermediate"
        dense
        :label="t('hideIntermediate')"
        @update:model-value="emit('update:line-collapse-intermediate', !!$event)"
      />
      <q-toggle
        :model-value="lineIncludeCycleSeeds"
        dense
        :label="t('showCycleSeeds')"
        @update:model-value="emit('update:line-include-cycle-seeds', !!$event)"
      />
      <q-toggle
        :model-value="lineWidthByRate"
        dense
        :label="t('lineWidthByRate')"
        @update:model-value="emit('update:line-width-by-rate', !!$event)"
      />
      <q-toggle
        :model-value="lineIntermediateColoring"
        dense
        :label="t('intermediateColoring')"
        @update:model-value="emit('update:line-intermediate-coloring', !!$event)"
      />
      <q-toggle
        v-if="
          selectedLineItemData && !selectedLineItemData.isRoot && !selectedLineItemData.recovery
        "
        :model-value="selectedLineItemForcedRaw"
        dense
        color="warning"
        :label="t('treatAsRawMaterial')"
        @update:model-value="emit('update:selected-line-item-forced-raw', !!$event)"
      />
      <q-btn
        v-if="lineWidthByRate"
        dense
        flat
        no-caps
        icon="tune"
        :label="t('lineWidthEditCurve')"
        @click="emit('open-line-width-curve')"
      />
      <q-btn-toggle
        dense
        outlined
        no-caps
        toggle-color="primary"
        :model-value="productionLineRenderer"
        :options="[
          { label: 'VueFlow', value: 'vue_flow' },
          { label: 'G6', value: 'g6' },
        ]"
        @update:model-value="
          emit('update:production-line-renderer', ($event as 'vue_flow' | 'g6') ?? 'vue_flow')
        "
      />
    </advanced-planner-viewport-toolbar>

    <div
      v-if="lineFlowNodes.length"
      ref="flowWrapEl"
      class="planner__flow"
      :class="{ 'planner__flow--fullscreen': lineFullscreen }"
    >
      <line-flow-view
        flow-id="advanced-planner-line-flow"
        :renderer="productionLineRenderer"
        :nodes="lineFlowNodes"
        :edges="lineFlowEdgesStyled"
        :selected-node-id="selectedLineNodeId"
        :item-defs-by-key-hash="itemDefsByKeyHash"
        :flow-background-pattern-color="flowBackgroundPatternColor"
        :line-width-scale="productionLineG6Scale"
        @update:selected-node-id="emit('update:selected-line-node-id', $event)"
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
import type { Edge, Node } from '@vue-flow/core';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import LineFlowView from 'src/jei/components/LineFlowView.vue';
import AdvancedPlannerViewportToolbar from 'src/pages/components/advanced-planner/AdvancedPlannerViewportToolbar.vue';
import type { PlannerGraphRenderer, PlannerTargetUnit } from 'src/jei/planner/plannerUi';
import type { ItemDef, ItemKey } from 'src/jei/types';

type SelectedLineItemData = {
  isRoot: boolean;
  recovery?: boolean;
};

defineProps<{
  itemDefsByKeyHash: Record<string, ItemDef>;
  targetUnitOptions: Array<{ label: string; value: string }>;
  linePageFull: boolean;
  lineFullscreen: boolean;
  lineDisplayUnit: PlannerTargetUnit;
  lineCollapseIntermediate: boolean;
  lineIncludeCycleSeeds: boolean;
  lineWidthByRate: boolean;
  lineIntermediateColoring: boolean;
  selectedLineItemData: SelectedLineItemData | null;
  selectedLineItemForcedRaw: boolean;
  productionLineRenderer: PlannerGraphRenderer;
  lineFlowNodes: Node[];
  lineFlowEdgesStyled: Edge[];
  selectedLineNodeId: string | null;
  flowBackgroundPatternColor: string;
  productionLineG6Scale: number;
}>();

const emit = defineEmits<{
  'update:line-page-full': [value: boolean];
  'toggle-fullscreen': [];
  'update:line-display-unit': [value: PlannerTargetUnit];
  'update:line-collapse-intermediate': [value: boolean];
  'update:line-include-cycle-seeds': [value: boolean];
  'update:line-width-by-rate': [value: boolean];
  'update:line-intermediate-coloring': [value: boolean];
  'update:selected-line-item-forced-raw': [value: boolean];
  'open-line-width-curve': [];
  'update:production-line-renderer': [value: PlannerGraphRenderer];
  'update:selected-line-node-id': [value: string | null];
  'node-drag-stop': [event: { node: Node }];
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
