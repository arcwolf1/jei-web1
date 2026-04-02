<template>
  <div>
    <section v-if="buildingEntries.length" class="ww__section">
      <h3 class="ww__title">{{ l('Factory Building Info') }}</h3>
      <WInfoGrid :entries="buildingEntries" />
    </section>

    <section v-if="hasData(buildingTable)" class="ww__section">
      <h3 class="ww__title">{{ l('Factory Building Full') }}</h3>
      <div
        v-if="buildingDescriptionHtml"
        class="ww__panel ww__prose ww__prose--box"
        v-html="buildingDescriptionHtml"
      />

      <WInfoGrid v-if="fullBuildingEntries.length" :entries="fullBuildingEntries" />

      <div v-if="rangeEntries.length" class="ww__panel">
        <div class="ww__panel-sub">{{ l('Attack Coverage Range') }}</div>
        <WInfoGrid :entries="rangeEntries" />
      </div>

      <div v-if="capabilityEntries.length" class="ww__panel">
        <div class="ww__panel-sub">{{ l('Placement And Power') }}</div>
        <WInfoGrid :entries="capabilityEntries" />
      </div>

      <div v-if="assetEntries.length" class="ww__panel">
        <div class="ww__panel-sub">{{ l('Assets And Scene') }}</div>
        <WInfoGrid :entries="assetEntries" />
      </div>

      <div v-if="limitEntries.length" class="ww__panel">
        <div class="ww__panel-sub">{{ l('Placement Limits') }}</div>
        <WInfoGrid :entries="limitEntries" />
      </div>
    </section>

    <section v-if="machineCraftRows.length" class="ww__section">
      <h3 class="ww__title">{{ l('Factory Machine Craft Table') }}</h3>
      <WDataTable :columns="machineCraftColumns" :rows="machineCraftRows" wide>
        <template #cell-formula="{ row }">
          <div class="ww__machine-formula">
            <div class="ww__machine-formula-title">{{ row.formula }}</div>
            <div v-if="row.metaLine" class="ww__muted">{{ row.metaLine }}</div>
          </div>
        </template>

        <template #cell-ingredients="{ value }">
          <div class="ww__material-groups">
            <div
              v-for="(group, groupIndex) in materialGroups(value)"
              :key="`in-${groupIndex}`"
              class="ww__material-group"
            >
              <div v-if="groupIndex > 0" class="ww__material-group-label">
                {{ l('Option') }} {{ groupIndex + 1 }}
              </div>
              <div class="ww__material-list">
                <div
                  v-for="(entry, entryIndex) in group"
                  :key="`${entry.rawId || entry.name}-${entryIndex}`"
                  class="ww__material-item"
                >
                  <img
                    v-if="entry.icon"
                    :src="entry.icon"
                    :alt="entry.name"
                    class="ww__material-icon"
                  />
                  <span class="ww__material-name">{{ entry.name }}</span>
                  <span class="ww__material-count">x{{ formatScalar(entry.count) }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>

        <template #cell-outcomes="{ value }">
          <div class="ww__material-groups">
            <div
              v-for="(group, groupIndex) in materialGroups(value)"
              :key="`out-${groupIndex}`"
              class="ww__material-group"
            >
              <div v-if="groupIndex > 0" class="ww__material-group-label">
                {{ l('Option') }} {{ groupIndex + 1 }}
              </div>
              <div class="ww__material-list">
                <div
                  v-for="(entry, entryIndex) in group"
                  :key="`${entry.rawId || entry.name}-${entryIndex}`"
                  class="ww__material-item"
                >
                  <img
                    v-if="entry.icon"
                    :src="entry.icon"
                    :alt="entry.name"
                    class="ww__material-icon"
                  />
                  <span class="ww__material-name">{{ entry.name }}</span>
                  <span class="ww__material-count">x{{ formatScalar(entry.count) }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </WDataTable>
    </section>

    <section v-else-if="hasData(machineCraftTable)" class="ww__section">
      <h3 class="ww__title">{{ l('Factory Machine Craft Table') }}</h3>
      <WJsonViewer :value="machineCraftTable" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ItemDef } from 'src/jei/types';
import WInfoGrid from './shared/WInfoGrid.vue';
import WDataTable from './shared/WDataTable.vue';
import WJsonViewer from './shared/WJsonViewer.vue';
import {
  type MaterialCostEntry,
  type RecordLike,
  isRecordLike,
  toArray,
  hasData,
  buildInfoEntries,
  formatLocalizedScalar,
  formatScalar,
  formatWikiHtml,
  normalizeMaterialCosts,
} from './utils';
import { facBuildingTypeNames } from './genums';
import { getWarfarinEnumLabel, localizeWarfarinIdentifier } from './displayLabels';

const props = defineProps<{
  detail: RecordLike;
  list: RecordLike;
  localNameMap?: RecordLike;
  idToPackItemId?: RecordLike;
  itemDefsByKeyHash?: Record<string, ItemDef>;
}>();

const { locale } = useI18n();
const l = (value: string) => localizeWarfarinIdentifier(value, locale.value);

const buildingTable = computed<RecordLike>(() =>
  isRecordLike(props.detail.factoryBuildingTable) ? props.detail.factoryBuildingTable : {},
);
const machineCraftTable = computed(() => props.detail.factoryMachineCraftTable);
const buildingRange = computed<RecordLike>(() =>
  isRecordLike(buildingTable.value.range) ? buildingTable.value.range : {},
);

type MachineCraftMaterialGroup = MaterialCostEntry[];

type MachineCraftRow = {
  formula: string;
  metaLine: string;
  ingredients: MachineCraftMaterialGroup[];
  outcomes: MachineCraftMaterialGroup[];
  rounds: string;
  duration: string;
};

const buildingDescriptionHtml = computed(() => formatWikiHtml(buildingTable.value.desc));

function normalizeMachineCraftGroups(value: unknown): MachineCraftMaterialGroup[] {
  return toArray<unknown>(value)
    .flatMap((entry) => {
      if (Array.isArray(entry)) {
        return [
          normalizeMaterialCosts(
            entry,
            props.localNameMap,
            props.itemDefsByKeyHash,
            props.idToPackItemId,
          ),
        ];
      }
      if (isRecordLike(entry) && Array.isArray(entry.group)) {
        return [
          normalizeMaterialCosts(
            entry.group,
            props.localNameMap,
            props.itemDefsByKeyHash,
            props.idToPackItemId,
          ),
        ];
      }
      if (isRecordLike(entry)) {
        return [
          normalizeMaterialCosts(
            [entry],
            props.localNameMap,
            props.itemDefsByKeyHash,
            props.idToPackItemId,
          ),
        ];
      }
      return [];
    })
    .filter((group) => group.length > 0);
}

function materialGroups(value: unknown): MachineCraftMaterialGroup[] {
  return Array.isArray(value) ? (value as MachineCraftMaterialGroup[]) : [];
}

function formatMachineCraftDuration(value: unknown): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return '-';
  if (numeric % 6000 === 0) return `${numeric / 6000}s`;
  if (numeric % 1000 === 0) return `${numeric / 1000}s`;
  return formatScalar(value);
}

