<template>
  <q-card
    v-show="!isMobile || mobileTab === 'panel'"
    flat
    bordered
    :class="['jei-panel column no-wrap', { 'jei-panel--collapsed': collapsed }]"
  >
    <!-- 折叠状态下的展开按钮 -->
    <div
      v-if="collapsed"
      class="jei-collapsed-trigger jei-collapsed-trigger--right"
      @click="$emit('update:collapsed', false)"
    >
      <q-icon name="chevron_left" size="16px" />
    </div>

    <!-- 展开状态下的内容 -->
    <template v-if="!collapsed && recipeViewMode === 'panel'">
      <!-- 顶部标题栏 -->
      <div class="jei-panel__head row items-center q-gutter-sm col-auto">
        <div class="text-subtitle2">{{ currentViewTitle }}</div>
        <q-space />
        <q-btn
          v-if="centerTab === 'recipe' && navStackLength > 1"
          flat
          round
          dense
          icon="arrow_back"
          @click="$emit('go-back')"
        />
        <q-btn
          v-if="centerTab === 'recipe' && navStackLength"
          flat
          round
          dense
          icon="close"
          @click="$emit('close')"
        />
        <q-btn
          flat
          dense
          round
          icon="chevron_right"
          size="sm"
          @click="$emit('update:collapsed', true)"
        >
          <q-tooltip>{{ t('collapse') }}</q-tooltip>
        </q-btn>
      </div>

      <!-- 主 Tabs -->
      <q-tabs
        :model-value="centerTab"
        @update:model-value="$emit('update:center-tab', $event)"
        dense
        :outside-arrows="!props.isMobile"
        :mobile-arrows="props.isMobile"
        :inline-label="!props.isMobile"
        class="q-px-sm"
      >
        <q-tab name="recipe" :label="t('recipeViewer')" />
        <q-tab name="advanced" :label="t('advancedPlanner')" />
        <q-tab
          v-for="tab in centerPluginTabs"
          :key="tab.tabKey"
          :name="tab.tabKey"
          :label="tab.tabLabel"
        />
      </q-tabs>

      <q-separator />
      <div
        v-if="centerTab === 'recipe' && navStackLength && pluginQueryActions.length"
        class="row q-gutter-xs q-pa-sm"
      >
        <q-btn
          v-for="action in pluginQueryActions"
          :key="`${action.pluginId}:${action.actionId}`"
          dense
          flat
          color="primary"
          :icon="action.icon || 'open_in_new'"
          :label="action.label"
          :href="action.url"
          :target="action.openInNewTab ? '_blank' : undefined"
          rel="noopener noreferrer"
        />
      </div>
      <q-separator v-if="centerTab === 'recipe' && navStackLength && pluginQueryActions.length" />

      <!-- 内容区域 - 使用 keep-alive 保持组件状态 -->
      <div class="col jei-panel__body">
        <q-tab-panels
          v-show="!isCenterPluginTabActive"
          :model-value="mainPanelTab"
          animated
          keep-alive
          class="jei-panel__tab-panels fit"
        >
          <!-- 资料查看器面板 -->
          <q-tab-panel name="recipe" class="q-pa-none jei-panel__tab-panel column">
            <div v-if="navStackLength" class="jei-panel__tabs col-auto">
              <q-tabs
                :model-value="activeTab"
                @update:model-value="$emit('update:active-tab', $event)"
                dense
                :outside-arrows="!props.isMobile"
                :mobile-arrows="props.isMobile"
                :inline-label="!props.isMobile"
                class="q-px-sm q-pt-sm"
              >
                <q-tab name="recipes" :label="recipesTabLabel" />
                <q-tab name="uses" :label="usesTabLabel" />
                <q-tab name="wiki" :label="wikiTabLabel" />
                <q-tab name="icon" :label="iconTabLabel" />
                <q-tab name="planner" :label="plannerTabLabel" />
                <q-tab
                  v-for="tab in pluginTabs"
                  :key="tab.tabKey"
                  :name="tab.tabKey"
                  :label="tab.tabLabel"
                />
              </q-tabs>
            </div>
            <q-separator v-if="navStackLength" />
            <div v-show="navStackLength" class="jei-panel__content col column">
              <recipe-content-view
                class="col"
                v-if="navStackLength"
                :pack="pack ?? null"
                :index="index ?? null"
                :current-item-key="currentItemKey ?? null"
                :current-item-def="currentItemDef ?? null"
                :item-defs-by-key-hash="itemDefsByKeyHash ?? {}"
                :rendered-description="renderedDescription ?? ''"
                :active-tab="activeTab"
                :active-type-key="activeTypeKey ?? ''"
                @update:active-type-key="$emit('update:active-type-key', $event)"
                :active-recipe-groups="activeRecipeGroups ?? []"
                :all-recipe-groups="allRecipeGroups ?? []"
                :type-machine-icons="typeMachineIcons ?? []"
                :recipes-by-id="recipesById ?? new Map()"
                :recipe-types-by-key="recipeTypesByKey ?? new Map()"
                :planner-initial-state="plannerInitialState ?? null"
                :planner-tab="plannerTab ?? 'tree'"
                :plugin-context="pluginContext"
                :plugin-tabs="pluginTabs"
                :resolve-plugin-api="resolvePluginApi"
                panel-class="jei-panel__panels"
                @item-click="$emit('item-click', $event)"
                @wiki-item-click="$emit('wiki-item-click', $event)"
                @machine-item-click="$emit('machine-item-click', $event)"
                @save-plan="$emit('save-plan', $event)"
                @share-plan="$emit('share-plan', $event)"
                @share-plan-json-url="$emit('share-plan-json-url', $event)"
                @state-change="$emit('state-change', $event)"
                @item-mouseenter="$emit('item-mouseenter', $event)"
                @item-mouseleave="$emit('item-mouseleave')"
                @item-context-menu="(...args) => $emit('item-context-menu', ...args)"
                @item-touch-hold="(...args) => $emit('item-touch-hold', ...args)"
              />
            </div>
            <div v-show="!navStackLength" class="q-pa-md text-caption text-grey-7">
              {{ t('selectItem') }}
            </div>
          </q-tab-panel>

          <!-- 高级计划器面板 -->
          <q-tab-panel name="advanced" class="q-pa-none jei-panel__tab-panel column">
            <advanced-planner
              class="col"
              ref="advancedPlannerRef"
              :pack="pack ?? null"
              :index="index ?? null"
              :item-defs-by-key-hash="itemDefsByKeyHash ?? {}"
              @save-plan="$emit('save-plan', $event)"
              @share-plan="$emit('share-plan', $event)"
              @share-plan-json-url="$emit('share-plan-json-url', $event)"
              @state-change="$emit('state-change', $event)"
            />
          </q-tab-panel>
        </q-tab-panels>
        <div
          v-for="tab in centerPluginTabs"
          :key="`center-plugin-wrap:${tab.tabKey}`"
          v-show="centerTab === tab.tabKey"
          class="jei-panel__terminal-wrap relative-position"
        >
          <iframe
            v-if="isCenterPluginTabMounted(tab.tabKey)"
            v-show="!loadingCenterPluginTabs[tab.tabKey]"
            class="jei-terminal-iframe"
            :src="tab.src"
            :title="tab.tabLabel"
            referrerpolicy="no-referrer"
            :sandbox="tab.sandbox || 'allow-scripts allow-same-origin allow-forms allow-popups'"
            @load="loadingCenterPluginTabs[tab.tabKey] = false"
          />
          <div
            v-if="loadingCenterPluginTabs[tab.tabKey] && isCenterPluginTabMounted(tab.tabKey)"
            class="absolute-full flex flex-center"
            :class="$q.dark.isActive ? 'bg-dark' : 'bg-grey-1'"
          >
            <q-spinner color="primary" size="3em" />
          </div>
          <div
            v-if="
              !tab.noApi &&
              isCenterPluginTabMounted(tab.tabKey) &&
              !loadingCenterPluginTabs[tab.tabKey]
            "
            class="absolute-top-right q-ma-sm"
          >
            <q-btn
              dense
              flat
              round
              color="primary"
              icon="open_in_new"
              :href="tab.src"
              target="_blank"
              rel="noopener noreferrer"
            />
          </div>
        </div>
      </div>
    </template>
    <template v-else-if="!collapsed">
      <div class="text-subtitle2">{{ t('middleArea') }}</div>
      <div class="text-caption">{{ t('middleAreaDesc') }}</div>
    </template>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { PackData, ItemDef, ItemKey } from 'src/jei/types';
