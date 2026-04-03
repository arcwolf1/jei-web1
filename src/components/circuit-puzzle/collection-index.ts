import { appPath } from 'src/utils/app-path';

export type PuzzleCollectionEntry = {
  id: string;
  title: string;
  json: string;
  directory?: string;
  markdown?: string;
  author?: string;
  difficulty?: string;
  tags: string[];
};

export type PuzzleCollectionIndex = {
  version: 1;
  title: string;
  basePath: string;
  entries: PuzzleCollectionEntry[];
};

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeBasePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return '/';
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withSlash.endsWith('/') ? withSlash.slice(0, -1) : withSlash;
}

function normalizeAssetPath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .trim();
}

export function resolveCollectionAssetPath(basePath: string, assetPath: string): string {
  const normalizedAsset = normalizeAssetPath(assetPath);
  if (!normalizedAsset) return appPath(normalizeBasePath(basePath));
  if (normalizedAsset.startsWith('/')) return appPath(normalizedAsset);
  return appPath(`${normalizeBasePath(basePath)}/${normalizedAsset}`);
}

export function parseCollectionIndex(value: unknown): {
  index: PuzzleCollectionIndex | null;
  errors: string[];
} {
  const errors: string[] = [];
  if (!value || typeof value !== 'object') {
    return { index: null, errors: ['Collection index must be an object'] };
  }

  const raw = value as Record<string, unknown>;
  const version = Number(raw.version ?? 1);
  if (version !== 1) errors.push('version must be 1');

  const title = asNonEmptyString(raw.title) ?? 'Circuit Puzzle Collection';
  const basePath = normalizeBasePath(asNonEmptyString(raw.basePath) ?? '/circuit-puzzle-levels');

  const entriesRaw = Array.isArray(raw.entries) ? raw.entries : null;
  if (!entriesRaw) {
    errors.push('entries must be an array');
    return { index: null, errors };
  }

  const entries: PuzzleCollectionEntry[] = [];
  for (let i = 0; i < entriesRaw.length; i += 1) {
    const item = entriesRaw[i];
    if (!item || typeof item !== 'object') {
      errors.push(`entries[${i}] must be an object`);
      continue;
    }
    const row = item as Record<string, unknown>;
    const id = asNonEmptyString(row.id);
    const titleValue = asNonEmptyString(row.title);
    const directory = asNonEmptyString(row.directory) ?? undefined;
    const jsonValue = asNonEmptyString(row.json);
    const json = jsonValue ?? directory;
    const markdown = asNonEmptyString(row.markdown) ?? undefined;
    const author = asNonEmptyString(row.author) ?? undefined;
    const difficulty = asNonEmptyString(row.difficulty) ?? undefined;
    const tagsRaw = Array.isArray(row.tags) ? row.tags : [];
    const tags = tagsRaw
      .map((tag) => asNonEmptyString(tag))
      .filter((tag): tag is string => tag !== null);

    if (!id) errors.push(`entries[${i}].id is required`);
    if (!titleValue) errors.push(`entries[${i}].title is required`);
    if (!json) errors.push(`entries[${i}].json or entries[${i}].directory is required`);
    if (!id || !titleValue || !json) continue;

    entries.push({
      id,
      title: titleValue,
      json,
      ...(directory ? { directory } : {}),
      ...(markdown ? { markdown } : {}),
      ...(author ? { author } : {}),
      ...(difficulty ? { difficulty } : {}),
      tags,
    });
  }

  const idSet = new Set<string>();
  for (const entry of entries) {
    if (idSet.has(entry.id)) {
      errors.push(`duplicate entry id: ${entry.id}`);
    }
    idSet.add(entry.id);
  }

  if (errors.length) return { index: null, errors };

  return {
    index: {
      version: 1,
      title,
      basePath,
      entries,
    },
    errors: [],
  };
}
