import type { ItemDef, PackData, PackManifest, PackTags, Recipe, RecipeTypeDef } from 'src/jei/types';
import { stableJsonStringify } from 'src/jei/utils/stableJson';
import { idbClearRemoteCache, idbGetPackZip, idbGetRemoteCache, idbSetRemoteCache } from 'src/jei/utils/idb';
import { assertItemDef, assertPackManifest, assertPackTags, assertRecipe, assertRecipeTypeDef } from './validate';
import { applyImageProxyToItem, applyImageProxyToPack, ensurePackImageProxyTokens } from './imageProxy';
import JSZip from 'jszip';

const packRefreshToken = new Map<string, string>();

function withRefreshToken(url: string, packId?: string): string {
  if (!packId) return url;
  const token = packRefreshToken.get(packId);
  if (!token) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}__refresh=${encodeURIComponent(token)}`;
}

async function fetchWithRefresh(url: string, packId?: string, init?: RequestInit): Promise<Response> {
  const requestUrl = withRefreshToken(url, packId);
  const res = await fetch(requestUrl, {
    ...init,
    ...(packId && packRefreshToken.has(packId) ? { cache: 'no-store' as const } : {}),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to fetch ${requestUrl} (${res.status}): ${body || res.statusText}`);
  }
  return res;
}

async function fetchJson(url: string, packId?: string): Promise<unknown> {
  const res = await fetchWithRefresh(url, packId, { headers: { Accept: 'application/json' } });
  return res.json();
}

async function fetchText(url: string, packId?: string): Promise<string> {
  const res = await fetchWithRefresh(url, packId);
  return res.text();
}

async function tryFetchIndexTimestamp(baseUrl: string, packId: string): Promise<string | null> {
  try {
    // 尝试获取 index.html (通常是 baseUrl 对应的页面)
    // 确保以 / 结尾
    const url = baseUrl.replace(/\/+$/, '') + '/';
    const html = await fetchText(url, packId);
    // 匹配 <p>Generated: 2026-03-10T17:53:42.317Z</p>
    const match = html.match(/<p>\s*Generated:\s*(.*?)\s*<\/p>/i);
    if (match && match[1]) {
      return match[1].trim();
    }
  } catch {
    // 忽略错误，不是所有 pack 都有 index.html
  }
  return null;
}

const jsonArrayCache = new Map<string, Promise<unknown>>();
const manifestCache = new Map<string, Promise<PackManifest>>();

export interface PackSource {
  packId: string;
  label: string;
  mirrors: string[];
}

const packRegistry = new Map<string, PackSource>();
const activePackBaseUrl = new Map<string, string>();
const packMirrorMode = new Map<string, 'auto' | 'manual'>();
const packManualMirror = new Map<string, string>();
const mirrorLatencyCache = new Map<string, { latencyMs: number | null; measuredAt: number }>();
const mirrorLatencyWarmupTask = new Map<string, Promise<void>>();

const MIRROR_LATENCY_TIMEOUT_MS = 4500;
const MIRROR_LATENCY_CACHE_TTL_MS = 2 * 60 * 1000;

function mirrorLatencyCacheKey(packId: string, url: string): string {
  return `${packId}::${url.replace(/\/+$/, '')}`;
}

function clearMirrorLatencyCache(packId?: string): void {
  if (!packId) {
    mirrorLatencyCache.clear();
    return;
  }
  const prefix = `${packId}::`;
  for (const key of mirrorLatencyCache.keys()) {
    if (key.startsWith(prefix)) mirrorLatencyCache.delete(key);
  }
}

function readCachedMirrorLatency(packId: string, url: string): number | null | undefined {
  const key = mirrorLatencyCacheKey(packId, url);
  const cached = mirrorLatencyCache.get(key);
  if (!cached) return undefined;
  if (Date.now() - cached.measuredAt > MIRROR_LATENCY_CACHE_TTL_MS) {
    mirrorLatencyCache.delete(key);
    return undefined;
  }
  return cached.latencyMs;
}

function writeCachedMirrorLatency(packId: string, url: string, latencyMs: number | null): void {
  mirrorLatencyCache.set(mirrorLatencyCacheKey(packId, url), {
    latencyMs,
    measuredAt: Date.now(),
  });
}

