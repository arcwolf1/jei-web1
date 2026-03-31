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

    <section v-if="hasData(machineCraftTable)" class="ww__section">
      <h3 class="ww__title">{{ l('Factory Machine Craft Table') }}</h3>
      <WJsonViewer :value="machineCraftTable" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import WInfoGrid from './shared/WInfoGrid.vue';
import WJsonViewer from './shared/WJsonViewer.vue';
import {
  type RecordLike,
  isRecordLike,
  hasData,
  buildInfoEntries,
  formatLocalizedScalar,
  formatWikiHtml,
} from './utils';
import { facBuildingTypeNames } from './genums';
import { getWarfarinEnumLabel, localizeWarfarinIdentifier } from './displayLabels';

const props = defineProps<{
  detail: RecordLike;
  list: RecordLike;
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

const buildingDescriptionHtml = computed(() => formatWikiHtml(buildingTable.value.desc));

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
