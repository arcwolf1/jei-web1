<template>
  <q-page padding>
    <div class="text-h4 q-mb-md">Dashboard</div>
    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-6">
        <q-card class="q-mb-md">
          <q-card-section>
            <div class="text-h6">Load Existing Pack</div>
          </q-card-section>
          <q-card-section>
            <div class="row q-col-gutter-sm items-center">
              <div class="col-grow">
                <q-select
                  v-model="selectedPack"
                  :options="availablePacks"
                  option-value="packId"
                  option-label="label"
                  label="Select Pack"
                  filled
                />
              </div>
              <div class="col-auto q-gutter-sm">
                <q-btn
                  color="primary"
                  icon="cloud_download"
                  label="Load"
                  @click="loadSelectedPack"
                  :disable="!selectedPack"
                  :loading="loading"
                />
                <q-btn
                  color="secondary"
                  icon="note_add"
                  label="New"
                  @click="newPack"
                  :disable="loading"
                />
                <q-btn
                  color="negative"
                  icon="delete_sweep"
                  label="Clear"
                  flat
                  @click="clearPack"
                  :disable="loading"
                />
              </div>
            </div>
          </q-card-section>
        </q-card>

        <q-card>
          <q-card-section>
            <div class="text-h6">Pack Info</div>
          </q-card-section>
          <q-card-section>
            <q-input v-model="store.manifest.packId" label="Pack ID" />
            <q-input v-model="store.manifest.displayName" label="Display Name" />
            <q-input v-model="store.manifest.version" label="Version" />
            <q-input v-model="store.manifest.gameId" label="Game ID" />
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-md-6">
        <q-card>
          <q-card-section>
            <div class="text-h6">Actions</div>
          </q-card-section>
          <q-card-section class="q-gutter-sm">
            <q-btn color="secondary" icon="download" label="Export JSON" @click="exportJson" />
            <q-btn color="secondary" icon="archive" label="Export ZIP" @click="exportZip" />
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useEditorStore } from 'src/stores/editor';
import { useQuasar } from 'quasar';
import { loadPack } from 'src/jei/pack/loader';
import JSZip from 'jszip';
import { collectPackAssetUrls } from 'src/jei/pack/collectAssetUrls';
import { appPath, packBasePath } from 'src/utils/app-path';

interface PackEntry {
  packId: string;
  label: string;
}

const store = useEditorStore();
const $q = useQuasar();

const availablePacks = ref<PackEntry[]>([]);
const selectedPack = ref<PackEntry | null>(null);
const loading = ref(false);

onMounted(async () => {
  try {
    const res = await fetch(appPath('/packs/index.json'));
    if (res.ok) {
      const data = await res.json();
      availablePacks.value = data.packs || [];
    }
  } catch (e) {
    console.error('Failed to load pack list', e);
    $q.notify({ type: 'warning', message: 'Failed to load pack list from server' });
  }
});

async function loadSelectedPack() {
  if (!selectedPack.value) return;

  loading.value = true;
  try {
    const packData = await loadPack(selectedPack.value.packId);
    store.loadPack(packData);
    $q.notify({
      type: 'positive',
      message: `Pack "${selectedPack.value.label}" loaded successfully`,
    });
  } catch (e) {
    console.error(e);
    $q.notify({ type: 'negative', message: `Failed to load pack: ${String(e)}` });
  } finally {
    loading.value = false;
  }
}

function newPack() {
  store.resetPack();
  $q.notify({ type: 'positive', message: 'New pack created' });
}

function clearPack() {
  store.resetPack();
  store.clearPersistedAll();
  $q.notify({ type: 'warning', message: 'Editor data cleared' });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportJson() {
  const data = store.exportPack();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `${store.manifest.packId || 'pack'}.json`);
}

async function exportZip() {
  const pack = store.exportPack();
  const packId = pack.manifest.packId || 'pack';
  const zip = new JSZip();
  const folder = zip.folder(packId);
  if (!folder) return;

  folder.file('manifest.json', JSON.stringify(pack.manifest, null, 2));

  const files = pack.manifest.files;
  // 处理物品数据 - 支持数组模式和目录模式
  if (files.items) {
    if (files.items.endsWith('/')) {
      // 目录模式：为每个物品创建单独的文件
      const itemsDir = folder.folder(files.items);
      if (!itemsDir) return;

      // 创建物品索引文件
      const itemFiles: string[] = [];
      for (const item of pack.items) {
        const itemId = item.key.id;
        const fileName = `${itemId.replace(/[/\\:*?"<>|]/g, '_')}.json`;
        itemsDir.file(fileName, JSON.stringify(item, null, 2));
        itemFiles.push(`${files.items}${fileName}`);
      }

      // 创建 itemsIndex.json
      if (files.itemsIndex) {
        folder.file(files.itemsIndex, JSON.stringify(itemFiles, null, 2));
      }
    } else {
      // 数组模式：所有物品在一个文件中
      folder.file(files.items, JSON.stringify(pack.items, null, 2));
    }
  }

  if (files.tags) folder.file(files.tags, JSON.stringify(pack.tags ?? {}, null, 2));
  if (files.recipeTypes) folder.file(files.recipeTypes, JSON.stringify(pack.recipeTypes, null, 2));
  if (files.recipes) folder.file(files.recipes, JSON.stringify(pack.recipes, null, 2));

  if (store.assets.length) {
    for (const asset of store.assets) {
      const blob = await store.getAssetBlob(asset.path);
      if (!blob) continue;
      folder.file(asset.path, blob);
    }
  }

  const referenced = collectPackAssetUrls({
    packId,
    items: store.items,
    recipeTypes: store.recipeTypes,
    recipes: store.recipes,
  });
  if (referenced.length) {
    const base = packBasePath(packId, true);
    const existing = new Set(store.assets.map((a) => `${base}${a.path}`));
    for (const url of referenced) {
      if (existing.has(url)) continue;
      const rel = url.startsWith(base) ? url.slice(base.length) : null;
      if (!rel) continue;
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const blob = await res.blob();
        if (!blob.type.startsWith('image/')) continue;
        folder.file(rel, blob);
      } catch {
        continue;
      }
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, `${packId}.zip`);
}
</script>
