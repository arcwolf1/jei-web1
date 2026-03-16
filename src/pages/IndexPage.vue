<template>
  <q-page :class="['jei-page', { 'jei-debug': settingsStore.debugLayout }]">
    <div v-if="error" class="text-negative q-pa-md">{{ error }}</div>

    <jei-loading
      v-else-if="loading && settingsStore.showLoadingOverlay"
      overlay
      :pack-label="currentPackLabel"
      :progress="loadingProgress"
      @open-settings="settingsOpen = true"
    />

    <jei-loading
      v-else-if="loading && !settingsStore.showLoadingOverlay"
      :overlay="false"
      :progress="loadingProgress"
    />

    <div
      v-else
      class="jei-root"
      :class="{
        'jei-root--mobile': isMobile,
        'jei-root--fav-collapsed': settingsStore.favoritesCollapsed,
        'jei-root--panel-collapsed': settingsStore.panelCollapsed,
      }"
    >
      <!-- 上下文菜单 -->
      <item-context-menu
        ref="contextMenuRef"
        :open="contextMenuOpen"
        @update:open="contextMenuOpen = $event"
        :target="contextMenuTarget ?? undefined"
        @hide="contextMenuTarget = null"
        :is-favorite="contextMenuKeyHash ? isFavorite(contextMenuKeyHash) : false"
        @action="onContextMenuAction"
      />

      <!-- 收藏夹面板 -->
      <favorites-panel
        :is-mobile="isMobile"
        :mobile-tab="mobileTab"
        :collapsed="settingsStore.favoritesCollapsed"
        :saved-plans="savedPlans"
        :favorite-items="favoriteItems"
        :item-defs-by-key-hash="itemDefsByKeyHash"
        @update:collapsed="settingsStore.setFavoritesCollapsed($event)"
        @update:hovered-key-hash="hoveredKeyHash = $event"
        @update:hovered-source="hoveredSource = $event"
        @open-plan="openSavedPlan"
        @delete-plan="deleteSavedPlan"
        @item-click="openDialogFromFavorites"
        @toggle-favorite="toggleFavorite"
        @context-menu="onContextMenu"
        @touch-hold="onTouchHold"
      />

      <!-- 中间区域面板 -->
      <center-panel
        ref="centerPanelRef"
        :is-mobile="isMobile"
        :mobile-tab="mobileTab"
        :collapsed="settingsStore.panelCollapsed"
        :recipe-view-mode="settingsStore.recipeViewMode"
        :center-tab="centerTab"
        :nav-stack-length="navStack.length"
        :current-item-title="currentItemTitle"
        :active-tab="activeTab"
        :pack="pack"
        :index="index"
        :current-item-key="currentItemKey"
        :current-item-def="currentItemDef"
        :item-defs-by-key-hash="itemDefsByKeyHash ?? {}"
        :rendered-description="renderedDescription ?? ''"
        :active-type-key="activeTypeKey ?? ''"
        :active-recipe-groups="(activeRecipeGroups ?? []) as any"
        :all-recipe-groups="(allRecipeGroups ?? []) as any"
        :type-machine-icons="typeMachineIcons ?? []"
        :recipes-by-id="recipesById ?? new Map()"
        :recipe-types-by-key="recipeTypesByKey ?? new Map()"
        :planner-initial-state="plannerInitialState"
        :planner-tab="plannerTab ?? 'tree'"
        :plugin-context="pluginContext"
        :plugin-query-actions="pluginQueryActions"
        :plugin-tabs="pluginTabs"
        :center-plugin-tabs="centerPluginTabs"
        :resolve-plugin-api="resolvePluginApi"
        @update:collapsed="settingsStore.setPanelCollapsed($event)"
        @update:center-tab="centerTab = $event"
        @update:active-tab="activeTab = $event"
        @update:active-type-key="activeTypeKey = $event"
        @go-back="goBackInDialog"
        @close="closeDialog"
        @item-click="openDialogByItemKey"
        @wiki-item-click="(key) => openDialogByItemKey(key, 'wiki')"
        @machine-item-click="openMachineItem"
        @save-plan="savePlannerPlan"
        @state-change="onPlannerStateChange"
        @item-mouseenter="
          hoveredKeyHash = $event;
          hoveredSource = 'recipe';
        "
        @item-mouseleave="
          hoveredKeyHash = null;
          hoveredSource = 'none';
        "
        @item-context-menu="(evt, keyHash) => onContextMenu(evt, keyHash)"
        @item-touch-hold="(evt, keyHash) => onTouchHold(evt, keyHash)"
      />

      <!-- 物品列表面板 -->
      <item-list-panel
        ref="itemListPanelRef"
        :is-mobile="isMobile"
        :mobile-tab="mobileTab"
        :pack-id="pack?.manifest.packId ?? ''"
        :first-paged-item="firstPagedItem"
        :rest-paged-items="restPagedItems"
        :padded-history-items="paddedHistoryItems"
        :page="page"
        @update:page="page = $event"
        :page-size="pageSize"
        :page-count="pageCount"
        :total-count="filteredItems.length"
        :measured-cell-height="measuredCellHeight"
        :item-defs-by-key-hash="itemDefsByKeyHash"
        :favorites="favorites"
        @update:hovered-key-hash="hoveredKeyHash = $event"
        @update:hovered-source="hoveredSource = $event"
        @item-click="openDialogByKeyHash"
        @toggle-favorite="toggleFavorite"
        @context-menu="onContextMenu"
        @touch-hold="onTouchHold"
        @wheel="onListWheel"
      />
    </div>

    <div
      v-if="isMobile"
      class="jei-mobile-nav shadow-up-2"
      :class="isDark ? 'bg-dark text-white' : 'bg-white text-grey-8'"
    >
      <q-tabs
        v-model="mobileTab"
        dense
        align="justify"
        active-color="primary"
        indicator-color="primary"
      >
        <q-tab name="fav" icon="star" :label="t('tabsFavorites')" />
        <q-tab name="panel" icon="dashboard" :label="t('tabsPanel')" />
        <q-tab name="list" icon="list" :label="t('tabsList')" />
      </q-tabs>
    </div>

    <!-- 底部栏 -->
    <bottom-bar
      :active-pack-id="activePackId"
      @update:active-pack-id="activePackId = $event"
      :pack-options="packOptions"
      :filter-text="filterText"
      @update:filter-text="filterText = $event"
      :filter-disabled="filterDisabled"
      :loading="loading"
      :available-item-ids="availableItemIds"
      :available-game-ids="availableGameIds"
      :available-tags="availableTags"
      @open-settings="settingsOpen = true"
    />

    <!-- 设置对话框 -->
    <settings-dialog
      :open="settingsOpen"
      @update:open="settingsOpen = $event"
      :history-limit="settingsStore.historyLimit"
      @update:history-limit="settingsStore.setHistoryLimit($event)"
      :debug-layout="settingsStore.debugLayout"
      @update:debug-layout="settingsStore.setDebugLayout($event)"
      :debug-nav-panel="settingsStore.debugNavPanel"
      @update:debug-nav-panel="settingsStore.setDebugNavPanel($event)"
      :show-loading-overlay="settingsStore.showLoadingOverlay"
      @update:show-loading-overlay="settingsStore.setShowLoadingOverlay($event)"
      :quant-line-width-scale="settingsStore.quantLineWidthScale"
      @update:quant-line-width-scale="settingsStore.setQuantLineWidthScale($event)"
      :production-line-g6-scale="settingsStore.productionLineG6Scale"
      @update:production-line-g6-scale="settingsStore.setProductionLineG6Scale($event)"
      :machine-count-decimals="settingsStore.machineCountDecimals"
      @update:machine-count-decimals="settingsStore.setMachineCountDecimals($event)"
      :line-intermediate-coloring="settingsStore.lineIntermediateColoring"
      @update:line-intermediate-coloring="settingsStore.setLineIntermediateColoring($event)"
      :production-line-renderer="settingsStore.productionLineRenderer"
      @update:production-line-renderer="settingsStore.setProductionLineRenderer($event)"
      :quant-flow-renderer="settingsStore.quantFlowRenderer"
      @update:quant-flow-renderer="settingsStore.setQuantFlowRenderer($event)"
      :recipe-view-mode="settingsStore.recipeViewMode"
      @update:recipe-view-mode="settingsStore.setRecipeViewMode($event)"
      :recipe-slot-show-name="settingsStore.recipeSlotShowName"
      @update:recipe-slot-show-name="settingsStore.setRecipeSlotShowName($event)"
      :favorites-opens-new-stack="settingsStore.favoritesOpensNewStack"
      @update:favorites-open-stack="settingsStore.setFavoritesOpensNewStack($event)"
      :detect-pc-disable-mobile="settingsStore.detectPcDisableMobile"
      @update:detect-pc-disable-mobile="settingsStore.setDetectPcDisableMobile($event)"
      :pack-proxy-template="packProxyTemplate"
      :pack-dev-proxy-template="packDevProxyTemplate"
      :pack-image-proxy-use-pack-provided="settingsStore.packImageProxyUsePackProvided"
      @update:pack-image-proxy-use-pack-provided="
        settingsStore.setPackImageProxyUsePackProvided($event)
      "
      :pack-image-proxy-use-manual="settingsStore.packImageProxyUseManual"
      @update:pack-image-proxy-use-manual="settingsStore.setPackImageProxyUseManual($event)"
      :pack-image-proxy-use-dev="settingsStore.packImageProxyUseDev"
      @update:pack-image-proxy-use-dev="settingsStore.setPackImageProxyUseDev($event)"
      :pack-image-proxy-manual-url="settingsStore.packImageProxyManualUrl"
      @update:pack-image-proxy-manual-url="settingsStore.setPackImageProxyManualUrl($event)"
      :pack-image-proxy-dev-url="settingsStore.packImageProxyDevUrl"
      @update:pack-image-proxy-dev-url="settingsStore.setPackImageProxyDevUrl($event)"
      :pack-image-proxy-access-token="settingsStore.packImageProxyAccessToken"
      @update:pack-image-proxy-access-token="settingsStore.setPackImageProxyAccessToken($event)"
      :pack-image-proxy-anonymous-token="settingsStore.packImageProxyAnonymousToken"
      @update:pack-image-proxy-anonymous-token="
        settingsStore.setPackImageProxyAnonymousToken($event)
      "
      :pack-image-proxy-framework-token="settingsStore.packImageProxyFrameworkToken"
      @update:pack-image-proxy-framework-token="
        settingsStore.setPackImageProxyFrameworkToken($event)
      "
      :plugin-entries="pluginEntries"
      :plugin-setting-sections="pluginSettingSections"
      :keybinding-groups="keybindingSettingGroups"
      :custom-pack-sources="
        settingsStore.customPackSources.map((s) => ({
          packId: s.packId,
          url: s.mirrors?.[0] || '',
          label: s.label,
        }))
      "
      :pack-mirrors="activePackMirrorRows"
      :active-pack-mirror-url="activePackMirrorUrl"
      :pack-mirror-selection-mode="activePackMirrorMode"
      :pack-manual-mirror="activePackManualMirror"
      :mirror-latency-loading="mirrorLatencyLoading"
      @add-custom-source="onAddCustomSource"
      @remove-custom-source="onRemoveCustomSource"
      @refresh-pack-cache="onRefreshPackCache"
      @update:pack-mirror-selection-mode="onUpdatePackMirrorSelectionMode"
      @update:pack-manual-mirror="onUpdatePackManualMirror"
      @update:plugin-enabled="onPluginEnabledChange"
      @update:plugin-setting="onPluginSettingChange"
      @update:keybinding="onKeybindingChange"
      @reset:keybindings="onResetKeybindings"
      @refresh-mirror-latency="refreshActivePackMirrorLatency"
    />

    <pre v-if="settingsStore.debugLayout" class="jei-debug-overlay">{{ debugText }}</pre>

    <!-- 物品详情对话框 -->
    <item-dialog
      :open="dialogOpen"
      @update:open="dialogOpen = $event"
      @close="closeDialog"
      :is-mobile="isMobile"
      :current-item-title="currentItemTitle"
      :pack="pack"
      :index="index"
      :current-item-key="currentItemKey"
      :current-item-def="currentItemDef"
      :item-defs-by-key-hash="itemDefsByKeyHash"
      :rendered-description="renderedDescription"
      :active-tab="activeTab"
      @update:active-tab="activeTab = $event"
      :active-type-key="activeTypeKey"
      @update:active-type-key="activeTypeKey = $event"
      :active-recipe-groups="activeRecipeGroups as any"
      :all-recipe-groups="allRecipeGroups as any"
      :type-machine-icons="typeMachineIcons"
      :recipes-by-id="recipesById"
      :recipe-types-by-key="recipeTypesByKey"
      :planner-initial-state="plannerInitialState"
      :planner-tab="plannerTab"
      :plugin-context="pluginContext"
      :plugin-tabs="pluginTabs"
      :resolve-plugin-api="resolvePluginApi"
      @item-click="openDialogByItemKey"
      @wiki-item-click="(key) => openDialogByItemKey(key, 'wiki')"
      @machine-item-click="openMachineItem"
      @save-plan="savePlannerPlan"
      @state-change="onPlannerStateChange"
      @ensure-recipe-detail="ensureRecipeDetailLoadedById"
      @item-mouseenter="
        hoveredKeyHash = $event;
        hoveredSource = 'recipe';
      "
      @item-mouseleave="
        hoveredKeyHash = null;
        hoveredSource = 'none';
      "
      @item-context-menu="(evt, keyHash) => onContextMenu(evt, keyHash)"
      @item-touch-hold="(evt, keyHash) => onTouchHold(evt, keyHash)"
    />

    <!-- 调试悬浮窗 -->
    <debug-panel
      v-if="settingsStore.debugNavPanel"
      :nav-stack="navStack"
      :dialog-open="dialogOpen"
    />
  </q-page>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch, provide } from 'vue';
