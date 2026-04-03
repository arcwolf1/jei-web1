<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="text-h4">Assets</div>
      <q-space />
      <q-btn color="primary" icon="upload" label="Add Images" @click="pickFiles" />
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        multiple
        style="display: none"
        @change="onFilesSelected"
      />
    </div>

    <q-card class="q-mb-md">
      <q-card-section>
        <div class="text-subtitle1">Pack Asset Base</div>
        <q-input :model-value="packBase" readonly filled />
      </q-card-section>
    </q-card>

    <q-card>
      <q-card-section>
        <div class="row items-center q-mb-sm">
          <div class="text-h6">Managed Files</div>
          <q-space />
          <q-badge color="grey-7" :label="`${store.assets.length}`" />
        </div>

        <q-list bordered separator v-if="store.assets.length">
          <q-item v-for="asset in store.assets" :key="asset.path">
            <q-item-section avatar>
              <q-img
                v-if="previewUrls[asset.path]"
                :src="previewUrls[asset.path]"
                width="40px"
                height="40px"
                fit="contain"
                class="cursor-pointer"
                @click="openViewer(previewUrls[asset.path] || '', asset.name)"
              />
              <q-icon v-else name="image" size="32px" />
            </q-item-section>

            <q-item-section>
              <q-item-label>{{ asset.name }}</q-item-label>
              <q-item-label caption>{{ asset.path }}</q-item-label>
              <q-item-label caption>{{ packUrlFor(asset.path) }}</q-item-label>
            </q-item-section>

            <q-item-section side>
              <div class="row q-gutter-sm items-center">
                <q-btn flat icon="content_copy" @click="copyText(packUrlFor(asset.path))" />
                <q-btn flat icon="delete" color="negative" @click="removeAsset(asset.path)" />
              </div>
            </q-item-section>
          </q-item>
        </q-list>

        <div v-else class="text-grey q-pa-md">No assets yet</div>
      </q-card-section>
    </q-card>

    <q-card class="q-mt-md">
      <q-card-section>
        <div class="row items-center q-mb-sm">
          <div class="text-h6">Referenced In Pack</div>
          <q-space />
          <q-badge color="grey-7" :label="`${referencedAssets.length}`" />
        </div>

        <q-list bordered separator v-if="referencedAssets.length">
          <q-item v-for="url in referencedAssets" :key="url">
            <q-item-section avatar>
              <q-img
                :src="url"
                width="40px"
                height="40px"
                fit="contain"
                class="cursor-pointer"
                @click="openViewer(url)"
              />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ urlToName(url) }}</q-item-label>
              <q-item-label caption>{{ url }}</q-item-label>
              <q-item-label caption>{{ urlToPackRelativePath(url) }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn flat icon="content_copy" @click="copyText(url)" />
            </q-item-section>
          </q-item>
        </q-list>

        <div v-else class="text-grey q-pa-md">No referenced assets found</div>
      </q-card-section>
    </q-card>

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
  </q-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watchEffect } from 'vue';
import { useEditorStore } from 'src/stores/editor';
import { useQuasar } from 'quasar';
import { collectPackAssetUrls } from 'src/jei/pack/collectAssetUrls';
import InlineImageViewer from 'src/components/InlineImageViewer.vue';
import { packBasePath as buildPackBasePath } from 'src/utils/app-path';

const store = useEditorStore();
const $q = useQuasar();

const fileInput = ref<HTMLInputElement | null>(null);
const previewUrls = reactive<Record<string, string>>({});
const viewerOpen = ref(false);
const viewerSrc = ref('');
const viewerName = ref('');

const packBase = computed(() => buildPackBasePath(store.manifest.packId || 'pack', true));

function packUrlFor(path: string) {
  return `${packBase.value}${path}`;
}

const referencedAssets = computed(() => {
  const packId = store.manifest.packId;
  if (!packId) return [];
  return collectPackAssetUrls({
    packId,
    items: store.items,
    recipeTypes: store.recipeTypes,
    recipes: store.recipes,
  });
});

function urlToPackRelativePath(url: string): string {
  const base = packBase.value;
  if (!url.startsWith(base)) return url;
  return url.slice(base.length);
}

function urlToName(url: string): string {
  const rel = urlToPackRelativePath(url);
  const parts = rel.split('/');
  return parts[parts.length - 1] || rel;
}

function openViewer(src: string, name?: string) {
  if (!src) return;
  viewerSrc.value = src;
  viewerName.value = name || urlToName(src);
  viewerOpen.value = true;
}

function pickFiles() {
  fileInput.value?.click();
}

async function onFilesSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = input.files ? Array.from(input.files) : [];
  input.value = '';
  if (!files.length) return;
  await store.addAssetFiles(files);
  $q.notify({ type: 'positive', message: `Added ${files.length} file(s)` });
}

async function ensurePreviewUrl(path: string) {
  if (previewUrls[path]) return;
  const blob = await store.getAssetBlob(path);
  if (!blob) return;
  previewUrls[path] = URL.createObjectURL(blob);
}

function removeAsset(path: string) {
  store.deleteAsset(path);
  const url = previewUrls[path];
  if (url) URL.revokeObjectURL(url);
  delete previewUrls[path];
  $q.notify({ type: 'warning', message: 'Asset deleted' });
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    $q.notify({ type: 'positive', message: 'Copied' });
  } catch {
    $q.notify({ type: 'warning', message: text });
  }
}

watchEffect(() => {
  store.assets.forEach((a) => {
    void ensurePreviewUrl(a.path);
  });
});

onBeforeUnmount(() => {
  Object.values(previewUrls).forEach((u) => URL.revokeObjectURL(u));
});
</script>
