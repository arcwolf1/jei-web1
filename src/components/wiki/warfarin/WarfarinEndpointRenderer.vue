<template>
  <div class="ww">
    <div v-if="!payload" class="ww__empty">{{ l('No Raw Data Available') }}</div>

    <template v-else>
      <!-- Operator: full page + raw -->
      <template v-if="endpoint === 'operators'">
        <q-tabs v-model="activeTab" dense align="left" class="text-primary">
          <q-tab name="overview" :label="t('warfarin.common.wikiPage')" />
          <q-tab name="raw" :label="l('Raw')" />
        </q-tabs>
        <q-separator />
        <q-tab-panels v-model="activeTab" animated>
          <q-tab-panel name="overview" class="ww__operator-panel">
            <div v-if="operatorTocEntries.length" class="ww__toc-float">
              <q-btn round dense color="primary" icon="menu_book" class="ww__toc-button">
                <q-tooltip>{{ t('warfarin.common.tableOfContents') }}</q-tooltip>
                <q-menu
                  v-model="tocMenuOpen"
                  auto-close
                  anchor="bottom right"
                  self="top right"
                  class="ww__toc-menu"
                >
                  <q-list dense class="ww__toc-list">
                    <q-item-label header class="ww__toc-menu-title">
                      {{ t('warfarin.common.tableOfContents') }}
                    </q-item-label>
                    <q-item
                      v-for="entry in operatorTocEntries"
                      :key="entry.id"
                      clickable
                      class="ww__toc-menu-item"
                      @click="handleOperatorTocClick(entry.id)"
                    >
                      <q-item-section>{{ entry.label }}</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-btn>
            </div>

            <div class="ww__page-main">
              <WOperatorOverview
                :detail="payload.detail"
                :list="payload.list"
                :refs="payload.refs"
                :local-name-map="payload.localNameMap"
                :id-to-pack-item-id="payload.idToPackItemId"
                :item-defs-by-key-hash="itemDefsByKeyHash"
              />
              <WOperatorSkills
                :detail="payload.detail"
                :refs="payload.refs"
                :local-name-map="payload.localNameMap"
                :id-to-pack-item-id="payload.idToPackItemId"
                :item-defs-by-key-hash="itemDefsByKeyHash"
              />
              <WOperatorVoices
                :detail="payload.detail"
                :refs="payload.refs"
                :local-name-map="payload.localNameMap"
                :id-to-pack-item-id="payload.idToPackItemId"
                :item-defs-by-key-hash="itemDefsByKeyHash"
              />
            </div>
          </q-tab-panel>
          <q-tab-panel name="raw">
            <WJsonViewer :value="payload" />
          </q-tab-panel>
        </q-tab-panels>
      </template>

      <!-- Enemy: has its own tabs internally -->
      <template v-else-if="endpoint === 'enemies'">
        <WEnemyRenderer
          :detail="payload.detail"
          :list="payload.list"
          :refs="payload.refs"
          :local-name-map="payload.localNameMap"
        />
      </template>

      <!-- All other endpoints: overview + raw tabs -->
      <template v-else>
        <q-tabs v-model="activeTab" dense align="left" class="text-primary">
          <q-tab name="overview" :label="l('Overview')" />
          <q-tab name="raw" :label="l('Raw')" />
        </q-tabs>
        <q-separator />
        <q-tab-panels v-model="activeTab" animated>
          <q-tab-panel name="overview">
            <component
              :is="endpointComponent"
              :detail="payload.detail"
              :list="payload.list"
              :refs="payload.refs"
              :local-name-map="payload.localNameMap"
              :id-to-pack-item-id="payload.idToPackItemId"
              :item-defs-by-key-hash="itemDefsByKeyHash"
            />
          </q-tab-panel>
          <q-tab-panel name="raw">
            <WJsonViewer :value="payload" />
          </q-tab-panel>
        </q-tab-panels>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch, type Component } from 'vue';
