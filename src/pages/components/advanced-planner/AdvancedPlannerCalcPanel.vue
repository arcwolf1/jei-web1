<template>
  <div class="column q-gutter-md">
    <div v-if="calcPlanDirty" class="planner__calc-sticky">
      <q-banner dense rounded inline-actions class="bg-warning text-black shadow-4">
        <span>{{ t('calcRecomputeRequired') }}</span>
        <template #action>
          <q-btn
            dense
            no-caps
            color="black"
            text-color="warning"
            :label="t('recomputeNow')"
            @click="emit('recompute-requested')"
          />
        </template>
      </q-banner>
    </div>

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
        :model-value="calcDisplayUnit"
        @update:model-value="emit('update:calc-display-unit', $event as PlannerTargetUnit)"
      />
    </div>

    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-4">
        <q-card flat bordered class="q-pa-md">
          <div class="text-subtitle2">{{ t('totalPower') }}</div>
          <div class="text-h6">{{ formatAmount(calcPower) }} kW</div>
          <div class="text-caption text-grey-7">
            {{ t('pollutionPerMin', { amount: formatAmount(calcPollution) }) }}
          </div>
        </q-card>
      </div>
      <div class="col-12 col-md-4">
        <q-card flat bordered class="q-pa-md">
          <div class="text-subtitle2">{{ t('totalEquipment') }}</div>
          <div class="text-h6">{{ formatAmount(calcMachineTotal) }}</div>
          <div class="text-caption text-grey-7">
            {{ calcMachineRows.length }} {{ t('machineTypes') }}
          </div>
        </q-card>
      </div>
      <div class="col-12 col-md-4">
        <q-card flat bordered class="q-pa-md">
          <div class="text-subtitle2">{{ t('outputTypes') }}</div>
          <div class="text-h6">{{ calcItemRows.length }}</div>
          <div class="text-caption text-grey-7">{{ t('summaryByNode') }}</div>
        </q-card>
      </div>
    </div>

    <q-card flat bordered class="q-pa-md">
      <div class="text-subtitle2 q-mb-md">{{ t('equipmentRequirements') }}</div>
      <q-table
        dense
        flat
        :rows="calcMachineRows"
        :columns="calcMachineColumnsTyped"
        row-key="id"
        :rows-per-page-options="[0]"
      >
        <template #body-cell-name="scope">
          <q-td :props="scope">
            <div class="row items-center q-gutter-sm">
              <stack-view
                :content="{ kind: 'item', id: scope.row.id, amount: 1 }"
                :item-defs-by-key-hash="itemDefsByKeyHash"
                variant="slot"
                :show-name="false"
                :show-subtitle="false"
                @item-click="emit('item-click', $event)"
                @item-mouseenter="emit('item-mouseenter', $event)"
                @item-mouseleave="emit('item-mouseleave')"
              />
              <span>{{ scope.row.name }}</span>
            </div>
          </q-td>
        </template>
        <template #body-cell-count="scope">
          <q-td :props="scope" class="text-right">
            {{ formatAmount(scope.row.count) }}
          </q-td>
        </template>
      </q-table>
    </q-card>

    <q-card flat bordered class="q-pa-md">
      <div class="text-subtitle2 q-mb-md">{{ t('intermediateProductionCount') }}</div>
      <q-table
        dense
        flat
        :rows="calcIntermediateRows"
        :columns="calcIntermediateColumnsTyped"
        row-key="id"
        :rows-per-page-options="[0]"
      >
        <template #body-cell-name="scope">
          <q-td :props="scope">
            <div class="row items-center q-gutter-sm">
              <stack-view
                :content="{ kind: 'item', id: scope.row.id, amount: 1 }"
                :item-defs-by-key-hash="itemDefsByKeyHash"
                variant="slot"
                :show-name="false"
                :show-subtitle="false"
                @item-click="emit('item-click', $event)"
                @item-mouseenter="emit('item-mouseenter', $event)"
                @item-mouseleave="emit('item-mouseleave')"
              />
              <span>{{ scope.row.name }}</span>
            </div>
          </q-td>
        </template>
        <template #body-cell-amount="scope">
          <q-td :props="scope" class="text-right">
            {{ formatAmount(scope.row.amount) }}
          </q-td>
        </template>
        <template #body-cell-rate="scope">
          <q-td :props="scope" class="text-right">
            {{ formatAmount(scope.row.rate) }}
          </q-td>
        </template>
        <template #body-cell-action="scope">
          <q-td :props="scope">
            <div class="column q-gutter-xs planner__action-cell">
              <q-btn
                dense
                outline
                no-caps
                size="sm"
                class="planner__action-button"
                :color="scope.row.forcedRaw ? 'warning' : 'primary'"
                :icon="scope.row.forcedRaw ? 'undo' : 'inventory_2'"
                :label="scope.row.forcedRaw ? t('cancelRawMaterial') : t('setAsRawMaterial')"
                @click="
                  emit('toggle-forced-raw-item', {
                    itemId: scope.row.id,
                    forced: !scope.row.forcedRaw,
                  })
                "
              />
              <q-select
                v-if="getRecipeOptionsForItemId(scope.row.id).length"
                dense
                outlined
                options-dense
                :disable="getRecipeOptionsForItemId(scope.row.id).length <= 1"
                emit-value
                map-options
                popup-content-class="planner__select-menu"
                class="planner__recipe-select"
                :options="getRecipeOptionsForItemId(scope.row.id)"
                :model-value="getSelectedRecipeIdForItemId(scope.row.id)"
                @update:model-value="
                  emit('set-recipe-choice', {
                    itemId: scope.row.id,
                    recipeId: String($event ?? ''),
                  })
                "
              >
                <template #selected-item="selectedScope">
                  <div class="planner__recipe-selected row items-center no-wrap">
                    <q-icon name="alt_route" size="14px" class="q-mr-xs" />
                    <span class="ellipsis">
                      {{ selectedScope.opt.triggerLabel }}
                    </span>
                  </div>
                </template>
                <template #option="optionScope">
                  <q-item v-bind="optionScope.itemProps" class="planner__recipe-option-item">
                    <q-item-section>
                      <q-item-label>{{ optionScope.opt.machineLabel }}</q-item-label>
                      <q-item-label
                        v-if="optionScope.opt.inputSummary"
                        caption
                        class="planner__recipe-option-summary"
                      >
                        {{ t('input') }}: {{ optionScope.opt.inputSummary }}
                      </q-item-label>
                      <q-item-label
                        v-if="optionScope.opt.outputSummary"
                        caption
                        class="planner__recipe-option-summary"
                      >
                        {{ t('output') }}: {{ optionScope.opt.outputSummary }}
                      </q-item-label>
                    </q-item-section>
                  </q-item>
                </template>
              </q-select>
            </div>
          </q-td>
        </template>
      </q-table>
    </q-card>

    <q-card v-if="calcForcedRawRows.length" flat bordered class="q-pa-md">
      <div class="text-subtitle2 q-mb-md">{{ t('rawMaterialList') }}</div>
      <q-table
        dense
        flat
        :rows="calcForcedRawRows"
        :columns="calcForcedRawColumnsTyped"
        row-key="keyHash"
        :rows-per-page-options="[0]"
      >
        <template #body-cell-name="scope">
          <q-td :props="scope">
            <div class="row items-center q-gutter-sm">
              <stack-view
                :content="{
                  kind: 'item',
                  id: scope.row.itemKey.id,
                  amount: 1,
                  ...(scope.row.itemKey.meta !== undefined ? { meta: scope.row.itemKey.meta } : {}),
                  ...(scope.row.itemKey.nbt !== undefined ? { nbt: scope.row.itemKey.nbt } : {}),
                }"
                :item-defs-by-key-hash="itemDefsByKeyHash"
                variant="slot"
                :show-name="false"
                :show-subtitle="false"
                @item-click="emit('item-click', $event)"
                @item-mouseenter="emit('item-mouseenter', $event)"
                @item-mouseleave="emit('item-mouseleave')"
              />
              <span>{{ scope.row.name }}</span>
            </div>
          </q-td>
        </template>
        <template #body-cell-amount="scope">
          <q-td :props="scope" class="text-right">
            {{ formatAmount(scope.row.amount) }}
          </q-td>
        </template>
        <template #body-cell-rate="scope">
          <q-td :props="scope" class="text-right">
            {{ formatAmount(scope.row.rate) }}
          </q-td>
        </template>
        <template #body-cell-action="scope">
          <q-td :props="scope">
            <div class="column q-gutter-xs planner__action-cell">
              <q-btn
                dense
                outline
                no-caps
                size="sm"
                class="planner__action-button"
                color="warning"
                icon="undo"
                :label="t('cancelRawMaterial')"
                @click="emit('clear-forced-raw-key', scope.row.keyHash)"
              />
              <q-select
                v-if="getRecipeOptionsForItemId(scope.row.itemKey.id).length"
                dense
                outlined
                options-dense
                :disable="getRecipeOptionsForItemId(scope.row.itemKey.id).length <= 1"
                emit-value
                map-options
                popup-content-class="planner__select-menu"
                class="planner__recipe-select"
                :options="getRecipeOptionsForItemId(scope.row.itemKey.id)"
                :model-value="getSelectedRecipeIdForItemId(scope.row.itemKey.id)"
                @update:model-value="
                  emit('set-recipe-choice', {
                    itemId: scope.row.itemKey.id,
                    recipeId: String($event ?? ''),
                  })
                "
              >
                <template #selected-item="selectedScope">
                  <div class="planner__recipe-selected row items-center no-wrap">
                    <q-icon name="alt_route" size="14px" class="q-mr-xs" />
                    <span class="ellipsis">
                      {{ selectedScope.opt.triggerLabel }}
                    </span>
                  </div>
                </template>
                <template #option="optionScope">
                  <q-item v-bind="optionScope.itemProps" class="planner__recipe-option-item">
                    <q-item-section>
                      <q-item-label>{{ optionScope.opt.machineLabel }}</q-item-label>
                      <q-item-label
                        v-if="optionScope.opt.inputSummary"
                        caption
                        class="planner__recipe-option-summary"
                      >
                        {{ t('input') }}: {{ optionScope.opt.inputSummary }}
                      </q-item-label>
                      <q-item-label
                        v-if="optionScope.opt.outputSummary"
                        caption
                        class="planner__recipe-option-summary"
                      >
                        {{ t('output') }}: {{ optionScope.opt.outputSummary }}
                      </q-item-label>
                    </q-item-section>
                  </q-item>
                </template>
              </q-select>
            </div>
          </q-td>
        </template>
      </q-table>
    </q-card>

    <q-card flat bordered class="q-pa-md">
      <div class="text-subtitle2 q-mb-md">{{ t('outputRate') }}</div>
      <q-table
        dense
        flat
        :rows="calcItemRows"
        :columns="calcItemColumnsTyped"
        row-key="id"
        :rows-per-page-options="[0]"
      >
        <template #body-cell-name="scope">
          <q-td :props="scope">
            <div class="row items-center q-gutter-sm">
              <stack-view
                :content="{ kind: 'item', id: scope.row.id, amount: 1 }"
                :item-defs-by-key-hash="itemDefsByKeyHash"
                variant="slot"
                :show-name="false"
                :show-subtitle="false"
                @item-click="emit('item-click', $event)"
                @item-mouseenter="emit('item-mouseenter', $event)"
                @item-mouseleave="emit('item-mouseleave')"
              />
              <span>{{ scope.row.name }}</span>
            </div>
          </q-td>
        </template>
        <template #body-cell-rate="scope">
          <q-td :props="scope" class="text-right">
            {{ formatAmount(scope.row.rate) }}
          </q-td>
        </template>
        <template #body-cell-action="scope">
          <q-td :props="scope">
            <q-select
              v-if="getRecipeOptionsForItemId(scope.row.id).length"
              dense
              outlined
              options-dense
              :disable="getRecipeOptionsForItemId(scope.row.id).length <= 1"
              emit-value
              map-options
              popup-content-class="planner__select-menu"
              class="planner__recipe-select"
              :options="getRecipeOptionsForItemId(scope.row.id)"
              :model-value="getSelectedRecipeIdForItemId(scope.row.id)"
              @update:model-value="
                emit('set-recipe-choice', {
                  itemId: scope.row.id,
                  recipeId: String($event ?? ''),
                })
              "
            >
              <template #selected-item="selectedScope">
                <div class="planner__recipe-selected row items-center no-wrap">
                  <q-icon name="alt_route" size="14px" class="q-mr-xs" />
                  <span class="ellipsis">
                    {{ selectedScope.opt.triggerLabel }}
                  </span>
                </div>
              </template>
              <template #option="optionScope">
                <q-item v-bind="optionScope.itemProps" class="planner__recipe-option-item">
                  <q-item-section>
                    <q-item-label>{{ optionScope.opt.machineLabel }}</q-item-label>
                    <q-item-label
                      v-if="optionScope.opt.inputSummary"
                      caption
                      class="planner__recipe-option-summary"
                    >
                      {{ t('input') }}: {{ optionScope.opt.inputSummary }}
                    </q-item-label>
                    <q-item-label
                      v-if="optionScope.opt.outputSummary"
                      caption
                      class="planner__recipe-option-summary"
                    >
                      {{ t('output') }}: {{ optionScope.opt.outputSummary }}
                    </q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
          </q-td>
        </template>
      </q-table>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import StackView from 'src/jei/components/StackView.vue';
