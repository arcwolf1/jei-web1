import type { ItemDef } from 'src/jei/types';
import { findItemDefByLookupId } from 'src/jei/indexing/itemLookup';
import { attributeTypeNames, resolveEnumName } from './genums';
import { getWarfarinAttributeLabel } from './attributeLabels';

export type RecordLike = Record<string, unknown>;
export type { WarfarinRenderContext } from './text';
export { formatWikiHtml, pickWarfarinText, renderWarfarinTextHtml, stripWikiText } from './text';

export interface MaterialCostEntry {
  rawId: string;
  packItemId?: string | undefined;
  name: string;
  count: unknown;
  icon?: string | undefined;
  rarity?: number | undefined;
}

export function isRecordLike(value: unknown): value is RecordLike {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function toArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatScalar(value: unknown): string {
  if (value === undefined || value === null || value === '') return '-';
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(3).replace(/\.?0+$/, '');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value as string | number | boolean);
}

export function formatLocalizedScalar(value: unknown, locale = 'en-US'): string {
  if (typeof value === 'boolean') {
    if (locale.startsWith('zh')) return value ? '是' : '否';
    if (locale.startsWith('ja')) return value ? 'はい' : 'いいえ';
    return value ? 'Yes' : 'No';
  }
  return formatScalar(value);
}

export function toText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return fallback;
}

export function formatRarity(value: unknown): string {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return '-';
  return `${'★'.repeat(num)} (${num})`;
}

export function toCdnAssetUrl(assetId: unknown): string {
  const id = typeof assetId === 'string' ? assetId.trim() : '';
  return id ? `https://cdn.warfarin.wiki/assets/${id}.png` : '';
}

export function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_./-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function hasData(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

export function formatRichContentBlock(text: string): string {
  return text
    .replace(/<image>(.*?)<\/image>/g, '[Image: $1]')
    .replace(/<video>(.*?)<\/video>/g, '[Video: $1]');
}

export { resolveEnumName } from './genums';

export function getAttrName(attrType: string | number, locale?: string): string {
  if (locale) return getWarfarinAttributeLabel(attrType, locale);
  return resolveEnumName(attributeTypeNames, attrType);
}

export interface NormalizedPayload {
  list: RecordLike;
  detail: RecordLike;
  refs: RecordLike;
  localNameMap: RecordLike;
  idToPackItemId: RecordLike;
}

export function normalizePayload(source: unknown): NormalizedPayload | null {
  if (!isRecordLike(source)) return null;
  let root = source;
  if (!isRecordLike(root.list) || !isRecordLike(root.detail)) {
    if (isRecordLike(source.raw)) {
      root = source.raw;
    }
  }
  if (!isRecordLike(root.list) || !isRecordLike(root.detail)) return null;
  return {
    list: root.list,
    detail: root.detail,
    refs: isRecordLike(root.refs) ? root.refs : {},
    localNameMap: isRecordLike(root.localNameMap) ? root.localNameMap : {},
    idToPackItemId: isRecordLike(root.idToPackItemId) ? root.idToPackItemId : {},
  };
}

export function resolveEntityName(id: unknown, localNameMap: RecordLike): string {
  const strId = typeof id === 'string' ? id : '';
  if (!strId) return '-';
  if (typeof localNameMap[strId] === 'string') return localNameMap[strId];
  return strId;
}

export function resolveReferenceName(id: unknown, refs?: RecordLike): string | undefined {
  const strId = typeof id === 'string' ? id.trim() : '';
  if (!strId || !refs) return undefined;
  const collectCandidate = (value: unknown): string | undefined => {
    if (!isRecordLike(value)) return undefined;
    const candidate = [value.tagName, value.blocName, value.name, value.title, value.label, value.engName]
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .find((entry) => entry.length > 0);
    return candidate || undefined;
  };

  const direct = collectCandidate(refs[strId]);
  if (direct) return direct;

  for (const tableName of ['tagDataTable', 'blocDataTable', 'charTypeTable', 'charProfessionTable']) {
    const table = refs[tableName];
    if (!isRecordLike(table)) continue;
    const byKey = collectCandidate(table[strId]);
    if (byKey) return byKey;

    for (const entry of Object.values(table)) {
      if (!isRecordLike(entry)) continue;
      const entryIdCandidates = [entry.tagId, entry.id, entry.blocId]
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length > 0);
      if (!entryIdCandidates.includes(strId)) continue;
      const nested = collectCandidate(entry);
      if (nested) return nested;
    }
  }

  return undefined;
}