export function setPackMirrorLatencyHint(
  packId: string,
  baseUrl: string,
  latencyMs: number | null,
): void {
  writeCachedMirrorLatency(packId, baseUrl, latencyMs);
}

async function probeMirrorLatency(packId: string, baseUrl: string): Promise<number | null> {
  if (typeof window === 'undefined') return null;
  const endpoint = withRefreshToken(
    `${baseUrl.replace(/\/+$/, '')}/manifest.json?__probe=${Date.now()}`,
    packId,
  );
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), MIRROR_LATENCY_TIMEOUT_MS);
  const t0 = performance.now();
  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return performance.now() - t0;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

function rankPackBaseUrlsForAutoMode(packId: string, baseUrls: string[]): string[] {
  if (baseUrls.length <= 1) return baseUrls;
  return baseUrls
    .map((url, idx) => ({
      url,
      idx,
      latencyMs: readCachedMirrorLatency(packId, url),
    }))
    .sort((a, b) => {
      if (typeof a.latencyMs === 'number' && typeof b.latencyMs === 'number') {
        const delta = a.latencyMs - b.latencyMs;
        // Keep host-proximity order when RTT is effectively tied.
        if (Math.abs(delta) > 20) return delta;
      }
      const aOk = typeof a.latencyMs === 'number';
      const bOk = typeof b.latencyMs === 'number';
      if (aOk !== bOk) return aOk ? -1 : 1;
      const aDead = a.latencyMs === null;
      const bDead = b.latencyMs === null;
      if (aDead !== bDead) return aDead ? 1 : -1;
      return a.idx - b.idx;
    })
    .map((it) => it.url);
}

function scheduleMirrorLatencyWarmup(packId: string, baseUrls: string[]): void {
  if (typeof window === 'undefined' || baseUrls.length <= 1) return;
  if (mirrorLatencyWarmupTask.has(packId)) return;
  const task = (async () => {
    await Promise.allSettled(
      baseUrls.map(async (baseUrl) => {
        if (readCachedMirrorLatency(packId, baseUrl) !== undefined) return;
        const measured = await probeMirrorLatency(packId, baseUrl);
        writeCachedMirrorLatency(packId, baseUrl, measured);
      }),
    );
  })()
    .catch(() => undefined)
    .finally(() => {
      mirrorLatencyWarmupTask.delete(packId);
    });
  mirrorLatencyWarmupTask.set(packId, task);
}

export function clearPackRuntimeCache(packId?: string) {
  if (packId) {
    manifestCache.delete(packId);
    activePackBaseUrl.delete(packId);
    clearMirrorLatencyCache(packId);
    mirrorLatencyWarmupTask.delete(packId);
    packRefreshToken.set(packId, `${Date.now()}`);
    for (const key of jsonArrayCache.keys()) {
      if (key.startsWith(`${packId}:`)) {
        jsonArrayCache.delete(key);
      }
    }
    // 异步清除 IndexedDB 缓存
    idbClearRemoteCache(packId).catch((e) => console.warn('Failed to clear remote cache', e));
    return;
  }
  manifestCache.clear();
  activePackBaseUrl.clear();
  clearMirrorLatencyCache();
  mirrorLatencyWarmupTask.clear();
  jsonArrayCache.clear();
  packRefreshToken.clear();
  // 异步清除所有 IndexedDB 缓存
  idbClearRemoteCache().catch((e) => console.warn('Failed to clear all remote cache', e));
}

export function registerPackSource(source: PackSource) {
  packRegistry.set(source.packId, source);
}

export function getPackSource(packId: string): PackSource | undefined {
  return packRegistry.get(packId);
}

export function setPackMirrorPreference(
  packId: string,
  mode: 'auto' | 'manual',
  manualMirror?: string,
) {
  packMirrorMode.set(packId, mode);
  if (mode === 'manual' && manualMirror) {
    packManualMirror.set(packId, manualMirror.replace(/\/+$/, ''));
  } else if (mode === 'auto') {
    packManualMirror.delete(packId);
  }
  activePackBaseUrl.delete(packId);
  manifestCache.delete(packId);
}

function registrableDomain(hostname: string): string {
  const parts = hostname.split('.').filter(Boolean);
  if (parts.length < 2) return hostname;
  return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
}

