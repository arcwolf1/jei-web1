import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import JSZip from 'jszip';
import { idbGetBlob, idbSetBlob } from 'src/jei/utils/idb';
import type {
  PackData,
  PackManifest,
  ItemDef,
  RecipeTypeDef,
  Recipe,
  PackTags,
} from '../jei/types';
import { stableJsonStringify } from 'src/jei/utils/stableJson';
import { collectPackAssetUrls } from 'src/jei/pack/collectAssetUrls';
import { storage } from 'src/utils/storage';
import { packBasePath } from 'src/utils/app-path';

export interface EditorAssetMeta {
  path: string;
  name: string;
  mime: string;
  size: number;
  updatedAt: number;
}

export const useEditorStore = defineStore('editor', () => {
  const STORAGE_KEY = 'jei.editor.packData.v1';
  const ASSETS_META_KEY = 'jei.editor.assetsMeta.v1';

  function makeDefaultManifest(): PackManifest {
    return {
      packId: 'new-pack',
      gameId: 'new-game',
      displayName: 'New Pack',
      version: '0.0.1',
      files: {
        items: 'items.json',
        tags: 'tags.json',
        recipeTypes: 'recipeTypes.json',
        recipes: 'recipes.json',
      },
    };
  }

  const manifest = ref<PackManifest>(makeDefaultManifest());

  const items = ref<ItemDef[]>([]);
  const recipeTypes = ref<RecipeTypeDef[]>([]);
  const recipes = ref<Recipe[]>([]);
  const tags = ref<PackTags>({});
  const assets = ref<EditorAssetMeta[]>([]);
  const baselinePack = ref<PackData | null>(null);
  const baselineAssets = ref<EditorAssetMeta[]>([]);
  const accepted = ref<Record<string, boolean>>({});

  function loadPack(data: PackData) {
    manifest.value = data.manifest;
    items.value = data.items;
    recipeTypes.value = data.recipeTypes;
    recipes.value = data.recipes;
    tags.value = data.tags || {};
  }

  function resetAssets() {
    assets.value = [];
  }

  function loadAssetsMeta(raw: unknown) {
    if (!Array.isArray(raw)) return;
    const parsed: EditorAssetMeta[] = [];
    raw.forEach((v) => {
      if (!v || typeof v !== 'object') return;
      const rec = v as Record<string, unknown>;
      const path = typeof rec.path === 'string' ? rec.path : '';
      const name = typeof rec.name === 'string' ? rec.name : '';
      const mime = typeof rec.mime === 'string' ? rec.mime : 'application/octet-stream';
      const size = typeof rec.size === 'number' ? rec.size : 0;
      const updatedAt = typeof rec.updatedAt === 'number' ? rec.updatedAt : 0;
      if (!path || !name) return;
      parsed.push({ path, name, mime, size, updatedAt });
    });
    assets.value = parsed;
  }

  function resetPack() {
    manifest.value = makeDefaultManifest();
    items.value = [];
    recipeTypes.value = [];
    recipes.value = [];
    tags.value = {};
  }

  function setBaselineFromCurrent() {
    baselinePack.value = exportPack();
    baselineAssets.value = JSON.parse(JSON.stringify(assets.value)) as EditorAssetMeta[];
    accepted.value = {};
  }

  function exportPack(): PackData {
    return {
      manifest: JSON.parse(JSON.stringify(manifest.value)),
      items: JSON.parse(JSON.stringify(items.value)),
      recipeTypes: JSON.parse(JSON.stringify(recipeTypes.value)),
      recipes: JSON.parse(JSON.stringify(recipes.value)),
      tags: JSON.parse(JSON.stringify(tags.value)),
    };
  }

  function clearPersistedPack() {
    if (storage.isUsingJEIStorage()) {
      void storage.removeItem(STORAGE_KEY);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function clearPersistedAssetsMeta() {
    if (storage.isUsingJEIStorage()) {
      void storage.removeItem(ASSETS_META_KEY);
    } else {
      localStorage.removeItem(ASSETS_META_KEY);
    }
  }

  function clearAssets() {
    assets.value = [];
    clearPersistedAssetsMeta();
  }

  function clearPersistedAll() {
    clearPersistedPack();
    clearAssets();
  }

  // Async initialization for JEIStorage
  async function tryRestorePersistedPack() {
    try {
      const raw = storage.isUsingJEIStorage()
        ? await storage.getItem(STORAGE_KEY)
        : localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PackData;
      if (!parsed?.manifest) return;
      loadPack(parsed);
    } catch {
      return;
    }
  }

  async function tryRestoreAssetsMeta() {
    try {
      const raw = storage.isUsingJEIStorage()
        ? await storage.getItem(ASSETS_META_KEY)
        : localStorage.getItem(ASSETS_META_KEY);
      if (!raw) return;
      loadAssetsMeta(JSON.parse(raw));
    } catch {
      return;
    }
  }

  // Initialize - async if using JEIStorage
  if (storage.isUsingJEIStorage()) {
    tryRestorePersistedPack().catch((e) => console.error('[Editor] Failed to restore pack:', e));
    tryRestoreAssetsMeta().catch((e) => console.error('[Editor] Failed to restore assets:', e));
  } else {
    // Synchronous initialization for localStorage
    (function tryRestoreSync() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as PackData;
        if (!parsed?.manifest) return;
        loadPack(parsed);
      } catch {
        return;
      }
    })();

    (function tryRestoreAssetsMetaSync() {
      try {
        const raw = localStorage.getItem(ASSETS_META_KEY);
        if (!raw) return;
        loadAssetsMeta(JSON.parse(raw));
      } catch {
        return;
      }
    })();
  }

  if (!baselinePack.value) {
    baselinePack.value = exportPack();
    baselineAssets.value = JSON.parse(JSON.stringify(assets.value)) as EditorAssetMeta[];
  }

  watch(
    [manifest, items, recipeTypes, recipes, tags],
    () => {
      try {
        const value = JSON.stringify(exportPack());
        if (storage.isUsingJEIStorage()) {
          void storage.setItem(STORAGE_KEY, value);
        } else {
          localStorage.setItem(STORAGE_KEY, value);
        }
      } catch {
        return;
      }
    },
    { deep: true },
  );

  watch(
    assets,
    () => {
      try {
        const value = JSON.stringify(assets.value);
        if (storage.isUsingJEIStorage()) {
          void storage.setItem(ASSETS_META_KEY, value);
        } else {
          localStorage.setItem(ASSETS_META_KEY, value);
        }
      } catch {
        return;
      }
    },
    { deep: true },
  );

  function sanitizeFilename(name: string): string {
    return name.replace(/[\\/:*?"<>|]/g, '_');
  }

  function uniqueAssetPath(filename: string): string {
    const base = sanitizeFilename(filename || 'image');
    const existing = new Set(assets.value.map((a) => a.path));
    if (!existing.has(`assets/${base}`)) return `assets/${base}`;
    const dot = base.lastIndexOf('.');
    const stem = dot > 0 ? base.slice(0, dot) : base;
    const ext = dot > 0 ? base.slice(dot) : '';
    let i = 1;
    while (existing.has(`assets/${stem} (${i})${ext}`)) i += 1;
    return `assets/${stem} (${i})${ext}`;
  }

  async function addAssetFiles(files: File[]) {
    for (const file of files) {
      const path = uniqueAssetPath(file.name);
      await idbSetBlob(path, file);
      assets.value = assets.value.filter((a) => a.path !== path);
      assets.value.push({
        path,
        name: path.split('/').slice(-1)[0] ?? file.name,
        mime: file.type || 'application/octet-stream',
        size: file.size,
        updatedAt: Date.now(),
      });
    }
  }

  async function addAssetBlobs(entries: { path: string; blob: Blob }[]) {
    for (const entry of entries) {
      const name = entry.path.split('/').slice(-1)[0] ?? entry.path;
      await idbSetBlob(entry.path, entry.blob);
      assets.value = assets.value.filter((a) => a.path !== entry.path);
      assets.value.push({
        path: entry.path,
        name,
        mime: entry.blob.type || 'application/octet-stream',
        size: entry.blob.size,
        updatedAt: Date.now(),
      });
    }
  }

  async function getAssetBlob(path: string): Promise<Blob | undefined> {
    try {
      return await idbGetBlob(path);
    } catch {
      return undefined;
    }
  }

  function deleteAsset(path: string): void {
    assets.value = assets.value.filter((a) => a.path !== path);
  }

  function prettyStable(value: unknown): string {
    try {
      return JSON.stringify(JSON.parse(stableJsonStringify(value)), null, 2);
    } catch {
      return JSON.stringify(value, null, 2);
    }
  }

  type ChangeKey = 'manifest' | 'items' | 'recipeTypes' | 'recipes' | 'tags' | 'assets';

  const changeBlocks = computed(() => {
    const base = baselinePack.value ?? exportPack();
    const blocks: {
      key: ChangeKey;
      title: string;
      before: string;
      after: string;
      accepted: boolean;
    }[] = [];

    const pushIfChanged = (
      key: ChangeKey,
      title: string,
      beforeVal: unknown,
      afterVal: unknown,
    ) => {
      const before = prettyStable(beforeVal);
      const after = prettyStable(afterVal);
      if (before !== after) {
        blocks.push({ key, title, before, after, accepted: !!accepted.value[key] });
      }
    };

    pushIfChanged('manifest', 'manifest.json', base.manifest, manifest.value);
    pushIfChanged('items', base.manifest.files.items || 'items.json', base.items, items.value);
    pushIfChanged(
      'recipeTypes',
      base.manifest.files.recipeTypes,
      base.recipeTypes,
      recipeTypes.value,
    );
    pushIfChanged('recipes', base.manifest.files.recipes, base.recipes, recipes.value);
    pushIfChanged('tags', base.manifest.files.tags || 'tags.json', base.tags ?? {}, tags.value);
    pushIfChanged('assets', 'assets', baselineAssets.value, assets.value);

    return blocks;
  });

  const hasAcceptedChanges = computed(() => {
    const keys = new Set(changeBlocks.value.map((b) => b.key));
    return Array.from(keys).some((k) => accepted.value[k]);
  });

  function acceptBlock(key: ChangeKey) {
    accepted.value[key] = true;
  }

  function undoBlock(key: ChangeKey) {
    const base = baselinePack.value ?? exportPack();
    if (key === 'manifest') manifest.value = JSON.parse(JSON.stringify(base.manifest));
    if (key === 'items') items.value = JSON.parse(JSON.stringify(base.items));
    if (key === 'recipeTypes') recipeTypes.value = JSON.parse(JSON.stringify(base.recipeTypes));
    if (key === 'recipes') recipes.value = JSON.parse(JSON.stringify(base.recipes));
    if (key === 'tags') tags.value = JSON.parse(JSON.stringify(base.tags ?? {}));
    if (key === 'assets') assets.value = JSON.parse(JSON.stringify(baselineAssets.value));
    delete accepted.value[key];
  }

  function acceptAll() {
    changeBlocks.value.forEach((b) => {
      accepted.value[b.key] = true;
    });
  }

  function undoAll() {
    (['manifest', 'items', 'recipeTypes', 'recipes', 'tags', 'assets'] as ChangeKey[]).forEach(
      (k) => undoBlock(k),
    );
    accepted.value = {};
  }

  function buildStagedPack(): { pack: PackData; assets: EditorAssetMeta[] } {
    const base = baselinePack.value ?? exportPack();
    const out: PackData = exportPack();
    if (!accepted.value.manifest) out.manifest = JSON.parse(JSON.stringify(base.manifest));
    if (!accepted.value.items) out.items = JSON.parse(JSON.stringify(base.items));
    if (!accepted.value.recipeTypes) out.recipeTypes = JSON.parse(JSON.stringify(base.recipeTypes));
    if (!accepted.value.recipes) out.recipes = JSON.parse(JSON.stringify(base.recipes));
    if (!accepted.value.tags) out.tags = JSON.parse(JSON.stringify(base.tags ?? {}));
    const outAssets = accepted.value.assets
      ? JSON.parse(JSON.stringify(assets.value))
      : JSON.parse(JSON.stringify(baselineAssets.value));
    return { pack: out, assets: outAssets as EditorAssetMeta[] };
  }

  function getSaveSnapshot(): { pack: PackData; assets: EditorAssetMeta[] } {
    return hasAcceptedChanges.value
      ? buildStagedPack()
      : { pack: exportPack(), assets: assets.value };
  }

  function commitAcceptedToBaseline() {
    const snapshot = getSaveSnapshot();
    baselinePack.value = JSON.parse(JSON.stringify(snapshot.pack));
    baselineAssets.value = JSON.parse(JSON.stringify(snapshot.assets)) as EditorAssetMeta[];
    accepted.value = {};
  }

  async function buildZipForExport(args: { includeReferenced: boolean }): Promise<Blob> {
    const staged = getSaveSnapshot();
    const pack = staged.pack;
    const packId = pack.manifest.packId || 'pack';
    const zip = new JSZip();
    const folder = zip.folder(packId);
    if (!folder) throw new Error('Failed to create zip');

    folder.file('manifest.json', JSON.stringify(pack.manifest, null, 2));
    const files = pack.manifest.files;
    if (files.items) folder.file(files.items, JSON.stringify(pack.items, null, 2));
    if (files.tags) folder.file(files.tags, JSON.stringify(pack.tags ?? {}, null, 2));
    if (files.recipeTypes)
      folder.file(files.recipeTypes, JSON.stringify(pack.recipeTypes, null, 2));
    if (files.recipes) folder.file(files.recipes, JSON.stringify(pack.recipes, null, 2));

    for (const asset of staged.assets) {
      const blob = await getAssetBlob(asset.path);
      if (!blob) continue;
      folder.file(asset.path, blob);
    }

    if (args.includeReferenced) {
      const referenced = collectPackAssetUrls({
        packId,
        items: pack.items,
        recipeTypes: pack.recipeTypes,
        recipes: pack.recipes,
      });
      const baseUrl = packBasePath(packId, true);
      const existing = new Set(staged.assets.map((a) => `${baseUrl}${a.path}`));
      for (const url of referenced) {
        if (existing.has(url)) continue;
        const rel = url.startsWith(baseUrl) ? url.slice(baseUrl.length) : null;
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

    return zip.generateAsync({ type: 'blob' });
  }

  // Items
  function addItem(item: ItemDef) {
    items.value.push(item);
  }

  function updateItem(index: number, item: ItemDef) {
    items.value[index] = item;
  }

  function deleteItem(index: number) {
    items.value.splice(index, 1);
  }

  // Recipe Types
  function addRecipeType(type: RecipeTypeDef) {
    recipeTypes.value.push(type);
  }

  function updateRecipeType(index: number, type: RecipeTypeDef) {
    recipeTypes.value[index] = type;
  }

  function deleteRecipeType(index: number) {
    recipeTypes.value.splice(index, 1);
  }

  // Recipes
  function addRecipe(recipe: Recipe) {
    recipes.value.push(recipe);
  }

  function updateRecipe(index: number, recipe: Recipe) {
    recipes.value[index] = recipe;
  }

  function deleteRecipe(index: number) {
    recipes.value.splice(index, 1);
  }

  return {
    manifest,
    items,
    recipeTypes,
    recipes,
    tags,
    assets,
    baselinePack,
    changeBlocks,
    hasAcceptedChanges,
    loadPack,
    resetPack,
    exportPack,
    clearPersistedPack,
    clearPersistedAll,
    resetAssets,
    addAssetFiles,
    addAssetBlobs,
    getAssetBlob,
    deleteAsset,
    setBaselineFromCurrent,
    acceptBlock,
    undoBlock,
    acceptAll,
    undoAll,
    getSaveSnapshot,
    commitAcceptedToBaseline,
    buildZipForExport,
    addItem,
    updateItem,
    deleteItem,
    addRecipeType,
    updateRecipeType,
    deleteRecipeType,
    addRecipe,
    updateRecipe,
    deleteRecipe,
  };
});