import { useQuasar } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import type { ItemDef, ItemKey, PackData, Recipe } from 'src/jei/types';
import { useDialogManager } from 'src/stores/dialogManager';
import {
  clearPackRuntimeCache,
  getAggregateSourcePackIds,
  getActivePackBaseUrl,
  getPackBaseUrls,
  loadPackItemDetail,
  loadPackRecipeDetail,
  loadRuntimePack,
  registerPackSource,
  setPackMirrorLatencyHint,
  setPackMirrorPreference,
  type LoadProgress,
} from 'src/jei/pack/loader';
import {
  applyImageProxyToPack,
  ensurePackImageProxyTokens,
  resolveImageUrl,
} from 'src/jei/pack/imageProxy';
import {
  buildJeiIndex,
  recipesConsumingItem,
  recipesProducingItem,
  type JeiIndex,
} from 'src/jei/indexing/buildIndex';
import FavoritesPanel from './components/FavoritesPanel.vue';
import ItemListPanel from './components/ItemListPanel.vue';
import CenterPanel from './components/CenterPanel.vue';
import BottomBar from './components/BottomBar.vue';
import SettingsDialog from './components/SettingsDialog.vue';
import ItemDialog from './components/ItemDialog.vue';
import ItemContextMenu from './components/ItemContextMenu.vue';
import DebugPanel from './components/DebugPanel.vue';
import JeiLoading from 'src/components/JeiLoading.vue';
import MarkdownIt from 'markdown-it';
import { pinyin } from 'pinyin-pro';
import type {
  PlannerInitialState,
  PlannerLiveState,
  PlannerSavePayload,
  AdvancedObjectiveEntry,
} from 'src/jei/planner/plannerUi';
import { ObjectiveType } from 'src/jei/planner/types';
import type { ObjectiveUnit } from 'src/jei/planner/types';
import { itemKeyHash } from 'src/jei/indexing/key';
import { autoPlanSelections } from 'src/jei/planner/planner';
import { builtinPlugins } from 'src/jei/plugins/builtin';
import { PluginManager } from 'src/jei/plugins/runtime';
import type {
  HostApiHandler,
  PluginApiResult,
  PluginCenterTabRuntime,
  PluginItemContext,
  PluginSettingDefinition,
  PluginSettingValue,
  PluginTabRuntime,
} from 'src/jei/plugins/types';
import { useSettingsStore } from 'src/stores/settings';
import {
  useKeyBindingsStore,
  eventMatchesBinding,
  type KeyBinding,
  type KeyAction,
} from 'src/stores/keybindings';
import { usePackRoutingRuntimeStore, type PackSourceSnapshot } from 'src/stores/packRoutingRuntime';
import { storage } from 'src/utils/storage';

const settingsStore = useSettingsStore();
const keyBindingsStore = useKeyBindingsStore();
const packRoutingRuntimeStore = usePackRoutingRuntimeStore();
const dialogManager = useDialogManager();
const { t } = useI18n();
const pluginManager = new PluginManager();
for (const plugin of builtinPlugins) {
  pluginManager.register(plugin);
}
const contextMenuTarget = ref<HTMLElement | null>(null);
const $q = useQuasar();

// PC UA 检测函数 - 检测是否为 PC 环境
function detectPcUserAgent(): boolean {
  const ua = navigator.userAgent;

  // 检测 JEIBrowser（定制浏览器）
  if (ua.includes('JEIBrowser')) {
    return true;
  }

  // 检测常见的 PC UA 特征
  const pcPatterns = [
    'Windows', // Windows
    'Macintosh', // macOS
    'Linux x86_64', // Linux 桌面
    'Linux i686', // Linux 32位
    'CrOS', // Chrome OS
    'X11', // X Window System (Unix 桌面)
  ];

  for (const pattern of pcPatterns) {
    if (ua.includes(pattern)) {
      return true;
    }
  }

  return false;
}

// 是否禁用移动端 UI（检测到 PC UA 且设置开启）
const shouldDisableMobileUi = computed(() => {
  return settingsStore.detectPcDisableMobile && detectPcUserAgent();
});

// 移动端检测：屏幕尺寸 OR（非 PC 检测禁用 AND 屏幕小）
const isMobile = computed(() => {
  if (shouldDisableMobileUi.value) {
    return false; // PC UA 且开启检测，强制使用桌面端
  }
  return $q.screen.lt.md;
});

const isDark = computed(() => $q.dark.isActive);
const mobileTab = ref<'list' | 'fav' | 'panel'>('list');

const route = useRoute();
const router = useRouter();
const applyingRoute = ref(false);
const syncingUrl = ref(false);

const loading = ref(true);
const loadingProgress = ref<LoadProgress | null>(null);
const error = ref('');

const pack = ref<PackData | null>(null);
const index = ref<JeiIndex | null>(null);
const runtimePackDispose = ref<null | (() => void)>(null);
const packProxyTemplate = computed(() => pack.value?.manifest.imageProxy?.urlTemplate ?? '');
const packDevProxyTemplate = computed(() => pack.value?.manifest.imageProxy?.devUrlTemplate ?? '');

type PackOption = { label: string; value: string };

const packOptions = ref<PackOption[]>([
  { label: 'Arknights:Endfield', value: 'aef' },
  { label: 'demo', value: 'demo' },
]);

type StoredLocalPackIndex = {
  version: 1;
  currentId?: string;
  entries?: Array<{ id: string; name: string; packId: string; updatedAt: number }>;
};

async function loadLocalPackOptions(): Promise<PackOption[]> {
  const INDEX_KEY = 'jei.editor.localPacks.v1';
  const raw = storage.isUsingJEIStorage()
    ? await storage.getItem(INDEX_KEY)
    : localStorage.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as StoredLocalPackIndex;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.entries)) return [];
    return parsed.entries
      .filter((e) => e && typeof e.id === 'string' && typeof e.name === 'string')
      .map((e) => ({
        value: `local:${e.id}`,
        label: `${t('localPack')}${e.name}${e.packId ? ` (${e.packId})` : ''}`,
      }));
  } catch {
    return [];
  }
}

// 使用 settings store 的 selectedPack 作为当前选中的 pack
const activePackId = computed({
  get: () => settingsStore.selectedPack,
  set: (v) => settingsStore.setSelectedPack(v),
});

const currentPackLabel = computed(() => {
  const opt = packOptions.value.find((o) => o.value === activePackId.value);
  return opt ? opt.label : activePackId.value;
});

const selectedKeyHash = ref<string | null>(null);
const hoveredKeyHash = ref<string | null>(null);
const hoveredSource = ref<'list' | 'favorites' | 'recipe' | 'none'>('none');
const filterText = ref('');
const favorites = ref<Set<string>>(new Set());
type SavedPlan = {
  id: string;
  name: string;
  rootItemKey: ItemKey;
  rootKeyHash: string;
  targetAmount: number;
  useProductRecovery?: boolean;
  selectedRecipeIdByItemKeyHash: Record<string, string>;
  selectedItemIdByTagId: Record<string, string>;
  createdAt: number;
  kind?: 'advanced';
  targets?: AdvancedObjectiveEntry[];
};

const savedPlans = ref<SavedPlan[]>([]);
const plannerInitialState = ref<PlannerInitialState | null>(null);
function createDefaultPlannerLiveState(): PlannerLiveState {
  return {
    targetAmount: 1,
    useProductRecovery: false,
    selectedRecipeIdByItemKeyHash: {},
    selectedItemIdByTagId: {},
  };
}

const plannerLiveState = ref<PlannerLiveState>(createDefaultPlannerLiveState());
const plannerTab = ref<'tree' | 'graph' | 'line' | 'calc' | 'quant'>('tree');
const historyKeyHashes = ref<string[]>([]);

const filterDisabled = computed(() => loading.value || !!error.value);

const page = ref(1);
const measuredCellHeight = ref(84);
const gridGap = 8;
const gridColumns = 2;

const pageSize = ref(120);

const settingsOpen = ref(false);
const mirrorLatencyLoading = ref(false);
const dialogOpen = ref(false);
const contextMenuRef = ref();
const centerPanelRef = ref();
const contextMenuOpen = ref(false);
const contextMenuKeyHash = ref<string | null>(null);

const activePackMirrorMode = computed(
  () => settingsStore.packMirrorSelectionModeByPack[activePackId.value] ?? 'auto',
);

type MirrorRouteEntry = {
  sourcePackId: string;
  sourceLabel: string;
  url: string;
};

function buildMirrorRouteEntriesForPack(packId: string): MirrorRouteEntry[] {
  const aggregateSources = getAggregateSourcePackIds(packId);
  const sourcePackIds = aggregateSources.length > 0 ? aggregateSources : [packId];
  const out: MirrorRouteEntry[] = [];

  sourcePackIds.forEach((sourcePackId) => {
    if (sourcePackId.startsWith('local:')) return;
    const mode = settingsStore.packMirrorSelectionModeByPack[sourcePackId] ?? 'auto';
    const manual = settingsStore.packManualMirrorByPack[sourcePackId];
    const mirrors = packRoutingRuntimeStore.getMirrorsForPack(sourcePackId, mode, manual);
    const resolvedMirrors = mirrors.length > 0 ? mirrors : getPackBaseUrls(sourcePackId);
    const sourceLabel = packRoutingRuntimeStore.sourcesByPack[sourcePackId]?.label ?? sourcePackId;
    resolvedMirrors.forEach((url) => {
      out.push({
        sourcePackId,
        sourceLabel,
        url,
      });
    });
  });

  return out;
}

const activePackMirrorEntries = computed(() => buildMirrorRouteEntriesForPack(activePackId.value));
const activePackMirrors = computed(() => {
  return activePackMirrorEntries.value.map((entry) => entry.url);
});
const activePackMirrorUrl = computed(() => {
  const packId = activePackId.value;
  const runtime = packRoutingRuntimeStore.activeBaseUrlByPack[packId];
  if (runtime) return runtime.replace(/\/+$/, '');
  return (getActivePackBaseUrl(packId) ?? '').replace(/\/+$/, '');
});
const activePackManualMirror = computed(() => {
  const saved = settingsStore.packManualMirrorByPack[activePackId.value];
  if (saved) return saved;
  return activePackMirrors.value[0] ?? '';
});
const activePackMirrorRows = computed(() =>
  activePackMirrorEntries.value.map((entry) => ({
    sourcePackId: entry.sourcePackId,
    sourceLabel: entry.sourceLabel,
    url: entry.url,
    latencyMs: packRoutingRuntimeStore.getLatency(entry.sourcePackId, entry.url),
  })),
);

function onContextMenu(evt: Event, keyHash: string) {
  contextMenuKeyHash.value = keyHash;
  const target =
    (evt.target as HTMLElement).closest('.jei-grid__cell, .stack-view') ||
    (evt.target as HTMLElement);
  contextMenuTarget.value = target as HTMLElement;
  contextMenuRef.value?.show();
}

function onTouchHold(evt: unknown, keyHash: string) {
  const d = evt as {
    evt: Event;
    position: { top: number; left: number };
    touch: boolean;
    mouse: boolean;
  };
  if (d.mouse) return;
  contextMenuKeyHash.value = keyHash;
  const target =
    (d.evt.target as HTMLElement).closest('.jei-grid__cell, .stack-view') ||
    (d.evt.target as HTMLElement);
  contextMenuTarget.value = target as HTMLElement;
  contextMenuRef.value?.show();
}

function onContextMenuAction(
  action: 'recipes' | 'uses' | 'wiki' | 'icon' | 'planner' | 'fav' | 'advanced',
) {
  const keyHash = contextMenuKeyHash.value;
  if (!keyHash) return;

  if (action === 'fav') {
    toggleFavorite(keyHash);
    return;
  }

  if (action === 'advanced') {
    // 切换到高级计划器标签页
    centerTab.value = 'advanced';
    // 获取物品信息并添加到高级计划器
    const itemDef = itemDefsByKeyHash.value[keyHash];
    if (itemDef && centerPanelRef.value) {
      centerPanelRef.value.addToAdvancedPlanner(itemDef.key, itemDef.name);
    }
    return;
  }

  openDialogByKeyHash(keyHash, action);
}

