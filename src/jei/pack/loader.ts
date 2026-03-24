import type {
  InlineRecipe,
  ItemDef,
  PackData,
  PackManifest,
  PackTags,
  Recipe,
  RecipeTypeDef,
  SlotContent,
  Stack,
  TagValue,
} from 'src/jei/types';
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
  devMirrors?: string[];
  aggregateDescriptor?: string;
}

type AggregateSourceDescriptor = {
  packId: string;
  priority: number;
  matchByName: boolean;
};

type AggregatePackDescriptor = {
  displayName?: string;
  gameId?: string;
  sources: AggregateSourceDescriptor[];
};

type AggregateSourceRuntime = {
  packId: string;
  recipeIdPrefix: string;
  recipeTypePrefix: string;
  itemIdAlias: Map<string, string>;
};

type AggregatePackRuntime = {
  bySourcePackId: Map<string, AggregateSourceRuntime>;
};

const packRegistry = new Map<string, PackSource>();
const activePackBaseUrl = new Map<string, string>();
const packMirrorMode = new Map<string, 'auto' | 'manual'>();
const packManualMirror = new Map<string, string>();
let packDevMirrorsEnabled = false;
const mirrorLatencyCache = new Map<string, { latencyMs: number | null; measuredAt: number }>();
const mirrorLatencyWarmupTask = new Map<string, Promise<void>>();
const aggregateDescriptorCache = new Map<string, Promise<AggregatePackDescriptor>>();
const aggregateRuntimeCache = new Map<string, AggregatePackRuntime>();
const aggregateLoadStack = new Set<string>();

const MIRROR_LATENCY_TIMEOUT_MS = 4500;
const MIRROR_LATENCY_CACHE_TTL_MS = 2 * 60 * 1000;
const AGGREGATE_DETAIL_PREFIX = '__agg__/';

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

function normalizeSourceMirrorUrls(urls: string[] | undefined): string[] {
  return Array.from(
    new Set((urls ?? []).map((m) => m.replace(/\/+$/, '').trim()).filter((m) => m.length > 0)),
  );
}

function getSourceMirrorUrls(source: PackSource, includeDevMirrors = packDevMirrorsEnabled): string[] {
  return normalizeSourceMirrorUrls([
    ...(source.mirrors ?? []),
    ...(includeDevMirrors ? (source.devMirrors ?? []) : []),
  ]);
}

