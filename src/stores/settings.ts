import { defineStore } from 'pinia';
import { Dark } from 'quasar';
import {
  initSettings,
  getSettingsJSON,
  saveSettingsJSON,
  getStorageItem,
  setStorageItem,
  isUsingJEIStorage,
  onSettingsLoaded,
  PROXY_ACCESS_TOKEN_KEY,
  PROXY_ANONYMOUS_TOKEN_KEY,
  PROXY_FRAMEWORK_TOKEN_KEY,
} from 'src/utils/storageHelper';
import {
  createDefaultLineWidthCurveConfig,
  sanitizeLineWidthCurveConfig,
  type LineWidthCurveConfig,
} from 'src/jei/planner/lineWidthCurve';

export type DarkMode = 'auto' | 'light' | 'dark';
export type Language = 'zh-CN' | 'en-US' | 'ja-JP';
export type ItemIconDisplayMode = 'modern' | 'jei_classic';
export type ItemClickDefaultTab = 'recipes' | 'uses' | 'wiki' | 'icon' | 'planner';
export type HoverTooltipDisplayKey =
  | 'title'
  | 'idLine'
  | 'metaLine'
  | 'nbtLine'
  | 'rarity'
  | 'detailIds'
  | 'detailTags'
  | 'detailSources'
  | 'detailInfo'
  | 'detailWiki'
  | 'detailDescriptions'
  | 'namespaceLines'
  | 'tagsLine'
  | 'sourceLine'
  | 'description'
  | 'namespace';
export type HoverTooltipDisplaySettings = Record<HoverTooltipDisplayKey, boolean>;

type CircuitEditorPiecePanelState = {
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  docked: boolean;
};

const DEFAULT_HOVER_TOOLTIP_DISPLAY_SETTINGS: HoverTooltipDisplaySettings = {
  title: true,
  idLine: true,
  metaLine: true,
  nbtLine: true,
  rarity: true,
  detailIds: true,
  detailTags: true,
  detailSources: true,
  detailInfo: true,
  detailWiki: true,
  detailDescriptions: true,
  namespaceLines: true,
  tagsLine: true,
  sourceLine: true,
  description: true,
  namespace: true,
};

function darkModeToQuasar(mode: DarkMode): boolean | 'auto' {
  if (mode === 'auto') return 'auto';
  return mode === 'dark';
}

// 探测浏览器语言
function detectBrowserLanguage(): Language {
  const browserLang = navigator.language;
  if (browserLang.startsWith('zh')) return 'zh-CN';
  if (browserLang.startsWith('ja')) return 'ja-JP';
  return 'en-US';
}

function syncProxyTokensToStorage(state: {
  packImageProxyAccessToken: string;
  packImageProxyAnonymousToken: string;
  packImageProxyFrameworkToken: string;
}): void {
  setStorageItem(PROXY_ACCESS_TOKEN_KEY, state.packImageProxyAccessToken);
  setStorageItem(PROXY_ANONYMOUS_TOKEN_KEY, state.packImageProxyAnonymousToken);
  setStorageItem(PROXY_FRAMEWORK_TOKEN_KEY, state.packImageProxyFrameworkToken);
}

function normalizeMirrors(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((v): v is string => typeof v === 'string')
        .map((v) => v.replace(/\/+$/, '').trim())
        .filter((v) => v.length > 0),
    ),
  );
}

function normalizeCustomPackId(rawId: string): string {
  const trimmed = rawId.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('ext-') ? trimmed : `ext-${trimmed}`;
}

function normalizeItemIconDisplayMode(value: unknown): ItemIconDisplayMode | null {
  return value === 'jei_classic' || value === 'modern' ? value : null;
}

function normalizeItemClickDefaultTab(value: unknown): ItemClickDefaultTab | null {
  return value === 'recipes' ||
    value === 'uses' ||
    value === 'wiki' ||
    value === 'icon' ||
    value === 'planner'
    ? value
    : null;
}

function normalizeCustomPackSource(
  value: unknown,
): { packId: string; label: string; mirrors: string[] } | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as { packId?: unknown; label?: unknown; mirrors?: unknown };
  if (typeof raw.packId !== 'string' || typeof raw.label !== 'string') return null;
  const packId = normalizeCustomPackId(raw.packId);
  if (!packId) return null;
  return {
    packId,
    label: raw.label,
    mirrors: normalizeMirrors(raw.mirrors),
  };
}

