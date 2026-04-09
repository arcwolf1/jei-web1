import type { ItemDef } from 'src/jei/types';

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function collectStringValues(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);
}

function getJeiwebMeta(item: ItemDef): Record<string, unknown> | undefined {
  const jeiweb = isRecordLike(item.extensions?.jeiweb) ? item.extensions.jeiweb : undefined;
  return isRecordLike(jeiweb?.meta) ? jeiweb.meta : undefined;
}

export function getItemLookupIds(item: ItemDef): string[] {
  const meta = getJeiwebMeta(item);
  const ids = new Set<string>();
  const push = (value: unknown) => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed) return;
    ids.add(trimmed);
  };

  push(item.key.id);
  push(meta?.aggregateSourceItemId);
  collectStringValues(meta?.aggregateOriginalItemIds).forEach((id) => ids.add(id));
  if (Array.isArray(meta?.aggregateHoverSources)) {
    meta.aggregateHoverSources.forEach((entry) => {
      if (!isRecordLike(entry)) return;
      push(entry.id);
    });
  }

  return Array.from(ids);
}

export function findItemDefByLookupId(
  rawId: unknown,
  itemDefsByKeyHash?: Record<string, ItemDef>,
  options?: { allowSuffixMatch?: boolean },
): ItemDef | undefined {
  const itemId = typeof rawId === 'string' ? rawId.trim() : '';
  if (!itemId || !itemDefsByKeyHash) return undefined;

  for (const entry of Object.values(itemDefsByKeyHash)) {
    if (getItemLookupIds(entry).includes(itemId)) return entry;
  }

  if (options?.allowSuffixMatch === false) return undefined;

  return Object.values(itemDefsByKeyHash).find((entry) =>
    getItemLookupIds(entry).some((candidate) => candidate.endsWith(itemId)),
  );
}
