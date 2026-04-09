<template>
  <q-page class="wiki-renderer-page">
    <!-- 文件上传区域 -->
    <div v-if="!wikiItem" class="upload-section">
      <q-card class="upload-card">
        <q-card-section>
          <div class="text-h5">{{ t('wikiDocRenderer') }}</div>
          <div class="text-caption">{{ t('supportBlockEditorFormat') }}</div>
        </q-card-section>

        <q-card-section>
          <div class="row q-col-gutter-md q-mb-md">
            <div class="col-6">
              <q-btn
                flat
                color="primary"
                icon="folder_open"
                :label="t('selectWikiFromDir')"
                @click="loadWikiFileList(wikiFileDir)"
                class="full-width"
                :loading="loadingWikiFiles"
              >
                <q-tooltip>{{ t('autoListTempInfo') }}</q-tooltip>
              </q-btn>
            </div>
            <div class="col-6">
              <q-btn
                flat
                color="secondary"
                icon="folder_open"
                :label="t('selectCatalogFromDir')"
                @click="loadCatalogFileList(catalogFileDir)"
                class="full-width"
                :loading="loadingCatalogFiles"
              >
                <q-tooltip>{{ t('autoListTempCatalog') }}</q-tooltip>
              </q-btn>
            </div>
          </div>

          <div class="row q-col-gutter-md q-mb-md">
            <div class="col-6">
              <q-file
                v-model="file"
                :label="t('orManuallySelectWiki')"
                accept=".json"
                @update:model-value="loadFile"
                :dark="$q.dark.isActive"
                outlined
              >
                <template v-slot:prepend>
                  <q-icon name="attach_file" />
                </template>
              </q-file>
            </div>
            <div class="col-6">
              <q-file
                v-model="catalogFile"
                :label="t('orManuallySelectCatalog')"
                accept=".json"
                @update:model-value="loadCatalogFile"
                :dark="$q.dark.isActive"
                outlined
              >
                <template v-slot:prepend>
                  <q-icon name="attach_file" />
                </template>
              </q-file>
            </div>
          </div>

          <div class="row q-col-gutter-md q-mb-md">
            <div class="col-12">
              <q-toggle v-model="imageUseProxy" :label="t('imageUseProxy')" color="primary" />
            </div>
            <div v-if="imageUseProxy" class="col-12">
              <q-input
                v-model="settingsStore.wikiImageProxyUrl"
                :label="t('proxyAddress')"
                dense
                outlined
              />
            </div>
          </div>

          <div class="text-caption text-grey">
            {{ t('selectFromDirHint') }}
          </div>

          <div v-if="savedCatalogFileName" class="text-caption text-warning q-mt-sm">
            {{ t('lastUsedCatalog') }}: <strong>{{ savedCatalogFileName }}</strong>
            <br />
            <span class="text-caption">{{ t('pleaseReselect') }}</span>
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- Wiki 内容渲染 -->
    <div v-else class="wiki-content">
      <div class="file-tools">
        <q-card class="file-tools-card">
          <q-card-section class="file-tools-section">
            <div class="file-tools-row">
              <div class="file-tools-item">
                <div class="q-mb-md">
                  <q-btn
                    flat
                    dense
                    color="secondary"
                    icon="folder_open"
                    :label="t('selectCatalogFromDir')"
                    @click="loadCatalogFileList(catalogFileDir)"
                    :loading="loadingCatalogFiles"
                    class="q-mb-xs"
                  />
                </div>

                <q-file
                  v-model="catalogFile"
                  :label="t('orManuallySelectCatalogFull')"
                  @update:model-value="loadCatalogFile"
                  :dark="$q.dark.isActive"
                  outlined
                >
                  <template v-slot:prepend>
                    <q-icon name="folder" />
                  </template>
                </q-file>
                <div class="text-caption text-grey-7 q-mt-xs">
                  {{
                    t('currentCatalogStatus', {
                      name: catalogFile?.name || t('notSelected'),
                      status: catalogStatus,
                    })
                  }}
                </div>

                <!-- 显示上次使用的文件提示（如果当前未选择） -->
                <q-banner
                  v-if="!catalogFile && savedCatalogFileName"
                  class="q-mt-sm bg-blue-1"
                  dense
                >
                  <template v-slot:avatar>
                    <q-icon name="history" color="blue" />
                  </template>
                  {{ t('lastUsedShort') }}: {{ savedCatalogFileName }}
                </q-banner>

                <div class="image-proxy-settings q-mt-md">
                  <q-toggle v-model="imageUseProxy" :label="t('imageUseProxy')" color="primary" />
                  <q-input
                    v-model="imageProxyUrl"
                    dense
                    outlined
                    :dark="$q.dark.isActive"
                    :label="t('proxyAddress')"
                    placeholder="https://r.jina.ai/http://"
                    class="q-mt-sm"
                  />
                  <div class="text-caption text-grey-7 q-mt-xs">
                    {{ t('proxyNote') }}
                  </div>
                </div>
              </div>

              <div class="file-tools-actions">
                <q-btn
                  flat
                  color="primary"
                  icon="folder_open"
                  :label="t('changeWikiFile')"
                  @click="resetView"
                  class="q-mr-sm"
                >
                  <q-tooltip>{{ t('returnToFileSelection') }}</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  color="secondary"
                  icon="refresh"
                  :label="t('loadOtherFile')"
                  @click="loadWikiFileList(wikiFileDir)"
                >
                  <q-tooltip>{{ t('selectFromCatalogList') }}</q-tooltip>
                </q-btn>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- 头部信息 -->
      <div v-if="itemBrief" class="wiki-header">
        <div
          class="header-background"
          :style="{ backgroundImage: headerBackground ? `url(${headerBackground})` : 'none' }"
        >
          <div class="header-overlay"></div>
        </div>

        <div class="header-content">
          <q-btn
            flat
            round
            dense
            icon="arrow_back"
            color="white"
            class="back-btn"
            @click="resetView"
          />

          <div class="header-info">
            <div v-if="itemBrief.cover" class="cover-image">
              <img :src="itemBrief.cover" :alt="itemBrief.name" />
            </div>

            <div class="info-text">
              <h1 class="item-name">{{ itemBrief.name || wikiItem?.name }}</h1>

              <!-- 标签 -->
              <div v-if="itemBrief.subTypeList" class="tags">
                <q-chip
                  v-for="subType in itemBrief.subTypeList"
                  :key="subType.subTypeId"
                  size="sm"
                  dense
                  color="primary"
                  text-color="white"
                >
                  {{ tagNameMap[subType.value] || subType.value }}
                </q-chip>
              </div>

              <!-- 简介 -->
              <div v-if="briefDescriptionDocument" class="caption">
                <WikiDocument :document="briefDescriptionDocument" />
              </div>
              <div v-else-if="caption" class="caption">
                <p v-for="(cap, idx) in caption" :key="idx">
                  {{ cap.text?.text }}
                </p>
              </div>
            </div>

            <div v-if="extraIllustration" class="hero-illustration">
              <img :src="extraIllustration" :alt="itemBrief.name" />
            </div>
          </div>
        </div>
      </div>

      <!-- 正文布局（由 chapterGroup 定义） -->
      <div class="wiki-body">
        <template v-if="chapterGroup?.length">
          <WikiChapterGroup
            v-for="group in chapterGroup"
            :key="group.title"
            :group="group"
            :widget-common-map="widgetCommonMap"
            :document-map="documentMap"
          />
        </template>

        <!-- 回退：无 chapterGroup 时流式渲染文档 -->
        <template v-else>
          <div class="fallback-docs">
            <section v-for="(doc, docId) in documentMap" :key="docId" class="fallback-section">
              <div class="fallback-title">{{ getDocumentTitle(doc, docId) }}</div>
              <WikiDocument :document="doc" />
            </section>
          </div>
        </template>
      </div>
    </div>

    <!-- Wiki 文件选择对话框 -->
    <q-dialog v-model="showWikiDirSelector" maximized>
      <q-card>
        <q-bar>
          <q-icon name="folder_open" />
          <span class="q-ml-sm">{{ t('selectWikiFromDirShort') }}</span>
          <q-space />
          <q-btn flat dense icon="close" v-close-popup>
            <q-tooltip>{{ t('close') }}</q-tooltip>
          </q-btn>
        </q-bar>

        <q-card-section class="q-pt-none">
          <div class="text-subtitle1 q-mb-md">{{ t('directory') }}: /temp/{{ wikiFileDir }}</div>

          <q-list bordered separator dense class="file-list">
            <q-item v-if="wikiFileList.length === 0">
              <q-item-section>
                <q-item-label caption>{{ t('noFilesFound') }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item
              v-for="fileInfo in wikiFileList"
              :key="fileInfo.path"
              clickable
              @click="loadWikiFileFromDir(fileInfo.path, fileInfo.name)"
              v-close-popup
            >
              <q-item-section avatar>
                <q-icon name="description" color="primary" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ fileInfo.name }}</q-item-label>
                <q-item-label caption>{{ fileInfo.path }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-icon name="open_in_new" />
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- 目录文件选择对话框 -->
    <q-dialog v-model="showCatalogDirSelector" maximized>
      <q-card>
        <q-bar>
          <q-icon name="folder_open" color="secondary" />
          <span class="q-ml-sm">{{ t('selectCatalogFromDirShort') }}</span>
          <q-space />
          <q-btn flat dense icon="close" v-close-popup>
            <q-tooltip>{{ t('close') }}</q-tooltip>
          </q-btn>
        </q-bar>

        <q-card-section class="q-pt-none">
          <div class="text-subtitle1 q-mb-md">{{ t('directory') }}: /temp/{{ catalogFileDir }}</div>

          <q-list bordered separator dense class="file-list">
            <q-item v-if="catalogFileList.length === 0">
              <q-item-section>
                <q-item-label caption>{{ t('noFilesFound') }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item
              v-for="fileInfo in catalogFileList"
              :key="fileInfo.path"
              clickable
              @click="loadCatalogFileFromDir(fileInfo.path, fileInfo.name)"
              v-close-popup
            >
              <q-item-section avatar>
                <q-icon name="description" color="secondary" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ fileInfo.name }}</q-item-label>
                <q-item-label caption>{{ fileInfo.path }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-icon name="open_in_new" />
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, provide, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import WikiDocument from '../components/wiki/WikiDocument.vue';
import WikiChapterGroup from '../components/wiki/layout/WikiChapterGroup.vue';
import { useSettingsStore } from '../stores/settings';
import { appPath } from '../utils/app-path';

const { t } = useI18n();
import type {
  WikiData,
  WikiItem,
  Document,
  ChapterGroup,
  WidgetCommon,
  TagNode,
  CatalogData,
  CatalogItemMap,
} from '../types/wiki';

const settingsStore = useSettingsStore();
const $q = useQuasar();

const file = ref<File | null>(null);
const catalogFile = ref<File | null>(null);
const wikiItem = ref<WikiItem | null>(null);
const catalogMap = ref<CatalogItemMap>({});

// 目录选择相关
const wikiFileDir = ref('info');
const wikiFileList = ref<{ name: string; path: string }[]>([]);
const catalogFileDir = ref('catalog');
const catalogFileList = ref<{ name: string; path: string }[]>([]);
const showWikiDirSelector = ref(false);
const showCatalogDirSelector = ref(false);
const loadingWikiFiles = ref(false);
const loadingCatalogFiles = ref(false);

// 使用持久化的代理设置
const imageUseProxy = computed({
  get: () => settingsStore.wikiImageUseProxy,
  set: (value) => settingsStore.setWikiImageUseProxy(value),
});

const imageProxyUrl = computed({
  get: () => settingsStore.wikiImageProxyUrl,
  set: (value) => settingsStore.setWikiImageProxyUrl(value),
});

provide('wikiCatalogMap', catalogMap);
provide('wikiImageUseProxy', imageUseProxy);
provide('wikiImageProxyUrl', imageProxyUrl);

const documentMap = computed<Record<string, Document>>(() => {
  return wikiItem.value?.document?.documentMap || {};
});

const itemBrief = computed(() => wikiItem.value?.brief);

// chapterGroup 和 widgetCommonMap 都在 document 对象下
const chapterGroup = computed<ChapterGroup[] | undefined>(() => {
  return wikiItem.value?.document?.chapterGroup;
});

const widgetCommonMap = computed<Record<string, WidgetCommon>>(() => {
  return wikiItem.value?.document?.widgetCommonMap || {};
});

// 自动加载上次选择的目录文件
const savedCatalogFileName = computed(() => settingsStore.wikiCatalogFileName);
const showSavedCatalogHint = ref(false);

// 组件挂载时显示上次使用的文件提示
onMounted(() => {
  if (savedCatalogFileName.value && !catalogFile.value) {
    showSavedCatalogHint.value = true;
  }
});

// 从指定目录加载 Wiki 文件列表
async function loadWikiFileList(dirPath: string) {
  loadingWikiFiles.value = true;
  try {
    // 构建完整的公共路径：info -> /temp/info/index.json
    const fullPath = appPath(`/temp/${dirPath}/index.json`);
    console.log('Loading file list from:', fullPath);

    const response = await fetch(fullPath);
    console.log('Response status:', response.status, response.statusText);

    if (!response.ok) {
      throw new Error(`Failed to load ${fullPath}: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Loaded file list:', data);

    wikiFileList.value = data.files || [];
    showWikiDirSelector.value = true;
  } catch (error) {
    console.error('Failed to load wiki file list:', error);
    alert(
      `${t('loadCatalogFileFailed')}: ${error instanceof Error ? error.message : t('unknownError')}\n\n${t('ensureSyncTemp')}`,
    );
  } finally {
    loadingWikiFiles.value = false;
  }
}

// 从指定目录加载目录文件列表
async function loadCatalogFileList(dirPath: string) {
  loadingCatalogFiles.value = true;
  try {
    // 构建完整的公共路径：catalog -> /temp/catalog/index.json
    const fullPath = appPath(`/temp/${dirPath}/index.json`);
    console.log('Loading catalog file list from:', fullPath);

    const response = await fetch(fullPath);
    console.log('Response status:', response.status, response.statusText);

    if (!response.ok) {
      throw new Error(`Failed to load ${fullPath}: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Loaded catalog file list:', data);

    catalogFileList.value = data.files || [];
    showCatalogDirSelector.value = true;
  } catch (error) {
    console.error('Failed to load catalog file list:', error);
    alert(
      `${t('loadCatalogFileFailed')}: ${error instanceof Error ? error.message : t('unknownError')}\n\n${t('ensureSyncTemp')}`,
    );
  } finally {
    loadingCatalogFiles.value = false;
  }
}

// 从目录加载 Wiki 文件
async function loadWikiFileFromDir(filePath: string, fileName: string) {
  try {
    // 构建完整的公共路径：info + id7.json -> /temp/info/id7.json
    const fullPath = appPath(`/temp/${wikiFileDir.value}/${filePath}`);
    console.log('Loading wiki file from:', fullPath);

    const response = await fetch(fullPath);
    console.log('Response status:', response.status, response.statusText);

    if (!response.ok) {
      throw new Error(`Failed to load ${fullPath}: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    const data: WikiData = JSON.parse(text);

    if (data.data?.item) {
      wikiItem.value = data.data.item;
      file.value = new File([text], fileName, { type: 'application/json' });
      showWikiDirSelector.value = false;
      console.log('Wiki file loaded successfully:', fileName);
    }
  } catch (error) {
    console.error('Failed to load wiki file from dir:', error);
    alert(`${t('loadFileFailed')}: ${error instanceof Error ? error.message : t('unknownError')}`);
  }
}

// 从目录加载 Catalog 文件
async function loadCatalogFileFromDir(filePath: string, fileName: string) {
  try {
    // 构建完整的公共路径：catalog + full.json -> /temp/catalog/full.json
    const fullPath = appPath(`/temp/${catalogFileDir.value}/${filePath}`);
    console.log('Loading catalog file from:', fullPath);

    const response = await fetch(fullPath);
    console.log('Response status:', response.status, response.statusText);

    if (!response.ok) {
      throw new Error(`Failed to load ${fullPath}: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    const data: CatalogData = JSON.parse(text);

    catalogMap.value = buildCatalogItemMap(data);
    catalogFile.value = new File([text], fileName, { type: 'application/json' });
    settingsStore.setWikiCatalogFileName(fileName);
    showCatalogDirSelector.value = false;
    console.log('Catalog file loaded successfully:', fileName);
  } catch (error) {
    console.error('Failed to load catalog file from dir:', error);
    alert(
      `${t('loadCatalogFileFailed')}: ${error instanceof Error ? error.message : t('unknownError')}`,
    );
  }
}

const catalogCount = computed(() => Object.keys(catalogMap.value).length);

const catalogStatus = computed(() => {
  if (!catalogFile.value) {
    if (savedCatalogFileName.value) {
      return `${t('lastUsedShort')}: ${savedCatalogFileName.value}`;
    }
    return t('notSelected');
  }
  if (!catalogCount.value) return t('parseFailedOrEmpty');
  return t('loadedCount', { count: catalogCount.value });
});

const caption = computed(() => wikiItem.value?.caption);

const briefDescriptionDocument = computed(() => {
  const desc = itemBrief.value?.description;
  if (desc && typeof desc === 'object') {
    return desc as Document;
  }
  return null;
});

const headerBackground = computed(() => {
  return wikiItem.value?.document?.extraInfo?.illustration || itemBrief.value?.cover || '';
});

const extraIllustration = computed(() => {
  return wikiItem.value?.document?.extraInfo?.illustration || '';
});

const tagNameMap = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {};
  const roots = wikiItem.value?.subType?.filterTagTree || [];

  const walk = (node: TagNode) => {
    map[node.id] = node.name;
    node.children?.forEach(walk);
  };

  roots.forEach(walk);
  return map;
});

async function loadFile(newFile: File | null) {
  if (!newFile) {
    resetView();
    return;
  }

  try {
    const text = await newFile.text();
    const data: WikiData = JSON.parse(text);

    // 获取 item 数据
    if (data.data?.item) {
      wikiItem.value = data.data.item;

      // 设置默认选中第一个文档
      const docMap = data.data.item.document?.documentMap;
      if (docMap) {
        const firstDocId = Object.keys(docMap)[0];
        void firstDocId;
      }
    }
  } catch (error) {
    console.error('Failed to load wiki file:', error);
    wikiItem.value = null;
  }
}

function buildCatalogItemMap(data: CatalogData): CatalogItemMap {
  const map: CatalogItemMap = {};
  const catalogList = data.data?.catalog || [];

  catalogList.forEach((category) => {
    category.typeSub?.forEach((subType) => {
      subType.items?.forEach((item) => {
        const name = item.name || item.brief?.name || item.itemId;
        map[item.itemId] = {
          itemId: item.itemId,
          name,
          cover: item.brief?.cover || '',
        };
      });
    });
  });

  return map;
}

async function loadCatalogFile(newFile: File | null) {
  if (!newFile) {
    catalogMap.value = {};
    settingsStore.setWikiCatalogFileName('');
    return;
  }

  try {
    const text = await newFile.text();
    const data: CatalogData = JSON.parse(text);
    catalogMap.value = buildCatalogItemMap(data);
    // 保存文件名以便下次自动加载
    settingsStore.setWikiCatalogFileName(newFile.name);
  } catch (error) {
    console.error('Failed to load catalog file:', error);
    catalogMap.value = {};
  }
}

function resetView() {
  wikiItem.value = null;
  file.value = null;
  // 不重置 catalogFile 和 catalogMap，保留用户选择的目录和代理设置
}

function getDocumentTitle(doc: Document, fallback: string): string {
  for (const blockId of doc.blockIds) {
    const block = doc.blockMap[blockId];
    if (block?.kind === 'text') {
      const kind = block.text?.kind || '';
      if (kind.startsWith('heading') || kind === 'title' || kind === 'subtitle') {
        const text = (block.text.inlineElements || [])
          .filter((el) => el.kind === 'text')
          .map((el) => el.text.text)
          .join('')
          .trim();
        if (text) return text;
      }
    }
  }

  return fallback;
}
</script>

<style scoped lang="scss">
.wiki-renderer-page {
  min-height: 100vh;
  background: #f5f5f5;
  height: 100%;
  overflow-y: auto;
}

.wiki-renderer-page--dark {
  background: #121212;
}

.file-tools {
  padding: 1rem 1.5rem 0;
}

.file-tools-card {
  border: 1px solid #e6e6e6;
  border-radius: 10px;
}

.wiki-card--dark {
  background: #1e1e1e;
  border-color: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.87);
}

.wiki-banner--dark {
  background: rgba(255, 255, 255, 0.08) !important;
  color: rgba(255, 255, 255, 0.9);
}

.wiki-bar--dark {
  background: #1e1e1e;
  color: rgba(255, 255, 255, 0.9);
}

.file-tools-section {
  padding: 1rem 1.25rem;
}

.file-tools-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
}

.file-tools-item {
  flex: 1 1 320px;
  min-width: 280px;
}

.file-tools-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 160px;
}

