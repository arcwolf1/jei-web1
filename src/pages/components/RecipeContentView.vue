<template>
  <div class="fit column">
    <!-- Planner 标签页 -->
    <crafting-planner-view
      v-if="pack && index && currentItemKey"
      v-show="activeTab === 'planner'"
      class="col overflow-auto q-pa-md"
      :pack="pack"
      :index="index"
      :root-item-key="currentItemKey"
      :item-defs-by-key-hash="itemDefsByKeyHash"
      :initial-state="plannerInitialState"
      :initial-tab="plannerTab"
      @item-click="$emit('item-click', $event)"
      @save-plan="$emit('save-plan', $event)"
      @share-plan="$emit('share-plan', $event)"
      @share-plan-json-url="$emit('share-plan-json-url', $event)"
      @state-change="$emit('state-change', $event)"
      @item-mouseenter="$emit('item-mouseenter', $event)"
      @item-mouseleave="$emit('item-mouseleave')"
    />

    <!-- Wiki 标签页内容 -->
    <div v-show="activeTab === 'wiki'" class="col overflow-auto q-pa-md">
      <div v-if="currentItemDef" class="column q-gutter-md">
        <div class="text-h5">{{ currentItemDef.name }}</div>
        <q-separator />
        <div class="row q-gutter-md">
          <div class="col-auto">
            <stack-view
              :content="{
                kind: 'item',
                id: currentItemDef.key.id,
                amount: 1,
                ...(currentItemDef.key.meta !== undefined ? { meta: currentItemDef.key.meta } : {}),
                ...(currentItemDef.key.nbt !== undefined ? { nbt: currentItemDef.key.nbt } : {}),
              }"
              :item-defs-by-key-hash="itemDefsByKeyHash"
            />
          </div>
          <div class="col column q-gutter-sm">
            <div class="text-caption text-grey-8">{{ t('itemId') }}</div>
            <div class="text-body2">{{ currentItemDef.key.id }}</div>
            <div
              v-if="currentItemDef.key.meta !== undefined"
              class="text-caption text-grey-8 q-mt-sm"
            >
              Meta
            </div>
            <div v-if="currentItemDef.key.meta !== undefined" class="text-body2">
              {{ currentItemDef.key.meta }}
            </div>
          </div>
        </div>
        <q-separator />

        <template v-if="hasExtensionWikiRenderers">
          <div class="wiki-renderer-stack column q-gutter-lg">
            <section
              v-for="renderer in extensionWikiRenderers"
              :key="renderer.id"
              class="wiki-renderer-section"
            >
              <div v-if="renderer.title" class="text-subtitle2 q-mb-sm">{{ renderer.title }}</div>

              <template v-if="renderer.type === 'structured-wiki' && renderer.structured">
                <div v-if="renderer.structured.briefDescriptionDocument" class="wiki-brief">
                  <div class="text-subtitle2 q-mb-sm">{{ t('description') }}</div>
                  <WikiDocument :document="renderer.structured.briefDescriptionDocument" />
                </div>

                <div class="wiki-body">
                  <template v-if="renderer.structured.chapterGroup.length">
                    <WikiChapterGroup
                      v-for="group in renderer.structured.chapterGroup"
                      :key="group.title"
                      :group="group"
                      :widget-common-map="renderer.structured.widgetCommonMap"
                      :document-map="renderer.structured.documentMap"
                    />
                  </template>

                  <template v-else>
                    <div class="fallback-docs">
                      <section
                        v-for="(doc, docId) in renderer.structured.documentMap"
                        :key="docId"
                        class="fallback-section q-mb-md"
                      >
                        <div class="text-subtitle2 q-mb-sm">{{ getDocumentTitle(doc, docId) }}</div>
                        <WikiDocument :document="doc" />
                      </section>
                    </div>
                  </template>
                </div>
              </template>

              <div
                v-else-if="renderer.type === 'markdown'"
                class="wiki-description"
                v-html="renderer.markdownHtml"
                @click="handleWikiDescriptionClick"
              ></div>

              <div
                v-else-if="renderer.type === 'description'"
                class="wiki-description"
                v-html="renderer.markdownHtml"
                @click="handleWikiDescriptionClick"
              ></div>

              <div
                v-else-if="renderer.type === 'simple-v1'"
                class="wiki-simple"
                @click="handleWikiDescriptionClick"
              >
                <SimpleWikiRenderer :source="renderer.simpleSource" />
              </div>
            </section>
          </div>
          <q-separator />
        </template>

        <template v-else-if="hasStructuredWiki">
          <div v-if="briefDescriptionDocument" class="wiki-brief">
            <div class="text-subtitle2 q-mb-sm">{{ t('description') }}</div>
            <WikiDocument :document="briefDescriptionDocument" />
          </div>

          <div class="wiki-body">
            <template v-if="chapterGroup.length">
              <WikiChapterGroup
                v-for="group in chapterGroup"
                :key="group.title"
                :group="group"
                :widget-common-map="widgetCommonMap"
                :document-map="documentMap"
              />
            </template>

            <template v-else>
              <div class="fallback-docs">
                <section
                  v-for="(doc, docId) in documentMap"
                  :key="docId"
                  class="fallback-section q-mb-md"
                >
                  <div class="text-subtitle2 q-mb-sm">{{ getDocumentTitle(doc, docId) }}</div>
                  <WikiDocument :document="doc" />
                </section>
              </div>
            </template>
          </div>
          <q-separator />
        </template>

        <template v-else>
          <div v-if="currentItemDef.description">
            <div class="text-subtitle2 q-mb-sm">{{ t('description') }}</div>
            <div
              class="wiki-description"
              v-html="renderedDescription"
              @click="handleWikiDescriptionClick"
            ></div>
          </div>
          <q-separator v-if="currentItemDef.description" />
        </template>

        <div>
          <div class="text-subtitle2 q-mb-sm">{{ t('tags') }}</div>
          <div v-if="currentItemDef.tags?.length" class="row q-gutter-xs">
            <q-badge v-for="tag in currentItemDef.tags" :key="tag" color="grey-7">
              {{ tag }}
            </q-badge>
          </div>
          <div v-else class="text-caption text-grey-7">{{ t('noTags') }}</div>
        </div>
      </div>
    </div>

    <!-- Icon 标签页内容 -->
    <div v-show="activeTab === 'icon'" class="col overflow-auto q-pa-md">
      <div v-if="currentItemDef" class="column q-gutter-md">
        <div class="text-h6">{{ t('tabsIcon') }}</div>
        <div v-if="iconViewerSrc" class="icon-tab-viewer">
          <InlineImageViewer :src="iconViewerSrc" :name="iconViewerName" />
        </div>
        <div v-else class="text-caption text-grey-7">{{ t('noIconFound') }}</div>

        <div v-if="iconViewerSrc" class="row q-gutter-sm">
          <q-chip dense outline color="primary">
            {{ iconSourceLabel }}
          </q-chip>
          <q-chip v-if="currentItemDef.iconSprite?.position" dense outline color="grey-7">
            sprite: {{ currentItemDef.iconSprite.position }}
          </q-chip>
          <q-chip v-if="currentItemDef.iconSprite?.size" dense outline color="grey-7">
            size: {{ currentItemDef.iconSprite.size }}
          </q-chip>
          <q-btn
            flat
            dense
            icon="open_in_full"
            :label="t('openImageViewer')"
            @click="openViewer(iconViewerSrc, iconViewerName)"
          />
        </div>

        <div v-if="currentItemDef.iconSprite && iconSpriteSrc" class="icon-tab-sprite-preview">
          <div class="icon-tab-sprite" :style="iconSpritePreviewStyle">
            <div class="icon-tab-sprite-image" :style="iconSpritePreviewImageStyle" />
          </div>
        </div>
      </div>
    </div>

    <q-dialog v-model="viewerOpen" maximized>
      <q-card class="column" style="height: 100%">
        <q-card-section class="row items-center">
          <div class="text-subtitle1 ellipsis">{{ viewerName }}</div>
          <q-space />
          <q-btn flat round icon="close" v-close-popup />
        </q-card-section>
        <q-separator />
        <q-card-section class="col q-pa-none">
          <InlineImageViewer v-if="viewerSrc" :src="viewerSrc" :name="viewerName" />
        </q-card-section>
      </q-card>
    </q-dialog>

    <template v-for="tab in pluginTabs" :key="tab.tabKey">
      <div v-if="tab.iframe" v-show="activeTab === tab.tabKey" class="col column">
        <plugin-iframe-tab
          v-if="isPluginTabMounted(tab.tabKey, tab.iframe.keepAlive)"
          class="col"
          :plugin-id="tab.pluginId"
          :src="tab.iframe.src(pluginContext) ?? ''"
          :allowed-origins="tab.iframe.allowedOrigins"
          v-bind="{
            ...(tab.iframe.sandbox ? { sandbox: tab.iframe.sandbox } : {}),
            ...(tab.iframe.noApi ? { noApi: true } : {}),
          }"
          :context="pluginContext"
        />
      </div>

      <div v-else-if="tab.api" v-show="activeTab === tab.tabKey" class="col overflow-auto q-pa-md">
        <div v-if="pluginApiState.loading" class="row items-center q-gutter-sm">
          <q-spinner size="18px" />
          <span>插件 API 查询中...</span>
        </div>
        <q-banner v-else-if="pluginApiState.error" dense class="bg-red-1 text-negative">
          {{ pluginApiState.error }}
        </q-banner>
        <div v-else-if="pluginApiState.result" class="column q-gutter-sm">
          <div class="text-subtitle2">{{ pluginApiState.result.title }}</div>
          <div v-if="pluginApiState.result.summary" class="text-caption text-grey-8">
            {{ pluginApiState.result.summary }}
          </div>
          <q-list
            v-if="pluginApiState.result.blocks?.length"
            dense
            bordered
            separator
            class="rounded-borders"
          >
            <q-item v-for="block in pluginApiState.result.blocks" :key="block.label">
              <q-item-section>{{ block.label }}</q-item-section>
              <q-item-section side>{{ block.value }}</q-item-section>
            </q-item>
          </q-list>
          <div v-if="pluginApiState.result.links?.length" class="row q-gutter-sm">
            <q-btn
              v-for="link in pluginApiState.result.links"
              :key="link.url"
              dense
              flat
              color="primary"
              icon="open_in_new"
              :label="link.label"
              :href="link.url"
              target="_blank"
              rel="noopener noreferrer"
            />
          </div>
        </div>
        <div v-else class="text-caption text-grey-7">当前插件标签页没有可展示内容</div>
      </div>
    </template>

    <!-- Recipes/Uses 标签页 -->
    <div
      v-show="activeTab === 'recipes' || activeTab === 'uses'"
      class="col overflow-auto"
      :class="containerClass"
    >
      <div v-if="activeRecipeGroups.length" class="jei-type-layout">
        <div v-if="typeMachineIcons.length" class="jei-type-sidebar">
          <q-btn
            v-for="m in typeMachineIcons"
            :key="m.typeKey"
            flat
            dense
            class="jei-type-sidebar__btn"
            :color="m.typeKey === activeTypeKey ? 'primary' : 'grey-7'"
            :class="{ 'jei-type-sidebar__btn--active': m.typeKey === activeTypeKey }"
            @click="$emit('machine-item-click', m.machineItemId)"
          >
            <stack-view
              :content="{ kind: 'item', id: m.machineItemId, amount: 1 }"
              :item-defs-by-key-hash="itemDefsByKeyHash"
              variant="slot"
              :show-name="false"
              :show-subtitle="false"
              :lazy-visual="true"
            />
          </q-btn>
        </div>

        <div class="jei-type-main">
          <q-tabs
            :model-value="activeTypeKey"
            @update:model-value="$emit('update:active-type-key', $event)"
            dense
            outside-arrows
            mobile-arrows
            inline-label
            class="q-px-sm q-pt-sm"
          >
            <q-tab
              v-for="g in activeRecipeGroups"
              :key="g.typeKey"
              :name="g.typeKey"
              :label="`${g.label} (${g.recipeIds.length})`"
            />
          </q-tabs>
          <q-separator />

          <q-tab-panels
            :model-value="activeTypeKey"
            @update:model-value="$emit('update:active-type-key', String($event))"
            animated
            :class="panelClass"
          >
            <q-tab-panel
              v-for="g in activeRecipeGroups"
              :key="g.typeKey"
              :name="g.typeKey"
              class="q-pa-md"
            >
              <!-- "全部"分组：按配方类型分组显示 -->
              <template v-if="g.isAll">
                <div class="column q-gutter-lg">
                  <div
                    v-for="subGroup in allRecipeGroups"
                    :key="subGroup.typeKey"
                    class="column q-gutter-md"
                  >
                    <div class="row items-center q-gutter-sm text-subtitle2">
                      <span>{{ subGroup.label }}</span>
                      <div v-if="subGroup.machines.length" class="row items-center q-gutter-xs">
                        <q-icon name="precision_manufacturing" size="16px" color="grey-7" />
                        <stack-view
                          v-for="m in subGroup.machines"
                          :key="m.machineItemId"
                          :content="{ kind: 'item', id: m.machineItemId, amount: 1 }"
                          :item-defs-by-key-hash="itemDefsByKeyHash"
                          variant="slot"
                          :show-name="false"
                          :show-subtitle="false"
                          :lazy-visual="true"
                          class="cursor-pointer"
                          @item-click="$emit('machine-item-click', m.machineItemId)"
                        />
                      </div>
                    </div>
                    <q-separator />
                    <div class="column q-gutter-md">
                      <q-card
                        v-for="rid in subGroup.recipeIds"
                        :key="rid"
                        flat
                        bordered
                        class="q-pa-md"
                      >
                        <recipe-viewer
                          v-if="recipesById.get(rid)"
                          :recipe="recipesById.get(rid)"
                          :recipe-type="recipeTypesByKey.get(recipesById.get(rid)?.type || '')"
                          :item-defs-by-key-hash="itemDefsByKeyHash"
                          :lazy-visual="true"
                          @ensure-recipe-detail="$emit('ensure-recipe-detail', $event)"
                          @item-click="$emit('item-click', $event)"
                          @item-mouseenter="$emit('item-mouseenter', $event)"
                          @item-mouseleave="$emit('item-mouseleave')"
                          @item-context-menu="(...args) => $emit('item-context-menu', ...args)"
                          @item-touch-hold="(...args) => $emit('item-touch-hold', ...args)"
                        />
                      </q-card>
                    </div>
                  </div>
                </div>
              </template>
              <!-- 普通分组：直接显示配方列表 -->
              <template v-else>
                <div class="column q-gutter-md">
                  <q-card v-for="rid in g.recipeIds" :key="rid" flat bordered class="q-pa-md">
                    <recipe-viewer
                      v-if="recipesById.get(rid)"
                      :recipe="recipesById.get(rid)"
                      :recipe-type="recipeTypesByKey.get(recipesById.get(rid)?.type || '')"
                      :item-defs-by-key-hash="itemDefsByKeyHash"
                      :lazy-visual="true"
                      @ensure-recipe-detail="$emit('ensure-recipe-detail', $event)"
                      @item-click="$emit('item-click', $event)"
                      @item-mouseenter="$emit('item-mouseenter', $event)"
                      @item-mouseleave="$emit('item-mouseleave')"
                      @item-context-menu="(...args) => $emit('item-context-menu', ...args)"
                      @item-touch-hold="(...args) => $emit('item-touch-hold', ...args)"
                    />
                  </q-card>
                </div>
              </template>
            </q-tab-panel>
          </q-tab-panels>
        </div>
      </div>
      <div v-else class="q-pa-md text-caption">{{ t('noRecipesFound') }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, provide, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import MarkdownIt from 'markdown-it';
import type { PackData, ItemDef, ItemKey, ItemExtensions, JeiWebWikiRendererDef } from 'src/jei/types';
import type { JeiIndex } from 'src/jei/indexing/buildIndex';
import { itemKeyHash } from 'src/jei/indexing/key';
import type { PlannerInitialState, PlannerLiveState } from 'src/jei/planner/plannerUi';
import type { PluginApiResult, PluginItemContext, PluginTabRuntime } from 'src/jei/plugins/types';
import { useSettingsStore } from 'src/stores/settings';
import StackView from 'src/jei/components/StackView.vue';
import RecipeViewer from 'src/jei/components/RecipeViewer.vue';
import CraftingPlannerView from 'src/jei/components/CraftingPlannerView.vue';
import WikiDocument from 'src/components/wiki/WikiDocument.vue';
import WikiChapterGroup from 'src/components/wiki/layout/WikiChapterGroup.vue';
import SimpleWikiRenderer from 'src/components/wiki/SimpleWikiRenderer.vue';
import InlineImageViewer from 'src/components/InlineImageViewer.vue';
import PluginIframeTab from './PluginIframeTab.vue';
import { useCachedImageUrl, useRuntimeImageUrl } from 'src/jei/pack/runtimeImage';
import type {
  ChapterGroup,
  Document,
  WikiItem,
  WidgetCommon,
  CatalogItemMap,
} from 'src/types/wiki';

const { t } = useI18n();
const settingsStore = useSettingsStore();

interface RecipeGroup {
  typeKey: string;
  label: string;
  recipeIds: string[];
  isAll?: boolean;
  machines: Array<{ typeKey: string; machineItemId: string }>;
}

interface MachineIcon {
  typeKey: string;
  machineItemId: string;
}

const props = defineProps<{
  pack: PackData | null;
  index: JeiIndex | null;
  currentItemKey: ItemKey | null;
  currentItemDef: ItemDef | null;
  itemDefsByKeyHash: Record<string, ItemDef>;
  renderedDescription: string;
  activeTab: string;
  activeTypeKey: string;
  activeRecipeGroups: RecipeGroup[];
  allRecipeGroups: RecipeGroup[];
  typeMachineIcons: MachineIcon[];
  recipesById: Map<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  recipeTypesByKey: Map<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  plannerInitialState: PlannerInitialState | null;
  plannerTab: 'tree' | 'graph' | 'line' | 'calc' | 'quant';
  pluginContext: PluginItemContext;
  pluginTabs: PluginTabRuntime[];
  resolvePluginApi: (
    pluginId: string,
    queryId: string,
    signal: AbortSignal,
  ) => Promise<PluginApiResult | null>;
  containerClass?: string;
  panelClass?: string;
}>();

const mountedPluginTabs = ref<Record<string, boolean>>({});

watch(
  () => [props.activeTab, props.pluginTabs] as const,
  ([tab, tabs]) => {
    // 只有声明了 keepAlive 的 Tab 才会被记录在 mountedPluginTabs 中
    if (tab) {
      const currentTab = tabs.find((it) => it.tabKey === tab);
      if (currentTab?.iframe?.keepAlive) {
        mountedPluginTabs.value = {
          ...mountedPluginTabs.value,
          [tab]: true,
        };
      }
    }
    const validKeys = new Set(tabs.map((it) => it.tabKey));
    mountedPluginTabs.value = Object.fromEntries(
      Object.entries(mountedPluginTabs.value).filter(([key]) => validKeys.has(key)),
    );
  },
  { immediate: true },
);

function isPluginTabMounted(tabKey: string, keepAlive?: boolean): boolean {
  // 如果当前是激活状态，总是渲染
  if (props.activeTab === tabKey) return true;
  // 如果声明了 keepAlive 且之前挂载过，则保持渲染
  if (keepAlive && mountedPluginTabs.value[tabKey]) return true;
  return false;
}

const markdownRenderer = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

type SupportedWikiRendererType = 'structured-wiki' | 'simple-v1' | 'markdown' | 'description';

interface StructuredWikiRenderData {
  briefDescriptionDocument: Document | null;
  documentMap: Record<string, Document>;
  chapterGroup: ChapterGroup[];
  widgetCommonMap: Record<string, WidgetCommon>;
}

interface PreparedWikiRenderer {
  id: string;
  type: SupportedWikiRendererType;
  order: number;
  title?: string;
  markdownHtml?: string;
  simpleSource?: unknown;
  structured?: StructuredWikiRenderData;
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeWikiItem(raw: unknown): WikiItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const dataItem = (raw as { data?: { item?: unknown } }).data?.item;
  if (dataItem && typeof dataItem === 'object') return dataItem as WikiItem;
  const item = (raw as { item?: unknown }).item;
  if (item && typeof item === 'object') return item as WikiItem;
  if ((raw as { itemId?: unknown }).itemId) return raw as WikiItem;
  return null;
}

function normalizeDocument(raw: unknown): Document | null {
  if (!isRecordLike(raw)) return null;
  if (!Array.isArray(raw.blockIds)) return null;
  if (!isRecordLike(raw.blockMap)) return null;
  return raw as unknown as Document;
}

function buildStructuredWikiRenderData(raw: unknown): StructuredWikiRenderData | null {
  const item = normalizeWikiItem(raw);
  if (!item) return null;
  const documentMap = isRecordLike(item.document?.documentMap) ? item.document.documentMap : {};
  const chapterGroup = Array.isArray(item.document?.chapterGroup) ? item.document.chapterGroup : [];
  const widgetCommonMap = isRecordLike(item.document?.widgetCommonMap)
    ? item.document.widgetCommonMap
    : {};
  const briefDescriptionDocument = normalizeDocument(item.brief?.description);
  if (!Object.keys(documentMap).length && !briefDescriptionDocument) return null;
  return {
    briefDescriptionDocument,
    documentMap,
    chapterGroup,
    widgetCommonMap,
  };
}

function normalizeRendererType(rawType: unknown): SupportedWikiRendererType | null {
  if (typeof rawType !== 'string') return null;
  const type = rawType.trim().toLowerCase();
  if (!type) return null;
  if (
    type === 'structured-wiki' ||
    type === 'structured' ||
    type === 'wiki-document' ||
    type === 'legacy-structured'
  ) {
    return 'structured-wiki';
  }
  if (type === 'simple-v1' || type === 'simple' || type === 'legacy-simple') {
    return 'simple-v1';
  }
  if (type === 'markdown' || type === 'md') {
    return 'markdown';
  }
  if (type === 'description' || type === 'legacy-description') {
    return 'description';
  }
  return null;
}

function pickTextContent(raw: unknown): string {
  if (typeof raw === 'string') return raw.trim();
  if (!isRecordLike(raw)) return '';
  if (typeof raw.content === 'string') return raw.content.trim();
  if (typeof raw.text === 'string') return raw.text.trim();
  if (typeof raw.markdown === 'string') return raw.markdown.trim();
  return '';
}

function renderMarkdownHtml(raw: unknown): string {
  const text = pickTextContent(raw);
  if (!text) return '';
  return markdownRenderer.render(text).trim();
}

function hasSimpleWikiContent(raw: unknown): boolean {
  if (typeof raw === 'string') return raw.trim().length > 0;
  if (Array.isArray(raw)) return raw.length > 0;
  if (!isRecordLike(raw)) return false;
  if (Array.isArray(raw.blocks)) return raw.blocks.length > 0;
  return pickTextContent(raw).length > 0;
}

function resolveLegacyRendererSource(type: SupportedWikiRendererType): unknown {
  if (type === 'structured-wiki' || type === 'simple-v1') return props.currentItemDef?.wiki;
  return props.currentItemDef?.description;
}

function resolveRendererSourceFromRef(
  sourceRef: string | undefined,
  sources: Record<string, unknown>,
): unknown {
  if (!sourceRef) return undefined;
  if (sourceRef === '$legacy.wiki') return props.currentItemDef?.wiki;
  if (sourceRef === '$legacy.description') return props.currentItemDef?.description;
  return sources[sourceRef];
}

function getJeiwebWikiConfig(
  extensions: ItemExtensions | undefined,
): { renderers: JeiWebWikiRendererDef[]; sources: Record<string, unknown> } | null {
  const jeiweb = extensions?.jeiweb;
  if (!isRecordLike(jeiweb)) return null;
  const wiki = jeiweb.wiki;
  if (!isRecordLike(wiki)) return null;
  const renderers = Array.isArray(wiki.renderers)
    ? (wiki.renderers.filter((entry) => isRecordLike(entry)) as JeiWebWikiRendererDef[])
    : [];
  const sources = isRecordLike(wiki.sources) ? wiki.sources : {};
  return { renderers, sources };
}

const legacyStructuredWikiData = computed(() =>
  buildStructuredWikiRenderData(props.currentItemDef?.wiki),
);
const hasStructuredWiki = computed(() => Boolean(legacyStructuredWikiData.value));

const documentMap = computed<Record<string, Document>>(() => {
  return legacyStructuredWikiData.value?.documentMap || {};
});

const chapterGroup = computed<ChapterGroup[]>(() => {
  return legacyStructuredWikiData.value?.chapterGroup || [];
});

const widgetCommonMap = computed<Record<string, WidgetCommon>>(() => {
  return legacyStructuredWikiData.value?.widgetCommonMap || {};
});

const briefDescriptionDocument = computed<Document | null>(() => {
  return legacyStructuredWikiData.value?.briefDescriptionDocument || null;
});

const extensionWikiRenderers = computed<PreparedWikiRenderer[]>(() => {
  const config = getJeiwebWikiConfig(props.currentItemDef?.extensions);
  if (!config?.renderers.length) return [];

  const prepared = config.renderers
    .map((entry, index): { index: number; renderer: PreparedWikiRenderer } | null => {
      if (entry.enabled === false) return null;
      const type = normalizeRendererType(entry.type);
      if (!type) return null;
      const order =
        typeof entry.order === 'number' && Number.isFinite(entry.order) ? entry.order : index * 10;
      const title =
        typeof entry.title === 'string' && entry.title.trim().length > 0
          ? entry.title.trim()
          : undefined;
      const sourceRef = typeof entry.source === 'string' ? entry.source.trim() : undefined;
      const source =
        entry.data !== undefined
          ? entry.data
          : (resolveRendererSourceFromRef(sourceRef, config.sources) ??
            resolveLegacyRendererSource(type));

      if (type === 'structured-wiki') {
        const structured = buildStructuredWikiRenderData(source);
        if (!structured) return null;
        return {
          index,
          renderer: {
            id: entry.id || `renderer-${index}`,
            type,
            order,
            ...(title !== undefined ? { title } : {}),
            structured,
          },
        };
      }

      if (type === 'simple-v1') {
        if (!hasSimpleWikiContent(source)) return null;
        return {
          index,
          renderer: {
            id: entry.id || `renderer-${index}`,
            type,
            order,
            ...(title !== undefined ? { title } : {}),
            simpleSource: source,
          },
        };
      }

      const markdownHtml =
        type === 'description' && source === props.currentItemDef?.description
          ? (props.renderedDescription || renderMarkdownHtml(source))
          : renderMarkdownHtml(source);
      if (!markdownHtml) return null;
      return {
        index,
        renderer: {
          id: entry.id || `renderer-${index}`,
          type,
          order,
          ...(title !== undefined ? { title } : {}),
          markdownHtml,
        },
      };
    })
    .filter((entry): entry is { index: number; renderer: PreparedWikiRenderer } => entry !== null)
    .sort((a, b) => a.renderer.order - b.renderer.order || a.index - b.index)
    .map((entry) => entry.renderer);

  return prepared;
});

const hasExtensionWikiRenderers = computed(() => extensionWikiRenderers.value.length > 0);

function getDocumentTitle(doc: Document, fallback: string) {
  for (const blockId of doc.blockIds || []) {
    const block = doc.blockMap?.[blockId];
    if (!block || block.kind !== 'text') continue;
    const kind = block.text?.kind || '';
    if (!kind.startsWith('heading') && kind !== 'title' && kind !== 'subtitle') continue;
    const text = (block.text?.inlineElements || [])
      .filter((el) => el.kind === 'text')
      .map((el) => el.text?.text || '')
      .join('')
      .trim();
    if (text) return text;
  }
  return fallback;
}

const wikiCatalogMap = computed<CatalogItemMap>(() => {
  const out: CatalogItemMap = {};
  const values = Object.values(props.itemDefsByKeyHash || {});
  for (const item of values) {
    const m = String(item?.key?.id || '').match(/item_(\d+)$/);
    if (!m?.[1]) continue;
    const id = m[1];
    out[id] = {
      itemId: id,
      name: item.name || id,
      cover: item.icon || item.iconSprite?.url || '',
      fullId: item.key.id,
    };
  }
  return out;
});

const imageUseProxy = computed(() => settingsStore.wikiImageUseProxy);
const imageProxyUrl = computed(() => settingsStore.wikiImageProxyUrl);
const iconSrcRaw = computed(() => props.currentItemDef?.icon ?? '');
const iconSrc = useCachedImageUrl(useRuntimeImageUrl(iconSrcRaw));
const iconSpriteSrcRaw = computed(() => props.currentItemDef?.iconSprite?.url ?? '');
const iconSpriteSrc = useCachedImageUrl(useRuntimeImageUrl(iconSpriteSrcRaw));
const iconViewerSrc = computed(() => iconSrc.value || iconSpriteSrc.value || '');
const iconViewerName = computed(() => props.currentItemDef?.name ?? '');
const iconSourceLabel = computed(() =>
  iconSrc.value ? t('iconSourceIcon') : t('iconSourceSprite'),
);
const viewerOpen = ref(false);
const viewerSrc = ref('');
const viewerName = ref('');
const pluginApiState = ref<{
  loading: boolean;
  error: string;
  result: PluginApiResult | null;
}>({
  loading: false,
  error: '',
  result: null,
});
let pluginAbortController: AbortController | null = null;

const pluginTabRuntime = computed(
  () => props.pluginTabs.find((it) => it.tabKey === props.activeTab) ?? null,
);

const iconSpritePreviewStyle = computed(() => {
  const sprite = props.currentItemDef?.iconSprite;
  if (!sprite) return {};
  return {
    backgroundColor: sprite.color ?? 'transparent',
  };
});

const iconSpritePreviewImageStyle = computed(() => {
  const sprite = props.currentItemDef?.iconSprite;
  if (!sprite) return {};
  const size = sprite.size ?? 64;
  const scale = 72 / size;
  return {
    width: `${size}px`,
    height: `${size}px`,
    backgroundImage: iconSpriteSrc.value ? `url(${iconSpriteSrc.value})` : 'none',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: sprite.position,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
  };
});

const emit = defineEmits<{
  'item-click': [keyHash: ItemKey];
  'wiki-item-click': [keyHash: ItemKey];
  'machine-item-click': [itemId: string];
  'save-plan': [payload: any]; // eslint-disable-line @typescript-eslint/no-explicit-any
  'share-plan': [payload: any]; // eslint-disable-line @typescript-eslint/no-explicit-any
  'share-plan-json-url': [payload: any]; // eslint-disable-line @typescript-eslint/no-explicit-any
  'state-change': [state: PlannerLiveState];
  'item-mouseenter': [keyHash: string];
  'item-mouseleave': [];
  'item-context-menu': [evt: Event, keyHash: string];
  'item-touch-hold': [evt: unknown, keyHash: string];
  'ensure-recipe-detail': [recipeId: string];
  'update:active-type-key': [typeKey: string];
}>();

function handleWikiEntryNavigate(itemId: string) {
  const id = String(itemId || '').trim();
  if (!id) return;

  const directDef = props.itemDefsByKeyHash[itemKeyHash({ id })];
  if (directDef) {
    emit('wiki-item-click', directDef.key);
    return;
  }

  const firstKeyHash = props.index?.itemKeyHashesByItemId.get(id)?.[0];
  if (!firstKeyHash) return;
  const def = props.index?.itemsByKeyHash.get(firstKeyHash);
  if (!def) return;
  emit('wiki-item-click', def.key);
}

function openViewer(src: string, name?: string) {
  if (!src) return;
  viewerSrc.value = src;
  viewerName.value = name || '';
  viewerOpen.value = true;
}

function handleWikiDescriptionClick(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof HTMLImageElement)) return;
  if (target.closest('.stack-view') || target.closest('.entry-stack')) return;
  const src = target.currentSrc || target.src;
  if (!src) return;
  openViewer(src, target.alt || target.title || '');
}

