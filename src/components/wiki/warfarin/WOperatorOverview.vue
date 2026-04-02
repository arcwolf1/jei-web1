<template>
  <div>
    <section id="operator-overview" class="ww__section">
      <h3 class="ww__title">{{ t('warfarin.operator.overview') }}</h3>
      <WInfoGrid :entries="basicEntries" />

      <div v-if="cvEntries.length" class="ww__tag-box q-mt-md">
        <div v-for="entry in cvEntries" :key="entry.label" class="ww__tag-row">
          <span class="ww__tag-label">{{ entry.label }}</span>
          <span>{{ entry.value }}</span>
        </div>
      </div>

      <div v-if="tagEntries.length" class="ww__tag-box q-mt-md">
        <div v-for="entry in tagEntries" :key="entry.label" class="ww__tag-row">
          <span class="ww__tag-label">{{ entry.label }}</span>
          <span>{{ entry.value }}</span>
        </div>
      </div>

      <div v-if="itemTable" class="q-mt-md">
        <WInfoGrid :entries="itemEntries" />
        <WTextRenderer
          v-if="pickWarfarinText(itemTable)"
          :value="pickWarfarinText(itemTable)"
          class-name="ww__prose--box"
          :local-name-map="localNameMap"
          :id-to-pack-item-id="idToPackItemId"
          :item-defs-by-key-hash="itemDefsByKeyHash"
          :refs="refs"
        />
        <WTextRenderer
          v-if="itemTable.decoDesc"
          :value="itemTable.decoDesc"
          class-name="ww__muted"
          compact
          :local-name-map="localNameMap"
          :id-to-pack-item-id="idToPackItemId"
          :item-defs-by-key-hash="itemDefsByKeyHash"
          :refs="refs"
        />
      </div>
    </section>

    <section v-if="attributeSummaryColumns.length" id="operator-attributes" class="ww__section">
      <h3 class="ww__title">{{ t('warfarin.operator.attributes') }}</h3>

      <div class="ww__table-wrap">
        <table class="ww__table ww__table--wide">
          <thead>
            <tr>
              <th>{{ t('warfarin.common.stat') }}</th>
              <th v-for="column in attributeSummaryColumns" :key="column">{{ levelLabel(column) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in attributeSummaryRows" :key="row.attrType">
              <td>{{ row.label }}</td>
              <td v-for="column in attributeSummaryColumns" :key="`${row.attrType}-${column}`">
                {{ formatScalar(row.values[column]) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <q-expansion-item
        v-for="stage in attributeStages"
        :key="`attr-${stage.breakStage}`"
        dense
        expand-separator
        switch-toggle-side
        :label="stage.label"
        class="ww__expansion"
      >
        <div class="ww__table-wrap">
          <table class="ww__table ww__table--wide">
            <thead>
              <tr>
                <th>{{ t('warfarin.common.level') }}</th>
                <th v-for="type in stage.attrTypes" :key="type">{{ attrLabel(type) }}</th>
                <th>{{ t('warfarin.common.expCost') }}</th>
                <th>{{ t('warfarin.common.creditCost') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in stage.rows" :key="`${stage.breakStage}-${row.level}`">
                <td>{{ formatScalar(row.level) }}</td>
                <td v-for="type in stage.attrTypes" :key="`${row.level}-${type}`">
                  {{ formatScalar(row.values[type]) }}
                </td>
                <td>{{ formatScalar(row.expCost) }}</td>
                <td>{{ formatScalar(row.goldCost) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </q-expansion-item>
    </section>

    <section v-if="promotionNodes.length" id="operator-promotions" class="ww__section">
      <h3 class="ww__title">{{ t('warfarin.operator.promotions') }}</h3>
      <div class="ww__stack">
        <div v-for="node in promotionNodes" :key="String(node.nodeId)" class="ww__panel">
          <div class="ww__panel-title">{{ node.name || node.nodeId }}</div>
          <WTextRenderer
            v-if="node.description"
            :value="node.description"
            compact
            :local-name-map="localNameMap"
            :id-to-pack-item-id="idToPackItemId"
            :item-defs-by-key-hash="itemDefsByKeyHash"
            :refs="refs"
          />
          <WItemCostGrid
            class="q-mt-md"
            :entries="
              normalizeMaterialCosts(
                node.requiredItem,
                localNameMap,
                itemDefsByKeyHash,
                idToPackItemId,
                )
              "
            :item-defs-by-key-hash="itemDefsByKeyHash"
          />
        </div>
      </div>
    </section>

    <section v-if="potentialBundles.length" id="operator-potentials" class="ww__section">
      <h3 class="ww__title">{{ t('warfarin.operator.potentials') }}</h3>
      <div class="ww__stack">
        <div v-for="bundle in potentialBundles" :key="formatScalar(bundle.level)" class="ww__panel">
          <div class="ww__panel-title">
            {{ t('warfarin.common.potentialLevel', { level: formatScalar(bundle.level) }) }}
            <span v-if="bundle.name"> · {{ bundle.name }}</span>
          </div>
          <WItemCostGrid
            class="q-mt-md"
            :entries="
              normalizeMaterialBundle(
                bundle.itemIds,
                bundle.itemCnts,
                itemDefsByKeyHash,
                idToPackItemId,
              )
              "
              compact
            :item-defs-by-key-hash="itemDefsByKeyHash"
            />
        </div>
      </div>
    </section>

    <section v-if="snapshotEntries.length" id="operator-artworks" class="ww__section">
      <h3 class="ww__title">{{ t('warfarin.operator.artworks') }}</h3>
      <div class="ww__grid">
        <div
          v-for="snapshot in snapshotEntries"
          :key="toText(snapshot.pictureId, toText(snapshot.imgId, 'snapshot'))"
          class="ww__card ww__card--media"
        >
          <img
            v-if="snapshot.imgId || snapshot.pictureId"
            :src="toCdnAssetUrl(snapshot.imgId || snapshot.pictureId)"
            :alt="toText(snapshot.name, toText(snapshot.pictureId, 'snapshot'))"
            class="ww__image"
          />
          <div class="ww__value">{{ snapshot.name || snapshot.pictureId || '-' }}</div>
          <div class="ww__label ww__value--mono">
            {{ snapshot.pictureId || snapshot.imgId || '-' }}
          </div>
          <WTextRenderer
            v-if="snapshot.decoDescription"
            :value="snapshot.decoDescription"
            class-name="ww__muted"
            compact
            :local-name-map="localNameMap"
            :id-to-pack-item-id="idToPackItemId"
            :item-defs-by-key-hash="itemDefsByKeyHash"
            :refs="refs"
          />
          <WTextRenderer
            v-if="pickWarfarinText(snapshot)"
            :value="pickWarfarinText(snapshot)"
            class-name="ww__muted"
            compact
            :local-name-map="localNameMap"
            :id-to-pack-item-id="idToPackItemId"
            :item-defs-by-key-hash="itemDefsByKeyHash"
            :refs="refs"
          />
          <div class="ww__label">{{ t('warfarin.common.author') }}: {{ snapshot.author || '-' }}</div>
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
  formatRarity,
  normalizeMaterialBundle,
  normalizeMaterialCosts,
  toCdnAssetUrl,
  getAttrName,
  resolveLocalizedEntityName,
  toText,
} from './utils';
import { getWarfarinDamageTypeLabel, getWarfarinProfessionLabel, getWarfarinWeaponTypeLabel } from './operatorLabels';
import { pickWarfarinText } from './text';

interface AttributeStageRow {
  level: unknown;
  values: Record<string, unknown>;
  expCost: unknown;
  goldCost: unknown;
}

const props = defineProps<{
  detail: RecordLike;
  list: RecordLike;
  refs: RecordLike;
  localNameMap: RecordLike;
  idToPackItemId?: RecordLike | undefined;
  itemDefsByKeyHash?: Record<string, ItemDef> | undefined;
}>();

const { t, locale } = useI18n();
const attrLabel = (attrType: string | number) => getAttrName(attrType, locale.value);

const characterTable = computed<RecordLike | null>(() =>
  isRecordLike(props.detail.characterTable) ? props.detail.characterTable : null,
);
const charTagTable = computed<RecordLike>(() =>
  isRecordLike(props.detail.charTagTable) ? props.detail.charTagTable : {},
);
const growthTable = computed<RecordLike>(() =>
  isRecordLike(props.detail.charGrowthTable) ? props.detail.charGrowthTable : {},
);
const itemTable = computed<RecordLike | null>(() =>
  isRecordLike(props.detail.itemTable) ? props.detail.itemTable : null,
);
const potentialTable = computed<RecordLike>(() =>
  isRecordLike(props.detail.characterPotentialTable) ? props.detail.characterPotentialTable : {},
);
const levelRefTable = computed<RecordLike>(() =>
  isRecordLike(props.refs.charLevelUpTable) ? props.refs.charLevelUpTable : {},
);

const basicEntries = computed(() => [
  { label: t('warfarin.common.name'), value: characterTable.value?.name || props.list?.name || '-' },
  { label: t('warfarin.common.englishName'), value: characterTable.value?.engName || '-' },
  {
    label: t('warfarin.common.id'),
    value: characterTable.value?.charId || props.list?.id || '-',
    mono: true,
  },
  {
    label: t('warfarin.common.rarity'),
    value: formatRarity(characterTable.value?.rarity ?? props.list?.rarity),
  },
  {
    label: t('warfarin.common.type'),
    value: getWarfarinDamageTypeLabel(
      characterTable.value?.charTypeId ?? props.list?.charTypeId,
      locale.value,
    ),
  },
  {
    label: t('warfarin.common.profession'),
    value: getWarfarinProfessionLabel(
      props.list?.professionId ?? characterTable.value?.professionId,
      props.list?.profession,
      locale.value,
    ),
  },
  {
    label: t('warfarin.common.weaponType'),
    value: getWarfarinWeaponTypeLabel(
      characterTable.value?.weaponType ?? props.list?.weaponType,
      locale.value,
    ),
  },
  {
    label: t('warfarin.common.department'),
    value:
      resolveLocalizedEntityName(
        charTagTable.value?.blocTagId,
        props.refs,
        props.localNameMap,
        props.itemDefsByKeyHash,
      ) ||
      characterTable.value?.department ||
      '-',
  },
  {
    label: t('warfarin.common.defaultWeapon'),
    value: resolveLocalizedEntityName(
      characterTable.value?.defaultWeaponId,
      props.refs,
      props.localNameMap,
      props.itemDefsByKeyHash,
    ),
  },
]);

const cvEntries = computed(() => {
  const cv =
    characterTable.value && isRecordLike(characterTable.value.cvName)
      ? characterTable.value.cvName
      : {};
  return [
    { label: 'CV CN', value: cv.ChiCVName },
    { label: 'CV EN', value: cv.EngCVName },
    { label: 'CV JP', value: cv.JapCVName },
    { label: 'CV KR', value: cv.KorCVName },
  ].filter(
    (entry): entry is { label: string; value: string } =>
      typeof entry.value === 'string' && entry.value.trim().length > 0,
  );
});

const tagEntries = computed(() => {
  const tags: Array<{ label: string; value: string }> = [];
  const table = charTagTable.value;
  const pushArray = (label: string, value: unknown) => {
    const arr = toArray(value)
      .map((entry) =>
        resolveLocalizedEntityName(entry, props.refs, props.localNameMap, props.itemDefsByKeyHash),
      )
      .filter((entry) => entry.length > 0);
    if (arr.length) tags.push({ label, value: arr.join(', ') });
  };
  if (typeof table.raceTagId === 'string' && table.raceTagId) {
    tags.push({
      label: t('warfarin.common.race'),
      value: resolveLocalizedEntityName(
        table.raceTagId,
        props.refs,
        props.localNameMap,
        props.itemDefsByKeyHash,
      ),
    });
  }
  if (typeof table.blocTagId === 'string' && table.blocTagId) {
    tags.push({
      label: t('warfarin.common.faction'),
      value: resolveLocalizedEntityName(
        table.blocTagId,
        props.refs,
        props.localNameMap,
        props.itemDefsByKeyHash,
      ),
    });
  }
  pushArray(t('warfarin.common.expertise'), table.expertTagIds);
  pushArray(t('warfarin.common.disposition'), table.dispositionTagIds);
  pushArray(t('warfarin.common.hobbies'), table.hobbyTagIds);
  pushArray(t('warfarin.common.behaviorHate'), table.behaviourHateTagIds);
  pushArray(t('warfarin.common.giftPreference'), table.giftPreferTagId);
  return tags;
});

const itemEntries = computed(() => {
  if (!itemTable.value) return [];
  return [
    { label: t('warfarin.common.itemId'), value: itemTable.value.id || '-', mono: true },
    { label: t('warfarin.common.itemName'), value: itemTable.value.name || '-' },
    { label: t('warfarin.common.iconId'), value: itemTable.value.iconId || '-', mono: true },
  ];
});

const attributeStages = computed(() => {
  const grouped = new Map<number, RecordLike[]>();
  toArray<RecordLike>(characterTable.value?.attributes).forEach((entry) => {
    const breakStage = Number(entry.breakStage ?? 0);
    const bucket = grouped.get(breakStage) ?? [];
    bucket.push(entry);
    grouped.set(breakStage, bucket);
  });

  return Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([breakStage, entries]) => {
      const typeSet = new Set<string>();
      const rows: AttributeStageRow[] = [];
      entries.forEach((entry, index) => {
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
        const levelKey = toText(level);
        const ref = isRecordLike(levelRefTable.value[levelKey]) ? levelRefTable.value[levelKey] : {};
        rows.push({
          level,
          values,
          expCost: ref.exp,
          goldCost: ref.gold,
        });
      });
      rows.sort((a, b) => Number(a.level) - Number(b.level));
      const attrTypes = Array.from(typeSet).sort((a, b) => {
        const preferred = ['39', '40', '41', '42', '2', '1'];
        const aIndex = preferred.indexOf(a);
        const bIndex = preferred.indexOf(b);
        if (aIndex >= 0 || bIndex >= 0) {
          if (aIndex < 0) return 1;
          if (bIndex < 0) return -1;
          return aIndex - bIndex;
        }
        return Number(a) - Number(b);
      });
      return {
        breakStage,
        label: `${t('warfarin.common.breakStage')} ${breakStage}`,
        rows,
        attrTypes,
      };
    })
    .filter((stage) => stage.rows.length > 0 && stage.attrTypes.length > 0);
});

const attributeSummaryColumns = computed(() => {
  const available = new Set(
    attributeStages.value.flatMap((stage) =>
      stage.rows.map((row) => Number(row.level)).filter((level) => Number.isFinite(level)),
    ),
  );
  return [1, 20, 40, 60, 80, 90].filter((level) => available.has(level));
});

const attributeSummaryRows = computed(() => {
  const byLevel = new Map<number, AttributeStageRow>();
  attributeStages.value.forEach((stage) => {
    stage.rows.forEach((row) => {
      const level = Number(row.level);
      if (Number.isFinite(level)) byLevel.set(level, row);
    });
  });
  const attrTypes = attributeStages.value[0]?.attrTypes ?? [];
  return attrTypes.map((attrType) => ({
    attrType,
    label: attrLabel(attrType),
    values: Object.fromEntries(
      attributeSummaryColumns.value.map((level) => [level, byLevel.get(level)?.values[attrType]]),
    ),
  }));
});

function levelLabel(level: number): string {
  return `${t('warfarin.common.level')} ${level}`;
}

const promotionNodes = computed<Array<RecordLike & { description: unknown }>>(() =>
  Object.values(
    isRecordLike(growthTable.value.charBreakCostMap) ? growthTable.value.charBreakCostMap : {},
  )
    .filter((entry): entry is RecordLike => isRecordLike(entry) && Number(entry.nodeType ?? 0) === 1)
    .map((entry) => ({
      ...entry,
      description: pickWarfarinText(entry),
    })),
);

const potentialBundles = computed(() => toArray<RecordLike>(potentialTable.value.potentialUnlockBundle));

const snapshotEntries = computed(() =>
  Object.values(isRecordLike(props.detail?.snapshots) ? props.detail.snapshots : {}).filter(
    (entry): entry is RecordLike => isRecordLike(entry),
  ),
);
</script>
