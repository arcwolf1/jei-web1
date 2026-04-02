<template>
  <div>
    <section v-if="missionEntries.length" class="ww__section">
      <h3 class="ww__title">{{ l('Mission Info') }}</h3>
      <WInfoGrid :entries="missionEntries" />
    </section>

    <section v-if="missionDesc" class="ww__section">
      <h3 class="ww__title">{{ l('Description') }}</h3>
      <div class="ww__prose ww__prose--box" v-html="formatWikiHtml(missionDesc)"></div>
    </section>

    <section v-if="quests.length" class="ww__section">
      <h3 class="ww__title">{{ l('Quests') }}</h3>
      <div class="ww__stack">
        <div v-for="quest in quests" :key="formatScalar(quest.questId)" class="ww__panel">
          <div class="ww__panel-title">{{ l('Quest') }}: {{ quest.questId }}</div>
          <div v-if="quest.prevQuests.length" class="ww__panel-sub">
            {{ l('Previous') }}: {{ quest.prevQuests.join(', ') }}
          </div>
          <div v-if="quest.objectives.length" class="ww__muted">
            <div v-for="(obj, oi) in quest.objectives" :key="oi">
              {{ l('Objective') }} {{ oi + 1 }}: {{ obj.description || '-' }}
            </div>
          </div>
        </div>
      </div>
    </section>

    <section v-if="dialogs.length" class="ww__section">
      <h3 class="ww__title">{{ l('Dialog') }}</h3>
      <div class="ww__stack ww__stack--compact">
        <div v-for="(line, i) in dialogs" :key="i" class="ww__panel">
          <div class="ww__panel-title">
            {{ line.actorName || line.actorNameId || l('Unknown') }}
            <span v-if="line.type" class="ww__panel-sub"> · {{ line.type }}</span>
          </div>
          <div class="ww__prose" v-html="formatWikiHtml(line.dialogText)"></div>
          <div v-if="line.optionText" class="ww__muted">{{ l('Option') }}: {{ line.optionText }}</div>
          <div class="ww__panel-sub ww__value--mono">{{ line.id || '-' }}</div>
        </div>
      </div>
    </section>

    <section v-if="radios.length" class="ww__section">
      <h3 class="ww__title">{{ l('Radio Messages') }}</h3>
      <q-expansion-item
        v-for="radio in radios"
        :key="formatScalar(radio.radioId)"
        dense
        expand-separator
        switch-toggle-side
        :label="`${l('Radio')}: ${radio.radioId} (${radio.messages.length} ${l('Messages')})`"
        class="ww__expansion"
      >
        <div class="ww__stack ww__stack--compact">
          <div v-for="(msg, mi) in radio.messages" :key="mi" class="ww__panel">
            <div class="ww__panel-title">{{ msg.actorName || msg.actorNameId || l('Unknown') }}</div>
            <div class="ww__prose" v-html="formatWikiHtml(msg.radioText)"></div>
          </div>
        </div>
      </q-expansion-item>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import WInfoGrid from './shared/WInfoGrid.vue';
import {
  type RecordLike,
  isRecordLike,
  toArray,
  formatWikiHtml,
  formatScalar,
  buildInfoEntries,
} from './utils';
import { missionTypeNames } from './genums';
import { getWarfarinEnumLabel, localizeWarfarinIdentifier } from './displayLabels';

const props = defineProps<{
  detail: RecordLike;
  list: RecordLike;
}>();

const { locale } = useI18n();
const l = (value: string) => localizeWarfarinIdentifier(value, locale.value);

const mission = computed<RecordLike>(() =>
  isRecordLike(props.detail.mission) ? props.detail.mission : {},
);

const missionEntries = computed(() =>
  buildInfoEntries(mission.value, [
    { key: 'name', label: l('Name') },
    { key: 'id', label: l('ID'), mono: true },
    { key: 'typeName', label: l('Type Name') },
    {
      key: 'type',
      label: l('Type'),
      format: (v: unknown) => getWarfarinEnumLabel(missionTypeNames, v, locale.value),
    },
    { key: 'importance', label: l('Importance') },
    { key: 'charId', label: l('Character ID'), mono: true },
    { key: 'levelId', label: l('Level ID'), mono: true },
    { key: 'rewardId', label: l('Reward ID'), mono: true },
  ]),
);

const missionDesc = computed(() => mission.value.description);

const quests = computed(() =>
  toArray<RecordLike>(props.detail.quests).map((q) => ({
    questId: q.questId || q.id || '-',
    prevQuests: toArray(q.prevQuests).map(String).filter(Boolean),
    objectives: toArray<RecordLike>(q.objectives),
  })),
);

const dialogs = computed(() => toArray<RecordLike>(props.detail.dialog));

const radios = computed(() =>
  toArray<RecordLike>(props.detail.radios).map((r) => ({
    radioId: r.radioId || '-',
    questId: r.questId,
    actionId: r.actionId,
    messages: toArray<RecordLike>(r.messages),
  })),
);
</script>
