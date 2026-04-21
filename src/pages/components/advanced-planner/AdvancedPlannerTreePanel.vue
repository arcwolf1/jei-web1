<template>
  <div class="column q-gutter-md">
    <div class="row items-center q-gutter-sm">
      <div class="text-caption text-grey-8">{{ t('displayUnit') }}</div>
      <q-select
        dense
        filled
        emit-value
        map-options
        popup-content-class="planner__select-menu"
        style="min-width: 120px"
        :options="targetUnitOptions"
        :model-value="treeDisplayUnit"
        @update:model-value="emit('update:tree-display-unit', $event as PlannerTargetUnit)"
      />
      <q-space />
      <q-btn-toggle
        :model-value="treeDisplayMode"
        dense
        outline
        toggle-color="primary"
        :options="[
          { label: t('displayModeList'), value: 'list' },
          { label: t('displayModeCompact'), value: 'compact' },
        ]"
        @update:model-value="emit('update:tree-display-mode', $event as 'list' | 'compact')"
      />
    </div>

    <div v-if="hasMergedTree" class="q-mt-md">
      <div v-if="treeDisplayMode === 'list'" class="planner__tree-table">
        <div class="planner__tree-table-header">
          <div class="planner__tree-col planner__tree-col--tree">
            {{ t('treeStructure') }}
          </div>
          <div class="planner__tree-col planner__tree-col--rate text-right">
            {{ rateColumnLabel }}
          </div>
          <div class="planner__tree-col planner__tree-col--belts text-right">
            {{ t('conveyorBelt') }}
          </div>
          <div class="planner__tree-col planner__tree-col--machines text-right">
            {{ t('equipment') }}
          </div>
          <div class="planner__tree-col planner__tree-col--power text-right">
            {{ t('power') }}
          </div>
        </div>
        <div v-for="row in treeListRows" :key="row.node.nodeId" class="planner__tree-table-row">
          <div class="planner__tree-col planner__tree-col--tree">
            <div class="planner__links">
              <template v-if="row.connect.length">
                <div
                  v-for="(trail, index) in row.connect"
                  :key="index"
                  class="planner__connect"
                  :class="{
                    'planner__connect--trail': trail,
                    'planner__connect--last': index === row.connect.length - 1,
                  }"
                ></div>
              </template>
              <div class="planner__tree-toggle">
                <q-btn
                  v-if="row.node.kind === 'item' && row.node.children.length"
                  flat
                  dense
                  round
                  size="sm"
                  :icon="collapsed.has(row.node.nodeId) ? 'chevron_right' : 'expand_more'"
                  @click="emit('toggle-collapsed', row.node.nodeId)"
                />
                <div v-else style="width: 28px"></div>
              </div>
              <div class="planner__tree-icon">
                <stack-view
                  v-if="row.node.kind === 'item'"
                  :content="{ kind: 'item', id: row.node.itemKey.id, amount: 1 }"
                  :item-defs-by-key-hash="itemDefsByKeyHash"
                  variant="slot"
                  :show-name="false"
                  :show-subtitle="false"
                  @item-click="emit('item-click', $event)"
                  @item-mouseenter="emit('item-mouseenter', $event)"
                  @item-mouseleave="emit('item-mouseleave')"
                />
                <stack-view
                  v-else
                  :content="
                    row.node.unit
                      ? { kind: 'fluid', id: row.node.id, amount: 1, unit: row.node.unit }
                      : { kind: 'fluid', id: row.node.id, amount: 1 }
                  "
                  :item-defs-by-key-hash="itemDefsByKeyHash"
                  variant="slot"
                  :show-name="false"
                  :show-subtitle="false"
                  @item-mouseleave="emit('item-mouseleave')"
                />
              </div>
              <div class="planner__tree-name">
                <div class="planner__tree-name-main">
                  {{ row.node.kind === 'item' ? itemName(row.node.itemKey) : row.node.id }}
                </div>
                <div class="planner__tree-name-sub text-caption text-grey-7">
                  {{ formatAmount(nodeDisplayAmount(row.node)) }}
                </div>
                <div
                  v-if="row.node.kind === 'item' && row.node.recovery"
                  class="planner__tree-name-sub text-caption text-positive"
                >
                  {{ recoverySourceText(row.node) }}
                </div>
                <div
                  v-if="
                    row.node.kind === 'item' &&
                    (recoveryProducedByNodeId.get(row.node.nodeId)?.length ?? 0) > 0
                  "
                  class="planner__tree-name-sub text-caption text-teal-8"
                >
                  {{ t('recoveryOutput') }}：{{ recoveryProducedText(row.node.nodeId) }}
                </div>
              </div>
              <q-badge
                v-if="row.node.kind === 'item' && row.node.recovery"
                color="teal"
                class="q-ml-sm"
              >
                recovery
              </q-badge>
              <q-badge
                v-if="
                  row.node.kind === 'item' &&
                  (recoveryProducedByNodeId.get(row.node.nodeId)?.length ?? 0) > 0
                "
                color="teal-6"
                class="q-ml-sm"
              >
                {{ t('recoveryOutput') }}
                <q-tooltip>{{ recoveryProducedText(row.node.nodeId) }}</q-tooltip>
              </q-badge>
              <q-badge
                v-if="row.node.kind === 'item' && row.node.cycle"
                :color="row.node.cycleSeed ? 'positive' : 'negative'"
                class="q-ml-sm"
              >
                {{ row.node.cycleSeed ? 'cycle seed' : 'cycle' }}
              </q-badge>
            </div>
          </div>
          <div class="planner__tree-col planner__tree-col--rate text-right monospace">
            {{ formatAmount(nodeDisplayRate(row.node)) }}
          </div>
          <div class="planner__tree-col planner__tree-col--belts text-right monospace">
            {{ nodeBeltsText(row.node) }}
          </div>
          <div class="planner__tree-col planner__tree-col--machines text-right">
            <div class="planner__machines-cell">
              <template v-if="row.node.kind === 'item' && row.node.machineItemId">
                <stack-view
                  :content="{ kind: 'item', id: row.node.machineItemId, amount: 1 }"
                  :item-defs-by-key-hash="itemDefsByKeyHash"
                  variant="slot"
                  :show-name="false"
                  :show-subtitle="false"
                  @item-click="emit('item-click', $event)"
                  @item-mouseenter="emit('item-mouseenter', $event)"
                  @item-mouseleave="emit('item-mouseleave')"
                />
                <div class="planner__machines-text monospace">
                  {{ nodeMachinesText(row.node) }}
                </div>
              </template>
            </div>
          </div>
          <div class="planner__tree-col planner__tree-col--power text-right monospace">
            {{ nodePowerText(row.node) }}
          </div>
        </div>
      </div>
      <div v-else class="column q-gutter-xs">
        <div v-for="row in treeRows" :key="row.node.nodeId" class="planner__tree-row">
          <div class="planner__tree-indent" :style="{ width: `${row.depth * 18}px` }"></div>
          <q-btn
            v-if="row.node.kind === 'item' && row.node.children.length"
            flat
            dense
            round
            size="sm"
            :icon="collapsed.has(row.node.nodeId) ? 'chevron_right' : 'expand_more'"
            @click="emit('toggle-collapsed', row.node.nodeId)"
          />
          <div v-else style="width: 28px"></div>
          <div class="planner__tree-content">
            <stack-view
              v-if="row.node.kind === 'item'"
              :content="{
                kind: 'item',
                id: row.node.itemKey.id,
                amount: nodeDisplayRate(row.node),
              }"
              :item-defs-by-key-hash="itemDefsByKeyHash"
              @item-click="emit('item-click', $event)"
              @item-mouseenter="emit('item-mouseenter', $event)"
              @item-mouseleave="emit('item-mouseleave')"
            />
            <stack-view
              v-else
              :content="
                row.node.unit
                  ? {
                      kind: 'fluid',
                      id: row.node.id,
                      amount: nodeDisplayRate(row.node),
                      unit: row.node.unit,
                    }
                  : { kind: 'fluid', id: row.node.id, amount: nodeDisplayRate(row.node) }
              "
              :item-defs-by-key-hash="itemDefsByKeyHash"
              @item-mouseleave="emit('item-mouseleave')"
            />
            <q-badge
              v-if="row.node.kind === 'item' && row.node.recovery"
              color="teal"
              class="q-ml-sm"
            >
              recovery
              <q-tooltip>{{ recoverySourceText(row.node) }}</q-tooltip>
            </q-badge>
            <q-badge
              v-if="
                row.node.kind === 'item' &&
                (recoveryProducedByNodeId.get(row.node.nodeId)?.length ?? 0) > 0
              "
              color="teal-6"
              class="q-ml-sm"
            >
              {{ t('recoveryOutput') }}
              <q-tooltip>{{ recoveryProducedText(row.node.nodeId) }}</q-tooltip>
            </q-badge>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import StackView from 'src/jei/components/StackView.vue';