function suffixMatchScore(a: string, b: string): number {
  const pa = a.split('.').filter(Boolean).reverse();
  const pb = b.split('.').filter(Boolean).reverse();
  const n = Math.min(pa.length, pb.length);
  let score = 0;
  for (let i = 0; i < n; i += 1) {
    if (pa[i] !== pb[i]) break;
    score += 1;
  }
  return score;
}

function scoreMirrorUrlByHostProximity(url: string, current: URL): number {
  let target: URL;
  try {
    target = new URL(url, current.origin);
  } catch {
    return -1;
  }
  const targetHost = target.hostname;
  if (!targetHost) return -1;
  let score = 0;
  if (targetHost === current.hostname) score += 10000;
  if (registrableDomain(targetHost) === registrableDomain(current.hostname)) score += 2000;
  score += suffixMatchScore(targetHost, current.hostname) * 100;
  if (target.protocol === current.protocol) score += 10;
  return score;
}

export function getPackBaseUrls(packId: string): string[] {
  const source = packRegistry.get(packId);
  if (source?.mirrors?.length) {
    const mirrors = Array.from(
      new Set(source.mirrors.map((m) => m.replace(/\/+$/, '')).filter((m) => m.length > 0)),
    );
    if (!mirrors.length) {
      const safe = encodeURIComponent(packId);
      return [`/packs/${safe}`];
    }
    const mode = packMirrorMode.get(packId) ?? 'auto';
    const manual = packManualMirror.get(packId);
    if (mode === 'manual' && manual && mirrors.includes(manual)) {
      return [manual, ...mirrors.filter((m) => m !== manual)];
    }
    if (typeof window === 'undefined') return mirrors;
    const current = new URL(window.location.href);
    return mirrors
      .map((url, idx) => ({
        url,
        idx,
        score: scoreMirrorUrlByHostProximity(url, current),
      }))
      .sort((a, b) => b.score - a.score || a.idx - b.idx)
      .map((it) => it.url);
  }
  const safe = encodeURIComponent(packId);
  return [`/packs/${safe}`];
}

export function packBaseUrl(packId: string): string {
  if (activePackBaseUrl.has(packId)) {
    return activePackBaseUrl.get(packId)!;
  }
  const urls = getPackBaseUrls(packId);
  return urls[0] ?? '';
}

export function getActivePackBaseUrl(packId: string): string | null {
  return activePackBaseUrl.get(packId) ?? null;
}

function itemKeyHash(def: { key: { id: string; meta?: number | string; nbt?: unknown } }): string {
  return `${def.key.id}::${def.key.meta ?? ''}::${stableJsonStringify(def.key.nbt ?? null)}`;
}

function mergeInlineItems(items: ItemDef[], recipes: Recipe[]): ItemDef[] {
  const byHash = new Map<string, ItemDef>();
  items.forEach((it) => byHash.set(itemKeyHash(it), it));
  recipes.forEach((r) => {
    r.inlineItems?.forEach((it) => {
      const key = itemKeyHash(it);
      if (!byHash.has(key)) byHash.set(key, it);
    });
  });
  return Array.from(byHash.values());
}

function extractInlineRecipes(items: ItemDef[]): Recipe[] {
  const recipes: Recipe[] = [];
  items.forEach((item) => {
    if (item.recipes) {
      item.recipes.forEach((r) => {
        recipes.push({
          id: r.id,
          type: r.type,
          slotContents: r.slotContents,
          params: r.params ?? {},
          inlineItems: r.inlineItems ?? [],
        });
      });
    }
  });
  return recipes;
}

function extractWikiData(items: ItemDef[]): Record<string, Record<string, unknown>> {
  const wikiMap: Record<string, Record<string, unknown>> = {};
  items.forEach((item) => {
    if (item.wiki && item.key.id) {
      wikiMap[item.key.id] = item.wiki;
    }
  });
  return wikiMap;
}

type ManifestLoadResult = {
  baseUrl: string;
  manifest: PackManifest;
};