const machineCraftColumns = computed(() => [
  { key: 'formula', label: l('Formula') },
  { key: 'ingredients', label: l('Ingredients') },
  { key: 'outcomes', label: l('Outcomes') },
  { key: 'rounds', label: l('Rounds') },
  { key: 'duration', label: l('Duration') },
]);

const machineCraftRows = computed<MachineCraftRow[]>(() =>
  (
    Array.isArray(machineCraftTable.value)
      ? machineCraftTable.value
      : isRecordLike(machineCraftTable.value) && Array.isArray(machineCraftTable.value.formula)
        ? machineCraftTable.value.formula
        : []
  ).map((entry, index) => {
    if (!isRecordLike(entry)) {
      return {
        formula: `${l('Formula')} ${index + 1}`,
        metaLine: '',
        ingredients: [],
        outcomes: [],
        rounds: '-',
        duration: '-',
      };
    }
    const metaParts = [
      typeof entry.id === 'string' && entry.id.trim() ? `ID: ${entry.id.trim()}` : '',
      typeof entry.formulaGroupId === 'string' && entry.formulaGroupId.trim()
        ? `Group: ${entry.formulaGroupId.trim()}`
        : '',
      typeof entry.machineId === 'string' && entry.machineId.trim()
        ? `Machine: ${entry.machineId.trim()}`
        : '',
      typeof entry.sortId === 'number' || typeof entry.sortId === 'string'
        ? `Sort: ${formatScalar(entry.sortId)}`
        : '',
    ].filter(Boolean);

    return {
      formula:
        (typeof entry.formulaDesc === 'string' && entry.formulaDesc.trim()) ||
        (typeof entry.id === 'string' && entry.id.trim()) ||
        `${l('Formula')} ${index + 1}`,
      metaLine: metaParts.join(' · '),
      ingredients: normalizeMachineCraftGroups(entry.ingredients),
      outcomes: normalizeMachineCraftGroups(entry.outcomes),
      rounds:
        entry.progressRound === undefined || entry.progressRound === null
          ? '-'
          : formatScalar(entry.progressRound),
      duration: formatMachineCraftDuration(entry.totalProgress),
    };
  }),
);