import type { JeiIndex } from 'src/jei/indexing/buildIndex';
import type {
  PluginActionRuntime,
  PluginApiResult,
  PluginItemContext,
  PluginTabRuntime,
} from 'src/jei/plugins/types';
import type {
  PlannerInitialState,
  PlannerLiveState,
  PlannerSavePayload,
} from 'src/jei/planner/plannerUi';
import { useKeyBindingsStore, keyBindingToString, type KeyAction } from 'src/stores/keybindings';
import RecipeContentView from './RecipeContentView.vue';
import AdvancedPlanner from './AdvancedPlanner.vue';

const { t } = useI18n();
const keyBindingsStore = useKeyBindingsStore();

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
  isMobile: boolean;
  mobileTab: string;
  collapsed: boolean;
  recipeViewMode: 'dialog' | 'panel';
  centerTab?: string;
  navStackLength: number;
  currentItemTitle: string;
  activeTab: string;
  pack?: PackData | null;
  index?: JeiIndex | null;
  currentItemKey?: ItemKey | null;
  currentItemDef?: ItemDef | null;
  itemDefsByKeyHash?: Record<string, ItemDef>;
  renderedDescription?: string;
  activeTypeKey?: string;
  activeRecipeGroups?: RecipeGroup[];
  allRecipeGroups?: RecipeGroup[];
  typeMachineIcons?: MachineIcon[];
  recipesById?: Map<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  recipeTypesByKey?: Map<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  plannerInitialState?: PlannerInitialState | null;
  plannerTab?: 'tree' | 'graph' | 'line' | 'calc' | 'quant';
  pluginContext: PluginItemContext;
  pluginQueryActions: PluginActionRuntime[];
  pluginTabs: PluginTabRuntime[];
  centerPluginTabs: Array<{
    tabKey: string;
    tabLabel: string;
    src: string;
    sandbox?: string;
    noApi?: boolean;
    keepAlive?: boolean;
  }>;
  resolvePluginApi: (
    pluginId: string,
    queryId: string,
    signal: AbortSignal,
  ) => Promise<PluginApiResult | null>;
}>();