const navStack = ref<ItemKey[]>([]);

watch(
  () => navStack.value.length,
  (len) => {
    if (isMobile.value && len > 0 && settingsStore.recipeViewMode === 'panel') {
      mobileTab.value = 'panel';
    }
  },
);

const centerTab = ref<string>('recipe');
const activeTab = ref<string>('recipes');
const lastRecipeTab = ref<'recipes' | 'uses'>('recipes');
const activeRecipesTypeKey = ref('');
const activeUsesTypeKey = ref('');
const activeTypeKey = computed({
  get: () =>
    lastRecipeTab.value === 'recipes' ? activeRecipesTypeKey.value : activeUsesTypeKey.value,
  set: (v: string) => {
    if (lastRecipeTab.value === 'recipes') activeRecipesTypeKey.value = v;
    else activeUsesTypeKey.value = v;
  },
});

const itemDefsByKeyHash = computed<Record<string, ItemDef>>(() => {
  const map = index.value?.itemsByKeyHash;
  if (!map) return {};
  return Object.fromEntries(map.entries());
});

const currentItemKey = computed<ItemKey | null>(
  () => navStack.value[navStack.value.length - 1] ?? null,
);

// Markdown 渲染器
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

const currentItemDef = computed<ItemDef | null>(() => {
  const key = currentItemKey.value;
  if (!key) return null;
  const h = itemKeyHash(key);
  return index.value?.itemsByKeyHash.get(h) ?? null;
});

const currentItemTitle = computed(() => {
  const def = currentItemDef.value;
  const key = currentItemKey.value;
  if (def) return `${def.name} (${def.key.id})`;
  if (!key) return '';
  return key.id;
});

const pluginContext = computed<PluginItemContext>(() => ({
  pack: pack.value,
  index: index.value,
  itemKey: currentItemKey.value,
  itemDef: currentItemDef.value,
  activeTab: activeTab.value,
  language: settingsStore.language,
  pluginSettingsById: settingsStore.pluginSettingsById,
}));

const pluginQueryActions = computed(() =>
  pluginManager.getActions(settingsStore.pluginEnabledById, pluginContext.value),
);

const pluginTabs = computed<PluginTabRuntime[]>(() =>
  pluginManager.getTabs(settingsStore.pluginEnabledById, pluginContext.value),
);

const centerPluginTabs = computed<
  Array<{
    tabKey: string;
    tabLabel: string;
    src: string;
    sandbox?: string;
    noApi?: boolean;
    keepAlive?: boolean;
  }>
>(() =>
  pluginManager
    .getCenterTabs(settingsStore.pluginEnabledById, pluginContext.value)
    .map((tab: PluginCenterTabRuntime) => {
      const sandbox = tab.iframe.sandbox;
      return {
        tabKey: tab.tabKey,
        tabLabel: tab.tabLabel,
        src: tab.iframe.src(pluginContext.value) ?? '',
        ...(typeof sandbox === 'string' ? { sandbox } : {}),
        ...(typeof tab.iframe.noApi === 'boolean' ? { noApi: tab.iframe.noApi } : {}),
        ...(typeof tab.iframe.keepAlive === 'boolean' ? { keepAlive: tab.iframe.keepAlive } : {}),
      };
    })
    .filter((tab) => !!tab.src),
);

const pluginEntries = computed(() =>
  pluginManager.list().map((plugin) => {
    const configured = settingsStore.pluginEnabledById[plugin.id];
    return {
      id: plugin.id,
      name: plugin.name,
      enabled: typeof configured === 'boolean' ? configured : plugin.enabledByDefault !== false,
    };
  }),
);

const pluginSettingSections = computed<
  Array<{
    pluginId: string;
    pluginName: string;
    settings: Array<PluginSettingDefinition & { value: PluginSettingValue }>;
  }>
>(() =>
  pluginManager.getSettingDefinitions().map((entry) => ({
    pluginId: entry.pluginId,
    pluginName: entry.pluginName,
    settings: entry.settings.map((setting) => {
      const raw = settingsStore.pluginSettingsById[entry.pluginId]?.[setting.key];
      const value =
        typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean'
          ? raw
          : setting.defaultValue;
      return { ...setting, value };
    }),
  })),
);

const keybindingSettingGroups = computed<
  Array<{
    id: string;
    label: string;
    actions: Array<{ id: KeyAction; label: string; description: string; binding: KeyBinding }>;
  }>
>(() => [
  {
    id: 'navigation',
    label: t('keybindingGroupNavigation'),
    actions: [
      {
        id: 'closeDialog',
        label: t('keybindingCloseDialog'),
        description: '',
        binding: keyBindingsStore.getBinding('closeDialog'),
      },
      {
        id: 'goBack',
        label: t('keybindingGoBack'),
        description: '',
        binding: keyBindingsStore.getBinding('goBack'),
      },
    ],
  },
  {
    id: 'view',
    label: t('keybindingGroupView'),
    actions: [
      {
        id: 'viewRecipes',
        label: t('keybindingViewRecipes'),
        description: '',
        binding: keyBindingsStore.getBinding('viewRecipes'),
      },
      {
        id: 'viewUses',
        label: t('keybindingViewUses'),
        description: '',
        binding: keyBindingsStore.getBinding('viewUses'),
      },
      {
        id: 'viewWiki',
        label: t('keybindingViewWiki'),
        description: '',
        binding: keyBindingsStore.getBinding('viewWiki'),
      },
      {
        id: 'viewIcon',
        label: t('keybindingViewIcon'),
        description: '',
        binding: keyBindingsStore.getBinding('viewIcon'),
      },
      {
        id: 'viewPlanner',
        label: t('keybindingViewPlanner'),
        description: '',
        binding: keyBindingsStore.getBinding('viewPlanner'),
      },
    ],
  },
  {
    id: 'planner',
    label: t('keybindingGroupPlanner'),
    actions: [
      {
        id: 'plannerTree',
        label: t('keybindingPlannerTree'),
        description: '',
        binding: keyBindingsStore.getBinding('plannerTree'),
      },
      {
        id: 'plannerGraph',
        label: t('keybindingPlannerGraph'),
        description: '',
        binding: keyBindingsStore.getBinding('plannerGraph'),
      },
      {
        id: 'plannerLine',
        label: t('keybindingPlannerLine'),
        description: '',
        binding: keyBindingsStore.getBinding('plannerLine'),
      },
      {
        id: 'plannerCalc',
        label: t('keybindingPlannerCalc'),
        description: '',
        binding: keyBindingsStore.getBinding('plannerCalc'),
      },
      {
        id: 'plannerQuant',
        label: t('keybindingPlannerQuant'),
        description: '',
        binding: keyBindingsStore.getBinding('plannerQuant'),
      },
    ],
  },
  {
    id: 'item',
    label: t('keybindingGroupItem'),
    actions: [
      {
        id: 'toggleFavorite',
        label: t('keybindingToggleFavorite'),
        description: '',
        binding: keyBindingsStore.getBinding('toggleFavorite'),
      },
      {
        id: 'addToAdvanced',
        label: t('keybindingAddToAdvanced'),
        description: '',
        binding: keyBindingsStore.getBinding('addToAdvanced'),
      },
    ],
  },
  {
    id: 'circuit',
    label: t('keybindingGroupCircuit'),
    actions: [
      {
        id: 'circuitRotate',
        label: t('keybindingCircuitRotate'),
        description: '',
        binding: keyBindingsStore.getBinding('circuitRotate'),
      },
      {
        id: 'circuitRun',
        label: t('keybindingCircuitRun'),
        description: '',
        binding: keyBindingsStore.getBinding('circuitRun'),
      },
      {
        id: 'circuitDeselect',
        label: t('keybindingCircuitDeselect'),
        description: '',
        binding: keyBindingsStore.getBinding('circuitDeselect'),
      },
      {
        id: 'circuitDelete',
        label: t('keybindingCircuitDelete'),
        description: '',
        binding: keyBindingsStore.getBinding('circuitDelete'),
      },
    ],
  },
]);

async function resolvePluginApi(
  pluginId: string,
  queryId: string,
  signal: AbortSignal,
): Promise<PluginApiResult | null> {
  const runtime = pluginManager.getApiQuery(
    settingsStore.pluginEnabledById,
    pluginContext.value,
    pluginId,
    queryId,
  );
  if (!runtime) return null;
  return runtime.run(signal);
}

function onPluginEnabledChange(pluginId: string, enabled: boolean) {
  settingsStore.setPluginEnabled(pluginId, enabled);
}

function onPluginSettingChange(pluginId: string, key: string, value: PluginSettingValue) {
  settingsStore.setPluginSetting(pluginId, key, value);
}

function onKeybindingChange(action: KeyAction, binding: KeyBinding) {
  keyBindingsStore.setBinding(action, binding);
}

function onResetKeybindings() {
  keyBindingsStore.resetToDefaults();
}

// 更新网页标题
watch(
  () => {
    const packId = pack.value?.manifest.packId;
    const packLabel = packOptions.value.find((p) => p.value === packId)?.label ?? packId ?? '';
    const title = currentItemTitle.value;
    return { title, packLabel };
  },
  ({ title, packLabel }) => {
    if (title) {
      document.title = `${title} ${packLabel} - JEI-WEB`;
    } else {
      document.title = 'JEI-WEB';
    }
  },
  { immediate: true },
);

// 渲染物品描述为 HTML
const renderedDescription = computed(() => {
  if (!currentItemDef.value?.description) return '';
  return md.render(currentItemDef.value.description);
});

function mergeInlineItems(items: ItemDef[], recipes: Recipe[]): ItemDef[] {
  const byHash = new Map<string, ItemDef>();
  items.forEach((it) => byHash.set(itemKeyHash(it.key), it));
  recipes.forEach((r) => {
    r.inlineItems?.forEach((it) => {
      const h = itemKeyHash(it.key);
      if (!byHash.has(h)) byHash.set(h, it);
    });
  });
  return Array.from(byHash.values());
}

const itemDetailLoadTasks = new Map<string, Promise<void>>();
const recipeDetailLoadTasks = new Map<string, Promise<void>>();

async function ensureItemDetailLoadedByKeyHash(keyHash: string): Promise<void> {
  const inflight = itemDetailLoadTasks.get(keyHash);
  if (inflight) return inflight;

  const task = (async () => {
    try {
      const p = pack.value;
      const idx = index.value;
      if (!p || !idx) return;

      const def = idx.itemsByKeyHash.get(keyHash);
      if (!def || def.detailLoaded || !def.detailPath) return;

      const selectedPackAtStart = activePackId.value;
      const packIdAtStart = p.manifest.packId;
      const detailPath = def.detailPath;
      const detail = await loadPackItemDetail(packIdAtStart, detailPath);

      const currentPack = pack.value;
      if (
        !currentPack ||
        currentPack.manifest.packId !== packIdAtStart ||
        activePackId.value !== selectedPackAtStart
      )
        return;

      const merged: ItemDef = {
        ...def,
        ...detail,
        detailPath,
        detailLoaded: true,
      };

      const nextItems = currentPack.items.map((it) =>
        itemKeyHash(it.key) === keyHash ? merged : it,
      );
      if (!nextItems.some((it) => itemKeyHash(it.key) === keyHash)) {
        nextItems.push(merged);
      }
      currentPack.items = nextItems;

      if (merged.wiki) {
        currentPack.wiki = {
          ...(currentPack.wiki ?? {}),
          [merged.key.id]: merged.wiki,
        };
      }

      if (Array.isArray(merged.recipes) && merged.recipes.length) {
        const existingRecipeIds = new Set(currentPack.recipes.map((r) => r.id));
        const append = merged.recipes
          .filter((r) => !existingRecipeIds.has(r.id))
          .map((r) => ({
            id: r.id,
            type: r.type,
            slotContents: r.slotContents,
            ...(r.params ? { params: r.params } : {}),
            ...(r.inlineItems ? { inlineItems: r.inlineItems } : {}),
          }));
        if (append.length) {
          currentPack.recipes = [...currentPack.recipes, ...append];
          currentPack.items = mergeInlineItems(currentPack.items, currentPack.recipes);
        }
      }

      index.value = buildJeiIndex(currentPack);
    } catch (e) {
      console.warn(`Failed to lazy-load item detail for ${keyHash}`, e);
    }
  })();

  itemDetailLoadTasks.set(keyHash, task);
  try {
    await task;
  } finally {
    itemDetailLoadTasks.delete(keyHash);
  }
}