const buildingEntries = computed(() =>
  buildInfoEntries(buildingTable.value, [
    { key: 'name', label: l('Name') },
    { key: 'id', label: l('ID'), mono: true },
    {
      key: 'type',
      label: l('Type'),
      format: (v: unknown) => getWarfarinEnumLabel(facBuildingTypeNames, v, locale.value),
    },
    { key: 'quickBarType', label: l('Quick Bar Type') },
    { key: 'rarity', label: l('Rarity') },
    { key: 'bandwidth', label: l('Bandwidth') },
    { key: 'powerConsume', label: l('Power Consumption') },
    { key: 'needPower', label: l('Needs Power'), format: (v: unknown) => formatLocalizedScalar(v, locale.value) },
    { key: 'canDelete', label: l('Can Delete'), format: (v: unknown) => formatLocalizedScalar(v, locale.value) },
    { key: 'canBatchSelect', label: l('Batch Select'), format: (v: unknown) => formatLocalizedScalar(v, locale.value) },
    { key: 'liquidEnabled', label: l('Liquid Enabled'), format: (v: unknown) => formatLocalizedScalar(v, locale.value) },
    { key: 'markInfoId', label: l('Mark Info ID'), mono: true },
  ]),
);

const fullBuildingEntries = computed(() =>
  buildInfoEntries(buildingTable.value, [
    { key: 'bgOnPanel', label: l('Panel Background'), mono: true },
    { key: 'iconOnPanel', label: l('Panel Icon'), mono: true },
    { key: 'buildCamState', label: l('Build Camera State'), mono: true },
    { key: 'modelHeight', label: l('Model Height') },
    { key: 'roadAttachSide', label: l('Road Attach Side') },
    { key: 'limitType', label: l('Limit Type') },
  ]),
);

const rangeEntries = computed(() =>
  buildInfoEntries(buildingRange.value, [
    { key: 'width', label: l('Width') },
    { key: 'height', label: l('Height') },
    { key: 'depth', label: l('Depth') },
    { key: 'x', label: l('Offset X') },
    { key: 'y', label: l('Offset Y') },
    { key: 'z', label: l('Offset Z') },
  ]),
);

const capabilityEntries = computed(() =>
  buildInfoEntries(buildingTable.value, [
    { key: 'needPower', label: l('Needs Power'), format: (v: unknown) => formatLocalizedScalar(v, locale.value) },
    { key: 'powerConsume', label: l('Power Consumption') },
    { key: 'canBatchModeTogglePower', label: l('Batch Toggle Power'), format: (v: unknown) => formatLocalizedScalar(v, locale.value) },
    { key: 'canBatchSelect', label: l('Can Batch Select'), format: (v: unknown) => formatLocalizedScalar(v, locale.value) },
    { key: 'canDelete', label: l('Can Delete'), format: (v: unknown) => formatLocalizedScalar(v, locale.value) },
    { key: 'onlyShowOnMain', label: l('Only Show On Main'), format: (v: unknown) => formatLocalizedScalar(v, locale.value) },
    { key: 'liquidEnabled', label: l('Liquid Enabled'), format: (v: unknown) => formatLocalizedScalar(v, locale.value) },
  ]),
);

const assetEntries = computed(() =>
  buildInfoEntries(buildingTable.value, [
    { key: 'markInfoId', label: l('Mark Info ID'), mono: true },
    { key: 'quickBarType', label: l('Quick Bar Type'), mono: true },
    { key: 'delConfirmText', label: l('Delete Confirm Text') },
  ]),
);

const limitEntries = computed(() =>
  [
    {
      label: l('Input Ports'),
      value: String(
        Array.isArray(buildingTable.value.inputPorts) ? buildingTable.value.inputPorts.length : 0,
      ),
      mono: false,
    },
    {
      label: l('Output Ports'),
      value: String(
        Array.isArray(buildingTable.value.outputPorts) ? buildingTable.value.outputPorts.length : 0,
      ),
      mono: false,
    },
    {
      label: l('Place Domains'),
      value: String(
        Array.isArray(buildingTable.value.placeDomains)
          ? buildingTable.value.placeDomains.length
          : 0,
      ),
      mono: false,
    },
    {
      label: l('Recommended Domains'),
      value: String(
        Array.isArray(buildingTable.value.recommendDomains)
          ? buildingTable.value.recommendDomains.length
          : 0,
      ),
      mono: false,
    },
    {
      label: l('Domain Limit Rules'),
      value: String(
        Array.isArray(buildingTable.value.placeDomainLimitCnt)
          ? buildingTable.value.placeDomainLimitCnt.length
          : 0,
      ),
      mono: false,
    },
  ].filter((entry) => entry.value !== '0'),
);
</script>

<style scoped>
.ww__machine-formula-title {
  font-weight: 600;
}

.ww__material-groups {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ww__material-group-label {
  font-size: 12px;
  opacity: 0.72;
}

.ww__material-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ww__material-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
}

.ww__material-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.ww__material-name {
  line-height: 1.2;
}

.ww__material-count {
  opacity: 0.8;
  font-variant-numeric: tabular-nums;
}
</style>