async function loadPluginApiForTab(): Promise<void> {
  if (pluginAbortController) pluginAbortController.abort();
  pluginAbortController = null;
  pluginApiState.value = {
    loading: false,
    error: '',
    result: null,
  };
  const runtime = pluginTabRuntime.value;
  if (!runtime?.api) return;
  const controller = new AbortController();
  pluginAbortController = controller;
  pluginApiState.value.loading = true;
  try {
    const result = await props.resolvePluginApi(
      runtime.pluginId,
      runtime.api.queryId,
      controller.signal,
    );
    if (controller.signal.aborted) return;
    if (!result) {
      pluginApiState.value.error = '插件 API 未返回结果';
      return;
    }
    pluginApiState.value.result = result;
  } catch (error) {
    if (controller.signal.aborted) return;
    pluginApiState.value.error = error instanceof Error ? error.message : '插件 API 查询失败';
  } finally {
    if (!controller.signal.aborted) {
      pluginApiState.value.loading = false;
    }
  }
}

watch(
  () =>
    [
      props.activeTab,
      props.pluginContext.itemDef?.key.id,
      props.pluginContext.pack?.manifest.packId,
    ] as const,
  () => {
    void loadPluginApiForTab();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (pluginAbortController) pluginAbortController.abort();
});

provide('wikiCatalogMap', wikiCatalogMap);
provide('wikiImageUseProxy', imageUseProxy);
provide('wikiImageProxyUrl', imageProxyUrl);
provide('wikiEntryNavigate', handleWikiEntryNavigate);
provide('wikiImageOpen', openViewer);
</script>