async function fetchManifestFromMirror(packId: string, baseUrl: string): Promise<ManifestLoadResult> {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  try {
    const raw = await fetchJson(`${baseUrl}/manifest.json`, packId);
    const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
    writeCachedMirrorLatency(packId, baseUrl, elapsed);
    const manifest = assertPackManifest(raw, '$.manifest');
    if (manifest.packId !== packId) {
      throw new Error(`packId mismatch: requested "${packId}", manifest has "${manifest.packId}"`);
    }
    return { baseUrl, manifest };
  } catch (e) {
    writeCachedMirrorLatency(packId, baseUrl, null);
    throw e;
  }
}

function buildManifestLoadError(
  packId: string,
  failures: Array<{ baseUrl: string; error: unknown }>,
): Error {
  if (!failures.length) {
    return new Error(`Failed to load manifest for ${packId}`);
  }
  const details = failures
    .slice(0, 3)
    .map(({ baseUrl, error }) => `${baseUrl}: ${error instanceof Error ? error.message : String(error)}`)
    .join(' | ');
  const suffix = failures.length > 3 ? ` (+${failures.length - 3} more)` : '';
  return new Error(`Failed to load manifest for ${packId}. ${details}${suffix}`);
}

async function loadManifestByRace(packId: string, baseUrls: string[]): Promise<ManifestLoadResult> {
  if (!baseUrls.length) {
    throw new Error(`No mirror base URLs for pack ${packId}`);
  }
  if (baseUrls.length === 1) {
    return fetchManifestFromMirror(packId, baseUrls[0]!);
  }

  return new Promise<ManifestLoadResult>((resolve, reject) => {
    let settled = false;
    let pending = baseUrls.length;
    const failures: Array<{ baseUrl: string; error: unknown }> = [];

    baseUrls.forEach((baseUrl) => {
      void fetchManifestFromMirror(packId, baseUrl)
        .then((result) => {
          pending -= 1;
          if (settled) return;
          settled = true;
          resolve(result);
        })
        .catch((error) => {
          pending -= 1;
          failures.push({ baseUrl, error });
          if (!settled && pending === 0) {
            failures.forEach(({ baseUrl: failedBase, error: failedError }) => {
              console.warn(`Failed to load manifest from ${failedBase}`, failedError);
            });
            reject(buildManifestLoadError(packId, failures));
          }
        });
    });
  });
}

async function loadManifest(packId: string): Promise<PackManifest> {
  const cached = manifestCache.get(packId);
  if (cached) return cached;
  const task = (async () => {
    const initialBaseUrls = getPackBaseUrls(packId);
    const mode = packMirrorMode.get(packId) ?? 'auto';
    const baseUrls =
      mode === 'auto' ? rankPackBaseUrlsForAutoMode(packId, initialBaseUrls) : initialBaseUrls;

    let selected: ManifestLoadResult | null = null;
    if (mode === 'auto') {
      selected = await loadManifestByRace(packId, baseUrls);
    } else {
      let lastError: unknown;
      for (const baseUrl of baseUrls) {
        try {
          selected = await fetchManifestFromMirror(packId, baseUrl);
          break;
        } catch (e) {
          lastError = e;
          console.warn(`Failed to load manifest from ${baseUrl}`, e);
        }
      }
      if (!selected) {
        throw lastError instanceof Error
          ? lastError
          : new Error(String(lastError) || `Failed to load manifest for ${packId}`);
      }
    }

    const { baseUrl, manifest } = selected;
    activePackBaseUrl.set(packId, baseUrl);

    // 尝试从 index.html 获取精确的生成时间戳
    const timestamp = await tryFetchIndexTimestamp(baseUrl, packId);
    if (timestamp) {
      manifest.version = `${manifest.version}+${timestamp}`;
    }

    if (mode === 'auto') {
      scheduleMirrorLatencyWarmup(packId, baseUrls);
    }

    return manifest;
  })().catch((err: unknown) => {
    manifestCache.delete(packId);
    throw err;
  });
  manifestCache.set(packId, task);
  return task;
}