export function findItemDefByRawId(
  rawId: unknown,
  itemDefsByKeyHash?: Record<string, ItemDef>,
): ItemDef | undefined {
  return findItemDefByLookupId(rawId, itemDefsByKeyHash);
}

export function resolvePackItemId(
  rawId: unknown,
  idToPackItemId?: RecordLike,
  itemDefsByKeyHash?: Record<string, ItemDef>,
): string | undefined {
  const itemId = typeof rawId === 'string' ? rawId.trim() : '';
  if (!itemId) return undefined;
  const mapped = idToPackItemId?.[itemId];
  if (typeof mapped === 'string' && mapped.trim().length > 0) {
    const mappedId = mapped.trim();
    return findItemDefByPackItemId(mappedId, itemDefsByKeyHash)?.key.id ?? mappedId;
  }
  if (itemDefsByKeyHash && itemId.startsWith('item_')) {
    const exactJeiwebItemId = `endfield.warfarin.items_${itemId}`;
    const exactDef = findItemDefByPackItemId(exactJeiwebItemId, itemDefsByKeyHash);
    if (exactDef) return exactDef.key.id;
  }
  const def = findItemDefByRawId(itemId, itemDefsByKeyHash);
  return def?.key.id;
}

export function resolveItemNameFromDefs(
  rawId: unknown,
  itemDefsByKeyHash?: Record<string, ItemDef>,
): string {
  const itemId = typeof rawId === 'string' ? rawId : '';
  if (!itemId) return '-';
  return findItemDefByRawId(itemId, itemDefsByKeyHash)?.name || itemId;
}

export function resolveLocalizedEntityName(
  id: unknown,
  refs?: RecordLike,
  localNameMap?: RecordLike,
  itemDefsByKeyHash?: Record<string, ItemDef>,
): string {
  const strId = typeof id === 'string' ? id.trim() : '';
  if (!strId) return '-';
  const refName = resolveReferenceName(strId, refs);
  if (refName) return refName;
  const itemName = resolveItemNameFromDefs(strId, itemDefsByKeyHash);
  if (itemName !== strId) return itemName;
  if (localNameMap) {
    const localName = resolveEntityName(strId, localNameMap);
    if (localName !== strId) return localName;
  }
  return strId;
}

function findItemDefByPackItemId(
  packItemId: string | undefined,
  itemDefsByKeyHash?: Record<string, ItemDef>,
): ItemDef | undefined {
  return findItemDefByLookupId(packItemId, itemDefsByKeyHash, { allowSuffixMatch: false });
}

export function normalizeItemGroups(source: unknown): RecordLike[][] {
  if (Array.isArray(source)) {
    if (source.length > 0 && Array.isArray(source[0])) {
      return source.map((group) => toArray<RecordLike>(group));
    }
    return [source.filter((item): item is RecordLike => isRecordLike(item))];
  }
  return [];
}

export function normalizeSimpleItems(source: unknown): RecordLike[] {
  if (Array.isArray(source)) return source.filter((item): item is RecordLike => isRecordLike(item));
  return [];
}

export function normalizeMaterialCosts(
  value: unknown,
  localNameMap?: RecordLike,
  itemDefsByKeyHash?: Record<string, ItemDef>,
  idToPackItemId?: RecordLike,
): MaterialCostEntry[] {
  return toArray<RecordLike>(value).map((item) => {
    const rawId = typeof item.id === 'string' ? item.id : '';
    const packItemId = resolvePackItemId(rawId, idToPackItemId, itemDefsByKeyHash);
    const def =
      findItemDefByPackItemId(packItemId, itemDefsByKeyHash) ??
      findItemDefByRawId(rawId, itemDefsByKeyHash);
    return {
      rawId,
      packItemId,
      name:
        def?.name ||
        (localNameMap && rawId ? resolveEntityName(rawId, localNameMap) : '') ||
        rawId ||
        '-',
      count: item.count ?? item.cnt ?? item.amount ?? 1,
      icon: def?.icon ?? def?.iconSprite?.url ?? (rawId ? `assets/icons/${rawId}.png` : undefined),
      rarity: typeof def?.rarity === 'number' ? def.rarity : undefined,
    };
  });
}