import { useI18n } from 'vue-i18n';
import { loadPackSharedJson } from 'src/jei/pack/loader';
import type { ItemDef } from 'src/jei/types';
import WJsonViewer from './shared/WJsonViewer.vue';
import WOperatorOverview from './WOperatorOverview.vue';
import WOperatorVoices from './WOperatorVoices.vue';
import WOperatorSkills from './WOperatorSkills.vue';
import WEnemyRenderer from './WEnemyRenderer.vue';
import WItemRenderer from './WItemRenderer.vue';
import WWeaponRenderer from './WWeaponRenderer.vue';
import WGearRenderer from './WGearRenderer.vue';
import WFacilityRenderer from './WFacilityRenderer.vue';
import WMedalRenderer from './WMedalRenderer.vue';
import WMissionRenderer from './WMissionRenderer.vue';
import WLoreRenderer from './WLoreRenderer.vue';
import WTutorialRenderer from './WTutorialRenderer.vue';
import WDocumentRenderer from './WDocumentRenderer.vue';
import WGenericRenderer from './WGenericRenderer.vue';
import {
  type RecordLike,
  type WarfarinEndpointType,
  isRecordLike,
  normalizePayload,
} from './utils';
import { localizeWarfarinIdentifier } from './displayLabels';

const props = defineProps<{
  source: unknown;
  endpoint?: string | undefined;
  sourcePackId?: string | undefined;
  itemDefsByKeyHash?: Record<string, ItemDef> | undefined;
}>();

const { t, locale } = useI18n();
const l = (value: string) => localizeWarfarinIdentifier(value, locale.value);
const activeTab = ref('overview');
const tocMenuOpen = ref(false);
const hydratedSource = ref<unknown>(props.source);

function resolveRawRoot(source: unknown): RecordLike | null {
  if (!isRecordLike(source)) return null;
  if (isRecordLike(source.list) && isRecordLike(source.detail)) return source;
  if (
    isRecordLike(source.raw) &&
    isRecordLike(source.raw.list) &&
    isRecordLike(source.raw.detail)
  ) {
    return source.raw;
  }
  return null;
}

async function hydrateSourceWithSharedContext(
  source: unknown,
  packId: string | undefined,
): Promise<unknown> {
  const root = resolveRawRoot(source);
  const sharedContextPath =
    root && typeof root.sharedContextPath === 'string' ? root.sharedContextPath.trim() : '';
  if (!root || !packId || !sharedContextPath) return source;
  if (
    isRecordLike(root.refs) &&
    isRecordLike(root.localNameMap) &&
    isRecordLike(root.idToPackItemId)
  ) {
    return source;
  }

  const shared = await loadPackSharedJson(packId, sharedContextPath);
  if (!shared) return source;

  const nextRoot: RecordLike = { ...root };
  if (isRecordLike(shared.refs) && !isRecordLike(nextRoot.refs)) {
    nextRoot.refs = shared.refs;
  }
  if (isRecordLike(shared.localNameMap) && !isRecordLike(nextRoot.localNameMap)) {
    nextRoot.localNameMap = shared.localNameMap;
  }
  if (isRecordLike(shared.idToPackItemId) && !isRecordLike(nextRoot.idToPackItemId)) {
    nextRoot.idToPackItemId = shared.idToPackItemId;
  }
  delete nextRoot.sharedContextPath;

  if (root === source) return nextRoot;
  if (!isRecordLike(source)) return source;
  return {
    ...source,
    raw: nextRoot,
  };
}

watch(
  () => [props.source, props.sourcePackId] as const,
  async ([source, packId]) => {
    hydratedSource.value = await hydrateSourceWithSharedContext(source, packId);
  },
  { immediate: true },
);

const payload = computed(() => normalizePayload(hydratedSource.value));