defineEmits<{
  'update:collapsed': [value: boolean];
  'update:center-tab': [value: string];
  'update:active-tab': [value: string];
  'update:active-type-key': [typeKey: string];
  'go-back': [];
  close: [];
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
}>();

const advancedPlannerRef = ref<InstanceType<typeof AdvancedPlanner>>();
const mountedCenterPluginTabs = ref<Record<string, boolean>>({});
const loadingCenterPluginTabs = ref<Record<string, boolean>>({});

watch(
  () => [props.centerTab, props.centerPluginTabs] as const,
  ([tab, tabs]) => {
    // 只有声明了 keepAlive 的 Tab 才会被记录在 mountedCenterPluginTabs 中
    if (tab) {
      const currentTab = tabs.find((it) => it.tabKey === tab);
      if (currentTab && currentTab.keepAlive) {
        mountedCenterPluginTabs.value = {
          ...mountedCenterPluginTabs.value,
          [tab]: true,
        };
      }
      // 初始化 loading 状态
      if (currentTab && loadingCenterPluginTabs.value[tab] === undefined) {
        loadingCenterPluginTabs.value = {
          ...loadingCenterPluginTabs.value,
          [tab]: true,
        };
      }
    }
    const validKeys = new Set(tabs.map((it) => it.tabKey));
    mountedCenterPluginTabs.value = Object.fromEntries(
      Object.entries(mountedCenterPluginTabs.value).filter(([key]) => validKeys.has(key)),
    );
    // 清理无效的 loading 状态
    loadingCenterPluginTabs.value = Object.fromEntries(
      Object.entries(loadingCenterPluginTabs.value).filter(([key]) => validKeys.has(key)),
    );
  },
  { immediate: true },
);