import type { PlannerTargetUnit } from 'src/jei/planner/plannerUi';
import type { ItemDef, ItemKey } from 'src/jei/types';
import type {
  PlannerTreeNode,
  TreeListRow,
  TreeRow,
} from 'src/pages/components/advanced-planner/advancedPlanner.types';

const props = defineProps<{
  itemDefsByKeyHash: Record<string, ItemDef>;
  targetUnitOptions: Array<{ label: string; value: string }>;
  treeDisplayUnit: PlannerTargetUnit;
  treeDisplayMode: 'list' | 'compact';
  hasMergedTree: boolean;
  treeRows: TreeRow[];
  treeListRows: TreeListRow[];
  collapsed: Set<string>;
  recoveryProducedByNodeId: Map<string, Array<{ itemKey: ItemKey; amount: number }>>;
  itemName: (itemKey: ItemKey) => string;
  formatAmount: (amount: number) => string | number;
  nodeDisplayAmount: (node: PlannerTreeNode) => number;
  nodeDisplayRate: (node: PlannerTreeNode) => number;
  nodeBeltsText: (node: PlannerTreeNode) => string;
  nodeMachinesText: (node: PlannerTreeNode) => string;
  nodePowerText: (node: PlannerTreeNode) => string;
  recoverySourceText: (node: {
    recovery?: boolean;
    recoverySourceItemKey?: ItemKey;
    recoverySourceRecipeId?: string;
    recoverySourceRecipeTypeKey?: string;
  }) => string;
  recoveryProducedText: (nodeId: string) => string;
}>();

const emit = defineEmits<{
  'update:tree-display-unit': [value: PlannerTargetUnit];
  'update:tree-display-mode': [value: 'list' | 'compact'];
  'toggle-collapsed': [nodeId: string];
  'item-click': [itemKey: ItemKey];
  'item-mouseenter': [keyHash: string];
  'item-mouseleave': [];
}>();

const { t } = useI18n();
const rateColumnLabel = computed(() => {
  if (props.treeDisplayUnit === 'items') return t('itemCount');
  if (props.treeDisplayUnit === 'per_second') return t('itemsPerSecond');
  if (props.treeDisplayUnit === 'per_hour') return t('itemsPerHour');
  return t('itemsPerMinute');
});
</script>