const endpoint = computed<WarfarinEndpointType>(() => {
  if (props.endpoint) return props.endpoint as WarfarinEndpointType;
  // Try to detect endpoint from data structure
  const detail = payload.value?.detail;
  if (!detail) return 'operators';
  if (detail.characterTable) return 'operators';
  if (detail.displayEnemyInfoTable) return 'enemies';
  if (detail.weaponBasicTable) return 'weapons';
  if (detail.equipTable) return 'gear';
  if (detail.factoryBuildingTable) return 'facilities';
  if (detail.achievementTable) return 'medals';
  if (detail.mission) return 'missions';
  if (detail.wikiTutorialPageTable || detail.wikiTutorialPageByEntryTable) return 'tutorials';
  if (detail.prtsDocument) return 'documents';
  if (detail.richContentTable && !detail.itemTable) return 'lore';
  if (detail.itemTable) return 'items';
  return 'operators';
});

const endpointComponentMap: Record<string, Component> = {
  items: WItemRenderer,
  weapons: WWeaponRenderer,
  gear: WGearRenderer,
  facilities: WFacilityRenderer,
  medals: WMedalRenderer,
  missions: WMissionRenderer,
  lore: WLoreRenderer,
  tutorials: WTutorialRenderer,
  documents: WDocumentRenderer,
};

const endpointComponent = computed<Component>(
  () => endpointComponentMap[endpoint.value] ?? WGenericRenderer,
);

const operatorTocEntries = computed(() => {
  const detail = isRecordLike(payload.value?.detail) ? payload.value.detail : {};
  const characterTable = isRecordLike(detail.characterTable) ? detail.characterTable : {};
  const growthTable = isRecordLike(detail.charGrowthTable) ? detail.charGrowthTable : {};
  const potentialTable = isRecordLike(detail.characterPotentialTable)
    ? detail.characterPotentialTable
    : {};
  const out: Array<{ id: string; label: string }> = [];
  const push = (enabled: boolean, id: string, label: string) => {
    if (enabled) out.push({ id, label });
  };
  push(true, 'operator-overview', t('warfarin.operator.overview'));
  push(
    Array.isArray(characterTable.attributes),
    'operator-attributes',
    t('warfarin.operator.attributes'),
  );
  push(!!growthTable.charBreakCostMap, 'operator-promotions', t('warfarin.operator.promotions'));
  push(!!growthTable.talentNodeMap, 'operator-talents', t('warfarin.operator.talents'));
  push(
    !!potentialTable.potentialUnlockBundle,
    'operator-potentials',
    t('warfarin.operator.potentials'),
  );
  push(!!detail.skillPatchTable, 'operator-combat-skills', t('warfarin.operator.combatSkills'));
  push(!!detail.spaceshipSkillTable, 'operator-base-skills', t('warfarin.operator.baseSkills'));
  push(!!detail.snapshots, 'operator-artworks', t('warfarin.operator.artworks'));
  push(
    Array.isArray(characterTable.profileRecord),
    'operator-files',
    t('warfarin.operator.operatorFiles'),
  );
  push(
    Array.isArray(characterTable.profileVoice),
    'operator-audio-log',
    t('warfarin.operator.audioLog'),
  );
  return out;
});

function writeOperatorTocHash(sectionId: string): void {
  if (typeof window === 'undefined') return;
  const nextHash = encodeURIComponent(sectionId);
  const nextUrl = `${window.location.pathname}${window.location.search}#${nextHash}`;
  window.history.replaceState(window.history.state, '', nextUrl);
}

function scrollToOperatorSection(sectionId: string, behavior: ScrollBehavior = 'smooth'): void {
  if (typeof document === 'undefined') return;
  const target = document.getElementById(sectionId);
  if (!target) return;
  target.scrollIntoView({ behavior, block: 'start' });
  writeOperatorTocHash(sectionId);
}