import type { PlannerTargetUnit } from 'src/jei/planner/plannerUi';
import type { ItemDef, ItemKey } from 'src/jei/types';
import type {
  CalcRecipeOption,
  CalcForcedRawRow,
  CalcIntermediateRow,
  CalcItemRow,
  CalcMachineRow,
  PlannerTableColumn,
} from 'src/pages/components/advanced-planner/advancedPlanner.types';

const props = defineProps<{
  itemDefsByKeyHash: Record<string, ItemDef>;
  targetUnitOptions: Array<{ label: string; value: string }>;
  calcDisplayUnit: PlannerTargetUnit;
  calcPlanDirty: boolean;
  calcPower: number;
  calcPollution: number;
  calcMachineRows: CalcMachineRow[];
  calcItemRows: CalcItemRow[];
  calcIntermediateRows: CalcIntermediateRow[];
  calcForcedRawRows: CalcForcedRawRow[];
  calcMachineColumns: PlannerTableColumn<CalcMachineRow>[];
  calcItemColumns: PlannerTableColumn<CalcItemRow>[];
  calcIntermediateColumns: PlannerTableColumn<CalcIntermediateRow>[];
  calcForcedRawColumns: PlannerTableColumn<CalcForcedRawRow>[];
  formatAmount: (amount: number) => string | number;
  getRecipeOptionsForItemId: (itemId: string) => CalcRecipeOption[];
  getSelectedRecipeIdForItemId: (itemId: string) => string | null;
}>();

