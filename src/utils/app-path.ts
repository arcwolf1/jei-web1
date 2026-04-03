const RELATIVE_BASES = new Set(['', '.', './']);

export function appPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return trimmed;
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|data:|blob:)/i.test(trimmed)) return trimmed;

  const base = (import.meta.env.BASE_URL ?? '/').trim();
  const normalizedPath = trimmed.replace(/^\/+/, '');
  if (RELATIVE_BASES.has(base)) return normalizedPath;

  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${normalizedPath}`;
}

export function packBasePath(packId: string, trailingSlash = false): string {
  const base = appPath(`/packs/${encodeURIComponent(packId)}`);
  const normalized = base.replace(/\/+$/, '');
  return trailingSlash ? `${normalized}/` : normalized;
}