function normalizeHoverTooltipDisplaySettings(value: unknown): HoverTooltipDisplaySettings {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_HOVER_TOOLTIP_DISPLAY_SETTINGS };
  }

  const raw = value as Partial<Record<HoverTooltipDisplayKey, unknown>>;
  return {
    title:
      typeof raw.title === 'boolean' ? raw.title : DEFAULT_HOVER_TOOLTIP_DISPLAY_SETTINGS.title,
    idLine:
      typeof raw.idLine === 'boolean' ? raw.idLine : DEFAULT_HOVER_TOOLTIP_DISPLAY_SETTINGS.idLine,
    metaLine:
      typeof raw.metaLine === 'boolean'
        ? raw.metaLine
        : DEFAULT_HOVER_TOOLTIP_DISPLAY_SETTINGS.metaLine,
    nbtLine:
      typeof raw.nbtLine === 'boolean'
        ? raw.nbtLine
        : DEFAULT_HOVER_TOOLTIP_DISPLAY_SETTINGS.nbtLine,
    rarity:
      typeof raw.rarity === 'boolean' ? raw.rarity : DEFAULT_HOVER_TOOLTIP_DISPLAY_SETTINGS.rarity,
    detailIds:
      typeof raw.detailIds === 'boolean'
        ? raw.detailIds
        : DEFAULT_HOVER_TOOLTIP_DISPLAY_SETTINGS.detailIds,
    detailTags:
      typeof raw.detailTags === 'boolean'
        ? raw.detailTags
        : DEFAULT_HOVER_TOOLTIP_DISPLAY_SETTINGS.detailTags,
    detailSources:
      typeof raw.detailSources === 'boolean'
        ? raw.detailSources
        : DEFAULT_HOVER_TOOLTIP_DISPLAY_SETTINGS.detailSources,
    detailInfo:
      typeof raw.detailInfo === 'boolean'
        ? raw.detailInfo
        : DEFAULT_HOVER_TOOLTIP_DISPLAY_SETTINGS.detailInfo,
    detailWiki:
      typeof raw.detailWiki === 'boolean'
        ? raw.detailWiki
        : DEFAULT_HOVER_TOOLTIP_DISPLAY_SETTINGS.detailWiki,
    detailDescriptions:
      typeof raw.detailDescriptions === 'boolean'
        ? raw.detailDescriptions
        : DEFAULT_HOVER_TOOLTIP_DISPLAY_SETTINGS.detailDescriptions,
    namespaceLines:
      typeof raw.namespaceLines === 'boolean'
        ? raw.namespaceLines
        : DEFAULT_HOVER_TOOLTIP_DISPLAY_SETTINGS.namespaceLines,
    tagsLine:
      typeof raw.tagsLine === 'boolean'
        ? raw.tagsLine
        : DEFAULT_HOVER_TOOLTIP_DISPLAY_SETTINGS.tagsLine,
    sourceLine:
      typeof raw.sourceLine === 'boolean'
        ? raw.sourceLine
        : DEFAULT_HOVER_TOOLTIP_DISPLAY_SETTINGS.sourceLine,
    description:
      typeof raw.description === 'boolean'
        ? raw.description
        : DEFAULT_HOVER_TOOLTIP_DISPLAY_SETTINGS.description,
    namespace:
      typeof raw.namespace === 'boolean'
        ? raw.namespace
        : DEFAULT_HOVER_TOOLTIP_DISPLAY_SETTINGS.namespace,
  };
}

