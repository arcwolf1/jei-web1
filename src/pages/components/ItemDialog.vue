<template>
  <q-dialog
    :model-value="open"
    @update:model-value="$emit('update:open', $event)"
    content-class="jei-dialog-content"
    :maximized="isMobile"
  >
    <q-card class="jei-dialog" :class="{ 'jei-dialog--mobile': isMobile }">
      <div class="jei-dialog__head">
        <div class="jei-dialog__title">
          {{ currentItemTitle }}
        </div>
        <q-btn flat round icon="close" @click="$emit('close')" />
      </div>

      <div class="jei-dialog__tabs">
        <q-tabs
          :model-value="activeTab"
          @update:model-value="$emit('update:active-tab', $event)"
          dense
          :outside-arrows="!isMobile"
          :mobile-arrows="isMobile"
          :inline-label="!isMobile"
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
        <div v-if="!isMobile" class="jei-dialog__hint text-caption">{{ keyHint }}</div>
      </div>

      <q-scroll-area class="jei-dialog__body">
        <recipe-content-view
          :pack="pack"
          :index="index"
          :current-item-key="currentItemKey"
          :current-item-def="currentItemDef"
          :item-defs-by-key-hash="itemDefsByKeyHash"
          :rendered-description="renderedDescription"
          :active-tab="activeTab"
          :active-type-key="activeTypeKey"
          @update:active-type-key="$emit('update:active-type-key', $event)"
          :active-recipe-groups="activeRecipeGroups"
          :all-recipe-groups="allRecipeGroups"
          :type-machine-icons="typeMachineIcons"
          :recipes-by-id="recipesById"
          :recipe-types-by-key="recipeTypesByKey"
          :planner-initial-state="plannerInitialState"
          :planner-tab="plannerTab"
          :plugin-context="pluginContext"
          :plugin-tabs="pluginTabs"
          :resolve-plugin-api="resolvePluginApi"
          @item-click="$emit('item-click', $event)"
          @wiki-item-click="$emit('wiki-item-click', $event)"
          @machine-item-click="$emit('machine-item-click', $event)"
          @save-plan="$emit('save-plan', $event)"
          @share-plan="$emit('share-plan', $event)"
          @share-plan-json-url="$emit('share-plan-json-url', $event)"
          @state-change="$emit('state-change', $event)"
          @ensure-recipe-detail="$emit('ensure-recipe-detail', $event)"
          @item-mouseenter="$emit('item-mouseenter', $event)"
          @item-mouseleave="$emit('item-mouseleave')"
          @item-context-menu="(...args) => $emit('item-context-menu', ...args)"
          @item-touch-hold="(...args) => $emit('item-touch-hold', ...args)"
        />
      </q-scroll-area>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { PackData, ItemDef, ItemKey } from 'src/jei/types';
import type { JeiIndex } from 'src/jei/indexing/buildIndex';
import type { PlannerInitialState, PlannerLiveState } from 'src/jei/planner/plannerUi';
import type { PluginApiResult, PluginItemContext, PluginTabRuntime } from 'src/jei/plugins/types';
import RecipeContentView from './RecipeContentView.vue';
import { useKeyBindingsStore, keyBindingToString, type KeyAction } from 'src/stores/keybindings';

const { t } = useI18n();
const keyBindingsStore = useKeyBindingsStore();

// 显示快捷键提示
const keyHint = computed(() => {
  const backspace = keyBindingToString(keyBindingsStore.getBinding('goBack'));
  const escape = keyBindingToString(keyBindingsStore.getBinding('closeDialog'));
  return `${backspace}: ${t('goBack')} · ${escape}: ${t('close')}`;
});

function labelWithShortcut(label: string, action: KeyAction) {
  return `${label} (${keyBindingToString(keyBindingsStore.getBinding(action))})`;
}

const props = defineProps<{
  open: boolean;
  isMobile: boolean;
  currentItemTitle: string;
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
}>();

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

defineEmits<{
  'update:open': [value: boolean];
  'update:active-tab': [tab: string];
  'update:active-type-key': [typeKey: string];
  close: [];
  'item-click': [keyHash: ItemKey];
  'wiki-item-click': [keyHash: ItemKey];
  'machine-item-click': [itemId: string];
  'save-plan': [payload: any]; // eslint-disable-line @typescript-eslint/no-explicit-any
  'share-plan': [payload: any]; // eslint-disable-line @typescript-eslint/no-explicit-any
  'share-plan-json-url': [payload: any]; // eslint-disable-line @typescript-eslint/no-explicit-any
  'state-change': [state: PlannerLiveState];
  'ensure-recipe-detail': [recipeId: string];
  'item-mouseenter': [keyHash: string];
  'item-mouseleave': [];
  'item-context-menu': [evt: Event, keyHash: string];
  'item-touch-hold': [evt: unknown, keyHash: string];
}>();
</script>

<style scoped>
:deep(.jei-dialog-content) {
  padding: 0 !important;
}

.jei-dialog {
  width: min(1800px, calc(100dvw - 32px));
  max-width: calc(100dvw - 32px);
  height: min(86vh, 960px);
  display: flex;
  flex-direction: column;
}

.jei-dialog--mobile {
  width: 100% !important;
  max-width: none !important;
  height: 100% !important;
  max-height: none !important;
  border-radius: 0 !important;
}

.jei-dialog__head {
  padding: 10px 10px 6px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.jei-dialog__title {
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.jei-dialog__tabs {
  padding: 0 14px 10px 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
}

.jei-dialog__tabs :deep(.q-tabs) {
  flex: 1 1 0;
  min-width: 0;
}

.jei-dialog :deep(.q-tabs),
.jei-dialog :deep(.q-tab-panels),
.jei-dialog :deep(.q-tab-panel),
.jei-dialog :deep(.q-tabs__content),
.jei-dialog :deep(.q-tab__content) {
  min-width: 0;
  max-width: 100%;
}

.jei-dialog__hint {
  margin-left: auto;
  flex: 0 0 auto;
  opacity: 0.75;
}

.jei-dialog__body {
  flex: 1 1 auto;
  min-width: 0;
}

.jei-dialog--mobile .jei-dialog__tabs {
  padding: 0 8px 8px;
}
</style>