const mainPanelTab = computed<'recipe' | 'advanced'>(() =>
  props.centerTab === 'advanced' ? 'advanced' : 'recipe',
);

const isCenterPluginTabActive = computed(() =>
  props.centerPluginTabs.some((tab) => tab.tabKey === props.centerTab),
);

const currentViewTitle = computed(() => {
  if (props.centerTab === 'advanced') {
    return t('advancedPlannerTitle');
  }
  const centerPluginTab = props.centerPluginTabs.find((tab) => tab.tabKey === props.centerTab);
  if (centerPluginTab) {
    return centerPluginTab.tabLabel;
  }
  return props.navStackLength ? props.currentItemTitle : t('middleArea');
});

function isCenterPluginTabMounted(tabKey: string): boolean {
  // 如果当前是激活状态，总是渲染
  if (props.centerTab === tabKey) return true;
  // 如果之前挂载过且声明了 keepAlive，则保持渲染
  return !!mountedCenterPluginTabs.value[tabKey];
}

function labelWithShortcut(label: string, action: KeyAction) {
  return `${label} (${keyBindingToString(keyBindingsStore.getBinding(action))})`;
}

const recipesTabLabel = computed(() =>
  props.isMobile ? t('tabsRecipes') : labelWithShortcut(t('tabsRecipes'), 'viewRecipes'),
);
const usesTabLabel = computed(() =>
  props.isMobile ? t('tabsUses') : labelWithShortcut(t('tabsUses'), 'viewUses'),
);
const wikiTabLabel = computed(() =>
  props.isMobile ? t('tabsWiki') : labelWithShortcut(t('tabsWiki'), 'viewWiki'),
);
const iconTabLabel = computed(() =>
  props.isMobile ? t('tabsIcon') : labelWithShortcut(t('tabsIcon'), 'viewIcon'),
);
const plannerTabLabel = computed(() =>
  props.isMobile ? t('tabsPlanner') : labelWithShortcut(t('tabsPlanner'), 'viewPlanner'),
);

const addToAdvancedPlanner = (itemKey: ItemKey, itemName: string) => {
  advancedPlannerRef.value?.addTarget(itemKey, itemName);
};

const loadAdvancedPlan = (plan: PlannerSavePayload) => {
  advancedPlannerRef.value?.loadSavedPlan(plan);
};

defineExpose({
  addToAdvancedPlanner,
  loadAdvancedPlan,
});
</script>

<style scoped>
.jei-panel {
  flex: 1 1 auto;
  min-width: 0;
  padding: 12px;
  height: 100%;
  min-height: 0;
  transition: width 0.3s ease;
}

.jei-panel--collapsed {
  width: 20px !important;
  min-width: 20px !important;
  padding: 0;
}

.jei-collapsed-trigger {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: var(--q-primary);
  color: white;
  opacity: 0.6;
  transition: all 0.2s;
  z-index: 10;
}

.jei-collapsed-trigger:hover {
  opacity: 1;
  width: 24px;
}

.jei-collapsed-trigger--right {
  right: 0;
  border-radius: 4px 0 0 4px;
}

.jei-panel__head {
  padding-bottom: 8px;
}

.jei-panel__tabs {
  display: flex;
  align-items: center;
  padding-bottom: 8px;
  min-width: 0;
  max-width: 100%;
}

.jei-panel__body {
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

.jei-panel__tab-panels {
  flex: 1 1 auto;
  min-height: 0;
}

.jei-panel__tab-panel {
  min-height: 0;
}

.jei-panel__content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.jei-panel :deep(.q-tabs),
.jei-panel :deep(.q-tab-panels),
.jei-panel :deep(.q-tab-panel),
.jei-panel :deep(.q-tabs__content),
.jei-panel :deep(.q-tab__content) {
  min-width: 0;
  max-width: 100%;
}

.jei-panel__panels {
  min-height: 0;
}

.jei-panel__terminal-wrap {
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
}

.jei-terminal-iframe {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}
</style>