async function loadItems(base: string, manifest: PackManifest, onProgress?: (percent: number) => void): Promise<ItemDef[]> {
  if (!manifest.files.items) return [];

  // 检查是否为目录模式（以 / 结尾）
  if (manifest.files.items.endsWith('/')) {
    // 目录模式：需要从 itemsIndex 加载文件列表
    if (!manifest.files.itemsIndex) {
      throw new Error('items directory specified but itemsIndex not defined in manifest');
    }
    const indexRaw = await fetchJson(`${base}/${manifest.files.itemsIndex}`, manifest.packId);
    if (!Array.isArray(indexRaw)) {
      throw new Error('$.itemsIndex: expected array');
    }

    const items: ItemDef[] = [];
    for (let i = 0; i < indexRaw.length; i++) {
      const itemFile = indexRaw[i];
      if (typeof itemFile !== 'string') {
        throw new Error(`$.itemsIndex[${i}]: expected string`);
      }
      try {
        const raw = await fetchJson(`${base}/${itemFile}`, manifest.packId);
        const item = assertItemDef(raw, `$.itemsIndex[${i}]`);
        items.push(item);
      } catch (e) {
        console.error(`Failed to load item file ${itemFile}:`, e);
        throw e;
      }
      onProgress?.((i + 1) / indexRaw.length);
    }
    return items;
  }

  // 数组模式：原有的单一 items.json 文件
  const raw = await fetchJson(`${base}/${manifest.files.items}`, manifest.packId);
  onProgress?.(1);
  if (!Array.isArray(raw)) {
    throw new Error('$.items: expected array');
  }
  return raw.map((v, i) => assertItemDef(v, `$.items[${i}]`));
}

async function loadItemsLite(base: string, manifest: PackManifest): Promise<ItemDef[] | null> {
  const litePath = manifest.files.itemsLite;
  if (!litePath) return null;
  const raw = await fetchJson(`${base}/${litePath}`, manifest.packId);
  if (!Array.isArray(raw)) {
    throw new Error('$.itemsLite: expected array');
  }
  return raw.map((v, i) => {
    const item = assertItemDef(v, `$.itemsLite[${i}]`);
    if (item.detailLoaded === undefined) item.detailLoaded = false;
    return item;
  });
}

async function loadRecipeTypes(base: string, manifest: PackManifest): Promise<RecipeTypeDef[]> {
  const raw = await fetchJson(`${base}/${manifest.files.recipeTypes}`, manifest.packId);
  if (!Array.isArray(raw)) {
    throw new Error('$.recipeTypes: expected array');
  }
  return raw.map((v, i) => assertRecipeTypeDef(v, `$.recipeTypes[${i}]`));
}

async function loadRecipes(base: string, manifest: PackManifest): Promise<Recipe[]> {
  const raw = await fetchJson(`${base}/${manifest.files.recipes}`, manifest.packId);
  if (!Array.isArray(raw)) {
    throw new Error('$.recipes: expected array');
  }
  return raw.map((v, i) => assertRecipe(v, `$.recipes[${i}]`));
}

async function loadTags(base: string, manifest: PackManifest): Promise<PackTags | undefined> {
  if (!manifest.files.tags) return undefined;
  const raw = await fetchJson(`${base}/${manifest.files.tags}`, manifest.packId);
  return assertPackTags(raw, '$.tags');
}

type RuntimePackLoadResult = { pack: PackData; dispose: () => void };

function localSelectorToId(sel: string): string | null {
  if (!sel.startsWith('local:')) return null;
  const id = sel.slice('local:'.length).trim();
  return id ? id : null;
}