async function ensureRecipeDetailLoadedById(recipeId: string): Promise<void> {
  if (!recipeId) return;
  const inflight = recipeDetailLoadTasks.get(recipeId);
  if (inflight) return inflight;

  const task = (async () => {
    try {
      const p = pack.value;
      const idx = index.value;
      if (!p || !idx) return;

      const recipe = idx.recipesById.get(recipeId);
      if (!recipe || recipe.detailLoaded || !recipe.detailPath) return;

      const selectedPackAtStart = activePackId.value;
      const packIdAtStart = p.manifest.packId;
      const detailPath = recipe.detailPath;
      const detail = await loadPackRecipeDetail(packIdAtStart, detailPath);

      const currentPack = pack.value;
      if (
        !currentPack ||
        currentPack.manifest.packId !== packIdAtStart ||
        activePackId.value !== selectedPackAtStart
      ) {
        return;
      }

      const currentRecipe = index.value?.recipesById.get(recipeId);
      if (!currentRecipe) return;
      Object.assign(currentRecipe, detail, {
        detailPath,
        detailLoaded: true,
      });
    } catch (e) {
      console.warn(`Failed to lazy-load recipe detail for ${recipeId}`, e);
    }
  })();

  recipeDetailLoadTasks.set(recipeId, task);
  try {
    await task;
  } finally {
    recipeDetailLoadTasks.delete(recipeId);
  }
}

watch(
  () => {
    const key = currentItemKey.value;
    return key ? itemKeyHash(key) : '';
  },
  (keyHash) => {
    if (!keyHash) return;
    void ensureItemDetailLoadedByKeyHash(keyHash);
  },
  { immediate: true },
);

type ParsedSearch = {
  text: string[];
  itemId: string[];
  gameId: string[];
  tag: string[];
};

const parsedSearch = computed<ParsedSearch>(() => parseSearch(filterText.value));

type NameSearchKeys = {
  nameLower: string;
  pinyinFull: string;
  pinyinFirst: string;
};

function normalizePinyinQuery(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function buildNameSearchKeys(name: string): NameSearchKeys {
  const nameLower = (name ?? '').toLowerCase();
  try {
    const pinyinFull = normalizePinyinQuery(
      pinyin(name ?? '', { toneType: 'none', nonZh: 'consecutive' }),
    );
    const pinyinFirst = normalizePinyinQuery(
      pinyin(name ?? '', { toneType: 'none', pattern: 'first', nonZh: 'consecutive' }),
    );
    return { nameLower, pinyinFull, pinyinFirst };
  } catch {
    return { nameLower, pinyinFull: '', pinyinFirst: '' };
  }
}

const nameSearchKeysByKeyHash = computed(() => {
  const map = index.value?.itemsByKeyHash;
  const out = new Map<string, NameSearchKeys>();
  if (!map) return out;
  for (const [keyHash, def] of map.entries()) {
    out.set(keyHash, buildNameSearchKeys(def.name ?? ''));
  }
  return out;
});

// 所有可用的标签 ID
const availableTags = computed(() => {
  const tags = new Set<string>();
  for (const tagIds of index.value?.tagIdsByItemId.values() ?? []) {
    for (const tag of tagIds) {
      tags.add(tag);
    }
  }
  return Array.from(tags).sort();
});

// 所有可用的物品 ID（去重）
const availableItemIds = computed(() => {
  const ids = new Set<string>();
  for (const def of index.value?.itemsByKeyHash.values() ?? []) {
    ids.add(def.key.id);
  }
  return Array.from(ids).sort();
});

// 所有可用的命名空间
const availableGameIds = computed(() => {
  const namespaces = new Set<string>();
  for (const id of availableItemIds.value) {
    const parts = id.includes(':') ? id.split(':') : id.split('.');
    const ns = parts[0];
    if (ns) namespaces.add(ns);
  }
  return Array.from(namespaces).sort();
});

const filteredItems = computed(() => {
  const map = index.value?.itemsByKeyHash;
  if (!map) return [];
  const entries = Array.from(map.entries()).map(([keyHash, def]) => ({ keyHash, def }));
  const search = parsedSearch.value;
  const keysByKeyHash = nameSearchKeysByKeyHash.value;

  const filtered = entries.filter((e) =>
    matchesSearch(e.def, search, keysByKeyHash.get(e.keyHash)),
  );
  filtered.sort((a, b) => {
    return a.def.name.localeCompare(b.def.name);
  });
  return filtered;
});

const pageCount = computed(() => {
  const total = filteredItems.value.length;
  const size = pageSize.value;
  if (!size) return 1;
  return Math.max(1, Math.ceil(total / size));
});

const validTabs = new Set(['recipes', 'uses', 'wiki', 'icon', 'planner'] as const);
type JeiTab = string;

function parseTab(v: unknown): JeiTab | null {
  if (typeof v !== 'string') return null;
  if (v.startsWith('plugin:')) return v;
  return validTabs.has(v as 'recipes' | 'uses' | 'wiki' | 'icon' | 'planner') ? v : null;
}

function routeKeyHash(): string | null {
  const p = route.params.keyHash;
  if (typeof p === 'string' && p) return p;
  const q = route.query.item;
  if (typeof q === 'string' && q) return q;
  return null;
}

function routeTab(): JeiTab | null {
  const p = route.params.tab;
  const t = parseTab(p);
  if (t) return t;
  return parseTab(route.query.tab);
}

function applyRouteState() {
  if (applyingRoute.value) return;
  const keyHash = routeKeyHash();
  const tab = routeTab();
  const packId = typeof route.query.pack === 'string' ? route.query.pack : null;

  applyingRoute.value = true;
  try {
    if (packId && packId !== activePackId.value) {
      activePackId.value = packId;
      return;
    }

    if (!keyHash) {
      closeDialog();
      activeTab.value = tab ?? activeTab.value;
      return;
    }

    const def = index.value?.itemsByKeyHash.get(keyHash);
    if (!def) return;

    selectedKeyHash.value = keyHash;

    // 检查当前物品是否已经在导航栈顶部，如果是则不重置导航栈
    const topKey = navStack.value[navStack.value.length - 1];
    const isTopMatches = topKey && itemKeyHash(topKey) === keyHash;

    if (!isTopMatches) {
      // 只有当导航栈为空或顶部物品不匹配时才重置
      // 检查导航栈中是否已有该物品，如果有则滚动到该位置
      const existingIndex = navStack.value.findIndex((k) => itemKeyHash(k) === keyHash);
      if (existingIndex >= 0) {
        // 物品已存在于导航栈中，滚动到该位置
        navStack.value = navStack.value.slice(0, existingIndex + 1);
      } else {
        // 物品不存在于导航栈中，重置为新导航栈
        navStack.value = [def.key];
      }
    }

    const finalTab = tab ?? 'recipes';
    activeTab.value = finalTab;
    if (finalTab === 'planner' && pack.value && index.value) {
      const auto = autoPlanSelections({
        pack: pack.value,
        index: index.value,
        rootItemKey: def.key,
        useProductRecovery: plannerLiveState.value.useProductRecovery === true,
      });
      plannerInitialState.value = {
        loadKey: `auto:${itemKeyHash(def.key)}:${Date.now()}`,
        targetAmount: 1,
        useProductRecovery: plannerLiveState.value.useProductRecovery === true,
        selectedRecipeIdByItemKeyHash: auto.selectedRecipeIdByItemKeyHash,
        selectedItemIdByTagId: auto.selectedItemIdByTagId,
      };
    } else {
      plannerInitialState.value = null;
    }
    dialogOpen.value = settingsStore.recipeViewMode === 'dialog';
  } finally {
    applyingRoute.value = false;
  }
}

async function syncUrl(mode: 'replace' | 'push') {
  if (applyingRoute.value || syncingUrl.value) return;
  syncingUrl.value = true;
  try {
    const packId = activePackId.value;
    const currentKey = currentItemKey.value;
    if (!currentKey) {
      if (loading.value) return;
      const routePack = typeof route.query.pack === 'string' ? route.query.pack : null;
      const routeHasItemState = Boolean(routeKeyHash() || routeTab());
      if (route.path === '/' && !routeHasItemState && routePack === (packId || null)) return;
      const next = { path: '/', query: packId ? { pack: packId } : {} };
      if (mode === 'push') await router.push(next);
      else await router.replace(next);
      return;
    }

    const keyHash = itemKeyHash(currentKey);
    const tab = activeTab.value;
    const next = {
      path: `/item/${encodeURIComponent(keyHash)}/${tab}`,
      query: packId ? { pack: packId } : {},
    };
    if (mode === 'push') await router.push(next);
    else await router.replace(next);
  } finally {
    syncingUrl.value = false;
  }
}

watch(
  () => [filterText.value, activePackId.value] as const,
  () => {
    page.value = 1;
  },
);

watch(
  () => pageCount.value,
  (max) => {
    if (page.value > max) page.value = max;
  },
);

watch(
  () => settingsStore.recipeViewMode,
  (mode) => {
    if (mode === 'panel') dialogOpen.value = false;
    if (mode === 'dialog' && navStack.value.length) dialogOpen.value = true;
  },
);

watch(
  () =>
    [
      route.params.keyHash,
      route.params.tab,
      route.query.item,
      route.query.tab,
      route.query.pack,
    ] as const,
  () => {
    void applyRouteState();
  },
  { immediate: true },
);

watch(
  () =>
    [
      activePackId.value,
      currentItemKey.value,
      activeTab.value,
      settingsStore.recipeViewMode,
    ] as const,
  () => {
    void syncUrl('replace');
  },
);

const pagedItems = computed(() => {
  const size = pageSize.value;
  const start = (page.value - 1) * size;
  return filteredItems.value.slice(start, start + size);
});

const firstPagedItem = computed(() => pagedItems.value[0] ?? null);
const restPagedItems = computed(() => pagedItems.value.slice(1));

const itemListPanelRef = ref<InstanceType<typeof ItemListPanel> | null>(null);
const listScrollEl = computed(() => itemListPanelRef.value?.listScrollEl ?? null);
const listGridEl = computed(() => itemListPanelRef.value?.listGridEl ?? null);
const sampleCellEl = computed(() => itemListPanelRef.value?.sampleCellEl ?? null);

const debugMetrics = ref({
  containerClientHeight: 0,
  containerPaddingTop: 0,
  containerPaddingBottom: 0,
  contentHeight: 0,
  available: 0,
  cell: 0,
  rows: 0,
  pageSize: 0,
  gridHeight: 0,
});

const debugText = computed(() => {
  const m = debugMetrics.value;
  return [
    `pageSize=${pageSize.value}`,
    `rows=${m.rows}`,
    `cell=${m.cell}`,
    `available=${m.available}`,
    `contentHeight=${m.contentHeight}`,
    `gridHeight=${m.gridHeight}`,
    `clientHeight=${m.containerClientHeight}`,
    `padding=${m.containerPaddingTop}+${m.containerPaddingBottom}`,
  ].join('\n');
});

function debugLog(event: string, data?: Record<string, unknown>) {
  if (!settingsStore.debugLayout) return;
  const ts = new Date().toISOString().slice(11, 23);
  if (data) console.log(`[jei][layout ${ts}] ${event}`, data);
  else console.log(`[jei][layout ${ts}] ${event}`);
}

function getContentBoxHeight(el: HTMLElement) {
  const cs = getComputedStyle(el);
  const pt = Number.parseFloat(cs.paddingTop || '0') || 0;
  const pb = Number.parseFloat(cs.paddingBottom || '0') || 0;
  debugMetrics.value.containerClientHeight = el.clientHeight;
  debugMetrics.value.containerPaddingTop = pt;
  debugMetrics.value.containerPaddingBottom = pb;
  return Math.max(0, el.clientHeight - pt - pb);
}

let validateSeq = 0;
function scheduleValidate() {
  const seq = (validateSeq += 1);
  void nextTick(() => {
    requestAnimationFrame(() => {
      if (seq !== validateSeq) return;
      const container = listScrollEl.value;
      const grid = listGridEl.value;
      if (!container || !grid) return;
      const contentHeight = getContentBoxHeight(container);
      const gridHeight = Math.ceil(grid.getBoundingClientRect().height);
      debugMetrics.value.gridHeight = gridHeight;
      if (gridHeight > contentHeight + 1) {
        const nextSize = Math.max(gridColumns, pageSize.value - gridColumns);
        if (nextSize !== pageSize.value) {
          debugLog('validate: overflow -> shrink', {
            contentHeight,
            gridHeight,
            pageSize: pageSize.value,
            nextSize,
          });
          pageSize.value = nextSize;
          scheduleValidate();
        }
      } else {
        debugLog('validate: ok', { contentHeight, gridHeight, pageSize: pageSize.value });
      }
    });
  });
}

function recomputePageSize(explicitHeight?: number) {
  const container = listScrollEl.value;
  if (!container && typeof explicitHeight !== 'number') return;

  const sample = sampleCellEl.value;
  if (sample) {
    const h = sample.offsetHeight;
    if (h > 0) measuredCellHeight.value = h;
  }

  const contentHeight =
    typeof explicitHeight === 'number'
      ? explicitHeight
      : container
        ? getContentBoxHeight(container)
        : 0;
  const available = Math.max(0, Math.floor(contentHeight) - 4);
  const cell = Math.max(1, measuredCellHeight.value);
  debugLog('recompute: input', {
    explicitHeight,
    contentHeight,
    available,
    cell,
    gridColumns,
    gridGap,
  });

  // 计算能放下的行数，考虑 grid-gap
  // rows * cell + (rows - 1) * gap <= available
  // rows * (cell + gap) - gap <= available
  // rows * (cell + gap) <= available + gap
  let rows = Math.floor((available + gridGap) / (cell + gridGap));

  if (rows < 1) rows = 1;

  // 双重检查，确保计算出的行数绝对不会溢出
  let used = rows * (cell + gridGap) - gridGap;
  while (rows > 1 && used > available) {
    rows -= 1;
    used = rows * (cell + gridGap) - gridGap;
  }

  const size = Math.max(gridColumns, rows * gridColumns);

  debugMetrics.value.contentHeight = Math.floor(contentHeight);
  debugMetrics.value.available = available;
  debugMetrics.value.cell = cell;
  debugMetrics.value.rows = rows;
  debugMetrics.value.pageSize = size;

  if (pageSize.value !== size) pageSize.value = size;
  debugLog('recompute: result', { rows, size, pageSize: pageSize.value, used });
  scheduleValidate();
}

const favoriteItems = computed(() => {
  const map = index.value?.itemsByKeyHash;
  if (!map) return [];
  const entries = Array.from(favorites.value.values())
    .map((keyHash) => {
      const def = map.get(keyHash);
      if (!def) return null;
      return { keyHash, def };
    })
    .filter((v): v is { keyHash: string; def: ItemDef } => v !== null);
  entries.sort((a, b) => a.def.name.localeCompare(b.def.name));
  return entries;
});

const historyItems = computed(() => {
  const map = index.value?.itemsByKeyHash;
  if (!map) return [];
  // 按照 settings.historyLimit 截取
  const limit = settingsStore.historyLimit;
  const sliced = historyKeyHashes.value.slice(0, limit);

  return sliced
    .map((keyHash) => {
      const def = map.get(keyHash);
      if (!def) return null;
      return { keyHash, def };
    })
    .filter((v): v is { keyHash: string; def: ItemDef } => v !== null);
});

// 生成带占位的历史记录列表，长度固定为 historyLimit
const paddedHistoryItems = computed(() => {
  const limit = settingsStore.historyLimit;
  const real = historyItems.value;
  const list: ({ keyHash: string; def: ItemDef } | null)[] = [...real];
  // 补齐 null
  while (list.length < limit) {
    list.push(null);
  }
  return list;
});

onMounted(async () => {
  try {
    loading.value = true;
    // 必须先加载索引（注册数据源），再加载当前包，否则可能会导致使用了错误的源（如本地源代替了远程源）
    await loadPacksIndex();
    await reloadPack(activePackId.value);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }

  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('resize', onWindowResize);
});

const resizeObserver = ref<ResizeObserver | null>(null);

// 监听 listScrollEl 的出现，初始化 ResizeObserver
// 这比在 onMounted 里写死更可靠，因为 listScrollEl 受 v-if (loading) 控制
watch(
  listScrollEl,
  (el) => {
    // 先清理旧的
    if (resizeObserver.value) {
      resizeObserver.value.disconnect();
      resizeObserver.value = null;
    }

    if (!el) return;
    debugLog('listScrollEl: mounted', {
      clientHeight: el.clientHeight,
      rectHeight: Math.ceil(el.getBoundingClientRect().height),
    });

    // 初始化新的 ResizeObserver
    const ro = new ResizeObserver((entries) => {
      // 使用 requestAnimationFrame 确保在下一帧（布局稳定后）再计算
      requestAnimationFrame(() => {
        for (const entry of entries) {
          if (entry.target === el) {
            debugLog('resizeObserver', { contentRectHeight: entry.contentRect.height });
            recomputePageSize(entry.contentRect.height);
          }
        }
      });
    });

    ro.observe(el);
    resizeObserver.value = ro;

    // 立即计算一次，但也延后一帧
    requestAnimationFrame(() => {
      pageSize.value = 0;
      recomputePageSize();
    });
  },
  { immediate: true, flush: 'post' }, // flush: 'post' 确保在 DOM 更新后触发
);

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown, true);
  window.removeEventListener('resize', onWindowResize);
  resizeObserver.value?.disconnect();
  runtimePackDispose.value?.();
  runtimePackDispose.value = null;
});