export function normalizeMaterialBundle(
  ids: unknown,
  counts: unknown,
  itemDefsByKeyHash?: Record<string, ItemDef>,
  idToPackItemId?: RecordLike,
): MaterialCostEntry[] {
  const idList = toArray(ids);
  const countList = toArray(counts);
  return idList.map((rawId, index) => {
    const raw = typeof rawId === 'string' ? rawId : '';
    const packItemId = resolvePackItemId(raw, idToPackItemId, itemDefsByKeyHash);
    const def =
      findItemDefByPackItemId(packItemId, itemDefsByKeyHash) ??
      findItemDefByRawId(raw, itemDefsByKeyHash);
    return {
      rawId: raw,
      packItemId,
      name: def?.name || raw || '-',
      count: countList[index] ?? 1,
      icon: def?.icon ?? def?.iconSprite?.url ?? (raw ? `assets/icons/${raw}.png` : undefined),
      rarity: typeof def?.rarity === 'number' ? def.rarity : undefined,
    };
  });
}

export function formatRequiredItems(
  value: unknown,
  localNameMap?: RecordLike,
  itemDefsByKeyHash?: Record<string, ItemDef>,
): string {
  return normalizeMaterialCosts(value, localNameMap, itemDefsByKeyHash)
    .map((item) => `${item.name} x${formatScalar(item.count)}`)
    .filter((entry) => entry.trim().length > 0)
    .join(', ');
}

export function formatItemBundle(
  ids: unknown,
  counts: unknown,
  itemDefsByKeyHash?: Record<string, ItemDef>,
): string {
  return normalizeMaterialBundle(ids, counts, itemDefsByKeyHash)
    .map((item) => `${item.name} x${formatScalar(item.count)}`)
    .join(', ');
}

export function formatCraftItem(
  value: unknown,
  localNameMap: RecordLike,
  liquidMap?: Map<string, string>,
  itemDefsByKeyHash?: Record<string, ItemDef>,
): string {
  if (!isRecordLike(value)) return formatScalar(value);
  const rawId = typeof value.id === 'string' ? value.id : '';
  const baseName =
    resolveLocalizedEntityName(rawId, undefined, localNameMap, itemDefsByKeyHash) ||
    (typeof value.name === 'string' ? value.name : '') ||
    '-';
  const liquidName = rawId && liquidMap?.has(rawId) ? liquidMap.get(rawId) : '';
  const name = liquidName ? `${baseName} (${liquidName})` : baseName;
  const count = value.count ?? value.cnt ?? value.amount ?? value.num;
  const chance = value.probability ?? value.rate ?? value.weight;
  const countLabel =
    count === undefined || count === null || count === '' ? '' : ` x${formatScalar(count)}`;
  const chanceLabel =
    chance === undefined || chance === null || chance === ''
      ? ''
      : ` (${formatScalar(chance)})`;
  return `${name}${countLabel}${chanceLabel}`;
}

export function buildInfoEntries(
  obj: RecordLike,
  keys: Array<string | { key: string; label?: string; mono?: boolean; format?: (v: unknown) => string }>,
): Array<{ label: string; value: string; mono: boolean }> {
  return keys
    .map((spec) => {
      const key = typeof spec === 'string' ? spec : spec.key;
      const label = typeof spec === 'string' ? humanizeKey(spec) : (spec.label ?? humanizeKey(spec.key));
      const mono = typeof spec === 'string' ? false : (spec.mono ?? false);
      const fmt = typeof spec === 'object' && spec.format ? spec.format : undefined;
      const raw = obj[key];
      if (raw === undefined || raw === null) return null;
      return { label, value: fmt ? fmt(raw) : formatScalar(raw), mono };
    })
    .filter((entry): entry is { label: string; value: string; mono: boolean } => entry !== null);
}

export type WarfarinEndpointType =
  | 'operators'
  | 'enemies'
  | 'items'
  | 'weapons'
  | 'gear'
  | 'facilities'
  | 'medals'
  | 'missions'
  | 'lore'
  | 'tutorials'
  | 'documents';
