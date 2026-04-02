<template>
  <div v-if="widgetCommon" class="widget-common">
    <div v-if="tabs.length" class="tabbed-panels">
      <q-tabs
        v-if="showTabHeader"
        v-model="activeTab"
        dense
        class="tab-header"
        active-color="primary"
        indicator-color="primary"
        inline-label
        :dark="$q.dark.isActive"
      >
        <q-tab v-for="tab in tabs" :key="tab.key" :name="tab.key" :label="tab.title">
          <span
            v-if="tab.icon"
            class="tab-icon-wrapper"
            @click.stop="handleIconClick(tab.icon, tab.title)"
          >
            <ImageLoader
              :url="tab.icon"
              :alt="tab.title"
              :max-width="24"
              :use-proxy="useProxy"
              :proxy-url="proxyUrl"
              variant="inline"
              class="tab-icon"
            />
          </span>
        </q-tab>
      </q-tabs>

      <q-tab-panels v-model="activeTab" animated class="tab-panels" :dark="$q.dark.isActive">
        <q-tab-panel v-for="tab in tabs" :key="tab.key" :name="tab.key" class="wiki-tab-panel">
          <WikiWidgetIntro v-if="tab.intro" :intro="tab.intro" :document-map="documentMap" />

          <WikiDocument
            v-if="tab.document"
            :document="tab.document"
            :hide-leading-horizontal-rule="hideAnonymousSinglePanelLeadSeparator"
          />
        </q-tab-panel>
      </q-tab-panels>
    </div>

    <div v-else class="stack-panels">
      <template v-for="panel in panels" :key="panel.key">
        <div class="stack-panel">
          <div v-if="panel.displayTitle || panel.icon" class="stack-title">
            <span
              v-if="panel.icon"
              class="tab-icon-wrapper"
              @click.stop="handleIconClick(panel.icon, panel.displayTitle || panel.title)"
            >
              <ImageLoader
                :url="panel.icon"
                :alt="panel.displayTitle || panel.title"
                :max-width="24"
                :use-proxy="useProxy"
                :proxy-url="proxyUrl"
                variant="inline"
                class="tab-icon"
              />
            </span>
            <span>{{ panel.displayTitle }}</span>
          </div>

          <WikiWidgetIntro v-if="panel.intro" :intro="panel.intro" :document-map="documentMap" />

          <WikiDocument
            v-if="panel.document"
            :document="panel.document"
            :hide-leading-horizontal-rule="hideAnonymousSinglePanelLeadSeparator"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, inject, type Ref } from 'vue';
import { useQuasar } from 'quasar';
import type { WidgetCommon, Document, WidgetTabData, WidgetIntro } from '../../../types/wiki';
import WikiDocument from '../WikiDocument.vue';
import WikiWidgetIntro from './WikiWidgetIntro.vue';
import ImageLoader from '../ImageLoader.vue';

const props = defineProps<{
  widgetCommon?: WidgetCommon;
  documentMap: Record<string, Document>;
}>();

const useProxyRef = inject<Ref<boolean>>('wikiImageUseProxy', ref(false));
const proxyUrlRef = inject<Ref<string>>('wikiImageProxyUrl', ref(''));
const openImageViewer = inject<(src: string, name?: string) => void>(
  'wikiImageOpen',
  () => undefined,
);
const $q = useQuasar();

const useProxy = computed(() => useProxyRef.value);
const proxyUrl = computed(() => proxyUrlRef.value);

type Panel = {
  key: string;
  title: string;
  displayTitle: string;
  icon: string;
  intro: WidgetIntro | null;
  document: Document | null;
};

function getTabData(tabId: string): WidgetTabData | undefined {
  return props.widgetCommon?.tabDataMap?.[tabId];
}

function getTabContentDocument(tabId: string): Document | null {
  const tabData = getTabData(tabId);
  if (!tabData?.content) return null;
  return props.documentMap[tabData.content] || null;
}

function buildDisplayTitle(tabId: string, title: string): string {
  if (title) return title;
  const tabData = getTabData(tabId);
  if (tabData?.intro?.name) return tabData.intro.name;
  if (tabData?.intro?.type) return tabData.intro.type;
  return '';
}

function buildTitle(tabId: string, title: string, index: number): string {
  return buildDisplayTitle(tabId, title) || `Tab ${index + 1}`;
}

function handleIconClick(url: string, title?: string) {
  if (!url) return;
  openImageViewer(url, title);
}

const panels = computed<Panel[]>(() => {
  if (!props.widgetCommon) return [];
  const list = props.widgetCommon.tabList || [];

  if (list.length) {
    return list.map((tab, index) => {
      const data = getTabData(tab.tabId);
      return {
        key: tab.tabId,
        title: buildTitle(tab.tabId, tab.title, index),
        displayTitle: buildDisplayTitle(tab.tabId, tab.title),
        icon: tab.icon || '',
        intro: data?.intro ?? null,
        document: getTabContentDocument(tab.tabId),
      };
    });
  }

  const keys = Object.keys(props.widgetCommon.tabDataMap || {});
  return keys.map((key, index) => {
    const data = getTabData(key);
    return {
      key,
      title: buildTitle(key, '', index),
      displayTitle: buildDisplayTitle(key, ''),
      icon: '',
      intro: data?.intro ?? null,
      document: getTabContentDocument(key),
    };
  });
});

const tabs = computed(() => {
  if (!props.widgetCommon) return [] as Panel[];
  const list = props.widgetCommon.tabList || [];
  if (!list.length) return [] as Panel[];
  return panels.value;
});

const showTabHeader = computed(() => {
  if (tabs.value.length !== 1) return true;
  const firstTab = tabs.value[0];
  return Boolean(firstTab?.displayTitle || firstTab?.icon);
});

const hideAnonymousSinglePanelLeadSeparator = computed(() => {
  if (panels.value.length !== 1) return false;
  const firstPanel = panels.value[0];
  return !firstPanel?.displayTitle && !firstPanel?.icon;
});

const activeTab = ref('');

watch(
  () => tabs.value,
  (nextTabs) => {
    if (!nextTabs.length) {
      activeTab.value = '';
      return;
    }
    const firstTab = nextTabs[0];
    if (!firstTab) {
      activeTab.value = '';
      return;
    }
    if (!activeTab.value || !nextTabs.find((tab) => tab.key === activeTab.value)) {
      activeTab.value = firstTab.key;
    }
  },
  { immediate: true },
);
</script>

<style scoped lang="scss">
.widget-common {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.tabbed-panels {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tab-header {
  border-bottom: 1px solid #e6e6e6;
}

.tab-panels {
  background: transparent;
}

.tab-panels :deep(.q-tab-panel) {
  background: transparent;
}

.wiki-tab-panel {
  background: transparent;
}

.tab-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
  margin-right: 0.5rem;
}

.tab-icon-wrapper {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}

.stack-panels {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.stack-panel {
  padding-bottom: 0.5rem;
  border-bottom: 1px dashed #e6e6e6;
}

.stack-panel:last-child {
  border-bottom: none;
}

.stack-title {
  font-weight: 600;
  // color: #333;
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
}
</style>
