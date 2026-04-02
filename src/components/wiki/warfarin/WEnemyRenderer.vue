<template>
  <div>
    <q-tabs v-model="activeTab" dense align="left" class="text-primary">
      <q-tab name="overview" :label="l('Overview')" />
      <q-tab name="attributes" :label="l('Attributes')" />
      <q-tab name="abilities" :label="l('Abilities')" />
      <q-tab name="raw" :label="l('Raw')" />
    </q-tabs>
    <q-separator />

    <q-tab-panels v-model="activeTab" animated>
      <q-tab-panel name="overview">
        <section class="ww__section">
          <h3 class="ww__title">{{ l('Enemy Basic Info') }}</h3>
          <WInfoGrid :entries="basicEntries" />
        </section>

        <section v-if="description" class="ww__section">
          <h3 class="ww__title">{{ l('Description') }}</h3>
          <div class="ww__prose ww__prose--box" v-html="formatWikiHtml(description)"></div>
        </section>

        <section v-if="enemyCategories.length" class="ww__section">
          <h3 class="ww__title">{{ l('Enemy Categories') }}</h3>
          <div class="ww__badges">
            <span v-for="category in enemyCategories" :key="category.groupId" class="ww__badge">
              {{ category.groupName }}
            </span>
          </div>
        </section>

        <section v-if="distributionRows.length" class="ww__section">
          <h3 class="ww__title">{{ l('Distributions') }}</h3>
          <WDataTable :columns="distributionColumns" :rows="distributionRows" />
        </section>

        <section v-if="tags.length" class="ww__section">
          <h3 class="ww__title">{{ l('Tags') }}</h3>
          <div class="ww__badges">
            <span v-for="tag in tags" :key="tag" class="ww__badge">{{ tag }}</span>
          </div>
        </section>

        <section v-if="abilityDescIds.length" class="ww__section">
          <h3 class="ww__title">{{ l('Ability IDs') }}</h3>
          <div class="ww__badges">
            <span v-for="id in abilityDescIds" :key="id" class="ww__badge">{{ id }}</span>
          </div>
        </section>

        <section v-if="independentAttrs.length" class="ww__section">
          <h3 class="ww__title">{{ l('Independent Attributes') }}</h3>
          <WInfoGrid :entries="independentAttrs" />
        </section>
      </q-tab-panel>

      <q-tab-panel name="attributes">
        <section v-if="resistanceEntries.length" class="ww__section">
          <h3 class="ww__title">{{ l('Resistance Scalars') }}</h3>
          <WInfoGrid :entries="resistanceEntries" />
        </section>

        <section v-if="resilienceEntries.length" class="ww__section">
          <h3 class="ww__title">{{ l('Resilience And Super Armor') }}</h3>
          <WInfoGrid :entries="resilienceEntries" />
        </section>

        <section v-if="engagementEntries.length" class="ww__section">
          <h3 class="ww__title">{{ l('Engagement Profile') }}</h3>
          <WInfoGrid :entries="engagementEntries" />
        </section>

        <section v-if="combatScalars.length" class="ww__section">
          <h3 class="ww__title">{{ l('Combat Scalars') }}</h3>
          <WInfoGrid :entries="combatScalars" />
        </section>

        <section v-if="poiseRows.length" class="ww__section">
          <h3 class="ww__title">{{ l('Poise Break Thresholds') }}</h3>
          <WDataTable :columns="poiseColumns" :rows="poiseRows" />
        </section>

        <section v-if="damageTakenLevelRows.length" class="ww__section">
          <h3 class="ww__title">{{ l('Damage Taken Grades') }}</h3>
          <WDataTable :columns="damageTakenLevelColumns" :rows="damageTakenLevelRows" />
        </section>

        <section v-if="levelAttrStages.length" class="ww__section">
          <h3 class="ww__title">{{ l('Level Dependent Attributes') }}</h3>
          <q-expansion-item
            v-for="(stage, i) in levelAttrStages"
            :key="`attr-stage-${i}`"
            dense
            expand-separator
            switch-toggle-side
            :label="`${l('Level Group')} ${i + 1}`"
            class="ww__expansion"
          >
            <div class="ww__table-wrap">
              <table class="ww__table ww__table--wide">
                <thead>
                  <tr>
                    <th>{{ l('Level') }}</th>
                    <th v-for="type in stage.attrTypes" :key="type">
                      {{ attrLabel(type) }}
                      <span class="ww__attr-type">#{{ type }}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in stage.rows" :key="`attr-${row.level}`">
                    <td>{{ l('Level') }} {{ formatScalar(row.level) }}</td>
                    <td v-for="type in stage.attrTypes" :key="`${row.level}-${type}`">
                      {{ formatScalar(row.values[type]) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </q-expansion-item>
        </section>
      </q-tab-panel>

      <q-tab-panel name="abilities">
        <section v-if="abilities.length" class="ww__section">
          <h3 class="ww__title">{{ l('Abilities') }}</h3>
          <div class="ww__stack">
            <div
              v-for="ability in abilities"
              :key="formatScalar(ability.abilityId)"
              class="ww__panel"
            >
              <div class="ww__panel-title">
                {{ ability.name || ability.abilityId || l('Ability') }}
              </div>
              <div class="ww__panel-sub ww__value--mono">{{ ability.abilityId || '-' }}</div>
              <div
                v-if="ability.description"
                class="ww__prose"
                v-html="formatWikiHtml(ability.description)"
              ></div>
            </div>
          </div>
        </section>
        <div v-else class="ww__empty">{{ l('No Ability Data Available') }}</div>
      </q-tab-panel>

      <q-tab-panel name="raw">
        <WJsonViewer :value="{ list, detail }" />
      </q-tab-panel>
    </q-tab-panels>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import WInfoGrid from './shared/WInfoGrid.vue';
import WDataTable from './shared/WDataTable.vue';
import WJsonViewer from './shared/WJsonViewer.vue';
import {
  type RecordLike,
  isRecordLike,
  toArray,
  formatWikiHtml,
  formatScalar,
  getAttrName,
  humanizeKey,
  toText,
  buildInfoEntries,
} from './utils';
import { displayEnemyTypeNames } from './genums';
import {
  getWarfarinDistributionLabel,
  getWarfarinEnumLabel,
  localizeWarfarinIdentifier,
} from './displayLabels';

const props = defineProps<{
  detail: RecordLike;
  list: RecordLike;
  refs: RecordLike;
  localNameMap: RecordLike;
}>();

const { locale } = useI18n();
const attrLabel = (attrType: string | number) => getAttrName(attrType, locale.value);
const l = (value: string) => localizeWarfarinIdentifier(value, locale.value);

const activeTab = ref('overview');

const poiseColumns = computed(() => [
  { key: 'index', label: l('Stage') },
  { key: 'threshold', label: l('Threshold') },
  { key: 'buffId', label: l('Buff ID') },
]);

const damageTakenLevelColumns = computed(() => [
  { key: 'level', label: l('Level') },
  { key: 'name', label: l('Grade') },
  { key: 'scalar', label: l('Scalar') },
]);

const distributionColumns = computed(() => [
  { key: 'name', label: l('Name') },
  { key: 'id', label: l('ID') },
]);

const displayInfo = computed<RecordLike>(() =>
  isRecordLike(props.detail.enemyTemplateDisplayInfoTable)
    ? props.detail.enemyTemplateDisplayInfoTable
    : isRecordLike(props.detail.displayEnemyInfoTable)
      ? props.detail.displayEnemyInfoTable
      : {},
);

const attrTable = computed<RecordLike>(() =>
  isRecordLike(props.detail.enemyAttributeTemplateTable)
    ? props.detail.enemyAttributeTemplateTable
    : isRecordLike(props.detail.displayEnemyAttrTable)
      ? props.detail.displayEnemyAttrTable
      : {},
);

const abilityTable = computed<RecordLike>(() =>
  isRecordLike(props.detail.enemyAbilityDescTable)
    ? props.detail.enemyAbilityDescTable
    : isRecordLike(props.detail.displayEnemyAbilityTable)
      ? props.detail.displayEnemyAbilityTable
      : {},
);

const enemyRefs = computed<RecordLike>(() => (isRecordLike(props.refs) ? props.refs : {}));
const displayEnemyTypeTable = computed<RecordLike>(() =>
  isRecordLike(enemyRefs.value.displayEnemyTypeTable) ? enemyRefs.value.displayEnemyTypeTable : {},
);
const enemyDamageTakenLevelTable = computed<RecordLike>(() =>
  isRecordLike(enemyRefs.value.enemyDamageTakenLevelTable)
    ? enemyRefs.value.enemyDamageTakenLevelTable
    : {},
);
const enemyCategoriesTable = computed(() => toArray<RecordLike>(enemyRefs.value.enemyCategories));

function resolveDisplayTypeName(value: unknown): string {
  const key = toText(value);
  if (key && isRecordLike(displayEnemyTypeTable.value[key])) {
    const name = toText(displayEnemyTypeTable.value[key].name);
    if (name) return name;
  }
  return getWarfarinEnumLabel(displayEnemyTypeNames, value, locale.value);
}

const description = computed(() => displayInfo.value.description);

const distributionIds = computed(() =>
  toArray(displayInfo.value.distributionIds).map(String).filter(Boolean),
);

const tags = computed(() => toArray(displayInfo.value.tags).map(String).filter(Boolean));
const abilityDescIds = computed(() =>
  toArray(displayInfo.value.abilityDescIds).map(String).filter(Boolean),
);
const distributionRows = computed(() =>
  distributionIds.value.map((id) => ({
    id,
    name: toText(props.localNameMap[id]) || getWarfarinDistributionLabel(id, locale.value),
  })),
);
const enemyCategories = computed(() => {
  const enemyId = toText(displayInfo.value.templateId, toText(props.list.id));
  if (!enemyId) return [];
  return enemyCategoriesTable.value
    .filter((group) =>
      toArray<RecordLike>(group.entries).some((entry) => toText(entry.id) === enemyId),
    )
    .map((group) => ({
      groupId: toText(group.groupId, 'unknown-group'),
      groupName: toText(group.groupName, toText(group.groupId, 'Unknown Group')),
    }));
});

const basicEntries = computed(() => {
  const info = displayInfo.value;
  const entries: Array<{ label: string; value: unknown; mono?: boolean }> = [];
  if (info.name) entries.push({ label: l('Name'), value: info.name });
  if (info.nickname) entries.push({ label: l('Nickname'), value: info.nickname });
  if (info.templateId) entries.push({ label: l('Template ID'), value: info.templateId, mono: true });
  if (info.displayType !== undefined)
    entries.push({
      label: l('Display Type'),
      value: resolveDisplayTypeName(info.displayType),
    });
  if (distributionIds.value.length)
    entries.push({ label: l('Distribution Count'), value: distributionIds.value.length });
  if (abilityDescIds.value.length) entries.push({ label: l('Ability Count'), value: abilityDescIds.value.length });
  entries.push({ label: l('Abilities'), value: abilities.value.length });
  entries.push({
    label: l('Level Attributes'),
    value: toArray(attrTable.value.levelDependentAttributes).length,
  });
  return entries;
});

const abilities = computed(() => {
  const abilityMap = abilityTable.value;
  const ordered = abilityDescIds.value
    .map((id) => (isRecordLike(abilityMap[id]) ? abilityMap[id] : null))
    .filter((entry): entry is RecordLike => entry !== null);
  if (ordered.length) return ordered;
  return toArray<RecordLike>(abilityMap.abilityInfo ?? Object.values(abilityMap));
});

const independentAttrs = computed(() => {
  const attrs = toArray<RecordLike>(
    isRecordLike(attrTable.value.levelIndependentAttributes)
      ? attrTable.value.levelIndependentAttributes.attrs
      : attrTable.value.levelIndependentAttributes,
  );
  return attrs
    .filter((a) => a.attrType !== undefined && a.attrValue !== undefined)
    .map((a) => ({
      label: attrLabel(toText(a.attrType)),
      value: formatScalar(a.attrValue),
    }));
});

const levelAttrStages = computed(() => {
  const levels = toArray<RecordLike>(attrTable.value.levelDependentAttributes);
  if (!levels.length) return [];

  const typeSet = new Set<string>();
  const rows: Array<{ level: unknown; values: Record<string, unknown> }> = [];

  levels.forEach((entry, index) => {
    const attrSource = isRecordLike(entry.Attribute) ? entry.Attribute.attrs : entry.attrs;
    const attrs = toArray<RecordLike>(attrSource);
    if (!attrs.length) return;
    let level: unknown = index + 1;
    const values: Record<string, unknown> = {};
    attrs.forEach((attr) => {
      if (attr.attrType === undefined || attr.attrValue === undefined) return;
      const type = toText(attr.attrType);
      if (!type) return;
      if (type === '0') {
        level = attr.attrValue;
        return;
      }
      values[type] = attr.attrValue;
      typeSet.add(type);
    });
    rows.push({ level, values });
  });

  rows.sort((a, b) => Number(a.level) - Number(b.level));
  if (!rows.length || !typeSet.size) return [];
  return [
    {
      rows,
      attrTypes: Array.from(typeSet).sort((a, b) => Number(a) - Number(b)),
    },
  ];
});

const combatScalarKeys = [
  'physicalDmgResistScalar',
  'naturalDmgResistScalar',
  'fireDmgResistScalar',
  'pulseDmgResistScalar',
  'crystDmgResistScalar',
  'maxResilience',
  'initialSuperArmor',
  'zeroPoiseSuperArmor',
  'attackValueAgainstTower',
  'pushedBackCoefficient',
];

const combatScalars = computed(() =>
  combatScalarKeys
    .filter((key) => attrTable.value[key] !== undefined && attrTable.value[key] !== null)
    .map((key) => ({ label: l(humanizeKey(key)), value: formatScalar(attrTable.value[key]) })),
);

const resistanceEntries = computed(() =>
  buildInfoEntries(attrTable.value, [
    { key: 'physicalDmgResistScalar', label: l('Physical Resist') },
    { key: 'naturalDmgResistScalar', label: l('Nature Resist') },
    { key: 'fireDmgResistScalar', label: l('Heat Resist') },
    { key: 'pulseDmgResistScalar', label: l('Electric Resist') },
    { key: 'crystDmgResistScalar', label: l('Cryo Resist') },
    { key: 'etherDmgResistScalar', label: l('Aether Resist') },
  ]),
);

const resilienceEntries = computed(() =>
  buildInfoEntries(attrTable.value, [
    { key: 'maxResilience', label: l('Max Resilience') },
    { key: 'initialSuperArmor', label: l('Initial Super Armor') },
    { key: 'zeroPoiseSuperArmor', label: l('Zero Poise Super Armor') },
    { key: 'superArmorWhenResilienceZero', label: l('Super Armor At Zero Resilience') },
    { key: 'breakingAttackedAtbObtain', label: l('Breaking ATB Gain') },
    { key: 'resilienceDecreaseWhenHurt', label: l('Resilience Loss When Hurt') },
    { key: 'resilienceRecover', label: l('Resilience Recover') },
    { key: 'resilienceRecoverInterval', label: l('Resilience Recover Interval') },
    { key: 'resilienceFullRecoverTime', label: l('Full Recover Time') },
  ]),
);

const engagementEntries = computed(() =>
  buildInfoEntries(attrTable.value, [
    { key: 'aoiRadius', label: l('AOI Radius') },
    { key: 'attackValueAgainstTower', label: l('Attack Against Tower') },
    { key: 'pushedBackCoefficient', label: l('Pushed Back Coefficient') },
    { key: 'templateId', label: l('Template ID'), mono: true },
  ]),
);

const poiseRows = computed(() => {
  const thresholds = toArray(attrTable.value.poiseKnotPctList);
  const buffs = toArray(attrTable.value.poiseKnotBuffList);
  return thresholds.map((threshold, index) => ({
    index: `#${index + 1}`,
    threshold:
      typeof threshold === 'number' ? `${(threshold * 100).toFixed(0)}%` : formatScalar(threshold),
    buffId: toText(buffs[index], '-'),
  }));
});

const damageTakenLevelRows = computed(() =>
  Object.values(enemyDamageTakenLevelTable.value)
    .filter((entry): entry is RecordLike => isRecordLike(entry))
    .sort((a, b) => Number(a.damageTakenLevel ?? 0) - Number(b.damageTakenLevel ?? 0))
    .map((entry) => ({
      level: formatScalar(entry.damageTakenLevel),
      name: toText(entry.name, '-'),
      scalar: formatScalar(entry.damageTakenScalar),
    })),
);
</script>
