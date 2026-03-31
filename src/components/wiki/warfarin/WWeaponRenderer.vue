<template>
  <div>
    <section id="weapon-overview" class="ww__section">
      <h3 class="ww__title">{{ t('warfarin.weapon.overview') }}</h3>
      <WInfoGrid :entries="basicEntries" />

      <div v-if="itemEntries.length" class="q-mt-md">
        <WInfoGrid :entries="itemEntries" />
      </div>

      <WTextRenderer
        v-if="itemDesc"
        :value="itemDesc"
        :local-name-map="localNameMap"
        :id-to-pack-item-id="idToPackItemId"
        :item-defs-by-key-hash="itemDefsByKeyHash"
        :refs="refs"
        class-name="ww__prose--box"
      />
      <WTextRenderer
        v-if="itemDecoDesc"
        :value="itemDecoDesc"
        :local-name-map="localNameMap"
        :id-to-pack-item-id="idToPackItemId"
        :item-defs-by-key-hash="itemDefsByKeyHash"
        :refs="refs"
        class-name="ww__muted"
        compact
      />
      <WTextRenderer
        v-if="weaponDesc"
        :value="weaponDesc"
        :local-name-map="localNameMap"
        :id-to-pack-item-id="idToPackItemId"
        :item-defs-by-key-hash="itemDefsByKeyHash"
        :refs="refs"
      />
    </section>

    <section v-if="summaryColumns.length" id="weapon-attributes" class="ww__section">
      <h3 class="ww__title">{{ t('warfarin.weapon.attributes') }}</h3>
      <div class="ww__table-wrap">
        <table class="ww__table ww__table--wide">
          <thead>
            <tr>
              <th>{{ t('warfarin.common.stat') }}</th>
              <th v-for="column in summaryColumns" :key="column">{{ levelLabel(column) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{{ t('warfarin.weapon.baseAtk') }}</td>
              <td v-for="column in summaryColumns" :key="column">{{ summaryAtk[column] ?? '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <q-expansion-item
        dense
        expand-separator
        switch-toggle-side
        :label="t('warfarin.common.detailed')"
        class="ww__expansion q-mt-md"
      >
        <div class="ww__table-wrap">
          <table class="ww__table ww__table--wide">
            <thead>
              <tr>
                <th>{{ t('warfarin.common.level') }}</th>
                <th>{{ t('warfarin.weapon.baseAtk') }}</th>
                <th>{{ t('warfarin.common.expCost') }}</th>
                <th>{{ t('warfarin.common.creditCost') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in upgradeRows" :key="String(row.weaponLv ?? '')">
                <td>{{ formatScalar(row.weaponLv) }}</td>
                <td>{{ formatScalar(row.baseAtk) }}</td>
                <td>{{ formatScalar(row.lvUpExp) }}</td>
                <td>{{ formatScalar(row.lvUpGold) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </q-expansion-item>
    </section>

    <section v-if="breakthroughRows.length" id="weapon-tuning" class="ww__section">
      <h3 class="ww__title">{{ t('warfarin.weapon.tuning') }}</h3>
      <div class="ww__stack">
        <div v-for="row in breakthroughRows" :key="row.stage" class="ww__panel">
          <div class="ww__panel-title">
            {{ t('warfarin.common.stageShort', { stage: row.stage }) }}
            <span class="ww__panel-sub">· {{ levelLabel(row.requiredLevel) }}</span>
          </div>
          <WItemCostGrid
            class="q-mt-md"
            :entries="row.materials"
            :item-defs-by-key-hash="itemDefsByKeyHash"
            compact
          />
          <div class="ww__table-wrap q-mt-md">
            <table class="ww__table">
              <thead>
                <tr>
                  <th>{{ t('warfarin.common.skill') }}</th>
                  <th>{{ t('warfarin.common.range') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="bound in row.skillBounds" :key="bound.name">
                  <td>{{ bound.name }}</td>
                  <td>{{ bound.range }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>

    <section v-if="skillGroups.length" id="weapon-skills" class="ww__section">
      <h3 class="ww__title">{{ t('warfarin.common.skills') }}</h3>
      <div class="ww__stack">
        <div v-for="group in skillGroups" :key="group.id" class="ww__panel">
          <div class="ww__panel-title">{{ group.name }}</div>
          <WTextRenderer
            v-if="group.description"
            :value="group.description"
            :local-name-map="localNameMap"
            :id-to-pack-item-id="idToPackItemId"
            :item-defs-by-key-hash="itemDefsByKeyHash"
            :refs="refs"
            :blackboard="group.blackboard"
            semantic
          />
          <div class="ww__table-wrap q-mt-md">
            <table class="ww__table ww__table--wide">
              <thead>
                <tr>
                  <th>{{ t('warfarin.common.level') }}</th>
                  <th v-for="column in group.columns" :key="column">{{ column }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in group.rows" :key="row.level">
                  <td>{{ row.level }}</td>
                  <td v-for="column in group.columns" :key="`${row.level}-${column}`">
                    {{ row.values[column] ?? '-' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ItemDef } from 'src/jei/types';
import WInfoGrid from './shared/WInfoGrid.vue';
import WTextRenderer from './shared/WTextRenderer.vue';
import WItemCostGrid from './shared/WItemCostGrid.vue';
import {
  type RecordLike,
  isRecordLike,
  toArray,
  formatScalar,
  buildInfoEntries,
  normalizeMaterialCosts,
  toText,
} from './utils';
import { itemTypeNames } from './genums';
import { buildWarfarinBlackboardMap, pickWarfarinText } from './text';
import { getWarfarinEnumLabel } from './displayLabels';
import { getWarfarinWeaponTypeLabel } from './operatorLabels';

const props = defineProps<{
  detail: RecordLike;
  list: RecordLike;
  refs: RecordLike;
  localNameMap: RecordLike;
  idToPackItemId?: RecordLike | undefined;
  itemDefsByKeyHash?: Record<string, ItemDef> | undefined;
}>();

const { t, locale } = useI18n();

const weaponBasic = computed<RecordLike>(() =>
  isRecordLike(props.detail.weaponBasicTable) ? props.detail.weaponBasicTable : {},
);
const itemTableData = computed<RecordLike>(() =>
  isRecordLike(props.detail.itemTable) ? props.detail.itemTable : {},
);
const skillPatchTableData = computed<RecordLike>(() =>
  isRecordLike(props.detail.skillPatchTable) ? props.detail.skillPatchTable : {},
);
const upgradeRows = computed<RecordLike[]>(() => {
  const table = isRecordLike(props.detail.weaponUpgradeTemplateTable)
    ? props.detail.weaponUpgradeTemplateTable
    : {};
  return toArray<RecordLike>(table.list ?? table);
});

const basicEntries = computed(() =>
  buildInfoEntries(weaponBasic.value, [
    { key: 'engName', label: t('warfarin.common.englishName') },
    { key: 'weaponId', label: t('warfarin.common.id'), mono: true },
    {
      key: 'weaponType',
      label: t('warfarin.common.weaponType'),
      format: (v: unknown) => getWarfarinWeaponTypeLabel(v, locale.value),
    },
    { key: 'rarity', label: t('warfarin.common.rarity') },
    { key: 'maxLv', label: t('warfarin.common.maxLevel') },
  ]),
);

const itemEntries = computed(() =>
  buildInfoEntries(itemTableData.value, [
    { key: 'name', label: t('warfarin.common.name') },
    { key: 'id', label: t('warfarin.common.itemId'), mono: true },
    { key: 'iconId', label: t('warfarin.common.iconId'), mono: true },
    {
      key: 'type',
      label: t('warfarin.common.type'),
      format: (v: unknown) => getWarfarinEnumLabel(itemTypeNames, v, locale.value),
    },
  ]),
);

const weaponDesc = computed(() => pickWarfarinText(weaponBasic.value) || weaponBasic.value.weaponDesc);
const itemDesc = computed(() => pickWarfarinText(itemTableData.value));
const itemDecoDesc = computed(() => itemTableData.value.decoDesc);

const summaryColumns = computed(() => [1, 20, 40, 60, 80, 90].filter((level) => upgradeRows.value.some((row) => Number(row.weaponLv) === level)));
const summaryAtk = computed(() =>
  Object.fromEntries(
    summaryColumns.value.map((level) => {
      const row = upgradeRows.value.find((entry) => Number(entry.weaponLv) === level);
      return [level, row?.baseAtk];
    }),
  ),
);

function levelLabel(level: number): string {
  return `${t('warfarin.common.level')} ${level}`;
}

const breakthroughRows = computed(() => {
  const table = isRecordLike(props.detail.weaponBreakThroughTemplateTable)
    ? props.detail.weaponBreakThroughTemplateTable
    : {};
  return toArray<RecordLike>(table.list ?? table).map((entry, index) => ({
    stage: index,
    requiredLevel: Number(entry.breakthroughLv ?? 0),
    materials: normalizeMaterialCosts(
      entry.breakItemList,
      props.localNameMap,
      props.itemDefsByKeyHash,
      props.idToPackItemId,
    ),
    skillBounds: toArray<RecordLike>(entry.skillLevelBounds).map((bound, boundIndex) => ({
      name: `${t('warfarin.common.skill')} ${boundIndex + 1}`,
      range: `${formatScalar(bound.lowerBound)} - ${formatScalar(bound.upperBound)}`,
    })),
  }));
});

const skillGroups = computed(() =>
  Object.entries(skillPatchTableData.value)
    .map(([skillId, value]) => {
      const bundles = toArray<RecordLike>(isRecordLike(value) ? value.SkillPatchDataBundle ?? value : []);
      const rows = bundles.map((bundle) => {
        const values: Record<string, string> = {};
        toArray(bundle.subDescNameList)
          .map((name) => toText(name).trim())
          .filter((name) => name.length > 0)
          .forEach((name, index) => {
            values[name] = formatScalar(toArray(bundle.subDescList)[index]);
          });
        return {
          level: formatScalar(bundle.level),
          values,
        };
      });
      const columns = Array.from(
        new Set(
          rows.flatMap((row) => Object.keys(row.values)).filter((key) => key.trim().length > 0),
        ),
      );
      return {
        id: skillId,
        name: typeof bundles[0]?.skillName === 'string' ? bundles[0].skillName : skillId,
        description: pickWarfarinText(bundles[0]),
        blackboard: buildWarfarinBlackboardMap(bundles[0]),
        rows,
        columns,
      };
    })
    .filter((group) => group.columns.length > 0 || toText(group.description).trim().length > 0),
);
</script>
