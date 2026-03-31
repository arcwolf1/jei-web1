<template>
  <div>
    <section v-if="achieveEntries.length" class="ww__section">
      <h3 class="ww__title">{{ l('Achievement Info') }}</h3>
      <WInfoGrid :entries="achieveEntries" />
    </section>

    <section v-if="achieveDesc" class="ww__section">
      <h3 class="ww__title">{{ l('Description') }}</h3>
      <div class="ww__prose ww__prose--box" v-html="formatWikiHtml(achieveDesc)"></div>
    </section>

    <section v-if="typeEntries.length" class="ww__section">
      <h3 class="ww__title">{{ l('Achievement Type') }}</h3>
      <WInfoGrid :entries="typeEntries" />
    </section>

    <section v-if="groupRows.length" class="ww__section">
      <h3 class="ww__title">{{ l('Achievement Groups') }}</h3>
      <WDataTable :columns="groupColumns" :rows="groupRows" />
    </section>

    <section v-if="levelInfos.length" class="ww__section">
      <h3 class="ww__title">{{ l('Level Infos') }}</h3>
      <div class="ww__stack">
        <div v-for="info in levelInfos" :key="info.level" class="ww__panel">
          <div class="ww__panel-title">{{ l('Level') }} {{ info.level }}</div>
          <div
            v-if="info.completeDesc"
            class="ww__prose"
            v-html="formatWikiHtml(info.completeDesc)"
          ></div>
          <div v-if="info.conditions.length" class="ww__muted">
            <div v-for="(cond, ci) in info.conditions" :key="ci">
              {{ l('Condition') }} {{ ci + 1 }}: {{ cond.desc || cond.conditionId || '-' }}
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import WInfoGrid from './shared/WInfoGrid.vue';
import WDataTable from './shared/WDataTable.vue';
import {
  type RecordLike,
  isRecordLike,
  toArray,
  formatWikiHtml,
  formatScalar,
  buildInfoEntries,
} from './utils';
import { localizeWarfarinIdentifier } from './displayLabels';

const props = defineProps<{
  detail: RecordLike;
  list: RecordLike;
}>();

const { locale } = useI18n();
const l = (value: string) => localizeWarfarinIdentifier(value, locale.value);

const achieveTable = computed<RecordLike>(() =>
  isRecordLike(props.detail.achievementTable) ? props.detail.achievementTable : {},
);
const typeTable = computed<RecordLike>(() =>
  isRecordLike(props.detail.achievementTypeTable) ? props.detail.achievementTypeTable : {},
);

const achieveEntries = computed(() =>
  buildInfoEntries(achieveTable.value, [
    { key: 'name', label: l('Name') },
    { key: 'achieveId', label: l('Achievement ID'), mono: true },
    { key: 'groupId', label: l('Group ID'), mono: true },
    { key: 'order', label: l('Order') },
    { key: 'initLevel', label: l('Init Level') },
    { key: 'canBeUpgraded', label: l('Upgradeable') },
    { key: 'canBePlated', label: l('Platable') },
    { key: 'applyRareEffect', label: l('Rare Effect') },
  ]),
);

const achieveDesc = computed(() => achieveTable.value.desc);

const typeEntries = computed(() =>
  buildInfoEntries(typeTable.value, [
    { key: 'categoryName', label: l('Category Name') },
    { key: 'categoryId', label: l('Category ID'), mono: true },
    { key: 'categoryPriority', label: l('Priority') },
    { key: 'noObtainCanView', label: l('View Without Obtaining') },
  ]),
);

const groupColumns = computed(() => [
  { key: 'groupName', label: l('Group Name') },
  { key: 'groupId', label: l('Group ID') },
]);

const groupRows = computed(() =>
  toArray<RecordLike>(typeTable.value.achievementGroupData).map((g) => ({
    groupName: formatScalar(g.groupName),
    groupId: formatScalar(g.groupId),
  })),
);

const levelInfos = computed(() => {
  const infos = isRecordLike(achieveTable.value.levelInfos) ? achieveTable.value.levelInfos : {};
  return Object.values(infos)
    .filter((v): v is RecordLike => isRecordLike(v))
    .sort((a, b) => Number(a.achieveLevel ?? 0) - Number(b.achieveLevel ?? 0))
    .map((info) => ({
      level: formatScalar(info.achieveLevel),
      completeDesc: info.completeDesc,
      conditions: toArray<RecordLike>(info.conditions),
    }));
});
</script>
