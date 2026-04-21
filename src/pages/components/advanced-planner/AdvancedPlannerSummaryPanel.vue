<template>
  <div class="column q-gutter-md">
    <q-card flat bordered class="q-pa-md">
      <div class="text-subtitle2 q-mb-md">
        {{ t('rawMaterialRequirements', { count: rawItemCount }) }}
      </div>
      <q-list dense bordered separator class="rounded-borders">
        <q-item v-for="[itemId, amount] in rawItemEntries" :key="itemId">
          <q-item-section avatar>
            <stack-view
              :content="{ kind: 'item', id: itemId, amount }"
              :item-defs-by-key-hash="itemDefsByKeyHash"
            />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ getItemName(itemId) }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-item-label caption>{{ formatSummaryAmount(amount) }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card>

    <q-card v-if="rawFluidEntries.length" flat bordered class="q-pa-md">
      <div class="text-subtitle2 q-mb-md">
        {{ t('rawMaterialFluidRequirements', { count: rawFluidCount }) }}
      </div>
      <q-list dense bordered separator class="rounded-borders">
        <q-item v-for="[fluidId, amount] in rawFluidEntries" :key="fluidId">
          <q-item-section avatar>
            <stack-view
              :content="{ kind: 'fluid', id: fluidId, amount }"
              :item-defs-by-key-hash="itemDefsByKeyHash"
            />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ fluidId }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-item-label caption>{{ formatSummaryAmount(amount) }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card>

    <q-card v-if="catalystEntries.length > 0" flat bordered class="q-pa-md">
      <div class="text-subtitle2 q-mb-md">
        {{ t('catalystRequirements', { count: catalystEntries.length }) }}
      </div>
      <q-list dense bordered separator class="rounded-borders">
        <q-item v-for="[itemId, amount] in catalystEntries" :key="itemId">
          <q-item-section avatar>
            <stack-view
              :content="{ kind: 'item', id: itemId, amount }"
              :item-defs-by-key-hash="itemDefsByKeyHash"
            />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ getItemName(itemId) }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-item-label caption>{{ amount }} {{ t('itemUnit') }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card>

    <q-card v-if="cycleSeedEntries.length" flat bordered class="q-pa-md">
      <div class="text-subtitle2 q-mb-md">
        {{ t('cycleSeedAnalysis', { count: cycleSeedEntries.length }) }}
      </div>
      <q-list dense bordered separator class="rounded-borders">
        <q-item v-for="seed in cycleSeedEntries" :key="seed.nodeId">
          <q-item-section avatar>
            <stack-view
              :content="{ kind: 'item', id: seed.itemKey.id, amount: seed.seedAmount }"
              :item-defs-by-key-hash="itemDefsByKeyHash"
            />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ itemName(seed.itemKey) }}</q-item-label>
            <q-item-label caption>
              {{ t('need') }} {{ formatSummaryAmount(seed.amountNeeded) }}
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-item-label caption>
              {{ t('seeds') }} {{ formatAmount(seed.seedAmount) }}
            </q-item-label>
            <q-item-label caption v-if="seed.cycleFactor">
              {{ t('growthFactor') }} {{ formatAmount(seed.cycleFactor) }}
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import StackView from 'src/jei/components/StackView.vue';
import type { ItemDef, ItemId, ItemKey } from 'src/jei/types';
import type { CycleSeedInfo } from 'src/pages/components/advanced-planner/advancedPlanner.types';

const props = defineProps<{
  itemDefsByKeyHash: Record<string, ItemDef>;
  rawItemTotals: Map<ItemId, number>;
  rawFluidTotals: Map<string, number>;
  catalystTotals: Map<ItemId, number>;
  cycleSeedEntries: CycleSeedInfo[];
  getItemName: (itemId: ItemId) => string;
  itemName: (itemKey: ItemKey) => string;
  formatSummaryAmount: (amount: number) => string;
  formatAmount: (amount: number) => string | number;
}>();

const { t } = useI18n();
const rawItemEntries = computed(() =>
  Array.from(props.rawItemTotals.entries()).sort((a, b) => b[1] - a[1]),
);
const rawFluidEntries = computed(() =>
  Array.from(props.rawFluidTotals.entries()).sort((a, b) => b[1] - a[1]),
);
const catalystEntries = computed(() =>
  Array.from(props.catalystTotals.entries()).sort((a, b) => b[1] - a[1]),
);
const rawItemCount = computed(() => props.rawItemTotals.size);
const rawFluidCount = computed(() => props.rawFluidTotals.size);
</script>