const emit = defineEmits<{
  'update:calc-display-unit': [value: PlannerTargetUnit];
  'toggle-forced-raw-item': [payload: { itemId: string; forced: boolean }];
  'clear-forced-raw-key': [keyHash: string];
  'set-recipe-choice': [payload: { itemId: string; recipeId: string }];
  'recompute-requested': [];
  'item-click': [itemKey: ItemKey];
  'item-mouseenter': [keyHash: string];
  'item-mouseleave': [];
}>();

const { t } = useI18n();
const calcMachineTotal = computed(() =>
  props.calcMachineRows.reduce((sum, row) => sum + row.count, 0),
);
const calcMachineColumnsTyped = computed(
  () => props.calcMachineColumns as QTableColumn<CalcMachineRow>[],
);
const calcItemColumnsTyped = computed(() => props.calcItemColumns as QTableColumn<CalcItemRow>[]);
const calcIntermediateColumnsTyped = computed(
  () => props.calcIntermediateColumns as QTableColumn<CalcIntermediateRow>[],
);
const calcForcedRawColumnsTyped = computed(
  () => props.calcForcedRawColumns as QTableColumn<CalcForcedRawRow>[],
);
</script>

<style scoped>
.planner__calc-sticky {
  position: sticky;
  top: 8px;
  z-index: 5;
  align-self: flex-end;
  max-width: min(560px, 100%);
}

.planner__recipe-select {
  width: 100%;
  min-width: 0;
}

.planner__recipe-selected {
  max-width: 148px;
  font-size: 12px;
}

.planner__action-cell {
  width: 164px;
}

.planner__action-button {
  width: 100%;
}

.planner__recipe-option-item {
  max-width: 420px;
}

.planner__recipe-option-summary {
  line-height: 1.35;
  white-space: normal;
}
</style>