<style scoped>
.wiki-renderer-stack {
  width: 100%;
}

.wiki-renderer-section + .wiki-renderer-section {
  padding-top: 0.75rem;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.wiki-description {
  line-height: 1.6;
}

.wiki-simple {
  line-height: 1.6;
}

.wiki-description :deep(h1),
.wiki-description :deep(h2),
.wiki-description :deep(h3),
.wiki-description :deep(h4),
.wiki-description :deep(h5),
.wiki-description :deep(h6) {
  margin-top: 1em;
  margin-bottom: 0.5em;
  font-weight: 600;
}

.wiki-description :deep(h1) {
  font-size: 1.5em;
}

.wiki-description :deep(h2) {
  font-size: 1.3em;
}

.wiki-description :deep(h3) {
  font-size: 1.1em;
}

.wiki-description :deep(p) {
  margin-bottom: 0.75em;
}

.wiki-description :deep(ul),
.wiki-description :deep(ol) {
  margin-left: 1.5em;
  margin-bottom: 0.75em;
}

.wiki-description :deep(li) {
  margin-bottom: 0.25em;
}

.wiki-description :deep(code) {
  background: rgba(0, 0, 0, 0.05);
  padding: 0.125em 0.25em;
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.9em;
}

.wiki-description :deep(pre) {
  background: rgba(0, 0, 0, 0.05);
  padding: 0.75em;
  border-radius: 4px;
  overflow-x: auto;
  margin-bottom: 0.75em;
}

.wiki-description :deep(pre code) {
  background: none;
  padding: 0;
}

.wiki-description :deep(a) {
  color: #1976d2;
  text-decoration: none;
}

.wiki-description :deep(a:hover) {
  text-decoration: underline;
}

.wiki-description :deep(blockquote) {
  border-left: 4px solid rgba(0, 0, 0, 0.12);
  padding-left: 1em;
  margin-left: 0;
  color: rgba(0, 0, 0, 0.65);
  margin-bottom: 0.75em;
}

.wiki-description :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 0.75em;
}

.wiki-description :deep(th),
.wiki-description :deep(td) {
  border: 1px solid rgba(0, 0, 0, 0.12);
  padding: 0.5em;
}

.wiki-description :deep(th) {
  background: rgba(0, 0, 0, 0.03);
  font-weight: 600;
}

.wiki-description :deep(img) {
  max-width: 100%;
  height: auto;
}

.jei-type-layout {
  display: flex;
  min-height: 0;
}

.jei-type-sidebar {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 6px 8px 10px;
  border-right: 1px solid rgba(0, 0, 0, 0.08);
}

.jei-type-sidebar__btn {
  padding: 0;
  min-height: 0;
  border-radius: 8px;
}

.jei-type-main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.icon-tab-viewer {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  overflow: hidden;
  height: clamp(280px, 52vh, 540px);
}

.icon-tab-sprite-preview {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.icon-tab-sprite {
  width: 72px;
  height: 72px;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.12);
}
</style>