async function zipToPackData(zipBlob: Blob): Promise<{ pack: PackData; assets: { path: string; blob: Blob }[] }> {
  const zip = await JSZip.loadAsync(zipBlob);
  const manifestFile = zip.file(/manifest\.json$/i)[0];
  if (!manifestFile) throw new Error('manifest.json not found in zip');
  const manifest = assertPackManifest(JSON.parse(await manifestFile.async('string')), '$.manifest');

  const baseDir = manifestFile.name.replace(/manifest\.json$/i, '');
  const readJsonArray = async <T>(rel: string | undefined, name: string, map: (v: unknown, i: number) => T) => {
    if (!rel) return [] as T[];
    const file = zip.file(`${baseDir}${rel}`);
    if (!file) throw new Error(`Missing ${rel}`);
    const raw = JSON.parse(await file.async('string')) as unknown;
    if (!Array.isArray(raw)) throw new Error(`$.${name}: expected array`);
    return raw.map((v, i) => map(v, i));
  };
  const readTags = async (rel: string | undefined) => {
    if (!rel) return undefined;
    const file = zip.file(`${baseDir}${rel}`);
    if (!file) throw new Error(`Missing ${rel}`);
    return assertPackTags(JSON.parse(await file.async('string')), '$.tags');
  };
  const readItemsFromDir = async (dir: string, indexRel: string) => {
    const indexFile = zip.file(`${baseDir}${indexRel}`);
    if (!indexFile) throw new Error(`Missing ${indexRel}`);
    const indexRaw = JSON.parse(await indexFile.async('string')) as unknown;
    if (!Array.isArray(indexRaw)) throw new Error(`$.itemsIndex: expected array`);

    const items: ItemDef[] = [];
    for (let i = 0; i < indexRaw.length; i++) {
      const itemFile = indexRaw[i];
      if (typeof itemFile !== 'string') {
        throw new Error(`$.itemsIndex[${i}]: expected string`);
      }
      const file = zip.file(`${baseDir}${itemFile}`);
      if (!file) throw new Error(`Missing ${itemFile}`);
      const raw = JSON.parse(await file.async('string')) as unknown;
      const item = assertItemDef(raw, `${itemFile}`);
      items.push(item);
    }
    return items;
  };

  const items = manifest.files.items?.endsWith('/')
    ? await readItemsFromDir(manifest.files.items, manifest.files.itemsIndex!)
    : await readJsonArray(manifest.files.items, 'items', (v, i) => assertItemDef(v, `$.items[${i}]`));

  const [tags, recipeTypes, recipes] = await Promise.all([
    readTags(manifest.files.tags),
    readJsonArray(manifest.files.recipeTypes, 'recipeTypes', (v, i) =>
      assertRecipeTypeDef(v, `$.recipeTypes[${i}]`),
    ),
    readJsonArray(manifest.files.recipes, 'recipes', (v, i) => assertRecipe(v, `$.recipes[${i}]`)),
  ]);

  const pack: PackData = {
    manifest,
    items: mergeInlineItems(items, recipes),
    recipeTypes,
    recipes,
  };
  if (tags !== undefined) pack.tags = tags;

  const assets: { path: string; blob: Blob }[] = [];
  const isItemFile = (rel: string) => {
    // 如果是目录模式，检查是否是物品目录下的文件
    if (manifest.files.items?.endsWith('/')) {
      return rel.startsWith(manifest.files.items);
    }
    // 如果是数组模式，检查是否是items.json
    return rel === manifest.files.items;
  };

  zip.forEach((relativePath, file) => {
    if (file.dir) return;
    if (!relativePath.startsWith(baseDir)) return;
    const rel = relativePath.slice(baseDir.length);
    if (!rel) return;
    if (rel === 'manifest.json') return;
    if (isItemFile(rel)) return;
    if (rel === manifest.files.tags) return;
    if (rel === manifest.files.recipeTypes) return;
    if (rel === manifest.files.recipes) return;
    if (rel === manifest.files.itemsIndex) return;
    if (rel === manifest.files.itemsLite) return;
    assets.push({ path: rel, blob: new Blob([]) });
  });

  for (let i = 0; i < assets.length; i += 1) {
    const rel = assets[i]!.path;
    const file = zip.file(`${baseDir}${rel}`);
    if (!file) continue;
    assets[i] = { path: rel, blob: await file.async('blob') };
  }

  return { pack, assets };
}

