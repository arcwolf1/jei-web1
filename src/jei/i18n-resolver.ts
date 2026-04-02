import type { ItemDef, RecipeTypeDef, TagDef } from './types';
import type { Language } from 'src/stores/settings';
import { normalizeTagId } from 'src/jei/tags/resolve';

export function resolveItemLocale(item: ItemDef, locale: Language): void {
  const itemI18nMap = item.i18n;
  const extI18nMap = item.extensions?.jeiweb?.i18n;
  const localeDataMap = item.extensions?.jeiweb?.localeData;
  if (!itemI18nMap && !extI18nMap && !localeDataMap) return;
  const itemEntry = itemI18nMap ? (itemI18nMap[locale] ?? itemI18nMap['zh-CN']) : undefined;
  const extEntry = extI18nMap ? (extI18nMap[locale] ?? extI18nMap['zh-CN']) : undefined;
  const localeDataEntry = localeDataMap
    ? (localeDataMap[locale] ?? localeDataMap['zh-CN'])
    : undefined;
  if (!itemEntry && !extEntry && !localeDataEntry) return;
  const entry = {
    ...(extEntry ?? {}),
    ...(itemEntry ?? {}),
  };

  if (entry.name) {
    item.name = entry.name;
  }
  if (entry.description !== undefined) {
    item.description = entry.description;
  }
  const localizedWiki = localeDataEntry?.wiki ?? entry.wiki;
  if (localizedWiki !== undefined) {
    item.wiki = localizedWiki;
  }
  if (entry.wikis !== undefined && typeof entry.wikis === 'object' && entry.wikis !== null) {
    const currentWikis =
      item.wikis && typeof item.wikis === 'object' && !Array.isArray(item.wikis) ? item.wikis : {};
    item.wikis = {
      ...currentWikis,
      ...entry.wikis,
    };
  }
  const mergedSources = {
    ...(localeDataEntry?.sources &&
    typeof localeDataEntry.sources === 'object' &&
    !Array.isArray(localeDataEntry.sources)
      ? localeDataEntry.sources
      : {}),
    ...(entry.source && typeof entry.source === 'object' && !Array.isArray(entry.source)
      ? entry.source
      : {}),
    ...(entry.sources && typeof entry.sources === 'object' && !Array.isArray(entry.sources)
      ? entry.sources
      : {}),
  };
  if (Object.keys(mergedSources).length > 0) {
    const currentSources =
      item.extensions?.jeiweb?.wiki?.sources &&
      typeof item.extensions.jeiweb.wiki.sources === 'object' &&
      !Array.isArray(item.extensions.jeiweb.wiki.sources)
        ? item.extensions.jeiweb.wiki.sources
        : {};
    item.extensions = {
      ...(item.extensions ?? {}),
      jeiweb: {
        ...(item.extensions?.jeiweb ?? {}),
        wiki: {
          ...(item.extensions?.jeiweb?.wiki ?? {}),
          sources: {
            ...currentSources,
            ...mergedSources,
          },
        },
      },
    };
  }
}

export function resolveAllItemsLocale(items: ItemDef[], locale: Language): void {
  for (const item of items) {
    resolveItemLocale(item, locale);
  }
}

export function resolveRecipeTypeLocale(type: RecipeTypeDef, locale: Language): void {
  const i18nMap = type.i18n;
  if (!i18nMap) return;

  const entry = i18nMap[locale] ?? i18nMap['zh-CN'];
  if (!entry) return;

  if (entry.displayName) {
    type.displayName = entry.displayName;
  }
}

export function resolveAllRecipeTypesLocale(types: RecipeTypeDef[], locale: Language): void {
  for (const type of types) {
    resolveRecipeTypeLocale(type, locale);
  }
}

export function getTagDisplayName(
  tagId: string,
  tag: TagDef | undefined,
  locale: Language,
): string {
  const i18nMap = tag?.i18n;
  if (!i18nMap) return tagId;

  const entry = i18nMap[locale] ?? i18nMap['zh-CN'];
  return entry?.displayName ?? tagId;
}

export function resolveTagDef(
  tagId: string,
  tags: Record<string, TagDef> | undefined,
  defaultNamespace?: string,
): TagDef | undefined {
  if (!tags) return undefined;
  const raw = String(tagId || '')
    .replace(/^#/, '')
    .trim();
  if (!raw) return undefined;

  const candidates = new Set<string>([tagId, raw]);
  if (defaultNamespace) candidates.add(normalizeTagId(raw, defaultNamespace));

  const dotted = raw.replace(':', '.');
  if (dotted !== raw) {
    candidates.add(dotted);
    if (defaultNamespace) candidates.add(`${defaultNamespace}.${dotted}`);
  }

  for (const key of candidates) {
    const hit = tags[key];
    if (hit) return hit;
  }

  if (dotted !== raw) {
    for (const [key, value] of Object.entries(tags)) {
      if (key === dotted || key.endsWith(`.${dotted}`) || key.endsWith(`:${raw}`)) return value;
    }
  } else {
    for (const [key, value] of Object.entries(tags)) {
      if (key.endsWith(`.${raw}`) || key.endsWith(`:${raw}`)) return value;
    }
  }

  return undefined;
}
