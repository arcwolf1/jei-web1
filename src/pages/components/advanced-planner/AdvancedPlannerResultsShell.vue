<template>
  <q-card
    flat
    bordered
    :class="[
      'q-pa-md',
      'q-mt-md',
      'advanced-planner__results',
      { 'advanced-planner__results--details-collapsed': detailsCollapsed },
    ]"
  >
    <div class="row items-center q-mb-md">
      <div class="text-subtitle2">{{ embedded ? t('lineSelection') : t('multiTargetPlanning') }}</div>
      <q-space />
      <q-btn
        dense
        outline
        icon="save"
        :label="t('savePlan')"
        :disable="pendingDecisionsCount > 0"
        @click="emit('open-save')"
      />
      <q-btn-dropdown
        dense
        outline
        icon="share"
        :label="t('share')"
        :disable="pendingDecisionsCount > 0"
      >
        <q-list dense style="min-width: 180px">
          <q-item clickable v-close-popup @click="emit('share-url')">
            <q-item-section avatar><q-icon name="link" /></q-item-section>
            <q-item-section>{{ t('copyShareLink') }}</q-item-section>
          </q-item>
          <q-item clickable v-close-popup @click="emit('copy-json')">
            <q-item-section avatar><q-icon name="data_object" /></q-item-section>
            <q-item-section>{{ t('copyJson') }}</q-item-section>
          </q-item>
          <q-item clickable v-close-popup @click="emit('share-json-url')">
            <q-item-section avatar><q-icon name="link" /></q-item-section>
            <q-item-section>{{ t('shareWithJsonUrl') }}</q-item-section>
          </q-item>
          <q-item clickable v-close-popup @click="emit('import-json')">
            <q-item-section avatar><q-icon name="upload_file" /></q-item-section>
            <q-item-section>{{ t('importJson') }}</q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>
      <q-chip dense color="primary" text-color="white">
        {{ targets.length }} {{ t('targetCount') }}
      </q-chip>
      <q-btn
        v-if="embedded"
        dense
        flat
        no-caps
        class="q-ml-sm"
        :icon="detailsCollapsed ? 'expand_more' : 'expand_less'"
        :label="detailsCollapsed ? t('expand') : t('collapse')"
        @click="emit('toggle-details')"
      />
    </div>

    <q-list v-if="!detailsCollapsed" dense bordered class="rounded-borders q-mb-md">
      <q-item-label header>{{ t('targetOverview') }}</q-item-label>
      <q-item v-for="(target, index) in targets" :key="index">
        <q-item-section avatar>
          <stack-view
            v-if="target.itemKey && itemDefsByKeyHash"
            :content="{
              kind: 'item',
              id: target.itemKey.id,
              amount: target.rate,
              ...(target.itemKey.meta !== undefined ? { meta: target.itemKey.meta } : {}),
              ...(target.itemKey.nbt !== undefined ? { nbt: target.itemKey.nbt } : {}),
            }"
            :item-defs-by-key-hash="itemDefsByKeyHash"
            variant="slot"
            :show-name="false"
            :show-subtitle="false"
            :show-amount="false"
            @item-click="emit('item-click', $event)"
            @item-mouseenter="emit('item-mouseenter', $event)"
            @item-mouseleave="emit('item-mouseleave')"
          />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ target.itemName }}</q-item-label>
          <q-item-label caption>{{ target.rate }} {{ getRateUnitLabel(target.unit) }}</q-item-label>
        </q-item-section>
      </q-item>
    </q-list>

    <q-tabs
      :model-value="activeTab"
      dense
      outside-arrows
      mobile-arrows
      inline-label
      @update:model-value="emit('update:active-tab', $event as AdvancedPlannerTab)"
    >
      <q-tab name="summary" :label="t('resourceSummary')" />
      <q-tab name="tree" :label="t('synthesisTree')" />
      <q-tab name="graph" :label="t('nodeGraph')" />
      <q-tab name="line" :label="t('productionLine')" />
      <q-tab name="quant" :label="t('quantificationView')" />
      <q-tab name="calc" :label="t('calculator')" />
      <q-tab v-if="lpMode && hasLpResult" name="lp_raw" :label="t('lpRawData')" />
    </q-tabs>

    <q-separator class="q-my-md" />

    <slot />
  </q-card>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import StackView from 'src/jei/components/StackView.vue';
import type { ItemDef, ItemKey } from 'src/jei/types';
import type { AdvancedPlannerTab, PlannerTargetUnit } from 'src/jei/planner/plannerUi';
import type { ObjectiveType } from 'src/jei/planner/types';

type Target = {
  itemKey: ItemKey;
  itemName: string;
  rate: number;
  unit: PlannerTargetUnit;
  type: ObjectiveType;
};

defineProps<{
  targets: Target[];
  itemDefsByKeyHash: Record<string, ItemDef>;
  pendingDecisionsCount: number;
  activeTab: AdvancedPlannerTab;
  lpMode: boolean;
  hasLpResult: boolean;
  getRateUnitLabel: (unit: PlannerTargetUnit) => string;
  embedded?: boolean;
  detailsCollapsed?: boolean;
}>();

const emit = defineEmits<{
  'open-save': [];
  'share-url': [];
  'copy-json': [];
  'share-json-url': [];
  'import-json': [];
  'toggle-details': [];
  'update:active-tab': [value: AdvancedPlannerTab];
  'item-click': [itemKey: ItemKey];
  'item-mouseenter': [keyHash: string];
  'item-mouseleave': [];
}>();

const { t } = useI18n();
</script>