const wheelState = ref({ lastAt: 0, acc: 0 });

function wrapPage(next: number) {
  const max = pageCount.value;
  if (max <= 1) return 1;
  if (next < 1) return max;
  if (next > max) return 1;
  return next;
}

function onListWheel(e: WheelEvent) {
  if (loading.value || error.value) return;
  if (e.ctrlKey) return;
  const now = performance.now();
  const state = wheelState.value;
  if (now - state.lastAt > 180) state.acc = 0;
  state.lastAt = now;
  state.acc += e.deltaY;

  const threshold = 60;
  if (Math.abs(state.acc) < threshold) return;

  const dir = state.acc > 0 ? 1 : -1;
  state.acc = 0;
  page.value = wrapPage(page.value + dir);
  e.preventDefault();
}

function onWindowResize() {
  debugLog('window: resize');
  void recomputePageSize();
}

watch(activePackId, async (next) => {
  debugLog('pack: change', { next });
  // store 的 setter 会自动保存到 localStorage
  await reloadPack(next);
  void recomputePageSize(); // 切 pack 后重新计算一次
});
watch(
  () => [settingsOpen.value, activePackId.value] as const,
  async ([open]) => {
    if (!open) return;
    await refreshActivePackMirrorLatency();
  },
);
watch(
  () =>
    [
      settingsStore.packImageProxyUsePackProvided,
      settingsStore.packImageProxyUseManual,
      settingsStore.packImageProxyUseDev,
      settingsStore.packImageProxyManualUrl,
      settingsStore.packImageProxyDevUrl,
      settingsStore.packImageProxyAccessToken,
      settingsStore.packImageProxyAnonymousToken,
      settingsStore.packImageProxyFrameworkToken,
    ] as const,
  async () => {
    if (!pack.value) return;
    await ensurePackImageProxyTokens(pack.value.manifest);
    applyImageProxyToPack(pack.value);
  },
);

async function reloadPack(packId: string) {
  error.value = '';
  loading.value = true;
  loadingProgress.value = null;
  try {
    applyMirrorPreference(packId);
    itemDetailLoadTasks.clear();
    recipeDetailLoadTasks.clear();
    applyingRoute.value = true;
    closeDialog();
    applyingRoute.value = false;
    historyKeyHashes.value = [];
    runtimePackDispose.value?.();
    runtimePackDispose.value = null;
    const loaded = await loadRuntimePack(packId, (p) => {
      loadingProgress.value = p;
    });
    runtimePackDispose.value = loaded.dispose;
    pack.value = loaded.pack;
    packRoutingRuntimeStore.setActiveBaseUrl(packId, getActivePackBaseUrl(packId));

    const startupDialog = loaded.pack.manifest.startupDialog;
    if (startupDialog && !settingsStore.acceptedStartupDialogs.includes(startupDialog.id)) {
      // 注册包弹窗到弹窗管理器
      const packDialogId = `pack-${loaded.pack.manifest.packId}-startup`;

      dialogManager.registerDialog({
        id: packDialogId,
        priority: 'high',
        title: startupDialog.title || '包欢迎弹窗',
        canShow: () => {
          // 只有在未被接受时才显示
          return !settingsStore.acceptedStartupDialogs.includes(startupDialog.id);
        },
        onShow: () => {
          const dialogOptions = {
            message: startupDialog.message,
            persistent: true,
            ok: {
              label: startupDialog.confirmText || 'OK',
              color: 'primary',
            },
          } as {
            message: string;
            persistent: true;
            ok: { label: string; color: string };
            title?: string;
          };
          if (startupDialog.title) dialogOptions.title = startupDialog.title;

          $q.dialog(dialogOptions).onOk(() => {
            settingsStore.addAcceptedStartupDialog(startupDialog.id);
            // 通知弹窗管理器当前弹窗已完成
            dialogManager.completeDialog();
          });
        },
      });
    }

    // 通知MainLayout包弹窗已加载（无论是否有包弹窗）
    // 稍微延迟确保弹窗注册完成
    setTimeout(() => {
      const globalWindow = window as unknown as { jeiPackDialogLoaded?: () => void };
      globalWindow.jeiPackDialogLoaded?.();
    }, 100);

    index.value = buildJeiIndex(loaded.pack);
    favorites.value = await loadFavorites(loaded.pack.manifest.packId);
    savedPlans.value = await loadPlans(loaded.pack.manifest.packId);
    plannerLiveState.value = await loadPlannerLiveState(loaded.pack.manifest.packId);
    plannerInitialState.value = null;
    selectedKeyHash.value = filteredItems.value[0]?.keyHash ?? null;

    // 等待 DOM 渲染（v-else 切换显示列表）
    loading.value = false;
    await nextTick();
    recomputePageSize();
    applyRouteState();
  } catch (e) {
    packRoutingRuntimeStore.setActiveBaseUrl(packId, null);
    error.value = e instanceof Error ? e.message : String(e);
    loading.value = false;
  }
}

async function loadPacksIndex() {
  const local = await loadLocalPackOptions();
  const reservedIds = new Set(packOptions.value.map((o) => o.value));
  const knownSources = packRoutingRuntimeStore.sourcesByPack;

  const custom = settingsStore.customPackSources.map((s) => ({
    label: s.label || s.packId,
    value: s.packId,
  }));

  try {
    const res = await fetch('/packs/index.json');
    if (!res.ok) {
      // 失败时，注册自定义源并返回
      const nextSources = registerCustomSources(reservedIds, knownSources);
      packRoutingRuntimeStore.setSources(nextSources);
      applyAllMirrorPreferences();
      packOptions.value = [...custom, ...packOptions.value, ...local];
      return;
    }
    const data = (await res.json()) as {
      packs?: Array<{
        packId: string;
        label: string;
        mirrors?: string[];
        aggregateDescriptor?: string;
      }>;
    };
    if (Array.isArray(data.packs)) {
      const remoteIds = new Set(data.packs.map((p) => p.packId));
      const effectiveCustom = settingsStore.customPackSources
        .filter((s) => !remoteIds.has(s.packId))
        .map((s) => ({
          label: s.label || s.packId,
          value: s.packId,
        }));
      const remoteSources: Record<string, PackSourceSnapshot> = {};
      const remote = data.packs.map((p) => {
        const mirrors = normalizeMirrorUrls(p.mirrors ?? []);
        const aggregateDescriptor =
          typeof p.aggregateDescriptor === 'string' && p.aggregateDescriptor.trim().length > 0
            ? p.aggregateDescriptor.trim()
            : undefined;
        const effectiveMirrors =
          mirrors.length > 0
            ? mirrors
            : aggregateDescriptor
              ? []
              : [`/packs/${encodeURIComponent(p.packId)}`];
        remoteSources[p.packId] = {
          label: p.label,
          mirrors: effectiveMirrors,
        };
        registerPackSource({
          packId: p.packId,
          label: p.label,
          mirrors: effectiveMirrors,
          ...(aggregateDescriptor ? { aggregateDescriptor } : {}),
        });
        return { label: p.label, value: p.packId };
      });

      // 2. 注册自定义源（仅新增扩展包，不覆盖官方包）
      const nextSources = registerCustomSources(remoteIds, remoteSources);
      packRoutingRuntimeStore.setSources(nextSources);
      applyAllMirrorPreferences();

      packOptions.value = [...remote, ...effectiveCustom, ...local];

      // 如果 store 中的 packId 不在新列表中，切换到第一个
      if (!packOptions.value.some((o) => o.value === settingsStore.selectedPack)) {
        settingsStore.setSelectedPack(packOptions.value[0]?.value ?? '');
      }
      return;
    }
    const nextSources = registerCustomSources(reservedIds, knownSources);
    packRoutingRuntimeStore.setSources(nextSources);
  } catch {
    const nextSources = registerCustomSources(reservedIds, knownSources);
    packRoutingRuntimeStore.setSources(nextSources);
    applyAllMirrorPreferences();
    packOptions.value = [...custom, ...packOptions.value, ...local];
  }
}

function normalizeMirrorUrls(raw: string[]): string[] {
  return Array.from(
    new Set(raw.map((m) => m.replace(/\/+$/, '').trim()).filter((m) => m.length > 0)),
  );
}

function registerCustomSources(
  remotePackIds: Set<string>,
  baseSources: Record<string, PackSourceSnapshot>,
): Record<string, PackSourceSnapshot> {
  const nextSources = { ...baseSources };
  settingsStore.customPackSources.forEach((s) => {
    if (remotePackIds.has(s.packId)) return;
    const mirrors = normalizeMirrorUrls(s.mirrors ?? []);
    if (!mirrors.length) return;
    nextSources[s.packId] = {
      label: s.label || s.packId,
      mirrors,
    };
    registerPackSource({
      packId: s.packId,
      label: s.label || s.packId,
      mirrors: mirrors,
    });
  });
  return nextSources;
}