function handleOperatorTocClick(sectionId: string): void {
  tocMenuOpen.value = false;
  void nextTick(() => {
    scrollToOperatorSection(sectionId);
  });
}

function syncOperatorSectionFromHash(behavior: ScrollBehavior = 'auto'): void {
  if (
    typeof window === 'undefined' ||
    endpoint.value !== 'operators' ||
    activeTab.value !== 'overview'
  ) {
    return;
  }
  const rawHash = window.location.hash.replace(/^#/, '').trim();
  if (!rawHash) return;
  const sectionId = decodeURIComponent(rawHash);
  if (!operatorTocEntries.value.some((entry) => entry.id === sectionId)) return;
  scrollToOperatorSection(sectionId, behavior);
}

onMounted(() => {
  void nextTick(() => {
    syncOperatorSectionFromHash('auto');
  });
});

watch(activeTab, (tab) => {
  if (tab !== 'overview') return;
  void nextTick(() => {
    syncOperatorSectionFromHash('auto');
  });
});
</script>

<style>
/* Shared styles for all warfarin-wiki sub-components (intentionally unscoped) */
.ww {
  --ww-text: rgba(0, 0, 0, 0.88);
  --ww-muted: rgba(0, 0, 0, 0.6);
  --ww-subtle: rgba(0, 0, 0, 0.45);
  --ww-border: rgba(0, 0, 0, 0.12);
  --ww-border-soft: rgba(0, 0, 0, 0.08);
  --ww-surface: rgba(0, 0, 0, 0.03);
  --ww-surface-soft: rgba(0, 0, 0, 0.02);
  --ww-surface-strong: rgba(0, 0, 0, 0.06);
  --ww-surface-hover: rgba(0, 0, 0, 0.08);
  --ww-table-bg: #ffffff;
  --ww-table-head-bg: #f7f7f7;
  --ww-raw-bg: #111827;
  --ww-raw-text: #e5e7eb;
  --ww-code-bg: rgba(0, 0, 0, 0.06);
  --ww-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
  color: var(--ww-text);
}

body.body--dark .ww {
  --ww-text: rgba(255, 255, 255, 0.92);
  --ww-muted: rgba(255, 255, 255, 0.72);
  --ww-subtle: rgba(255, 255, 255, 0.52);
  --ww-border: rgba(255, 255, 255, 0.16);
  --ww-border-soft: rgba(255, 255, 255, 0.1);
  --ww-surface: rgba(255, 255, 255, 0.06);
  --ww-surface-soft: rgba(255, 255, 255, 0.04);
  --ww-surface-strong: rgba(255, 255, 255, 0.1);
  --ww-surface-hover: rgba(255, 255, 255, 0.14);
  --ww-table-bg: #1b1f2a;
  --ww-table-head-bg: #252b38;
  --ww-raw-bg: #0f172a;
  --ww-raw-text: rgba(255, 255, 255, 0.88);
  --ww-code-bg: rgba(255, 255, 255, 0.08);
  --ww-shadow: 0 14px 34px rgba(0, 0, 0, 0.28);
}

.ww__empty {
  color: var(--ww-muted);
}
.ww__section {
  margin-bottom: 1.5rem;
}
.ww__title {
  margin: 0 0 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--ww-border);
  color: var(--q-primary);
  font-size: 1rem;
  font-weight: 600;
}
.ww__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}
.ww__operator-panel {
  position: relative;
}
.ww__page-main {
  min-width: 0;
}
.ww__toc-float {
  position: sticky;
  top: 0.5rem;
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.75rem;
  z-index: 20;
}
.ww__toc-button {
  box-shadow: var(--ww-shadow);
}
.ww__toc-menu {
  min-width: 220px;
  border: 1px solid var(--ww-border);
  border-radius: 12px;
  background: var(--ww-table-bg);
  color: var(--ww-text);
  box-shadow: var(--ww-shadow);
}
.ww__toc-list {
  padding: 0.35rem 0;
}
.ww__toc-menu-title {
  color: var(--ww-muted);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.ww__toc-menu-item {
  min-height: 38px;
}
.ww__card,
.ww__panel,
.ww__tag-box,
.ww__subpanel {
  background: var(--ww-surface);
  border: 1px solid var(--ww-border);
  border-radius: 8px;
  box-shadow: var(--ww-shadow);
}
.ww__card {
  padding: 1rem;
}
.ww__card--media {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.ww__image {
  width: 100%;
  background: var(--ww-surface-soft);
  border: 1px solid var(--ww-border-soft);
  border-radius: 6px;
  object-fit: cover;
}
.ww__label,
.ww__panel-sub {
  color: var(--ww-muted);
  font-size: 0.75rem;
}
.ww__value,
.ww__panel-title {
  color: var(--ww-text);
  font-size: 0.95rem;
  font-weight: 600;
}
.ww__value--mono {
  font-family: Consolas, 'Courier New', monospace;
  word-break: break-all;
}
.ww__tag-box,
.ww__panel,
.ww__subpanel {
  padding: 0.9rem 1rem;
}
.ww__tag-row + .ww__tag-row,
.ww__panel + .ww__panel,
.ww__subpanel + .ww__subpanel {
  margin-top: 0.75rem;
}
.ww__tag-label {
  display: inline-block;
  min-width: 5rem;
  color: var(--q-primary);
  font-weight: 600;
}
.ww__stack {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.ww__stack--compact {
  gap: 0.75rem;
}
.ww__prose {
  margin-top: 0.75rem;
  line-height: 1.65;
  white-space: pre-wrap;
}
.ww__prose--box {
  margin-top: 1rem;
  padding: 1rem;
  background: var(--ww-surface);
  border-radius: 8px;
}
.ww__prose--small {
  font-size: 0.875rem;
}
.ww__muted {
  margin-top: 0.5rem;
  color: var(--ww-muted);
  font-size: 0.85rem;
  line-height: 1.55;
}
.ww__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.ww__badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  background: var(--ww-surface-strong);
  color: var(--ww-text);
  border-radius: 4px;
  font-size: 0.85rem;
}
.ww__table-wrap {
  overflow: auto;
}
.ww__table {
  width: 100%;
  border-collapse: collapse;
  background: var(--ww-table-bg);
  color: var(--ww-text);
}
.ww__table--wide {
  min-width: 720px;
}
.ww__table th,
.ww__table td {
  padding: 0.5rem 0.625rem;
  border: 1px solid var(--ww-border);
  text-align: left;
  vertical-align: top;
}
.ww__table th {
  position: sticky;
  top: 0;
  background: var(--ww-table-head-bg);
  z-index: 1;
}
.ww__table tbody tr:nth-child(even) {
  background: var(--ww-surface-soft);
}
.ww__table tbody tr:hover {
  background: var(--ww-surface-hover);
}
.ww__attr-type {
  display: block;
  color: var(--ww-subtle);
  font-size: 0.7rem;
  font-weight: 400;
}
.ww__expansion {
  background: var(--ww-surface-soft);
  border: 1px solid var(--ww-border-soft);
  border-radius: 8px;
  margin-bottom: 0.75rem;
}
.ww__expansion .q-item {
  color: var(--ww-text);
}
.ww__expansion .q-item__label,
.ww__expansion .q-item__section {
  color: inherit;
}
.ww__expansion .q-separator {
  background: var(--ww-border-soft);
}
.ww__raw {
  margin: 0;
  padding: 1rem;
  overflow: auto;
  background: var(--ww-raw-bg);
  color: var(--ww-raw-text);
  border-radius: 8px;
  font-size: 0.75rem;
  line-height: 1.55;
}
.ww__recipe-meta {
  font-size: 0.8rem;
  color: var(--ww-muted);
  margin-top: 0.5rem;
}
.ww__recipe-items {
  color: var(--ww-text);
  font-size: 0.85rem;
  margin-top: 0.25rem;
}
.ww__rich-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.ww__prose,
.ww__prose :where(p, li, strong, em, span, div) {
  color: inherit;
}
.ww__prose p {
  margin: 0.5rem 0;
}
.ww__prose ul,
.ww__prose ol {
  margin: 0.5rem 0;
  padding-left: 1.25rem;
}
.ww__prose code {
  background: var(--ww-code-bg);
  color: inherit;
  border-radius: 4px;
  padding: 0.1rem 0.35rem;
}
.ww__prose pre {
  background: var(--ww-raw-bg);
  color: var(--ww-raw-text);
  border-radius: 8px;
  padding: 0.875rem 1rem;
  overflow: auto;
}
.ww__prose pre code {
  background: transparent;
  padding: 0;
}
.ww__prose a {
  color: var(--q-primary);
  text-decoration-color: var(--ww-muted);
}
.ww__prose a:hover {
  text-decoration-color: currentColor;
}
.ww__inline {
  font-weight: 600;
}
.ww__inline--accent {
  color: var(--q-primary);
}
.ww__inline--battle {
  color: #f4b46c;
}
.ww__inline--positive {
  color: #ffbf66;
}
.ww__inline--negative {
  color: #ff9f7d;
}
.ww__inline--status {
  color: #6ebeff;
}
.ww__inline--physical {
  color: #f1b86c;
}
.ww__inline--spell {
  color: #c59cff;
}
.ww__inline--fire {
  color: #ff8e61;
}
.ww__inline--cryst {
  color: #7ddcff;
}
.ww__inline--pulse {
  color: #9fa4ff;
}
.ww__inline--natural {
  color: #8fd07d;
}
.ww__inline--originium {
  color: #d59aff;
}
.ww__inline--item {
  color: #7fd0ff;
}
.ww__inline--system {
  color: #8cd17d;
}
.ww__inline--muted {
  color: var(--ww-muted);
}
.ww__inline--tips-orange {
  color: #ffb357;
}
.ww__inline--tips-purple {
  color: #bb9cff;
}
.ww__inline-value {
  color: #ffcf70;
  font-weight: 700;
}
.ww__inline-icon {
  display: inline-block;
  width: 1.25em;
  height: 1.25em;
  vertical-align: text-bottom;
  object-fit: contain;
}
.ww__cost-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.625rem;
  align-items: flex-start;
}
.ww__cost-grid--compact {
  gap: 0.5rem;
}
.ww__cost-card {
  width: 96px;
  flex: 0 0 96px;
  padding: 0;
  border: 1px solid var(--ww-border);
  border-radius: 8px;
  background: var(--ww-surface-soft);
  color: var(--ww-text);
  text-align: left;
}
.ww__cost-fallback-card {
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: inherit;
}
.ww__cost-grid--compact .ww__cost-card {
  width: 82px;
  flex-basis: 82px;
}
.ww__cost-card--clickable {
  cursor: pointer;
}
.ww__cost-stack {
  padding: 0.42rem 0.45rem 0.48rem;
}
.ww__cost-grid--compact .ww__cost-stack {
  padding: 0.32rem 0.4rem 0.42rem;
}
.ww__cost-stack :deep(.stack-view) {
  width: 100%;
}
.ww__cost-stack :deep(.stack-view__main) {
  width: 100%;
}
.ww__cost-stack :deep(.stack-view__icon),
.ww__cost-stack :deep(.stack-view__icon-fallback) {
  width: 56px;
  height: 56px;
}
.ww__cost-grid--compact .ww__cost-stack :deep(.stack-view__icon),
.ww__cost-grid--compact .ww__cost-stack :deep(.stack-view__icon-fallback) {
  width: 50px;
  height: 50px;
}
.ww__cost-stack :deep(.stack-view__name) {
  max-width: 100%;
  padding-inline: 0.1rem;
  text-align: center;
  text-decoration: none !important;
  white-space: normal;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.ww__cost-stack :deep(.stack-view__subline) {
  justify-content: center;
  min-height: 1.1rem;
}
.ww__cost-stack :deep(.stack-view__sub) {
  font-size: 0.72rem;
  line-height: 1.1;
  font-weight: 700;
  color: var(--ww-muted);
  opacity: 1;
}
.ww__cost-thumb {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.42rem;
  border-bottom: 1px solid var(--ww-border-soft);
}
.ww__cost-grid--compact .ww__cost-thumb {
  padding: 0.32rem;
}
.ww__cost-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.ww__cost-fallback {
  font-size: 1.8rem;
  font-weight: 700;
  opacity: 0.7;
}
.ww__cost-name {
  padding: 0.2rem 0.45rem 0;
  font-size: 0.74rem;
  line-height: 1.25;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  text-align: center;
}
.ww__cost-grid--compact .ww__cost-name {
  padding: 0.16rem 0.4rem 0;
  font-size: 0.7rem;
  line-height: 1.2;
}
.ww__cost-count-row {
  padding: 0.12rem 0.45rem 0.48rem;
  color: var(--ww-muted);
  font-size: 0.72rem;
  line-height: 1.1;
  font-weight: 700;
  text-align: center;
}
.ww__cost-grid--compact .ww__cost-count-row {
  padding: 0.08rem 0.4rem 0.42rem;
  font-size: 0.68rem;
}
.ww__material-upgrades {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 0.875rem;
  align-items: flex-start;
}
.ww__material-column {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}
.ww__material-column-title {
  color: var(--ww-text);
  font-weight: 700;
  text-align: center;
}
.ww__talent-card,
.ww__potential-card {
  background: var(--ww-surface-soft);
  border: 1px solid var(--ww-border-soft);
  border-radius: 16px;
}
.ww__talent-card {
  padding: 0.75rem 0.9rem 0.85rem;
}
.ww__talent-head {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}
.ww__talent-icon-box {
  width: 72px;
  height: 72px;
  flex: 0 0 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--ww-border-soft);
}
.ww__talent-icon {
  width: 52px;
  height: 52px;
  object-fit: contain;
}
.ww__talent-icon-fallback {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--ww-text);
}
.ww__talent-copy {
  min-width: 0;
}
.ww__talent-name,
.ww__potential-name {
  font-size: 1rem;
  line-height: 1.2;
  font-weight: 700;
  color: var(--ww-text);
}
.ww__talent-sub {
  margin-top: 0.2rem;
  font-size: 0.78rem;
  color: var(--ww-muted);
}
.ww__talent-desc,
.ww__potential-desc {
  margin-top: 0.7rem;
}
.ww__potential-card {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem 1.1rem;
}
.ww__potential-index {
  width: 44px;
  flex: 0 0 44px;
  padding-top: 0.05rem;
  font-size: 2rem;
  line-height: 1;
  font-weight: 300;
  color: white;
}
.ww__potential-body {
  min-width: 0;
  flex: 1;
}
body.body--dark .ww__potential-index {
  color: #ffffff;
}
@media (max-width: 640px) {
  .ww__talent-icon-box {
    width: 60px;
    height: 60px;
    flex-basis: 60px;
  }
  .ww__talent-icon {
    width: 44px;
    height: 44px;
  }
  .ww__potential-card {
    gap: 0.8rem;
    padding: 0.9rem 0.95rem;
  }
  .ww__potential-index {
    width: 34px;
    flex-basis: 34px;
    font-size: 1.65rem;
  }
}
.ww .q-tab-panels,
.ww .q-tab-panel {
  background: transparent;
  color: var(--ww-text);
}
@media (max-width: 900px) {
  .ww__toc-float {
    top: 0;
  }
}
</style>