export const useSettingsStore = defineStore('settings', {
  state: () => {
    const defaults = {
      historyLimit: 6,
      favoritePageSizeMin: 2,
      favoritePageSizeMax: 60,
      debugLayout: false,
      debugNavPanel: false,
      recipeViewMode: 'panel' as 'dialog' | 'panel',
      recipeSlotShowName: true,
      selectedPack: 'aef',
      favoritesCollapsed: false,
      panelCollapsed: false,
      darkMode: 'auto' as DarkMode,
      language: detectBrowserLanguage(),
      debugPanelPos: { x: 10, y: 10 },
      acceptedStartupDialogs: [] as string[],
      completedTutorial: false,
      favoritesOpensNewStack: false,
      persistHistoryRecords: true,
      hoverTooltipAllowMouseEnter: true,
      hoverTooltipDisplay: { ...DEFAULT_HOVER_TOOLTIP_DISPLAY_SETTINGS },
      // Wiki 渲染器设置
      wikiImageUseProxy: false,
      wikiImageProxyUrl: 'https://r.jina.ai/http://',
      wikiCatalogFileName: '',
      packImageProxyUsePackProvided: true,
      packImageProxyUseManual: false,
      packImageProxyUseDev: false,
      packImageProxyManualUrl: '',
      packImageProxyDevUrl: '',
      packImageProxyAccessToken: getStorageItem(PROXY_ACCESS_TOKEN_KEY),
      packImageProxyAnonymousToken: getStorageItem(PROXY_ANONYMOUS_TOKEN_KEY),
      packImageProxyFrameworkToken: getStorageItem(PROXY_FRAMEWORK_TOKEN_KEY),
      circuitCollectionPreviewShowPieces: false,
      circuitEditorPiecePanel: {
        x: 16,
        y: 120,
        width: 420,
        height: 620,
        minimized: false,
        docked: false,
      } as CircuitEditorPiecePanelState,
      circuitEditorPiecePanelSplitRatio: 0.5,
      detectPcDisableMobile: true,
      customPackSources: [] as Array<{ packId: string; label: string; mirrors: string[] }>,
      useDevPackMirrors: false,
      packMirrorSelectionModeByPack: {} as Record<string, 'auto' | 'manual'>,
      packManualMirrorByPack: {} as Record<string, string>,
      showLoadingOverlay: true,
      quantLineWidthScale: 2,
      productionLineG6Scale: 2,
      productionLineRenderer: 'vue_flow' as 'vue_flow' | 'g6',
      quantFlowRenderer: 'nodes' as 'nodes' | 'sankey',
      lineIntermediateColoring: true,
      lineWidthByRate: false,
      lineWidthCurveConfig: createDefaultLineWidthCurveConfig(),
      itemListIconDisplayMode: 'modern' as ItemIconDisplayMode,
      favoritesIconDisplayMode: 'modern' as ItemIconDisplayMode,
      itemIconLoadingAnimation: false,
      itemClickDefaultTab: 'recipes' as ItemClickDefaultTab,
      machineCountDecimals: 2,
      pluginEnabledById: {} as Record<string, boolean>,
      pluginSettingsById: {} as Record<string, Record<string, string | number | boolean>>,
      hoverTooltipTemporaryInteractive: false,
    };
    try {
      const raw = getSettingsJSON();
      if (!raw) {
        Dark.set('auto');
        return defaults;
      }
      const parsed = JSON.parse(raw) as Partial<typeof defaults>;
      const darkMode =
        parsed.darkMode === 'auto' || parsed.darkMode === 'light' || parsed.darkMode === 'dark'
          ? parsed.darkMode
          : defaults.darkMode;
      Dark.set(darkModeToQuasar(darkMode));
      const language: Language =
        parsed.language === 'zh-CN' || parsed.language === 'en-US' || parsed.language === 'ja-JP'
          ? parsed.language
          : defaults.language;
      const recipeViewMode: 'dialog' | 'panel' =
        parsed.recipeViewMode === 'panel' ? 'panel' : 'dialog';
      const panelParsed = parsed.circuitEditorPiecePanel;
      const circuitEditorPiecePanel =
        panelParsed &&
        typeof panelParsed.x === 'number' &&
        Number.isFinite(panelParsed.x) &&
        typeof panelParsed.y === 'number' &&
        Number.isFinite(panelParsed.y) &&
        typeof panelParsed.width === 'number' &&
        Number.isFinite(panelParsed.width) &&
        typeof panelParsed.height === 'number' &&
        Number.isFinite(panelParsed.height) &&
        typeof panelParsed.minimized === 'boolean'
          ? {
              x: panelParsed.x,
              y: panelParsed.y,
              width: panelParsed.width,
              height: panelParsed.height,
              minimized: panelParsed.minimized,
              docked:
                typeof panelParsed.docked === 'boolean'
                  ? panelParsed.docked
                  : defaults.circuitEditorPiecePanel.docked,
            }
          : defaults.circuitEditorPiecePanel;
      const restored = {
        historyLimit:
          typeof parsed.historyLimit === 'number' ? parsed.historyLimit : defaults.historyLimit,
        favoritePageSizeMin:
          typeof parsed.favoritePageSizeMin === 'number' &&
          Number.isFinite(parsed.favoritePageSizeMin) &&
          parsed.favoritePageSizeMin >= 2
            ? Math.max(2, Math.min(200, Math.floor(parsed.favoritePageSizeMin)))
            : defaults.favoritePageSizeMin,
        favoritePageSizeMax:
          typeof parsed.favoritePageSizeMax === 'number' &&
          Number.isFinite(parsed.favoritePageSizeMax) &&
          parsed.favoritePageSizeMax >= 2
            ? Math.max(2, Math.min(400, Math.floor(parsed.favoritePageSizeMax)))
            : defaults.favoritePageSizeMax,
        debugLayout:
          typeof parsed.debugLayout === 'boolean' ? parsed.debugLayout : defaults.debugLayout,
        debugNavPanel:
          typeof parsed.debugNavPanel === 'boolean' ? parsed.debugNavPanel : defaults.debugNavPanel,
        recipeViewMode,
        recipeSlotShowName:
          typeof parsed.recipeSlotShowName === 'boolean'
            ? parsed.recipeSlotShowName
            : defaults.recipeSlotShowName,
        selectedPack:
          typeof parsed.selectedPack === 'string' ? parsed.selectedPack : defaults.selectedPack,
        favoritesCollapsed:
          typeof parsed.favoritesCollapsed === 'boolean'
            ? parsed.favoritesCollapsed
            : defaults.favoritesCollapsed,
        panelCollapsed:
          typeof parsed.panelCollapsed === 'boolean'
            ? parsed.panelCollapsed
            : defaults.panelCollapsed,
        darkMode,
        language,
        debugPanelPos:
          parsed.debugPanelPos &&
          typeof parsed.debugPanelPos.x === 'number' &&
          typeof parsed.debugPanelPos.y === 'number'
            ? parsed.debugPanelPos
            : defaults.debugPanelPos,
        acceptedStartupDialogs: Array.isArray(parsed.acceptedStartupDialogs)
          ? parsed.acceptedStartupDialogs.filter((x): x is string => typeof x === 'string')
          : defaults.acceptedStartupDialogs,
        completedTutorial:
          typeof parsed.completedTutorial === 'boolean'
            ? parsed.completedTutorial
            : defaults.completedTutorial,
        favoritesOpensNewStack:
          typeof parsed.favoritesOpensNewStack === 'boolean'
            ? parsed.favoritesOpensNewStack
            : defaults.favoritesOpensNewStack,
        persistHistoryRecords:
          typeof parsed.persistHistoryRecords === 'boolean'
            ? parsed.persistHistoryRecords
            : defaults.persistHistoryRecords,
        hoverTooltipAllowMouseEnter:
          typeof parsed.hoverTooltipAllowMouseEnter === 'boolean'
            ? parsed.hoverTooltipAllowMouseEnter
            : defaults.hoverTooltipAllowMouseEnter,
        hoverTooltipDisplay: normalizeHoverTooltipDisplaySettings(parsed.hoverTooltipDisplay),
        wikiImageUseProxy:
          typeof parsed.wikiImageUseProxy === 'boolean'
            ? parsed.wikiImageUseProxy
            : defaults.wikiImageUseProxy,
        wikiImageProxyUrl:
          typeof parsed.wikiImageProxyUrl === 'string'
            ? parsed.wikiImageProxyUrl
            : defaults.wikiImageProxyUrl,
        wikiCatalogFileName:
          typeof parsed.wikiCatalogFileName === 'string'
            ? parsed.wikiCatalogFileName
            : defaults.wikiCatalogFileName,
        packImageProxyUsePackProvided:
          typeof parsed.packImageProxyUsePackProvided === 'boolean'
            ? parsed.packImageProxyUsePackProvided
            : defaults.packImageProxyUsePackProvided,
        packImageProxyUseManual:
          typeof parsed.packImageProxyUseManual === 'boolean'
            ? parsed.packImageProxyUseManual
            : defaults.packImageProxyUseManual,
        packImageProxyUseDev:
          typeof parsed.packImageProxyUseDev === 'boolean'
            ? parsed.packImageProxyUseDev
            : defaults.packImageProxyUseDev,
        packImageProxyManualUrl:
          typeof parsed.packImageProxyManualUrl === 'string'
            ? parsed.packImageProxyManualUrl
            : defaults.packImageProxyManualUrl,
        packImageProxyDevUrl:
          typeof parsed.packImageProxyDevUrl === 'string'
            ? parsed.packImageProxyDevUrl
            : defaults.packImageProxyDevUrl,
        packImageProxyAccessToken:
          typeof parsed.packImageProxyAccessToken === 'string'
            ? parsed.packImageProxyAccessToken
            : defaults.packImageProxyAccessToken,
        packImageProxyAnonymousToken:
          typeof parsed.packImageProxyAnonymousToken === 'string'
            ? parsed.packImageProxyAnonymousToken
            : defaults.packImageProxyAnonymousToken,
        packImageProxyFrameworkToken:
          typeof parsed.packImageProxyFrameworkToken === 'string'
            ? parsed.packImageProxyFrameworkToken
            : defaults.packImageProxyFrameworkToken,
        circuitCollectionPreviewShowPieces:
          typeof parsed.circuitCollectionPreviewShowPieces === 'boolean'
            ? parsed.circuitCollectionPreviewShowPieces
            : defaults.circuitCollectionPreviewShowPieces,
        circuitEditorPiecePanel,
        circuitEditorPiecePanelSplitRatio:
          typeof parsed.circuitEditorPiecePanelSplitRatio === 'number' &&
          Number.isFinite(parsed.circuitEditorPiecePanelSplitRatio)
            ? parsed.circuitEditorPiecePanelSplitRatio
            : defaults.circuitEditorPiecePanelSplitRatio,
        detectPcDisableMobile:
          typeof parsed.detectPcDisableMobile === 'boolean'
            ? parsed.detectPcDisableMobile
            : defaults.detectPcDisableMobile,
        customPackSources: Array.isArray(parsed.customPackSources)
          ? parsed.customPackSources
              .map((x) => normalizeCustomPackSource(x))
              .filter((x): x is { packId: string; label: string; mirrors: string[] } => x !== null)
          : defaults.customPackSources,
        useDevPackMirrors:
          typeof parsed.useDevPackMirrors === 'boolean'
            ? parsed.useDevPackMirrors
            : defaults.useDevPackMirrors,
        packMirrorSelectionModeByPack:
          parsed.packMirrorSelectionModeByPack &&
          typeof parsed.packMirrorSelectionModeByPack === 'object'
            ? Object.fromEntries(
                Object.entries(parsed.packMirrorSelectionModeByPack).filter(
                  (entry): entry is [string, 'auto' | 'manual'] =>
                    entry[1] === 'auto' || entry[1] === 'manual',
                ),
              )
            : defaults.packMirrorSelectionModeByPack,
        packManualMirrorByPack:
          parsed.packManualMirrorByPack && typeof parsed.packManualMirrorByPack === 'object'
            ? Object.fromEntries(
                Object.entries(parsed.packManualMirrorByPack).filter(
                  (entry): entry is [string, string] => typeof entry[1] === 'string',
                ),
              )
            : defaults.packManualMirrorByPack,
        showLoadingOverlay:
          typeof parsed.showLoadingOverlay === 'boolean'
            ? parsed.showLoadingOverlay
            : defaults.showLoadingOverlay,
        quantLineWidthScale:
          typeof parsed.quantLineWidthScale === 'number' &&
          Number.isFinite(parsed.quantLineWidthScale) &&
          parsed.quantLineWidthScale > 0
            ? parsed.quantLineWidthScale
            : defaults.quantLineWidthScale,
        productionLineG6Scale:
          typeof parsed.productionLineG6Scale === 'number' &&
          Number.isFinite(parsed.productionLineG6Scale) &&
          parsed.productionLineG6Scale > 0
            ? parsed.productionLineG6Scale
            : defaults.productionLineG6Scale,
        productionLineRenderer:
          parsed.productionLineRenderer === 'g6' || parsed.productionLineRenderer === 'vue_flow'
            ? parsed.productionLineRenderer
            : defaults.productionLineRenderer,
        quantFlowRenderer:
          parsed.quantFlowRenderer === 'sankey' || parsed.quantFlowRenderer === 'nodes'
            ? parsed.quantFlowRenderer
            : defaults.quantFlowRenderer,
        lineIntermediateColoring:
          typeof parsed.lineIntermediateColoring === 'boolean'
            ? parsed.lineIntermediateColoring
            : defaults.lineIntermediateColoring,
        lineWidthByRate:
          typeof parsed.lineWidthByRate === 'boolean'
            ? parsed.lineWidthByRate
            : defaults.lineWidthByRate,
        lineWidthCurveConfig:
          parsed.lineWidthCurveConfig && typeof parsed.lineWidthCurveConfig === 'object'
            ? sanitizeLineWidthCurveConfig(
                parsed.lineWidthCurveConfig as unknown as LineWidthCurveConfig,
              )
            : defaults.lineWidthCurveConfig,
        itemListIconDisplayMode:
          normalizeItemIconDisplayMode(parsed.itemListIconDisplayMode) ??
          defaults.itemListIconDisplayMode,
        favoritesIconDisplayMode:
          normalizeItemIconDisplayMode(parsed.favoritesIconDisplayMode) ??
          defaults.favoritesIconDisplayMode,
        itemIconLoadingAnimation:
          typeof parsed.itemIconLoadingAnimation === 'boolean'
            ? parsed.itemIconLoadingAnimation
            : defaults.itemIconLoadingAnimation,
        itemClickDefaultTab:
          normalizeItemClickDefaultTab(parsed.itemClickDefaultTab) ?? defaults.itemClickDefaultTab,
        machineCountDecimals:
          typeof parsed.machineCountDecimals === 'number' &&
          Number.isFinite(parsed.machineCountDecimals) &&
          parsed.machineCountDecimals >= 0
            ? Math.max(0, Math.min(4, Math.floor(parsed.machineCountDecimals)))
            : defaults.machineCountDecimals,
        pluginEnabledById:
          parsed.pluginEnabledById && typeof parsed.pluginEnabledById === 'object'
            ? Object.fromEntries(
                Object.entries(parsed.pluginEnabledById).filter(
                  (entry): entry is [string, boolean] => typeof entry[1] === 'boolean',
                ),
              )
            : defaults.pluginEnabledById,
        pluginSettingsById:
          parsed.pluginSettingsById && typeof parsed.pluginSettingsById === 'object'
            ? Object.fromEntries(
                Object.entries(parsed.pluginSettingsById)
                  .filter(
                    (entry): entry is [string, Record<string, string | number | boolean>] =>
                      typeof entry[1] === 'object' && !!entry[1],
                  )
                  .map(([pluginId, values]) => [
                    pluginId,
                    Object.fromEntries(
                      Object.entries(values).filter(
                        (valueEntry): valueEntry is [string, string | number | boolean] =>
                          typeof valueEntry[1] === 'string' ||
                          typeof valueEntry[1] === 'number' ||
                          typeof valueEntry[1] === 'boolean',
                      ),
                    ),
                  ]),
              )
            : defaults.pluginSettingsById,
        hoverTooltipTemporaryInteractive: defaults.hoverTooltipTemporaryInteractive,
      };
      syncProxyTokensToStorage(restored);
      return restored;
    } catch {
      Dark.set('auto');
      return defaults;
    }
  },
  actions: {
    setHistoryLimit(limit: number) {
      this.historyLimit = limit;
      void this.save();
    },
    setFavoritePageSizeMin(value: number) {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 2) return;
      this.favoritePageSizeMin = Math.max(2, Math.min(200, Math.floor(n)));
      if (this.favoritePageSizeMax < this.favoritePageSizeMin) {
        this.favoritePageSizeMax = this.favoritePageSizeMin;
      }
      void this.save();
    },
    setFavoritePageSizeMax(value: number) {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 2) return;
      this.favoritePageSizeMax = Math.max(2, Math.min(400, Math.floor(n)));
      if (this.favoritePageSizeMin > this.favoritePageSizeMax) {
        this.favoritePageSizeMin = this.favoritePageSizeMax;
      }
      void this.save();
    },
    resetFavoritePageSizeBounds() {
      this.favoritePageSizeMin = 2;
      this.favoritePageSizeMax = 60;
      void this.save();
    },
    setDebugLayout(enabled: boolean) {
      this.debugLayout = enabled;
      void this.save();
    },
    setDebugNavPanel(enabled: boolean) {
      this.debugNavPanel = enabled;
      void this.save();
    },
    setRecipeViewMode(mode: 'dialog' | 'panel') {
      this.recipeViewMode = mode;
      void this.save();
    },
    setRecipeSlotShowName(enabled: boolean) {
      this.recipeSlotShowName = enabled;
      void this.save();
    },
    setSelectedPack(packId: string) {
      this.selectedPack = packId;
      void this.save();
    },
    setFavoritesCollapsed(value: boolean) {
      this.favoritesCollapsed = value;
      void this.save();
    },
    setPanelCollapsed(value: boolean) {
      this.panelCollapsed = value;
      void this.save();
    },
    setDarkMode(mode: DarkMode) {
      this.darkMode = mode;
      Dark.set(darkModeToQuasar(mode));
      void this.save();
    },
    setLanguage(lang: Language) {
      this.language = lang;
      void this.save();
    },
    setDebugPanelPos(pos: { x: number; y: number }) {
      this.debugPanelPos = pos;
      void this.save();
    },
    addAcceptedStartupDialog(id: string) {
      if (!this.acceptedStartupDialogs.includes(id)) {
        this.acceptedStartupDialogs.push(id);
        void this.save();
      }
    },
    setFavoritesOpensNewStack(value: boolean) {
      this.favoritesOpensNewStack = value;
      void this.save();
    },
    setPersistHistoryRecords(value: boolean) {
      this.persistHistoryRecords = value;
      void this.save();
    },
    setHoverTooltipAllowMouseEnter(value: boolean) {
      this.hoverTooltipAllowMouseEnter = value;
      void this.save();
    },
    setHoverTooltipDisplaySetting(key: HoverTooltipDisplayKey, value: boolean) {
      this.hoverTooltipDisplay = {
        ...this.hoverTooltipDisplay,
        [key]: value,
      };
      void this.save();
    },
    setHoverTooltipTemporaryInteractive(value: boolean) {
      this.hoverTooltipTemporaryInteractive = value;
    },
    setWikiImageUseProxy(value: boolean) {
      this.wikiImageUseProxy = value;
      void this.save();
    },
    setWikiImageProxyUrl(value: string) {
      this.wikiImageProxyUrl = value;
      void this.save();
    },
    setWikiCatalogFileName(value: string) {
      this.wikiCatalogFileName = value;
      void this.save();
    },
    setPackImageProxyUsePackProvided(value: boolean) {
      this.packImageProxyUsePackProvided = value;
      void this.save();
    },
    setPackImageProxyUseManual(value: boolean) {
      this.packImageProxyUseManual = value;
      void this.save();
    },
    setPackImageProxyUseDev(value: boolean) {
      this.packImageProxyUseDev = value;
      void this.save();
    },
    setPackImageProxyManualUrl(value: string) {
      this.packImageProxyManualUrl = value;
      void this.save();
    },
    setPackImageProxyDevUrl(value: string) {
      this.packImageProxyDevUrl = value;
      void this.save();
    },
    setPackImageProxyAccessToken(value: string) {
      this.packImageProxyAccessToken = value;
      syncProxyTokensToStorage(this);
      void this.save();
    },
    setPackImageProxyAnonymousToken(value: string) {
      this.packImageProxyAnonymousToken = value;
      syncProxyTokensToStorage(this);
      void this.save();
    },
    setPackImageProxyFrameworkToken(value: string) {
      this.packImageProxyFrameworkToken = value;
      syncProxyTokensToStorage(this);
      void this.save();
    },
    setCompletedTutorial(value: boolean) {
      this.completedTutorial = value;
      void this.save();
    },
    setCircuitCollectionPreviewShowPieces(value: boolean) {
      this.circuitCollectionPreviewShowPieces = value;
      void this.save();
    },
    setCircuitEditorPiecePanelSplitRatio(value: number) {
      this.circuitEditorPiecePanelSplitRatio = value;
      void this.save();
    },
    setCircuitEditorPiecePanel(value: CircuitEditorPiecePanelState) {
      this.circuitEditorPiecePanel = {
        x: value.x,
        y: value.y,
        width: value.width,
        height: value.height,
        minimized: value.minimized,
        docked: value.docked,
      };
      void this.save();
    },
    setDetectPcDisableMobile(value: boolean) {
      this.detectPcDisableMobile = value;
      void this.save();
    },
    addCustomPackSource(source: { packId: string; label: string; mirrors: string[] }) {
      const safeId = normalizeCustomPackId(source.packId);
      if (!safeId) return;
      const mirrors = normalizeMirrors(source.mirrors);
      if (!mirrors.length) return;
      const existing = this.customPackSources.findIndex((s) => s.packId === safeId);
      if (existing >= 0) {
        this.customPackSources[existing] = { ...source, packId: safeId, mirrors };
      } else {
        this.customPackSources.push({ ...source, packId: safeId, mirrors });
      }
      void this.save();
    },
    removeCustomPackSource(packId: string) {
      this.customPackSources = this.customPackSources.filter((s) => s.packId !== packId);
      void this.save();
    },
    setUseDevPackMirrors(value: boolean) {
      this.useDevPackMirrors = value;
      void this.save();
    },
    setPackMirrorSelectionMode(packId: string, mode: 'auto' | 'manual') {
      this.packMirrorSelectionModeByPack = {
        ...this.packMirrorSelectionModeByPack,
        [packId]: mode,
      };
      void this.save();
    },
    setPackManualMirror(packId: string, url: string) {
      this.packManualMirrorByPack = {
        ...this.packManualMirrorByPack,
        [packId]: url,
      };
      void this.save();
    },
    setShowLoadingOverlay(value: boolean) {
      this.showLoadingOverlay = value;
      void this.save();
    },
    setQuantLineWidthScale(value: number) {
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0) return;
      this.quantLineWidthScale = n;
      void this.save();
    },
    setProductionLineG6Scale(value: number) {
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0) return;
      this.productionLineG6Scale = n;
      void this.save();
    },
    setProductionLineRenderer(value: 'vue_flow' | 'g6') {
      this.productionLineRenderer = value === 'g6' ? 'g6' : 'vue_flow';
      void this.save();
    },
    setQuantFlowRenderer(value: 'nodes' | 'sankey') {
      this.quantFlowRenderer = value === 'sankey' ? 'sankey' : 'nodes';
      void this.save();
    },
    setLineIntermediateColoring(value: boolean) {
      this.lineIntermediateColoring = value;
      void this.save();
    },
    setLineWidthByRate(value: boolean) {
      this.lineWidthByRate = value;
      void this.save();
    },
    setLineWidthCurveConfig(value: LineWidthCurveConfig) {
      this.lineWidthCurveConfig = sanitizeLineWidthCurveConfig(value);
      void this.save();
    },
    setItemListIconDisplayMode(value: ItemIconDisplayMode) {
      this.itemListIconDisplayMode = value === 'jei_classic' ? 'jei_classic' : 'modern';
      void this.save();
    },
    setFavoritesIconDisplayMode(value: ItemIconDisplayMode) {
      this.favoritesIconDisplayMode = value === 'jei_classic' ? 'jei_classic' : 'modern';
      void this.save();
    },
    setItemIconLoadingAnimation(value: boolean) {
      this.itemIconLoadingAnimation = value;
      void this.save();
    },
    setItemClickDefaultTab(value: ItemClickDefaultTab) {
      this.itemClickDefaultTab = normalizeItemClickDefaultTab(value) ?? 'recipes';
      void this.save();
    },
    setMachineCountDecimals(value: number) {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) return;
      this.machineCountDecimals = Math.max(0, Math.min(4, Math.floor(n)));
      void this.save();
    },
    setPluginEnabled(pluginId: string, enabled: boolean) {
      this.pluginEnabledById = {
        ...this.pluginEnabledById,
        [pluginId]: enabled,
      };
      void this.save();
    },
    setPluginSetting(pluginId: string, key: string, value: string | number | boolean) {
      const current = this.pluginSettingsById[pluginId] ?? {};
      this.pluginSettingsById = {
        ...this.pluginSettingsById,
        [pluginId]: {
          ...current,
          [key]: value,
        },
      };
      void this.save();
    },
    async save() {
      const json = JSON.stringify({
        historyLimit: this.historyLimit,
        favoritePageSizeMin: this.favoritePageSizeMin,
        favoritePageSizeMax: this.favoritePageSizeMax,
        debugLayout: this.debugLayout,
        debugNavPanel: this.debugNavPanel,
        recipeViewMode: this.recipeViewMode,
        recipeSlotShowName: this.recipeSlotShowName,
        selectedPack: this.selectedPack,
        favoritesCollapsed: this.favoritesCollapsed,
        panelCollapsed: this.panelCollapsed,
        darkMode: this.darkMode,
        language: this.language,
        debugPanelPos: this.debugPanelPos,
        acceptedStartupDialogs: this.acceptedStartupDialogs,
        completedTutorial: this.completedTutorial,
        favoritesOpensNewStack: this.favoritesOpensNewStack,
        persistHistoryRecords: this.persistHistoryRecords,
        hoverTooltipAllowMouseEnter: this.hoverTooltipAllowMouseEnter,
        hoverTooltipDisplay: this.hoverTooltipDisplay,
        wikiImageUseProxy: this.wikiImageUseProxy,
        wikiImageProxyUrl: this.wikiImageProxyUrl,
        wikiCatalogFileName: this.wikiCatalogFileName,
        packImageProxyUsePackProvided: this.packImageProxyUsePackProvided,
        packImageProxyUseManual: this.packImageProxyUseManual,
        packImageProxyUseDev: this.packImageProxyUseDev,
        packImageProxyManualUrl: this.packImageProxyManualUrl,
        packImageProxyDevUrl: this.packImageProxyDevUrl,
        packImageProxyAccessToken: this.packImageProxyAccessToken,
        packImageProxyAnonymousToken: this.packImageProxyAnonymousToken,
        packImageProxyFrameworkToken: this.packImageProxyFrameworkToken,
        circuitCollectionPreviewShowPieces: this.circuitCollectionPreviewShowPieces,
        circuitEditorPiecePanel: this.circuitEditorPiecePanel,
        circuitEditorPiecePanelSplitRatio: this.circuitEditorPiecePanelSplitRatio,
        detectPcDisableMobile: this.detectPcDisableMobile,
        customPackSources: this.customPackSources,
        useDevPackMirrors: this.useDevPackMirrors,
        packMirrorSelectionModeByPack: this.packMirrorSelectionModeByPack,
        packManualMirrorByPack: this.packManualMirrorByPack,
        showLoadingOverlay: this.showLoadingOverlay,
        quantLineWidthScale: this.quantLineWidthScale,
        productionLineG6Scale: this.productionLineG6Scale,
        productionLineRenderer: this.productionLineRenderer,
        quantFlowRenderer: this.quantFlowRenderer,
        lineIntermediateColoring: this.lineIntermediateColoring,
        lineWidthByRate: this.lineWidthByRate,
        lineWidthCurveConfig: this.lineWidthCurveConfig,
        itemListIconDisplayMode: this.itemListIconDisplayMode,
        favoritesIconDisplayMode: this.favoritesIconDisplayMode,
        itemIconLoadingAnimation: this.itemIconLoadingAnimation,
        itemClickDefaultTab: this.itemClickDefaultTab,
        machineCountDecimals: this.machineCountDecimals,
        pluginEnabledById: this.pluginEnabledById,
        pluginSettingsById: this.pluginSettingsById,
      });
      await saveSettingsJSON(json);
    },
    isUsingJEIStorage() {
      return isUsingJEIStorage();
    },
    /**
     * Reload settings from storage
     * Call this after JEIStorage async loading completes
     */
    reloadFromStorage() {
      const raw = getSettingsJSON();
      if (!raw) return;

      const parsed = JSON.parse(raw) as Partial<typeof this.$state>;

      // Update state with loaded values
      if (typeof parsed.historyLimit === 'number') this.historyLimit = parsed.historyLimit;
      if (
        typeof parsed.favoritePageSizeMin === 'number' &&
        Number.isFinite(parsed.favoritePageSizeMin) &&
        parsed.favoritePageSizeMin >= 2
      ) {
        this.favoritePageSizeMin = Math.max(
          2,
          Math.min(200, Math.floor(parsed.favoritePageSizeMin)),
        );
      }
      if (
        typeof parsed.favoritePageSizeMax === 'number' &&
        Number.isFinite(parsed.favoritePageSizeMax) &&
        parsed.favoritePageSizeMax >= 2
      ) {
        this.favoritePageSizeMax = Math.max(
          2,
          Math.min(400, Math.floor(parsed.favoritePageSizeMax)),
        );
      }
      if (this.favoritePageSizeMax < this.favoritePageSizeMin) {
        this.favoritePageSizeMax = this.favoritePageSizeMin;
      }
      if (typeof parsed.debugLayout === 'boolean') this.debugLayout = parsed.debugLayout;
      if (typeof parsed.debugNavPanel === 'boolean') this.debugNavPanel = parsed.debugNavPanel;
      if (parsed.recipeViewMode === 'panel' || parsed.recipeViewMode === 'dialog')
        this.recipeViewMode = parsed.recipeViewMode;
      if (typeof parsed.recipeSlotShowName === 'boolean')
        this.recipeSlotShowName = parsed.recipeSlotShowName;
      if (typeof parsed.selectedPack === 'string') this.selectedPack = parsed.selectedPack;
      if (typeof parsed.favoritesCollapsed === 'boolean')
        this.favoritesCollapsed = parsed.favoritesCollapsed;
      if (typeof parsed.panelCollapsed === 'boolean') this.panelCollapsed = parsed.panelCollapsed;
      if (parsed.darkMode === 'auto' || parsed.darkMode === 'light' || parsed.darkMode === 'dark') {
        this.darkMode = parsed.darkMode;
        Dark.set(darkModeToQuasar(parsed.darkMode));
      }
      if (parsed.language === 'zh-CN' || parsed.language === 'en-US' || parsed.language === 'ja-JP')
        this.language = parsed.language;
      if (parsed.debugPanelPos && typeof parsed.debugPanelPos.x === 'number')
        this.debugPanelPos = parsed.debugPanelPos;
      if (Array.isArray(parsed.acceptedStartupDialogs))
        this.acceptedStartupDialogs = parsed.acceptedStartupDialogs.filter(
          (x): x is string => typeof x === 'string',
        );
      if (typeof parsed.completedTutorial === 'boolean')
        this.completedTutorial = parsed.completedTutorial;
      if (typeof parsed.favoritesOpensNewStack === 'boolean')
        this.favoritesOpensNewStack = parsed.favoritesOpensNewStack;
      if (typeof parsed.persistHistoryRecords === 'boolean')
        this.persistHistoryRecords = parsed.persistHistoryRecords;
      if (typeof parsed.hoverTooltipAllowMouseEnter === 'boolean')
        this.hoverTooltipAllowMouseEnter = parsed.hoverTooltipAllowMouseEnter;
      this.hoverTooltipDisplay = normalizeHoverTooltipDisplaySettings(parsed.hoverTooltipDisplay);
      if (typeof parsed.wikiImageUseProxy === 'boolean')
        this.wikiImageUseProxy = parsed.wikiImageUseProxy;
      if (typeof parsed.wikiImageProxyUrl === 'string')
        this.wikiImageProxyUrl = parsed.wikiImageProxyUrl;
      if (typeof parsed.wikiCatalogFileName === 'string')
        this.wikiCatalogFileName = parsed.wikiCatalogFileName;
      if (typeof parsed.packImageProxyUsePackProvided === 'boolean')
        this.packImageProxyUsePackProvided = parsed.packImageProxyUsePackProvided;
      if (typeof parsed.packImageProxyUseManual === 'boolean')
        this.packImageProxyUseManual = parsed.packImageProxyUseManual;
      if (typeof parsed.packImageProxyUseDev === 'boolean')
        this.packImageProxyUseDev = parsed.packImageProxyUseDev;
      if (typeof parsed.packImageProxyManualUrl === 'string')
        this.packImageProxyManualUrl = parsed.packImageProxyManualUrl;
      if (typeof parsed.packImageProxyDevUrl === 'string')
        this.packImageProxyDevUrl = parsed.packImageProxyDevUrl;
      if (typeof parsed.packImageProxyAccessToken === 'string')
        this.packImageProxyAccessToken = parsed.packImageProxyAccessToken;
      if (typeof parsed.packImageProxyAnonymousToken === 'string')
        this.packImageProxyAnonymousToken = parsed.packImageProxyAnonymousToken;
      if (typeof parsed.packImageProxyFrameworkToken === 'string')
        this.packImageProxyFrameworkToken = parsed.packImageProxyFrameworkToken;
      if (typeof parsed.showLoadingOverlay === 'boolean')
        this.showLoadingOverlay = parsed.showLoadingOverlay;
      if (
        typeof parsed.quantLineWidthScale === 'number' &&
        Number.isFinite(parsed.quantLineWidthScale) &&
        parsed.quantLineWidthScale > 0
      ) {
        this.quantLineWidthScale = parsed.quantLineWidthScale;
      }
      if (
        typeof parsed.productionLineG6Scale === 'number' &&
        Number.isFinite(parsed.productionLineG6Scale) &&
        parsed.productionLineG6Scale > 0
      ) {
        this.productionLineG6Scale = parsed.productionLineG6Scale;
      }
      if (parsed.productionLineRenderer === 'g6' || parsed.productionLineRenderer === 'vue_flow') {
        this.productionLineRenderer = parsed.productionLineRenderer;
      }
      if (parsed.quantFlowRenderer === 'sankey' || parsed.quantFlowRenderer === 'nodes') {
        this.quantFlowRenderer = parsed.quantFlowRenderer;
      }
      if (typeof parsed.lineIntermediateColoring === 'boolean') {
        this.lineIntermediateColoring = parsed.lineIntermediateColoring;
      }
      if (typeof parsed.lineWidthByRate === 'boolean') {
        this.lineWidthByRate = parsed.lineWidthByRate;
      }
      if (parsed.lineWidthCurveConfig && typeof parsed.lineWidthCurveConfig === 'object') {
        this.lineWidthCurveConfig = sanitizeLineWidthCurveConfig(
          parsed.lineWidthCurveConfig as unknown as LineWidthCurveConfig,
        );
      }
      const itemListIconDisplayMode = normalizeItemIconDisplayMode(parsed.itemListIconDisplayMode);
      if (itemListIconDisplayMode) {
        this.itemListIconDisplayMode = itemListIconDisplayMode;
      }
      const favoritesIconDisplayMode = normalizeItemIconDisplayMode(
        parsed.favoritesIconDisplayMode,
      );
      if (favoritesIconDisplayMode) {
        this.favoritesIconDisplayMode = favoritesIconDisplayMode;
      }
      if (typeof parsed.itemIconLoadingAnimation === 'boolean') {
        this.itemIconLoadingAnimation = parsed.itemIconLoadingAnimation;
      }
      const itemClickDefaultTab = normalizeItemClickDefaultTab(parsed.itemClickDefaultTab);
      if (itemClickDefaultTab) {
        this.itemClickDefaultTab = itemClickDefaultTab;
      }
      if (
        typeof parsed.machineCountDecimals === 'number' &&
        Number.isFinite(parsed.machineCountDecimals) &&
        parsed.machineCountDecimals >= 0
      ) {
        this.machineCountDecimals = Math.max(
          0,
          Math.min(4, Math.floor(parsed.machineCountDecimals)),
        );
      }
      if (typeof parsed.circuitCollectionPreviewShowPieces === 'boolean')
        this.circuitCollectionPreviewShowPieces = parsed.circuitCollectionPreviewShowPieces;
      if (typeof parsed.circuitEditorPiecePanelSplitRatio === 'number')
        this.circuitEditorPiecePanelSplitRatio = parsed.circuitEditorPiecePanelSplitRatio;
      if (typeof parsed.detectPcDisableMobile === 'boolean')
        this.detectPcDisableMobile = parsed.detectPcDisableMobile;
      if (Array.isArray(parsed.customPackSources)) {
        this.customPackSources = parsed.customPackSources
          .map((x) => normalizeCustomPackSource(x))
          .filter((x): x is { packId: string; label: string; mirrors: string[] } => x !== null);
      }
      if (typeof parsed.useDevPackMirrors === 'boolean') {
        this.useDevPackMirrors = parsed.useDevPackMirrors;
      }
      if (
        parsed.packMirrorSelectionModeByPack &&
        typeof parsed.packMirrorSelectionModeByPack === 'object'
      ) {
        this.packMirrorSelectionModeByPack = Object.fromEntries(
          Object.entries(parsed.packMirrorSelectionModeByPack).filter(
            (entry): entry is [string, 'auto' | 'manual'] =>
              entry[1] === 'auto' || entry[1] === 'manual',
          ),
        );
      }
      if (parsed.packManualMirrorByPack && typeof parsed.packManualMirrorByPack === 'object') {
        this.packManualMirrorByPack = Object.fromEntries(
          Object.entries(parsed.packManualMirrorByPack).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
          ),
        );
      }
      if (parsed.pluginEnabledById && typeof parsed.pluginEnabledById === 'object') {
        this.pluginEnabledById = Object.fromEntries(
          Object.entries(parsed.pluginEnabledById).filter(
            (entry): entry is [string, boolean] => typeof entry[1] === 'boolean',
          ),
        );
      }
      if (parsed.pluginSettingsById && typeof parsed.pluginSettingsById === 'object') {
        this.pluginSettingsById = Object.fromEntries(
          Object.entries(parsed.pluginSettingsById)
            .filter(
              (entry): entry is [string, Record<string, string | number | boolean>] =>
                typeof entry[1] === 'object' && !!entry[1],
            )
            .map(([pluginId, values]) => [
              pluginId,
              Object.fromEntries(
                Object.entries(values).filter(
                  (valueEntry): valueEntry is [string, string | number | boolean] =>
                    typeof valueEntry[1] === 'string' ||
                    typeof valueEntry[1] === 'number' ||
                    typeof valueEntry[1] === 'boolean',
                ),
              ),
            ]),
        );
      }
    },
  },
});

/**
 * Initialize settings store from storage
 * Call this during app initialization before creating the store
 */
export async function initSettingsStore() {
  await initSettings();
}

/**
 * Setup settings store to auto-reload when JEIStorage loading completes
 * Call this after creating the store instance
 */
export function setupSettingsStoreAutoReload(store: ReturnType<typeof useSettingsStore>) {
  onSettingsLoaded(() => {
    console.log('[Settings] Reloading store from async storage...');
    void store.reloadFromStorage();
  });
}