function resolveLocalPackAssetUrls(pack: PackData, assets: { path: string; blob: Blob }[]): RuntimePackLoadResult {
  const base = `/packs/${encodeURIComponent(pack.manifest.packId)}/`;
  const urlByAbsolute = new Map<string, string>();
  const created: string[] = [];

  assets.forEach((a) => {
    const abs = `${base}${a.path}`;
    const url = URL.createObjectURL(a.blob);
    created.push(url);
    urlByAbsolute.set(abs, url);
  });

  const rewriteUrl = (u: string): string => {
    if (!u.startsWith(base)) return u;
    return urlByAbsolute.get(u) ?? u;
  };

  const rewriteItem = (it: ItemDef) => {
    if (it.icon) it.icon = rewriteUrl(it.icon);
    if (it.iconSprite?.url) it.iconSprite.url = rewriteUrl(it.iconSprite.url);
  };
  const rewriteMachine = (m: { icon?: string }) => {
    if (m.icon) m.icon = rewriteUrl(m.icon);
  };

  pack.items.forEach(rewriteItem);
  pack.recipes.forEach((r) => r.inlineItems?.forEach(rewriteItem));
  pack.recipeTypes.forEach((rt) => {
    const m = rt.machine;
    if (Array.isArray(m)) m.forEach(rewriteMachine);
    else if (m) rewriteMachine(m);
  });

  return {
    pack,
    dispose: () => {
      created.forEach((u) => URL.revokeObjectURL(u));
    },
  };
}

export interface LoadProgress {
  message: string;
  percent: number;
}

export type ProgressCallback = (p: LoadProgress) => void;

export async function loadRuntimePack(packIdOrLocal: string, onProgress?: ProgressCallback): Promise<RuntimePackLoadResult> {
  const localId = localSelectorToId(packIdOrLocal);
  if (localId) {
    onProgress?.({ message: 'Loading local pack...', percent: 0 });
    const zipBlob = await idbGetPackZip(localId);
    if (!zipBlob) throw new Error('Local pack zip not found');

    onProgress?.({ message: 'Parsing zip...', percent: 0.2 });
    const { pack, assets } = await zipToPackData(zipBlob);

    onProgress?.({ message: 'Processing assets...', percent: 0.8 });
    const result = resolveLocalPackAssetUrls(pack, assets);
    await ensurePackImageProxyTokens(result.pack.manifest);
    applyImageProxyToPack(result.pack);

    onProgress?.({ message: 'Done', percent: 1 });
    return result;
  }

  const pack = await loadPack(packIdOrLocal, onProgress);
  return { pack, dispose: () => { } };
}

export async function loadPack(packId: string, onProgress?: ProgressCallback): Promise<PackData> {
  const forceRefresh = packRefreshToken.has(packId);
  onProgress?.({ message: 'Loading manifest...', percent: 0 });

  const manifest = await loadManifest(packId);
  const base = packBaseUrl(packId);
  const version = manifest.version || '0.0.0';

  const wItems = 40;
  const wTags = 10;
  const wTypes = 10;
  const wRecipes = 40;
  const wTotal = wItems + wTags + wTypes + wRecipes;

  const baseProgress = 0.1;
  const remainingProgress = 0.9;

  let pItems = 0;
  let pTags = 0;
  let pTypes = 0;
  let pRecipes = 0;

  const update = (msg: string) => {
    const weightedSum = pItems * wItems + pTags * wTags + pTypes * wTypes + pRecipes * wRecipes;
    const p = baseProgress + remainingProgress * (weightedSum / wTotal);
    onProgress?.({
      message: msg,
      percent: p,
    });
  };

  const loadCached = async <T>(
    type: string,
    loader: (onProgress?: (p: number) => void) => Promise<T>,
    onLoadProgress?: (p: number) => void,
  ): Promise<T> => {
    if (!forceRefresh) {
      try {
        const cached = await idbGetRemoteCache(packId, type);
        if (cached && cached.version === version) {
          onLoadProgress?.(1);
          return cached.data as T;
        }
      } catch (e) {
        console.warn(`[loader] Failed to read cache for ${type}`, e);
      }
    }

    const data = await loader(onLoadProgress);

    // 异步写入缓存
    idbSetRemoteCache({
      packId,
      version,
      type,
      data: data as unknown,
      updatedAt: Date.now(),
    }).catch((e) => console.warn(`[loader] Failed to write cache for ${type}`, e));

    return data;
  };

  const itemsLoader = async () => {
    if (manifest.files.itemsLite) {
      return loadCached('itemsLite', async (cb) => {
        const res = await loadItemsLite(base, manifest);
        cb?.(1);
        return res;
      }, () => {
        pItems = 1;
        update('Loaded items (lite)');
      });
    }
    return loadCached('items', (cb) => loadItems(base, manifest, cb), (p) => {
      pItems = p;
      update(`Loading items ${Math.round(p * 100)}%...`);
    });
  };

  const tagsLoader = async () => {
    return loadCached('tags', async (cb) => {
      const res = await loadTags(base, manifest);
      cb?.(1);
      return res;
    }, () => {
      pTags = 1;
      update('Loaded tags');
    });
  };

  const recipeTypesLoader = async () => {
    return loadCached('recipeTypes', async (cb) => {
      const res = await loadRecipeTypes(base, manifest);
      cb?.(1);
      return res;
    }, () => {
      pTypes = 1;
      update('Loaded recipe types');
    });
  };

  const recipesLoader = async () => {
    return loadCached('recipes', async (cb) => {
      const res = await loadRecipes(base, manifest);
      cb?.(1);
      return res;
    }, () => {
      pRecipes = 1;
      update('Loaded recipes');
    });
  };

  const [itemsMaybeLite, tags, recipeTypes, recipes] = await Promise.all([
    itemsLoader(),
    tagsLoader(),
    recipeTypesLoader(),
    recipesLoader(),
  ]);
  const items = itemsMaybeLite ?? [];

  onProgress?.({ message: 'Processing data...', percent: 0.99 });

  // 从物品文件中提取内联的 recipes 和 wiki 数据
  const inlineRecipes = extractInlineRecipes(items);
  const wikiData = extractWikiData(items);

  // 合并所有 recipes：全局 recipes + 物品内联 recipes
  const allRecipes = [...recipes, ...inlineRecipes];

  const out: PackData = {
    manifest,
    items: mergeInlineItems(items, allRecipes),
    recipeTypes,
    recipes: allRecipes,
  };
  if (tags !== undefined) out.tags = tags;
  if (Object.keys(wikiData).length > 0) out.wiki = wikiData;
  await ensurePackImageProxyTokens(manifest);
  applyImageProxyToPack(out);
  return out;
}