function onAddCustomSource(source: { packId: string; url: string; label?: string }) {
  settingsStore.addCustomPackSource({
    packId: source.packId,
    label: source.label || source.packId,
    mirrors: [source.url],
  });
  void loadPacksIndex();
}

function onRemoveCustomSource(packId: string) {
  settingsStore.removeCustomPackSource(packId);
  void loadPacksIndex();
}

function applyMirrorPreference(packId: string) {
  const mode = settingsStore.packMirrorSelectionModeByPack[packId] ?? 'auto';
  const manual = settingsStore.packManualMirrorByPack[packId];
  setPackMirrorPreference(packId, mode, manual);
}

function applyAllMirrorPreferences() {
  Object.keys(settingsStore.packMirrorSelectionModeByPack).forEach((packId) => {
    applyMirrorPreference(packId);
  });
}

async function measureMirrorLatency(url: string): Promise<number | null> {
  try {
    const endpoint = `${url.replace(/\/+$/, '')}/manifest.json?__ping=${Date.now()}`;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 6000);
    const t0 = performance.now();
    const res = await fetch(endpoint, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    window.clearTimeout(timeout);
    if (!res.ok) return null;
    return performance.now() - t0;
  } catch {
    return null;
  }
}

async function refreshActivePackMirrorLatency() {
  const mirrorRows = activePackMirrorRows.value;
  if (!mirrorRows.length) return;
  mirrorLatencyLoading.value = true;
  try {
    await Promise.allSettled(
      mirrorRows.map(async (row) => {
        const latency = await measureMirrorLatency(row.url);
        // Incremental update: each mirror writes back immediately when finished.
        packRoutingRuntimeStore.setLatency(row.sourcePackId, row.url, latency);
        setPackMirrorLatencyHint(row.sourcePackId, row.url, latency);
      }),
    );
  } finally {
    mirrorLatencyLoading.value = false;
  }
}

async function onUpdatePackMirrorSelectionMode(mode: 'auto' | 'manual') {
  settingsStore.setPackMirrorSelectionMode(activePackId.value, mode);
  if (mode === 'manual' && !settingsStore.packManualMirrorByPack[activePackId.value]) {
    const first = activePackMirrors.value[0];
    if (first) settingsStore.setPackManualMirror(activePackId.value, first);
  }
  applyMirrorPreference(activePackId.value);
  clearPackRuntimeCache(activePackId.value);
  await reloadPack(activePackId.value);
}

async function onUpdatePackManualMirror(url: string) {
  settingsStore.setPackManualMirror(activePackId.value, url);
  applyMirrorPreference(activePackId.value);
  if (activePackMirrorMode.value === 'manual') {
    clearPackRuntimeCache(activePackId.value);
    await reloadPack(activePackId.value);
  }
}

async function onRefreshPackCache() {
  try {
    clearPackRuntimeCache(activePackId.value);
    await reloadPack(activePackId.value);
    $q.notify({
      type: 'positive',
      message: t('packCacheRefreshed'),
    });
  } catch (e) {
    $q.notify({
      type: 'negative',
      message: t('packCacheRefreshFailed'),
      caption: e instanceof Error ? e.message : String(e),
    });
  }
}

const recipesById = computed(() => index.value?.recipesById ?? new Map());
const recipeTypesByKey = computed(() => index.value?.recipeTypesByKey ?? new Map());

const producingRecipeIds = computed(() => {
  if (!index.value || !currentItemKey.value) return [];
  return recipesProducingItem(index.value, currentItemKey.value);
});

const consumingRecipeIds = computed(() => {
  if (!index.value || !currentItemKey.value) return [];
  return recipesConsumingItem(index.value, currentItemKey.value);
});

// 机器提供的配方类型（用于"提供合成"分组）
const machineProvidingRecipeIds = computed(() => {
  if (!index.value || !currentItemKey.value) return [];
  // 获取当前物品的所有 itemId 可能的变体（考虑 meta/nbt）
  const currentItemIds = index.value.itemKeyHashesByItemId.get(currentItemKey.value.id) ?? [];
  if (!currentItemIds.length) return [];

  // 查找所有使用当前物品作为机器的配方类型
  const providedTypeKeys: string[] = [];
  for (const [typeKey, recipeType] of recipeTypesByKey.value) {
    if (recipeType.machine?.id === currentItemKey.value.id) {
      providedTypeKeys.push(typeKey);
    }
  }

  if (!providedTypeKeys.length) return [];

  // 收集这些配方类型的所有配方 ID
  const recipeIds = new Set<string>();
  for (const rid of index.value.recipesById.keys()) {
    const r = index.value.recipesById.get(rid);
    if (r && providedTypeKeys.includes(r.type)) {
      recipeIds.add(rid);
    }
  }
  return Array.from(recipeIds);
});

watch(
  activeTab,
  (t) => {
    if (t === 'recipes' || t === 'uses') lastRecipeTab.value = t;
  },
  { immediate: true },
);

watch(
  () => [activeTab.value, currentItemKey.value, pack.value, index.value] as const,
  () => {
    if (activeTab.value !== 'planner') return;
    if (plannerInitialState.value) return;
    const p = pack.value;
    const idx = index.value;
    const key = currentItemKey.value;
    if (!p || !idx || !key) return;
    const auto = autoPlanSelections({
      pack: p,
      index: idx,
      rootItemKey: key,
      useProductRecovery: plannerLiveState.value.useProductRecovery === true,
    });
    plannerInitialState.value = {
      loadKey: `auto:${itemKeyHash(key)}:${Date.now()}`,
      targetAmount: 1,
      useProductRecovery: plannerLiveState.value.useProductRecovery === true,
      selectedRecipeIdByItemKeyHash: auto.selectedRecipeIdByItemKeyHash,
      selectedItemIdByTagId: auto.selectedItemIdByTagId,
    };
  },
  { immediate: true },
);

const activeRecipeIds = computed(() => {
  return lastRecipeTab.value === 'recipes' ? producingRecipeIds.value : consumingRecipeIds.value;
});

type RecipeGroup = { typeKey: string; label: string; recipeIds: string[]; isAll?: boolean };

const activeRecipeGroups = computed<RecipeGroup[]>(() => {
  const map = new Map<string, string[]>();
  activeRecipeIds.value.forEach((rid) => {
    const r = recipesById.value.get(rid);
    if (!r) return;
    const list = map.get(r.type) ?? [];
    list.push(rid);
    map.set(r.type, list);
  });

  const groups = Array.from(map.entries()).map(([typeKey, recipeIds]) => {
    const label = recipeTypesByKey.value.get(typeKey)?.displayName ?? typeKey;
    return { typeKey, label, recipeIds };
  });
  groups.sort((a, b) => a.label.localeCompare(b.label));

  // 在 Uses 标签页下，添加"提供合成"分组
  if (lastRecipeTab.value === 'uses' && machineProvidingRecipeIds.value.length) {
    // 按配方类型分组
    const providingMap = new Map<string, string[]>();
    machineProvidingRecipeIds.value.forEach((rid) => {
      const r = recipesById.value.get(rid);
      if (!r) return;
      const list = providingMap.get(r.type) ?? [];
      list.push(rid);
      providingMap.set(r.type, list);
    });

    // 使用原始配方类型作为 typeKey，这样配方显示时能正确获取类型
    const providingGroups = Array.from(providingMap.entries()).map(([typeKey, recipeIds]) => {
      const typeDef = recipeTypesByKey.value.get(typeKey);
      const label = `${t('providingRecipes')}${typeDef?.displayName ?? typeKey}`;
      return { typeKey, label, recipeIds };
    });
    providingGroups.sort((a, b) => a.label.localeCompare(b.label));

    // 添加"全部"分组（包含消耗配方和机器提供的配方），然后"提供合成"分组，最后普通分组
    const allRecipeIds = [...activeRecipeIds.value, ...machineProvidingRecipeIds.value];
    const allGroup: RecipeGroup = {
      typeKey: '__all__',
      label: t('allRecipes'),
      recipeIds: allRecipeIds,
      isAll: true,
    };
    return [allGroup, ...providingGroups, ...groups];
  }

  // 添加"全部"分组到最前面
  const allGroup: RecipeGroup = {
    typeKey: '__all__',
    label: t('allRecipes'),
    recipeIds: activeRecipeIds.value,
    isAll: true,
  };

  return [allGroup, ...groups];
});

const preferredRecipeTypeKey = computed(() => {
  if (!index.value || !currentItemKey.value) return null;
  const rootHash = itemKeyHash(currentItemKey.value);
  const rid = plannerLiveState.value.selectedRecipeIdByItemKeyHash[rootHash];
  if (!rid) return null;
  const r = index.value.recipesById.get(rid);
  return r?.type ?? null;
});

const typeMachineIcons = computed(() => {
  const currentGroup = activeRecipeGroups.value.find((g) => g.typeKey === activeTypeKey.value);
  if (!currentGroup) return [];

  // "全部"分组：显示所有有机器的配方类型
  if (currentGroup.isAll) {
    const icons: { typeKey: string; machineItemId: string }[] = [];
    const seen = new Set<string>();

    for (const group of activeRecipeGroups.value) {
      if (group.isAll) continue;
      const rt = recipeTypesByKey.value.get(group.typeKey);
      const machineItemId = rt?.machine?.id;
      if (!machineItemId || seen.has(machineItemId)) continue;
      seen.add(machineItemId);
      icons.push({ typeKey: group.typeKey, machineItemId });
    }
    return icons;
  }

  // 普通分组：只显示当前分组对应的机器
  const rt = recipeTypesByKey.value.get(currentGroup.typeKey);
  const machineItemId = rt?.machine?.id;
  if (!machineItemId) return [];

  return [{ typeKey: currentGroup.typeKey, machineItemId }];
});

type AllRecipeSubGroup = {
  typeKey: string;
  label: string;
  recipeIds: string[];
  machines: { typeKey: string; machineItemId: string }[];
};

// 用于"全部"分组的子分组（按配方类型分组，包含机器信息）
const allRecipeGroups = computed<AllRecipeSubGroup[]>(() => {
  const map = new Map<string, string[]>();

  // 在 Uses 模式下，需要同时包含消耗配方和机器提供的配方
  const recipeIdsToInclude =
    lastRecipeTab.value === 'uses' && machineProvidingRecipeIds.value.length
      ? [...activeRecipeIds.value, ...machineProvidingRecipeIds.value]
      : activeRecipeIds.value;

  recipeIdsToInclude.forEach((rid) => {
    const r = recipesById.value.get(rid);
    if (!r) return;
    const list = map.get(r.type) ?? [];
    list.push(rid);
    map.set(r.type, list);
  });

  return Array.from(map.entries()).map(([typeKey, recipeIds]) => {
    const label = recipeTypesByKey.value.get(typeKey)?.displayName ?? typeKey;
    const rt = recipeTypesByKey.value.get(typeKey);
    const machineItemId = rt?.machine?.id;
    const machines = machineItemId ? [{ typeKey, machineItemId }] : [];
    return { typeKey, label, recipeIds, machines };
  });
});

watch(
  () => [activeTab.value, currentItemKey.value, activeRecipeGroups.value] as const,
  () => {
    if (!activeRecipeGroups.value.length) {
      activeTypeKey.value = '';
      return;
    }
    if (
      !activeTypeKey.value ||
      !activeRecipeGroups.value.some((g) => g.typeKey === activeTypeKey.value)
    ) {
      const preferred = preferredRecipeTypeKey.value;
      if (preferred && activeRecipeGroups.value.some((g) => g.typeKey === preferred)) {
        activeTypeKey.value = preferred;
        return;
      }
      const first = activeRecipeGroups.value[0];
      if (first) activeTypeKey.value = first.typeKey;
    }
  },
  { immediate: true },
);

function buildAutoPlannerInitialState(rootItemKey: ItemKey): PlannerInitialState | null {
  const p = pack.value;
  const idx = index.value;
  if (!p || !idx) return null;
  const useProductRecovery = plannerLiveState.value.useProductRecovery === true;
  const auto = autoPlanSelections({ pack: p, index: idx, rootItemKey, useProductRecovery });
  return {
    loadKey: `auto:${itemKeyHash(rootItemKey)}:${Date.now()}`,
    targetAmount: 1,
    useProductRecovery,
    selectedRecipeIdByItemKeyHash: auto.selectedRecipeIdByItemKeyHash,
    selectedItemIdByTagId: auto.selectedItemIdByTagId,
  };
}

function ensurePlannerAutoForCurrentItem() {
  if (plannerInitialState.value) return;
  const key = currentItemKey.value;
  if (!key) return;
  plannerInitialState.value = buildAutoPlannerInitialState(key);
}