export function clearPackRuntimeCache(packId?: string) {
  if (packId) {
    manifestCache.delete(packId);
    activePackBaseUrl.delete(packId);
    clearMirrorLatencyCache(packId);
    mirrorLatencyWarmupTask.delete(packId);
    aggregateDescriptorCache.delete(packId);
    aggregateRuntimeCache.delete(packId);
    for (const [virtualPackId, runtime] of aggregateRuntimeCache.entries()) {
      if (runtime.bySourcePackId.has(packId)) {
        aggregateRuntimeCache.delete(virtualPackId);
      }
    }
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
  aggregateDescriptorCache.clear();
  aggregateRuntimeCache.clear();
  aggregateLoadStack.clear();
  jsonArrayCache.clear();
  packRefreshToken.clear();
  // 异步清除所有 IndexedDB 缓存
  idbClearRemoteCache().catch((e) => console.warn('Failed to clear all remote cache', e));
}

export function registerPackSource(source: PackSource) {
  packRegistry.set(source.packId, {
    ...source,
    mirrors: normalizeSourceMirrorUrls(source.mirrors),
    devMirrors: normalizeSourceMirrorUrls(source.devMirrors),
  });
}

export function getPackSource(packId: string): PackSource | undefined {
  return packRegistry.get(packId);
}

export function getAggregateSourcePackIds(packId: string): string[] {
  const runtime = aggregateRuntimeCache.get(packId);
  if (!runtime) return [];
  return Array.from(runtime.bySourcePackId.keys());
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

export function setPackDevMirrorsEnabled(enabled: boolean) {
  packDevMirrorsEnabled = enabled;
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
  if (source) {
    const mirrors = getSourceMirrorUrls(source);
    if (!mirrors.length) {
      if (typeof source.aggregateDescriptor === 'string' && source.aggregateDescriptor.trim().length > 0) {
        return [];
      }
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

function isAbsoluteLikeUrlOrPath(value: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(value);
}

function resolvePackAssetUrl(base: string, rawUrl: string): string {
  const url = rawUrl.trim();
  if (!url) return url;
  if (isAbsoluteLikeUrlOrPath(url)) return url;
  const cleanBase = base.replace(/\/+$/, '');
  const cleanUrl = url.replace(/^\.\/+/, '');
  return `${cleanBase}/${cleanUrl}`;
}

function resolveItemAssetUrls(item: ItemDef, base: string): void {
  if (item.icon) item.icon = resolvePackAssetUrl(base, item.icon);
  if (item.iconSprite?.url) {
    item.iconSprite.url = resolvePackAssetUrl(base, item.iconSprite.url);
  }
}

function resolveRecipeAssetUrls(recipe: Recipe, base: string): void {
  recipe.inlineItems?.forEach((item) => resolveItemAssetUrls(item, base));
}

function resolveRecipeTypeAssetUrls(typeDef: RecipeTypeDef, base: string): void {
  const machine = typeDef.machine;
  const resolveMachine = (m: { icon?: string }) => {
    if (m.icon) m.icon = resolvePackAssetUrl(base, m.icon);
  };
  if (Array.isArray(machine)) {
    machine.forEach(resolveMachine);
  } else if (machine) {
    resolveMachine(machine);
  }
}

function resolvePackAssetUrls(pack: PackData, base: string): void {
  pack.items.forEach((item) => resolveItemAssetUrls(item, base));
  pack.recipes.forEach((recipe) => resolveRecipeAssetUrls(recipe, base));
  pack.recipeTypes.forEach((typeDef) => resolveRecipeTypeAssetUrls(typeDef, base));
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

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isAggregateSource(
  source: PackSource | undefined,
): source is PackSource & { aggregateDescriptor: string } {
  return (
    !!source &&
    typeof source.aggregateDescriptor === 'string' &&
    source.aggregateDescriptor.trim().length > 0
  );
}

function normalizeAggregateItemName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().toLowerCase();
}

function encodeAggregateDetailPath(sourcePackId: string, detailPath: string): string {
  const normalizedPath = detailPath.replace(/^\/+/, '');
  return `${AGGREGATE_DETAIL_PREFIX}${encodeURIComponent(sourcePackId)}/${normalizedPath}`;
}

function decodeAggregateDetailPath(
  detailPath: string,
): { sourcePackId: string; sourcePath: string } | null {
  const normalized = detailPath.replace(/^\/+/, '');
  if (!normalized.startsWith(AGGREGATE_DETAIL_PREFIX)) return null;
  const body = normalized.slice(AGGREGATE_DETAIL_PREFIX.length);
  const splitAt = body.indexOf('/');
  if (splitAt <= 0) return null;
  const sourcePackId = decodeURIComponent(body.slice(0, splitAt));
  const sourcePath = body.slice(splitAt + 1);
  if (!sourcePackId || !sourcePath) return null;
  return { sourcePackId, sourcePath };
}

function resolveAggregateDescriptorUrl(raw: string): string {
  const descriptor = raw.trim();
  if (!descriptor) return descriptor;
  if (isAbsoluteLikeUrlOrPath(descriptor)) return descriptor;
  const clean = descriptor.replace(/^\.?\/+/, '');
  return `/packs/${clean}`;
}

function parseAggregateDescriptor(raw: unknown, jsonPath: string): AggregatePackDescriptor {
  if (!isRecordLike(raw)) {
    throw new Error(`${jsonPath}: expected object`);
  }
  const displayName =
    typeof raw.displayName === 'string' && raw.displayName.trim().length > 0
      ? raw.displayName.trim()
      : undefined;
  const gameId =
    typeof raw.gameId === 'string' && raw.gameId.trim().length > 0 ? raw.gameId.trim() : undefined;

  const sourceRaw = raw.sources;
  if (!Array.isArray(sourceRaw) || sourceRaw.length === 0) {
    throw new Error(`${jsonPath}.sources: expected non-empty array`);
  }

  const parsedWithIndex: Array<AggregateSourceDescriptor & { index: number }> = sourceRaw.map(
    (entry, index) => {
      let packId = '';
      let priority = index;
      let matchByName = true;

      if (typeof entry === 'string') {
        packId = entry.trim();
      } else if (isRecordLike(entry)) {
        packId = typeof entry.packId === 'string' ? entry.packId.trim() : '';
        if (typeof entry.priority === 'number' && Number.isFinite(entry.priority)) {
          priority = entry.priority;
        }
        if (typeof entry.matchByName === 'boolean') {
          matchByName = entry.matchByName;
        }
      }

      if (!packId) {
        throw new Error(`${jsonPath}.sources[${index}].packId: expected non-empty string`);
      }

      return {
        packId,
        priority,
        matchByName,
        index,
      };
    },
  );

  parsedWithIndex.sort((a, b) => a.priority - b.priority || a.index - b.index);
  const seen = new Set<string>();
  const sources: AggregateSourceDescriptor[] = parsedWithIndex.map((entry) => {
    if (seen.has(entry.packId)) {
      throw new Error(`${jsonPath}.sources: duplicate packId "${entry.packId}"`);
    }
    seen.add(entry.packId);
    return {
      packId: entry.packId,
      priority: entry.priority,
      matchByName: entry.matchByName,
    };
  });

  return {
    ...(displayName ? { displayName } : {}),
    ...(gameId ? { gameId } : {}),
    sources,
  };
}

async function loadAggregateDescriptor(
  packId: string,
  source: PackSource & { aggregateDescriptor: string },
): Promise<AggregatePackDescriptor> {
  const cached = aggregateDescriptorCache.get(packId);
  if (cached) return cached;

  const task = (async () => {
    const descriptorUrl = resolveAggregateDescriptorUrl(source.aggregateDescriptor);
    if (!descriptorUrl) {
      throw new Error(`Pack "${packId}" aggregateDescriptor is empty`);
    }
    const raw = await fetchJson(descriptorUrl, packId);
    return parseAggregateDescriptor(raw, '$.aggregateDescriptor');
  })().catch((err: unknown) => {
    aggregateDescriptorCache.delete(packId);
    throw err;
  });

  aggregateDescriptorCache.set(packId, task);
  return task;
}

function remapItemIdByAlias(id: string, alias: Map<string, string>): string {
  return alias.get(id) ?? id;
}

function remapStackForAggregate(stack: Stack, alias: Map<string, string>): Stack {
  if (stack.kind !== 'item') return { ...stack };
  return {
    ...stack,
    id: remapItemIdByAlias(stack.id, alias),
  };
}

function remapSlotContentForAggregate(
  content: SlotContent,
  alias: Map<string, string>,
): SlotContent {
  if (Array.isArray(content)) {
    return content.map((stack) => remapStackForAggregate(stack, alias));
  }
  return remapStackForAggregate(content, alias);
}

function remapSlotContentsForAggregate(
  slotContents: Record<string, SlotContent>,
  alias: Map<string, string>,
): Record<string, SlotContent> {
  const out: Record<string, SlotContent> = {};
  Object.keys(slotContents).forEach((slotId) => {
    out[slotId] = remapSlotContentForAggregate(slotContents[slotId]!, alias);
  });
  return out;
}

function transformInlineRecipeForAggregate(
  recipe: InlineRecipe,
  runtime: AggregateSourceRuntime,
): InlineRecipe {
  const out: InlineRecipe = {
    id: `${runtime.recipeIdPrefix}${recipe.id}`,
    type: `${runtime.recipeTypePrefix}${recipe.type}`,
    slotContents: remapSlotContentsForAggregate(recipe.slotContents, runtime.itemIdAlias),
  };
  if (recipe.params !== undefined) out.params = { ...recipe.params };
  if (recipe.inlineItems !== undefined) {
    out.inlineItems = recipe.inlineItems.map((item) => transformItemForAggregate(item, runtime));
  }
  return out;
}

function transformItemForAggregate(item: ItemDef, runtime: AggregateSourceRuntime): ItemDef {
  const out: ItemDef = {
    ...item,
    key: {
      ...item.key,
      id: remapItemIdByAlias(item.key.id, runtime.itemIdAlias),
    },
  };

  if (item.iconSprite) out.iconSprite = { ...item.iconSprite };
  if (item.tags) out.tags = [...item.tags];
  if (item.rarity) out.rarity = { ...item.rarity };
  if (item.belt) out.belt = { ...item.belt };
  if (item.wiki) out.wiki = { ...item.wiki };
  if (item.extensions) out.extensions = { ...item.extensions };
  if (item.recipes) {
    out.recipes = item.recipes.map((recipe) => transformInlineRecipeForAggregate(recipe, runtime));
  }
  if (item.detailPath) {
    out.detailPath = encodeAggregateDetailPath(runtime.packId, item.detailPath);
  }
  return out;
}

function transformRecipeForAggregate(recipe: Recipe, runtime: AggregateSourceRuntime): Recipe {
  const out: Recipe = {
    id: `${runtime.recipeIdPrefix}${recipe.id}`,
    type: `${runtime.recipeTypePrefix}${recipe.type}`,
    slotContents: remapSlotContentsForAggregate(recipe.slotContents, runtime.itemIdAlias),
  };
  if (recipe.params !== undefined) out.params = { ...recipe.params };
  if (recipe.inlineItems !== undefined) {
    out.inlineItems = recipe.inlineItems.map((item) => transformItemForAggregate(item, runtime));
  }
  if (recipe.detailPath) {
    out.detailPath = encodeAggregateDetailPath(runtime.packId, recipe.detailPath);
  }
  if (recipe.detailLoaded !== undefined) out.detailLoaded = recipe.detailLoaded;
  return out;
}

function transformRecipeTypeForAggregate(
  recipeType: RecipeTypeDef,
  runtime: AggregateSourceRuntime,
): RecipeTypeDef {
  const out: RecipeTypeDef = {
    ...recipeType,
    key: `${runtime.recipeTypePrefix}${recipeType.key}`,
  };
  if (recipeType.machine) {
    if (Array.isArray(recipeType.machine)) {
      out.machine = recipeType.machine.map((machine) => ({
        ...machine,
        id: remapItemIdByAlias(machine.id, runtime.itemIdAlias),
      }));
    } else {
      out.machine = {
        ...recipeType.machine,
        id: remapItemIdByAlias(recipeType.machine.id, runtime.itemIdAlias),
      };
    }
  }
  if (recipeType.slots) {
    out.slots = recipeType.slots.map((slot) => ({
      ...slot,
      accept: [...slot.accept],
    }));
  }
  if (recipeType.paramSchema) out.paramSchema = { ...recipeType.paramSchema };
  if (recipeType.defaults) out.defaults = { ...recipeType.defaults };
  return out;
}

function remapTagValueForAggregate(value: TagValue, alias: Map<string, string>): TagValue {
  if (typeof value === 'string') {
    return remapItemIdByAlias(value, alias);
  }
  const id = remapItemIdByAlias(value.id, alias);
  if (value.required === undefined) return { id };
  return { id, required: value.required };
}

function remapPackTagsForAggregate(
  tags: PackTags | undefined,
  alias: Map<string, string>,
): PackTags | undefined {
  if (!tags?.item) return undefined;
  const out: PackTags = { item: {} };
  Object.keys(tags.item).forEach((tagId) => {
    const tagDef = tags.item?.[tagId];
    if (!tagDef) return;
    out.item![tagId] = {
      ...(tagDef.replace !== undefined ? { replace: tagDef.replace } : {}),
      values: tagDef.values.map((value) => remapTagValueForAggregate(value, alias)),
    };
  });
  return out;
}

function tagValueHash(value: TagValue): string {
  if (typeof value === 'string') return `s:${value}`;
  return `o:${value.id}:${value.required ? '1' : '0'}`;
}

function pickPreferLongerString(a?: string, b?: string): string | undefined {
  const left = (a ?? '').trim();
  const right = (b ?? '').trim();
  if (!left) return right || undefined;
  if (!right) return left;
  if (left === right) return left;
  if (left.length !== right.length) return left.length > right.length ? left : right;
  return left < right ? left : right;
}

function pickPreferDenseObject<T extends Record<string, unknown>>(a: T, b: T): T {
  const scoreA = Object.values(a).filter((value) => value !== undefined && value !== null).length;
  const scoreB = Object.values(b).filter((value) => value !== undefined && value !== null).length;
  if (scoreA !== scoreB) return scoreA > scoreB ? a : b;
  const textA = stableJsonStringify(a);
  const textB = stableJsonStringify(b);
  if (textA.length !== textB.length) return textA.length > textB.length ? a : b;
  return textA <= textB ? a : b;
}

function pickPreferInformativeValue(a: unknown, b: unknown): unknown {
  const textA = stableJsonStringify(a ?? null);
  const textB = stableJsonStringify(b ?? null);
  if (textA.length !== textB.length) return textA.length > textB.length ? a : b;
  return textA <= textB ? a : b;
}

function mergeWikiForAggregate(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!a && !b) return undefined;
  if (!a) return { ...b! };
  if (!b) return { ...a };
  const out: Record<string, unknown> = { ...a };
  Object.keys(b).forEach((key) => {
    if (!(key in out)) {
      out[key] = b[key];
      return;
    }
    out[key] = pickPreferInformativeValue(out[key], b[key]);
  });
  return out;
}

function mergeItemExtensionsForAggregate(
  a: ItemDef['extensions'] | undefined,
  b: ItemDef['extensions'] | undefined,
): ItemDef['extensions'] | undefined {
  return mergeWikiForAggregate(
    a as Record<string, unknown> | undefined,
    b as Record<string, unknown> | undefined,
  ) as ItemDef['extensions'] | undefined;
}

function mergePackTagsForAggregate(
  base: PackTags | undefined,
  incoming: PackTags | undefined,
): PackTags | undefined {
  if (!base && !incoming) return undefined;
  const out: PackTags = {
    ...(base?.item ? { item: { ...base.item } } : {}),
  };
  if (!incoming?.item) return out;
  if (!out.item) out.item = {};

  Object.keys(incoming.item).forEach((tagId) => {
    const incomingTag = incoming.item?.[tagId];
    if (!incomingTag) return;
    const existing = out.item?.[tagId];
    if (!existing) {
      out.item![tagId] = {
        ...(incomingTag.replace !== undefined ? { replace: incomingTag.replace } : {}),
        values: [...incomingTag.values],
      };
      return;
    }
    const seen = new Set(existing.values.map((value) => tagValueHash(value)));
    const mergedValues = [...existing.values];
    incomingTag.values.forEach((value) => {
      const key = tagValueHash(value);
      if (seen.has(key)) return;
      seen.add(key);
      mergedValues.push(value);
    });
    out.item![tagId] = {
      ...(existing.replace === true || incomingTag.replace === true ? { replace: true } : {}),
      values: mergedValues,
    };
  });

  return out;
}

function mergeInlineRecipesForAggregate(
  base: InlineRecipe[] | undefined,
  incoming: InlineRecipe[] | undefined,
): InlineRecipe[] | undefined {
  if ((!base || base.length === 0) && (!incoming || incoming.length === 0)) return undefined;
  if (!base || base.length === 0) return [...(incoming ?? [])];
  if (!incoming || incoming.length === 0) return [...base];
  const out = [...base];
  const existing = new Set(base.map((recipe) => recipe.id));
  incoming.forEach((recipe) => {
    if (existing.has(recipe.id)) return;
    existing.add(recipe.id);
    out.push(recipe);
  });
  return out;
}

function mergeItemForAggregate(base: ItemDef, incoming: ItemDef): ItemDef {
  const out: ItemDef = {
    ...base,
    key: { ...base.key },
  };
  if (base.iconSprite) out.iconSprite = { ...base.iconSprite };
  if (base.tags) out.tags = [...base.tags];
  if (base.rarity) out.rarity = { ...base.rarity };
  if (base.belt) out.belt = { ...base.belt };
  if (base.wiki) out.wiki = { ...base.wiki };
  if (base.extensions) out.extensions = { ...base.extensions };
  if (base.recipes) out.recipes = [...base.recipes];

  out.name = pickPreferLongerString(base.name, incoming.name) ?? out.name;
  const icon = pickPreferLongerString(base.icon, incoming.icon);
  if (icon !== undefined) out.icon = icon;
  else delete out.icon;
  const source = pickPreferLongerString(base.source, incoming.source);
  if (source !== undefined) out.source = source;
  else delete out.source;
  const description = pickPreferLongerString(base.description, incoming.description);
  if (description !== undefined) out.description = description;
  else delete out.description;
  const detailPath = pickPreferLongerString(base.detailPath, incoming.detailPath);
  if (detailPath !== undefined) out.detailPath = detailPath;
  else delete out.detailPath;
  if (base.detailLoaded === true || incoming.detailLoaded === true) {
    out.detailLoaded = true;
  }

  if (base.iconSprite && incoming.iconSprite) {
    out.iconSprite = pickPreferDenseObject(base.iconSprite, incoming.iconSprite);
  } else if (!base.iconSprite && incoming.iconSprite) {
    out.iconSprite = { ...incoming.iconSprite };
  }

  if (base.rarity && incoming.rarity) {
    const mergedRarity: NonNullable<ItemDef['rarity']> = {
      stars: Math.max(base.rarity.stars, incoming.rarity.stars),
    };
    const label = pickPreferLongerString(base.rarity.label, incoming.rarity.label);
    if (label !== undefined) mergedRarity.label = label;
    const color = pickPreferLongerString(base.rarity.color, incoming.rarity.color);
    if (color !== undefined) mergedRarity.color = color;
    const token = pickPreferLongerString(base.rarity.token, incoming.rarity.token);
    if (token !== undefined) mergedRarity.token = token;
    const tagId = pickPreferLongerString(base.rarity.tagId, incoming.rarity.tagId);
    if (tagId !== undefined) mergedRarity.tagId = tagId;
    out.rarity = mergedRarity;
  } else if (!base.rarity && incoming.rarity) {
    out.rarity = { ...incoming.rarity };
  }

  if (base.belt && incoming.belt) {
    out.belt = {
      speed: Math.max(base.belt.speed, incoming.belt.speed),
    };
  } else if (!base.belt && incoming.belt) {
    out.belt = { ...incoming.belt };
  }

  if (incoming.tags?.length) {
    const mergedTags = new Set(out.tags ?? []);
    incoming.tags.forEach((tag) => mergedTags.add(tag));
    out.tags = Array.from(mergedTags);
  }
  const wiki = mergeWikiForAggregate(out.wiki, incoming.wiki);
  if (wiki !== undefined) out.wiki = wiki;
  else delete out.wiki;
  const extensions = mergeItemExtensionsForAggregate(out.extensions, incoming.extensions);
  if (extensions !== undefined) out.extensions = extensions;
  else delete out.extensions;
  const recipes = mergeInlineRecipesForAggregate(out.recipes, incoming.recipes);
  if (recipes) out.recipes = recipes;

  return out;
}

async function loadAggregatePack(
  packId: string,
  source: PackSource & { aggregateDescriptor: string },
  onProgress?: ProgressCallback,
): Promise<PackData> {
  if (aggregateLoadStack.has(packId)) {
    throw new Error(`Aggregate source cycle detected for "${packId}"`);
  }
  aggregateLoadStack.add(packId);
  try {
    onProgress?.({ message: 'Loading aggregate descriptor...', percent: 0 });
    const descriptor = await loadAggregateDescriptor(packId, source);
    if (!descriptor.sources.length) {
      throw new Error(`Aggregate descriptor for "${packId}" has no sources`);
    }

    if (descriptor.sources.some((entry) => entry.packId === packId)) {
      throw new Error(`Aggregate source "${packId}" cannot include itself`);
    }
    descriptor.sources.forEach((entry) => {
      const nested = getPackSource(entry.packId);
      if (isAggregateSource(nested)) {
        throw new Error(
          `Aggregate source "${packId}" cannot reference virtual source "${entry.packId}"`,
        );
      }
    });

    const shouldForceSourceRefresh = packRefreshToken.has(packId);
    if (shouldForceSourceRefresh) {
      descriptor.sources.forEach((entry) => clearPackRuntimeCache(entry.packId));
    }

    const loadedByPriority: Array<{ sourceDef: AggregateSourceDescriptor; pack: PackData }> = [];
    const loadBudget = 0.75;
    const segment = loadBudget / descriptor.sources.length;

    for (let i = 0; i < descriptor.sources.length; i += 1) {
      const sourceDef = descriptor.sources[i]!;
      const progressStart = i * segment;
      const progressPack = await loadPack(sourceDef.packId, (p) => {
        onProgress?.({
          message: `[${sourceDef.packId}] ${p.message}`,
          percent: progressStart + p.percent * segment,
        });
      });
      loadedByPriority.push({ sourceDef, pack: progressPack });
    }

    onProgress?.({ message: 'Aggregating sources...', percent: loadBudget });

    const nameCandidatesByName = new Map<string, Set<string>>();
    loadedByPriority.forEach(({ sourceDef, pack }) => {
      if (!sourceDef.matchByName) return;
      pack.items.forEach((item) => {
        const nameKey = normalizeAggregateItemName(item.name ?? '');
        if (!nameKey) return;
        const candidates = nameCandidatesByName.get(nameKey) ?? new Set<string>();
        candidates.add(item.key.id);
        nameCandidatesByName.set(nameKey, candidates);
      });
    });

    const canonicalItemIdByName = new Map<string, string>();
    nameCandidatesByName.forEach((candidates, nameKey) => {
      const sorted = Array.from(candidates).sort((a, b) => a.localeCompare(b));
      const canonical = sorted[0];
      if (canonical) canonicalItemIdByName.set(nameKey, canonical);
    });

    const sourceRuntimes: AggregateSourceRuntime[] = loadedByPriority.map(({ sourceDef, pack }) => {
      const alias = new Map<string, string>();
      if (sourceDef.matchByName) {
        pack.items.forEach((item) => {
          const nameKey = normalizeAggregateItemName(item.name ?? '');
          if (!nameKey) return;
          const canonical = canonicalItemIdByName.get(nameKey);
          if (!canonical) return;
          if (canonical !== item.key.id) {
            alias.set(item.key.id, canonical);
          }
        });
      }
      return {
        packId: sourceDef.packId,
        recipeIdPrefix: `${sourceDef.packId}::`,
        recipeTypePrefix: `${sourceDef.packId}::`,
        itemIdAlias: alias,
      };
    });

    const mergedItemsByHash = new Map<string, ItemDef>();
    const mergedRecipeTypesByKey = new Map<string, RecipeTypeDef>();
    const mergedRecipesById = new Map<string, Recipe>();
    let mergedTags: PackTags | undefined;

    loadedByPriority.forEach(({ pack }, index) => {
      const runtime = sourceRuntimes[index]!;
      const items = pack.items.map((item) => transformItemForAggregate(item, runtime));
      const recipeTypes = pack.recipeTypes.map((recipeType) =>
        transformRecipeTypeForAggregate(recipeType, runtime),
      );
      const recipes = pack.recipes.map((recipe) => transformRecipeForAggregate(recipe, runtime));
      const tags = remapPackTagsForAggregate(pack.tags, runtime.itemIdAlias);

      items.forEach((item) => {
        const key = itemKeyHash(item);
        const existing = mergedItemsByHash.get(key);
        if (!existing) {
          mergedItemsByHash.set(key, item);
          return;
        }
        mergedItemsByHash.set(key, mergeItemForAggregate(existing, item));
      });
      recipeTypes.forEach((recipeType) => {
        if (!mergedRecipeTypesByKey.has(recipeType.key)) {
          mergedRecipeTypesByKey.set(recipeType.key, recipeType);
        }
      });
      recipes.forEach((recipe) => {
        if (!mergedRecipesById.has(recipe.id)) {
          mergedRecipesById.set(recipe.id, recipe);
        }
      });
      mergedTags = mergePackTagsForAggregate(mergedTags, tags);
    });

    const mergedRecipes = Array.from(mergedRecipesById.values());
    const mergedItems = mergeInlineItems(Array.from(mergedItemsByHash.values()), mergedRecipes);
    const wikiData = extractWikiData(mergedItems);

    const primaryManifest = loadedByPriority[0]!.pack.manifest;
    const manifest: PackManifest = {
      ...primaryManifest,
      files: {
        ...primaryManifest.files,
      },
      packId,
      displayName: descriptor.displayName ?? source.label ?? primaryManifest.displayName,
      gameId: descriptor.gameId ?? primaryManifest.gameId,
      version: `${primaryManifest.version}+agg(${descriptor.sources.map((s) => s.packId).join(',')})`,
    };
    delete manifest.imageProxy;

    const out: PackData = {
      manifest,
      items: mergedItems,
      recipeTypes: Array.from(mergedRecipeTypesByKey.values()),
      recipes: mergedRecipes,
    };
    if (mergedTags !== undefined) out.tags = mergedTags;
    if (Object.keys(wikiData).length > 0) out.wiki = wikiData;

    aggregateRuntimeCache.set(packId, {
      bySourcePackId: new Map(sourceRuntimes.map((runtime) => [runtime.packId, runtime])),
    });

    onProgress?.({ message: 'Done', percent: 1 });
    return out;
  } finally {
    aggregateLoadStack.delete(packId);
  }
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
    const localBase = `/packs/${encodeURIComponent(pack.manifest.packId)}`;
    resolvePackAssetUrls(pack, localBase);

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
  const source = getPackSource(packId);
  if (isAggregateSource(source)) {
    return loadAggregatePack(packId, source, onProgress);
  }

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
  resolvePackAssetUrls(out, base);
  await ensurePackImageProxyTokens(manifest);
  applyImageProxyToPack(out);
  return out;
}

export async function loadPackItemDetail(packId: string, detailPath: string): Promise<ItemDef> {
  const source = getPackSource(packId);
  if (isAggregateSource(source)) {
    const detailRef = decodeAggregateDetailPath(detailPath);
    if (!detailRef) {
      throw new Error(`Invalid aggregate item detail path: "${detailPath}"`);
    }
    const runtime = aggregateRuntimeCache.get(packId);
    if (!runtime) {
      throw new Error(`Aggregate runtime not initialized for "${packId}"`);
    }
    const sourceRuntime = runtime.bySourcePackId.get(detailRef.sourcePackId);
    if (!sourceRuntime) {
      throw new Error(
        `Aggregate item detail source "${detailRef.sourcePackId}" not found for "${packId}"`,
      );
    }
    const sourceItem = await loadPackItemDetail(detailRef.sourcePackId, detailRef.sourcePath);
    const item = transformItemForAggregate(sourceItem, sourceRuntime);
    item.detailPath = encodeAggregateDetailPath(detailRef.sourcePackId, detailRef.sourcePath);
    item.detailLoaded = true;
    return item;
  }

  const base = packBaseUrl(packId);
  const normalizedPath = detailPath.replace(/^\/+/, '');
  const raw = await resolveDetailRaw(packId, base, normalizedPath, 'item detail');
  const item = assertItemDef(raw, '$.itemDetail');
  resolveItemAssetUrls(item, base);
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
  const source = getPackSource(packId);
  if (isAggregateSource(source)) {
    const detailRef = decodeAggregateDetailPath(detailPath);
    if (!detailRef) {
      throw new Error(`Invalid aggregate recipe detail path: "${detailPath}"`);
    }
    const runtime = aggregateRuntimeCache.get(packId);
    if (!runtime) {
      throw new Error(`Aggregate runtime not initialized for "${packId}"`);
    }
    const sourceRuntime = runtime.bySourcePackId.get(detailRef.sourcePackId);
    if (!sourceRuntime) {
      throw new Error(
        `Aggregate recipe detail source "${detailRef.sourcePackId}" not found for "${packId}"`,
      );
    }
    const sourceRecipe = await loadPackRecipeDetail(detailRef.sourcePackId, detailRef.sourcePath);
    const recipe = transformRecipeForAggregate(sourceRecipe, sourceRuntime);
    recipe.detailPath = encodeAggregateDetailPath(detailRef.sourcePackId, detailRef.sourcePath);
    recipe.detailLoaded = true;
    return recipe;
  }

  const base = packBaseUrl(packId);
  const normalizedPath = detailPath.replace(/^\/+/, '');
  const raw = await resolveDetailRaw(packId, base, normalizedPath, 'recipe detail');
  const recipe = assertRecipe(raw, '$.recipeDetail');
  resolveRecipeAssetUrls(recipe, base);
  recipe.detailPath = normalizedPath;
  recipe.detailLoaded = true;
  return recipe;
}
