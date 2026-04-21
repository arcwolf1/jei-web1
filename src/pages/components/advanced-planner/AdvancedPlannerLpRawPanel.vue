<template>
  <div class="column q-gutter-md">
    <q-card flat bordered class="q-pa-md">
      <div class="text-subtitle2 q-mb-sm">
        {{ t('lpSolutionResult') }}
        <q-badge color="deep-purple" class="q-ml-sm"
          >{{ lpRawRows.length }} {{ t('recipes2') }}</q-badge
        >
      </div>
      <q-table
        dense
        flat
        :rows="lpRawRows"
        :columns="lpRawColumnsTyped"
        row-key="id"
        :rows-per-page-options="[0]"
      >
        <template #body-cell-name="scope">
          <q-td :props="scope">
            <div class="row items-start q-gutter-xs no-wrap">
              <stack-view
                v-if="scope.row.itemId"
                :content="{ kind: 'item', id: scope.row.itemId, amount: 1 }"
                :item-defs-by-key-hash="itemDefsByKeyHash"
                variant="slot"
                :show-name="false"
                :show-subtitle="false"
              />
              <div class="column">
                <span>{{ scope.row.name }}</span>
                <span v-if="scope.row.recipeLabel" class="text-caption text-grey-6">
                  {{ scope.row.recipeLabel }}
                </span>
                <span v-if="scope.row.inputSummary" class="text-caption text-grey-6">
                  {{ scope.row.inputSummary }}
                </span>
                <span v-if="scope.row.outputSummary" class="text-caption text-grey-6">
                  {{ scope.row.outputSummary }}
                </span>
              </div>
              <q-badge v-if="!scope.row.recipeId" color="grey" :label="t('rawMaterial')" />
            </div>
          </q-td>
        </template>
        <template #body-cell-surplus="scope">
          <q-td :props="scope" class="text-right">
            <span :class="scope.row.surplus > 0 ? 'text-orange-7' : ''">
              {{ scope.row.surplus > 0 ? scope.row.surplus.toFixed(4) : '-' }}
            </span>
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
import type { ItemDef } from 'src/jei/types';
import type {
  LpRawRow,
  PlannerTableColumn,
} from 'src/pages/components/advanced-planner/advancedPlanner.types';

const props = defineProps<{
  itemDefsByKeyHash: Record<string, ItemDef>;
  lpRawRows: LpRawRow[];
  lpRawColumns: PlannerTableColumn<LpRawRow>[];
}>();

const { t } = useI18n();
const lpRawColumnsTyped = computed(() => props.lpRawColumns as QTableColumn<LpRawRow>[]);
</script>