function openDialogByKeyHash(
  keyHash: string,
  tab: 'recipes' | 'uses' | 'wiki' | 'icon' | 'planner' = 'recipes',
) {
  const def = index.value?.itemsByKeyHash.get(keyHash);
  if (!def) return;

  // 如果当前不在资料查看器，切换到资料查看器
  if (centerTab.value !== 'recipe') {
    centerTab.value = 'recipe';
  }

  selectedKeyHash.value = keyHash;
  navStack.value = [def.key];
  activeTab.value = tab;
  plannerInitialState.value = tab === 'planner' ? buildAutoPlannerInitialState(def.key) : null;
  if (tab !== 'planner') plannerTab.value = 'tree';
  dialogOpen.value = settingsStore.recipeViewMode === 'dialog';
  pushHistoryKeyHash(keyHash);
  void syncUrl('push');
}

function openDialogByItemKey(
  key: ItemKey,
  tab: 'recipes' | 'uses' | 'wiki' | 'icon' | 'planner' = 'recipes',
) {
  // 如果当前不在资料查看器，切换到资料查看器
  if (centerTab.value !== 'recipe') {
    centerTab.value = 'recipe';
  }

  // 防止重复压栈
  const last = navStack.value[navStack.value.length - 1];
  if (last && itemKeyHash(last) === itemKeyHash(key)) {
    activeTab.value = tab;
    if (tab === 'planner' && !plannerInitialState.value) {
      plannerInitialState.value = buildAutoPlannerInitialState(key);
    }
    return;
  }

  navStack.value = [...navStack.value, key];
  activeTab.value = tab;
  plannerInitialState.value = tab === 'planner' ? buildAutoPlannerInitialState(key) : null;
  if (tab !== 'planner') plannerTab.value = 'tree';
  pushHistoryKeyHash(itemKeyHash(key));
  void syncUrl('push');
}

function openStackDialog(
  keyHash: string,
  tab: 'recipes' | 'uses' | 'wiki' | 'icon' | 'planner' = 'recipes',
) {
  const def = index.value?.itemsByKeyHash.get(keyHash);
  if (!def) return;
  if (dialogOpen.value || settingsStore.recipeViewMode === 'panel') {
    openDialogByItemKey(def.key, tab);
  } else {
    openDialogByKeyHash(keyHash, tab);
  }
}

function openDialogFromFavorites(keyHash: string) {
  if (settingsStore.favoritesOpensNewStack) {
    openStackDialog(keyHash, 'recipes');
  } else {
    openDialogByKeyHash(keyHash, 'recipes');
  }
}

function openMachineItem(machineItemId: string) {
  // 根据 itemId 找到对应的 ItemKeyHash
  const keyHashes = index.value?.itemKeyHashesByItemId.get(machineItemId);
  if (!keyHashes || !keyHashes.length) return;
  // 使用第一个 keyHash 打开机器物品的对话框
  const firstKeyHash = keyHashes[0];
  if (firstKeyHash) openDialogByKeyHash(firstKeyHash);
}

const handlePluginHostApi: HostApiHandler = async (pluginId, api, args) => {
  await Promise.resolve(); // make it async
  if (api === 'navigateToItem') {
    const itemId = args.itemId as string;
    const newStack = args.newStack as boolean;
    if (!itemId) return false;

    const keyHashes = index.value?.itemKeyHashesByItemId.get(itemId);
    if (keyHashes && keyHashes.length > 0) {
      const keyHash = keyHashes[0] as string;
      const def = index.value?.itemsByKeyHash.get(keyHash);
      if (def) {
        if (newStack) {
          openDialogByKeyHash(keyHash);
        } else {
          openDialogByItemKey(def.key);
        }
        return true;
      }
    }
    return false;
  }
  if (api === 'toggleBookmark') {
    const itemId = args.itemId as string;
    const favorite = args.favorite as boolean | undefined;
    if (!itemId) return false;

    const keyHashes = index.value?.itemKeyHashesByItemId.get(itemId);
    if (keyHashes && keyHashes.length > 0) {
      const keyHash = keyHashes[0] as string;
      const isFav = isFavorite(keyHash);
      if (favorite === undefined) {
        toggleFavorite(keyHash);
      } else if (favorite && !isFav) {
        toggleFavorite(keyHash);
      } else if (!favorite && isFav) {
        toggleFavorite(keyHash);
      }
      return isFavorite(keyHash);
    }
    return false;
  }
  if (api === 'getItemImage') {
    const itemId = args.itemId as string;
    if (!itemId) return null;

    const keyHashes = index.value?.itemKeyHashesByItemId.get(itemId);
    if (keyHashes && keyHashes.length > 0) {
      const keyHash = keyHashes[0] as string;
      const def = index.value?.itemsByKeyHash.get(keyHash);
      if (def && pack.value) {
        return resolveImageUrl(def.icon ?? '', pack.value.manifest);
      }
    }
    return null;
  }
  if (api === 'getHostSettings') {
    return {
      theme: settingsStore.darkMode ? 'dark' : 'light',
      language: settingsStore.language,
      recipeViewMode: settingsStore.recipeViewMode,
      favoritesCollapsed: settingsStore.favoritesCollapsed,
      panelCollapsed: settingsStore.panelCollapsed,
    };
  }
  throw new Error(`Unknown API: ${api}`);
};

provide('pluginHostApi', handlePluginHostApi);

function goBackInDialog() {
  if (navStack.value.length <= 1) return;
  navStack.value = navStack.value.slice(0, -1);
  void syncUrl('replace');
}

function closeDialog() {
  dialogOpen.value = false;
  navStack.value = [];
  void syncUrl('replace');
}

function onKeyDown(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null;
  const tag = target?.tagName?.toLowerCase() ?? '';
  const isTyping =
    tag === 'input' || tag === 'textarea' || target?.getAttribute('contenteditable') === 'true';
  if (isTyping) return;

  // 获取快捷键绑定
  const bindings = keyBindingsStore.bindings;

  // 导航快捷键（在面板模式和对话框模式下都工作）
  if (navStack.value.length > 0) {
    if (eventMatchesBinding(e, bindings.closeDialog)) {
      e.preventDefault();
      closeDialog();
      return;
    }
    if (eventMatchesBinding(e, bindings.goBack)) {
      e.preventDefault();
      goBackInDialog();
      return;
    }
  }

  if (dialogOpen.value) {
    const canStackFromHover =
      hoveredKeyHash.value &&
      hoveredSource.value !== 'list' &&
      (hoveredSource.value !== 'favorites' || settingsStore.favoritesOpensNewStack) &&
      hoveredKeyHash.value !== (currentItemKey.value ? itemKeyHash(currentItemKey.value) : '');
    const openHoverInDialog = (tab: 'recipes' | 'uses' | 'wiki' | 'icon' | 'planner') => {
      if (!canStackFromHover || !hoveredKeyHash.value) return false;
      const def = index.value?.itemsByKeyHash.get(hoveredKeyHash.value);
      if (!def) return false;
      openDialogByItemKey(def.key, tab);
      return true;
    };

    if (eventMatchesBinding(e, bindings.viewRecipes)) {
      e.preventDefault();
      if (openHoverInDialog('recipes')) return;
      activeTab.value = 'recipes';
      return;
    }
    if (eventMatchesBinding(e, bindings.viewUses)) {
      e.preventDefault();
      if (openHoverInDialog('uses')) return;
      activeTab.value = 'uses';
      return;
    }
    if (eventMatchesBinding(e, bindings.viewWiki)) {
      e.preventDefault();
      if (openHoverInDialog('wiki')) return;
      activeTab.value = 'wiki';
      return;
    }
    if (eventMatchesBinding(e, bindings.viewIcon)) {
      e.preventDefault();
      if (openHoverInDialog('icon')) return;
      activeTab.value = 'icon';
      return;
    }
    if (eventMatchesBinding(e, bindings.viewPlanner)) {
      e.preventDefault();
      if (openHoverInDialog('planner')) {
        plannerTab.value = 'tree';
        return;
      }
      activeTab.value = 'planner';
      plannerTab.value = 'tree';
      ensurePlannerAutoForCurrentItem();
      return;
    }
    if (eventMatchesBinding(e, bindings.plannerTree)) {
      e.preventDefault();
      if (openHoverInDialog('planner')) {
        plannerTab.value = 'tree';
        return;
      }
      activeTab.value = 'planner';
      plannerTab.value = 'tree';
      ensurePlannerAutoForCurrentItem();
      return;
    }
    if (eventMatchesBinding(e, bindings.plannerGraph)) {
      e.preventDefault();
      if (openHoverInDialog('planner')) {
        plannerTab.value = 'graph';
        return;
      }
      activeTab.value = 'planner';
      plannerTab.value = 'graph';
      ensurePlannerAutoForCurrentItem();
      return;
    }
    if (eventMatchesBinding(e, bindings.plannerLine)) {
      e.preventDefault();
      if (openHoverInDialog('planner')) {
        plannerTab.value = 'line';
        return;
      }
      activeTab.value = 'planner';
      plannerTab.value = 'line';
      ensurePlannerAutoForCurrentItem();
      return;
    }
    if (eventMatchesBinding(e, bindings.plannerCalc)) {
      e.preventDefault();
      activeTab.value = 'planner';
      plannerTab.value = 'calc';
      ensurePlannerAutoForCurrentItem();
      return;
    }
    if (eventMatchesBinding(e, bindings.plannerQuant)) {
      e.preventDefault();
      activeTab.value = 'planner';
      plannerTab.value = 'quant';
      ensurePlannerAutoForCurrentItem();
      return;
    }
    return;
  }

  if (!hoveredKeyHash.value) return;
  const useStack =
    hoveredSource.value === 'recipe' ||
    (hoveredSource.value === 'favorites' && settingsStore.favoritesOpensNewStack);
  const openTarget = (tab: 'recipes' | 'uses' | 'wiki' | 'icon' | 'planner') => {
    if (useStack) openStackDialog(hoveredKeyHash.value!, tab);
    else openDialogByKeyHash(hoveredKeyHash.value!, tab);
  };

  if (eventMatchesBinding(e, bindings.viewRecipes)) {
    e.preventDefault();
    openTarget('recipes');
  } else if (eventMatchesBinding(e, bindings.viewUses)) {
    e.preventDefault();
    openTarget('uses');
  } else if (eventMatchesBinding(e, bindings.viewWiki)) {
    e.preventDefault();
    openTarget('wiki');
  } else if (eventMatchesBinding(e, bindings.viewIcon)) {
    e.preventDefault();
    openTarget('icon');
  } else if (eventMatchesBinding(e, bindings.viewPlanner)) {
    e.preventDefault();
    plannerTab.value = 'tree';
    openTarget('planner');
  } else if (eventMatchesBinding(e, bindings.plannerTree)) {
    e.preventDefault();
    plannerTab.value = 'tree';
    openTarget('planner');
  } else if (eventMatchesBinding(e, bindings.plannerGraph)) {
    e.preventDefault();
    plannerTab.value = 'graph';
    openTarget('planner');
  } else if (eventMatchesBinding(e, bindings.plannerLine)) {
    e.preventDefault();
    plannerTab.value = 'line';
    openTarget('planner');
  } else if (eventMatchesBinding(e, bindings.plannerCalc)) {
    e.preventDefault();
    plannerTab.value = 'calc';
    openTarget('planner');
  } else if (eventMatchesBinding(e, bindings.plannerQuant)) {
    e.preventDefault();
    plannerTab.value = 'quant';
    openTarget('planner');
  } else if (eventMatchesBinding(e, bindings.toggleFavorite)) {
    e.preventDefault();
    toggleFavorite(hoveredKeyHash.value);
  } else if (eventMatchesBinding(e, bindings.addToAdvanced)) {
    e.preventDefault();
    // 添加到高级计划器
    centerTab.value = 'advanced';
    const itemDef = itemDefsByKeyHash.value[hoveredKeyHash.value];
    if (itemDef && centerPanelRef.value) {
      centerPanelRef.value.addToAdvancedPlanner(itemDef.key, itemDef.name);
    }
  }
}

function favoritesStorageKey(packId: string) {
  return `jei.favorites.${packId}`;
}

function plansStorageKey(packId: string) {
  return `jei.plans.${packId}`;
}

function plannerLiveStorageKey(packId: string) {
  return `jei.planner.live.${packId}`;
}

function normalizeStringRecord(v: unknown): Record<string, string> {
  if (!v || typeof v !== 'object') return {};
  const out: Record<string, string> = {};
  Object.entries(v as Record<string, unknown>).forEach(([k, val]) => {
    if (typeof val === 'string') out[k] = val;
  });
  return out;
}