.image-proxy-settings {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.upload-section {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80vh;
  padding: 2rem;
}

.upload-card {
  width: 100%;
  max-width: 600px;
}

.file-list {
  max-height: calc(100vh - 120px);
  overflow-y: auto;
}

.wiki-content {
  background: white;
}

// 头部样式
.wiki-header {
  position: relative;
  height: 400px;
  overflow: hidden;
}

.header-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  filter: blur(8px);
  transform: scale(1.1);
}

.header-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.7));
}

.header-content {
  position: relative;
  height: 100%;
  display: flex;
  align-items: flex-end;
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.back-btn {
  position: absolute;
  top: 1rem;
  left: 1rem;
}

.header-info {
  display: flex;
  gap: 2rem;
  align-items: flex-end;
  width: 100%;
  flex-wrap: wrap;
}

.cover-image {
  flex-shrink: 0;
  width: 200px;
  height: 200px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  background: white;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.info-text {
  flex: 1;
  color: white;

  .item-name {
    font-size: 2.5rem;
    font-weight: bold;
    margin: 0 0 1rem 0;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .caption {
    font-size: 1rem;
    line-height: 1.6;
    max-width: 800px;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);

    p {
      margin: 0.5rem 0;
    }
  }
}

.hero-illustration {
  flex-shrink: 0;
  width: 420px;
  max-height: 320px;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;

  img {
    max-width: 100%;
    max-height: 320px;
    object-fit: contain;
    filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.35));
  }
}

// 文档主体
.wiki-body {
  max-width: 1200px;
  margin: 0 auto;
  background: white;
  padding: 2rem;
}

.fallback-docs {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.fallback-section {
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #eee;
}

.fallback-section:last-child {
  border-bottom: none;
}

.fallback-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
  margin-bottom: 1rem;
}

// 响应式
@media (max-width: 768px) {
  .wiki-header {
    height: auto;
    min-height: 300px;
  }

  .header-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .cover-image {
    width: 150px;
    height: 150px;
  }

  .info-text .item-name {
    font-size: 1.8rem;
  }

  .hero-illustration {
    width: 100%;
    max-height: 220px;
  }
}
</style>
