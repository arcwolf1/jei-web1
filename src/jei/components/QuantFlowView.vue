<template>
  <quant-flow-g6-view
    v-if="mode === 'nodes'"
    :model="model"
    :node-positions="nodePositions ?? {}"
    :item-defs-by-key-hash="itemDefsByKeyHash"
    :display-unit="displayUnit"
    :width-by-rate="widthByRate"
    :belt-speed="beltSpeed"
    :line-width-curve-config="lineWidthCurveConfig"
    :line-width-scale="lineWidthScale"
    :machine-count-decimals="machineCountDecimals"
    @node-drag-stop="$emit('node-drag-stop', $event)"
    @item-click="$emit('item-click', $event)"
    @item-mouseenter="$emit('item-mouseenter', $event)"
    @item-mouseleave="$emit('item-mouseleave')"
  />
  <quant-flow-sankey-view
    v-else
    :model="model"
    :item-defs-by-key-hash="itemDefsByKeyHash"
    :display-unit="displayUnit"
    :width-by-rate="widthByRate"
    :line-width-scale="lineWidthScale"
    @item-click="$emit('item-click', $event)"
    @item-mouseenter="$emit('item-mouseenter', $event)"
    @item-mouseleave="$emit('item-mouseleave')"
  />
</template>

<script setup lang="ts">
import type { ItemDef, ItemKey } from 'src/jei/types';
import type { QuantFlowEdge, QuantFlowNode } from 'src/jei/planner/quantFlow';
import type { LineWidthCurveConfig } from 'src/jei/planner/lineWidthCurve';
import QuantFlowG6View from 'src/jei/components/QuantFlowG6View.vue';
import QuantFlowSankeyView from 'src/jei/components/QuantFlowSankeyView.vue';

type DisplayUnit = 'items' | 'per_second' | 'per_minute' | 'per_hour';

defineProps<{
  mode: 'nodes' | 'sankey';
  model: { nodes: QuantFlowNode[]; edges: QuantFlowEdge[] };
  nodePositions?: Record<string, { x: number; y: number }>;
  itemDefsByKeyHash: Record<string, ItemDef>;
  displayUnit: DisplayUnit;
  widthByRate: boolean;
  beltSpeed: number;
  lineWidthCurveConfig: LineWidthCurveConfig;
  lineWidthScale: number;
  machineCountDecimals: number;
}>();

defineEmits<{
  (e: 'node-drag-stop', evt: { node: { id: string; position: { x: number; y: number } } }): void;
  (e: 'item-click', itemKey: ItemKey): void;
  (e: 'item-mouseenter', keyHash: string): void;
  (e: 'item-mouseleave'): void;
}>();
</script>