export async function loadPackItemDetail(packId: string, detailPath: string): Promise<ItemDef> {
  const base = packBaseUrl(packId);
  const normalizedPath = detailPath.replace(/^\/+/, '');
  const raw = await resolveDetailRaw(packId, base, normalizedPath, 'item detail');
  const item = assertItemDef(raw, '$.itemDetail');
  const manifest = await loadManifest(packId);
  await ensurePackImageProxyTokens(manifest);
  applyImageProxyToItem(item as unknown as Record<string, unknown>, manifest);
  item.detailPath = normalizedPath;
  item.detailLoaded = true;
  return item;
}

async function resolveDetailRaw(
  packId: string,
  base: string,
  normalizedPath: string,
  label: string,
): Promise<unknown> {
  const sharp = normalizedPath.lastIndexOf('#');
  const sourcePath = sharp > 0 ? normalizedPath.slice(0, sharp) : normalizedPath;
  const frag = sharp > 0 ? normalizedPath.slice(sharp + 1) : '';
  const idx = frag !== '' ? Number.parseInt(frag, 10) : Number.NaN;

  let raw: unknown;
  if (Number.isInteger(idx) && idx >= 0) {
    const cacheKey = `${packId}:${sourcePath}`;
    let arrayPromise = jsonArrayCache.get(cacheKey);
    if (!arrayPromise) {
      arrayPromise = fetchJson(`${base}/${sourcePath}`, packId);
      jsonArrayCache.set(cacheKey, arrayPromise);
    }
    const arr = await arrayPromise;
    if (!Array.isArray(arr)) {
      throw new Error(`Failed to load ${label} from ${sourcePath}: expected array`);
    }
    raw = arr[idx];
    if (raw === undefined) {
      throw new Error(`Failed to load ${label} from ${sourcePath}: index ${idx} out of range`);
    }
  } else {
    raw = await fetchJson(`${base}/${sourcePath}`, packId);
  }
  return raw;
}

export async function loadPackRecipeDetail(packId: string, detailPath: string): Promise<Recipe> {
  const base = packBaseUrl(packId);
  const normalizedPath = detailPath.replace(/^\/+/, '');
  const raw = await resolveDetailRaw(packId, base, normalizedPath, 'recipe detail');
  const recipe = assertRecipe(raw, '$.recipeDetail');
  recipe.detailPath = normalizedPath;
  recipe.detailLoaded = true;
  return recipe;
}