function normalizePlannerLiveState(v: unknown): PlannerLiveState {
  if (!v || typeof v !== 'object') return createDefaultPlannerLiveState();
  const obj = v as Record<string, unknown>;
  const targetAmountRaw =
    typeof obj.targetAmount === 'number' ? obj.targetAmount : Number(obj.targetAmount);
  return {
    targetAmount: Number.isFinite(targetAmountRaw) && targetAmountRaw > 0 ? targetAmountRaw : 1,
    useProductRecovery: obj.useProductRecovery === true,
    selectedRecipeIdByItemKeyHash: normalizeStringRecord(obj.selectedRecipeIdByItemKeyHash),
    selectedItemIdByTagId: normalizeStringRecord(obj.selectedItemIdByTagId),
  };
}

async function loadPlannerLiveState(packId: string): Promise<PlannerLiveState> {
  const key = plannerLiveStorageKey(packId);
  const raw = storage.isUsingJEIStorage() ? await storage.getItem(key) : localStorage.getItem(key);
  if (!raw) return createDefaultPlannerLiveState();
  try {
    return normalizePlannerLiveState(JSON.parse(raw) as unknown);
  } catch {
    return createDefaultPlannerLiveState();
  }
}

function savePlannerLiveState(packId: string, state: PlannerLiveState): void {
  const key = plannerLiveStorageKey(packId);
  const normalized = normalizePlannerLiveState(state);
  const value = JSON.stringify(normalized);
  if (storage.isUsingJEIStorage()) {
    void storage.setItem(key, value);
  } else {
    localStorage.setItem(key, value);
  }
}

async function loadPlans(packId: string): Promise<SavedPlan[]> {
  const key = plansStorageKey(packId);
  const raw = storage.isUsingJEIStorage() ? await storage.getItem(key) : localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((v) => {
        if (!v || typeof v !== 'object') return null;
        const obj = v as Record<string, unknown>;
        const id = typeof obj.id === 'string' ? obj.id : '';
        const name = typeof obj.name === 'string' ? obj.name : '';
        const rootItemKey = obj.rootItemKey as ItemKey | undefined;
        const rootKeyHash = typeof obj.rootKeyHash === 'string' ? obj.rootKeyHash : '';
        const targetAmount =
          typeof obj.targetAmount === 'number' ? obj.targetAmount : Number(obj.targetAmount);
        const selectedRecipeIdByItemKeyHash =
          (obj.selectedRecipeIdByItemKeyHash as Record<string, string> | undefined) ?? {};
        const selectedItemIdByTagId =
          (obj.selectedItemIdByTagId as Record<string, string> | undefined) ?? {};
        const useProductRecovery = obj.useProductRecovery === true;
        const createdAt = typeof obj.createdAt === 'number' ? obj.createdAt : 0;
        const kind = obj.kind === 'advanced' ? 'advanced' : undefined;
        const targetsRaw = Array.isArray(obj.targets)
          ? (obj.targets as Array<Record<string, unknown>>)
          : [];
        const targets = targetsRaw
          .map((t): AdvancedObjectiveEntry | null => {
            const itemKey = t.itemKey as ItemKey | undefined;
            const value =
              typeof t.value === 'number'
                ? t.value
                : typeof t.rate === 'number'
                  ? t.rate
                  : Number(t.rate ?? t.value);
            const unit = t.unit as ObjectiveUnit | undefined;
            if (!itemKey?.id || !Number.isFinite(value) || !unit) return null;
            const itemName = typeof t.itemName === 'string' ? t.itemName : undefined;
            const type =
              typeof t.type === 'number' ? (t.type as ObjectiveType) : ObjectiveType.Output;
            const entry: AdvancedObjectiveEntry = { itemKey, value, unit, type };
            if (itemName !== undefined) entry.itemName = itemName;
            return entry;
          })
          .filter((t): t is AdvancedObjectiveEntry => t !== null);
        if (!id || !name || !rootItemKey?.id || !rootKeyHash || !Number.isFinite(targetAmount))
          return null;
        const plan: SavedPlan = {
          id,
          name,
          rootItemKey,
          rootKeyHash,
          targetAmount,
          useProductRecovery,
          selectedRecipeIdByItemKeyHash,
          selectedItemIdByTagId,
          createdAt,
          ...(kind ? { kind } : {}),
          ...(targets.length ? { targets } : {}),
        };
        return plan;
      })
      .filter((p): p is SavedPlan => p !== null)
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

function savePlans(packId: string, plans: SavedPlan[]) {
  const key = plansStorageKey(packId);
  const value = JSON.stringify(plans);
  if (storage.isUsingJEIStorage()) {
    void storage.setItem(key, value);
  } else {
    localStorage.setItem(key, value);
  }
}

function newPlanId() {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `plan_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function onPlannerStateChange(s: PlannerLiveState) {
  const normalized = normalizePlannerLiveState(s);
  plannerLiveState.value = normalized;
  const packId = pack.value?.manifest.packId;
  if (packId) savePlannerLiveState(packId, normalized);
}

function savePlannerPlan(payload: PlannerSavePayload) {
  const packId = pack.value?.manifest.packId ?? 'default';
  const plan: SavedPlan = {
    id: newPlanId(),
    name: payload.name,
    rootItemKey: payload.rootItemKey,
    rootKeyHash: itemKeyHash(payload.rootItemKey),
    targetAmount: payload.targetAmount,
    useProductRecovery: payload.useProductRecovery === true,
    selectedRecipeIdByItemKeyHash: payload.selectedRecipeIdByItemKeyHash,
    selectedItemIdByTagId: payload.selectedItemIdByTagId,
    createdAt: Date.now(),
    ...(payload.kind === 'advanced' ? { kind: 'advanced' } : {}),
    ...(payload.kind === 'advanced' && payload.targets ? { targets: payload.targets } : {}),
  };
  const next = [plan, ...savedPlans.value];
  savedPlans.value = next;
  savePlans(packId, next);
}

function openSavedPlan(p: SavedPlan) {
  if (p.kind === 'advanced' && p.targets?.length) {
    centerTab.value = 'advanced';
    centerPanelRef.value?.loadAdvancedPlan({
      name: p.name,
      rootItemKey: p.rootItemKey,
      targetAmount: p.targetAmount,
      useProductRecovery: p.useProductRecovery === true,
      selectedRecipeIdByItemKeyHash: p.selectedRecipeIdByItemKeyHash,
      selectedItemIdByTagId: p.selectedItemIdByTagId,
      kind: 'advanced',
      targets: p.targets,
    });
    return;
  }

  // 普通计划切换到资料查看器
  centerTab.value = 'recipe';
  selectedKeyHash.value = p.rootKeyHash;
  navStack.value = [p.rootItemKey];
  activeTab.value = 'planner';
  plannerInitialState.value = {
    loadKey: `${p.id}:${Date.now()}`,
    targetAmount: p.targetAmount,
    useProductRecovery: p.useProductRecovery === true,
    selectedRecipeIdByItemKeyHash: p.selectedRecipeIdByItemKeyHash,
    selectedItemIdByTagId: p.selectedItemIdByTagId,
  };
  dialogOpen.value = settingsStore.recipeViewMode === 'dialog';
  pushHistoryKeyHash(p.rootKeyHash);
}

function deleteSavedPlan(id: string) {
  const packId = pack.value?.manifest.packId ?? 'default';
  const next = savedPlans.value.filter((p) => p.id !== id);
  savedPlans.value = next;
  savePlans(packId, next);
}

async function loadFavorites(packId: string): Promise<Set<string>> {
  const key = favoritesStorageKey(packId);
  const raw = storage.isUsingJEIStorage() ? await storage.getItem(key) : localStorage.getItem(key);
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v) => typeof v === 'string'));
  } catch {
    return new Set();
  }
}

function saveFavorites(packId: string, fav: Set<string>) {
  const key = favoritesStorageKey(packId);
  const value = JSON.stringify(Array.from(fav));
  if (storage.isUsingJEIStorage()) {
    void storage.setItem(key, value);
  } else {
    localStorage.setItem(key, value);
  }
}

function isFavorite(keyHash: string) {
  return favorites.value.has(keyHash);
}

function toggleFavorite(keyHash: string) {
  const packId = pack.value?.manifest.packId ?? 'default';
  const next = new Set(favorites.value);
  if (next.has(keyHash)) next.delete(keyHash);
  else next.add(keyHash);
  favorites.value = next;
  saveFavorites(packId, next);
}

function pushHistoryKeyHash(keyHash: string) {
  // 保持历史记录多一点,展示的时候再截断
  const next = [keyHash, ...historyKeyHashes.value.filter((k) => k !== keyHash)].slice(0, 100);
  historyKeyHashes.value = next;
}

function parseSearch(input: string): ParsedSearch {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  const out: ParsedSearch = { text: [], itemId: [], gameId: [], tag: [] };

  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (!t) continue;
    if (!t.startsWith('@')) {
      out.text.push(t.toLowerCase());
      continue;
    }

    const raw = t.slice(1);
    const [nameRaw, valueInline] = splitDirective(raw);
    const name = nameRaw.toLowerCase();
    let value: string | undefined = valueInline || undefined;

    const next = tokens[i + 1];
    if (!value && next && !next.startsWith('@')) {
      value = next;
      i += 1;
    }

    const v = (value ?? '').trim();

    if (name === 'itemid' || name === 'id') {
      if (!v) continue;
      out.itemId.push(v.toLowerCase());
    } else if (name === 'gameid' || name === 'game') {
      if (!v) continue;
      out.gameId.push(v.toLowerCase());
    } else if (name === 'tag' || name === 't') {
      if (!v) continue;
      out.tag.push(v.toLowerCase());
    } else {
      // 无前缀的 @xxx 直接作为标签包含搜索
      out.tag.push(raw.toLowerCase());
    }
  }

  return out;
}

function splitDirective(raw: string): [string, string] {
  const idx = raw.search(/[:=]/);
  if (idx < 0) return [raw, ''];
  return [raw.slice(0, idx), raw.slice(idx + 1)];
}

function matchesSearch(def: ItemDef, search: ParsedSearch, nameKeys?: NameSearchKeys): boolean {
  const name = nameKeys?.nameLower ?? (def.name ?? '').toLowerCase();
  const pinyinFull = nameKeys?.pinyinFull ?? '';
  const pinyinFirst = nameKeys?.pinyinFirst ?? '';
  const id = def.key.id.toLowerCase();

  for (const t of search.text) {
    if (name.includes(t)) continue;
    const q = normalizePinyinQuery(t);
    if (q && (pinyinFull.includes(q) || pinyinFirst.includes(q))) continue;
    return false;
  }
  for (const t of search.itemId) {
    if (!id.includes(t)) return false;
  }
  for (const t of search.gameId) {
    const gid = (id.includes(':') ? id.split(':')[0] : id.split('.')[0]) ?? '';
    if (!gid.includes(t)) return false;
  }
  for (const t of search.tag) {
    const tags = index.value?.tagIdsByItemId.get(def.key.id);
    if (!tags) return false;
    // 使用包含匹配：检查是否有任何标签包含搜索词
    const matchFound = Array.from(tags).some((tagId) =>
      tagId.toLowerCase().includes(t.toLowerCase()),
    );
    if (!matchFound) return false;
  }
  return true;
}
</script>

<style scoped>
.jei-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0 !important;
  min-height: 0;
}

.jei-root {
  flex: 1;
  min-height: 0;
  display: grid;
  --jei-fav-col: fit-content(320px);
  --jei-panel-col: 1fr;
  --jei-list-col: fit-content(380px);
  grid-template-columns: var(--jei-fav-col) var(--jei-panel-col) var(--jei-list-col);
  gap: 12px;
  align-items: stretch;
  padding: 12px;
  padding-bottom: 0;
}

.jei-root--fav-collapsed {
  --jei-fav-col: 20px;
}

.jei-root--panel-collapsed {
  --jei-panel-col: 20px;
  --jei-list-col: 1fr;
}

.jei-root--mobile {
  display: flex;
  flex-direction: column;
  padding: 0;
}

.jei-root--mobile > .q-card {
  border-radius: 0;
  border-left: none;
  border-right: none;
  flex: 1;
}

.jei-mobile-nav {
  flex: 0 0 auto;
  border-top: 1px solid rgba(0, 0, 0, 0.12);
  z-index: 20;
}

@media (max-width: 599px) {
  .jei-bottombar .row {
    flex-wrap: wrap;
  }
  .jei-bottombar .q-select {
    width: 100%;
    min-width: 0 !important;
    margin-bottom: 8px;
  }
}

.jei-fav {
  height: 100%;
  min-height: 0;
  transition: width 0.3s ease;
}

.jei-fav--collapsed {
  width: 20px !important;
  min-width: 20px !important;
}
</style>

<style scoped>
.jei-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.jei-root {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
}

.jei-mobile-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  z-index: 1000;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.jei-debug-overlay {
  position: fixed;
  right: 10px;
  bottom: 80px;
  z-index: 9999;
  max-width: 320px;
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  color: #fff;
  background: rgba(0, 0, 0, 0.75);
  font-size: 12px;
  line-height: 1.25;
  white-space: pre-wrap;
  pointer-events: none;
}
</style>
