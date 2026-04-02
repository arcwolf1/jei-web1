<template>
  <div>
    <section v-if="profileRecords.length" id="operator-files" class="ww__section">
      <h3 class="ww__title">{{ t('warfarin.operator.operatorFiles') }}</h3>
      <div class="ww__stack">
        <div
          v-for="record in profileRecords"
          :key="toText(record.id, toText(record.recordID, 'record'))"
          class="ww__panel"
        >
          <div class="ww__panel-title">{{ record.recordTitle || t('warfarin.common.record') }}</div>
          <div v-if="record.unlockType || record.unlockValue" class="ww__panel-sub">
            {{ getWarfarinEnumLabel(charDocUnlockTypeNames, record.unlockType ?? 0, locale) }}
            · {{ formatScalar(record.unlockValue ?? 0) }}
          </div>
          <WTextRenderer
            :value="record.recordDesc"
            :local-name-map="localNameMap"
            :id-to-pack-item-id="idToPackItemId"
            :item-defs-by-key-hash="itemDefsByKeyHash"
            :refs="refs"
          />
        </div>
      </div>
    </section>

    <section v-if="voiceGroups.length" id="operator-audio-log" class="ww__section">
      <h3 class="ww__title">{{ t('warfarin.operator.audioLog') }}</h3>
      <q-expansion-item
        v-for="group in voiceGroups"
        :key="group.title"
        dense
        expand-separator
        switch-toggle-side
        :label="`${group.title} (${group.items.length})`"
        class="ww__expansion"
      >
        <div class="ww__stack ww__stack--compact">
          <div
            v-for="voice in group.items"
            :key="toText(voice.id, toText(voice.voId, 'voice'))"
            class="ww__panel"
          >
            <div class="ww__panel-title">{{ voice.voiceTitle || t('warfarin.common.voice') }}</div>
            <WTextRenderer
              :value="voice.voiceDesc"
              :local-name-map="localNameMap"
              :id-to-pack-item-id="idToPackItemId"
              :item-defs-by-key-hash="itemDefsByKeyHash"
              :refs="refs"
            />
            <div v-if="voice.voId" class="ww__panel-sub ww__value--mono">{{ voice.voId }}</div>
          </div>
        </div>
      </q-expansion-item>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ItemDef } from 'src/jei/types';
import WTextRenderer from './shared/WTextRenderer.vue';
import {
  type RecordLike,
  isRecordLike,
  toArray,
  formatScalar,
  toText,
} from './utils';
import { charDocUnlockTypeNames } from './genums';
import { getWarfarinEnumLabel } from './displayLabels';

const props = defineProps<{
  detail: RecordLike;
  refs: RecordLike;
  localNameMap: RecordLike;
  idToPackItemId?: RecordLike | undefined;
  itemDefsByKeyHash?: Record<string, ItemDef> | undefined;
}>();

const { t, locale } = useI18n();

const characterTable = computed<RecordLike | null>(() =>
  isRecordLike(props.detail.characterTable) ? props.detail.characterTable : null,
);

const profileRecords = computed(() => toArray<RecordLike>(characterTable.value?.profileRecord));

const voiceGroups = computed(() => {
  const voices = toArray<RecordLike>(characterTable.value?.profileVoice);
  const groups = new Map<string, RecordLike[]>();
  voices.forEach((voice) => {
    const rawTitle = typeof voice.voiceTitle === 'string' ? voice.voiceTitle.trim() : t('warfarin.common.voice');
    const groupTitle = rawTitle.replace(/\d+$/, '').trim() || rawTitle;
    const bucket = groups.get(groupTitle) ?? [];
    bucket.push(voice);
    groups.set(groupTitle, bucket);
  });
  return Array.from(groups.entries()).map(([title, items]) => ({ title, items }));
});
</script>
