import type { PackData, PackManifest } from 'src/jei/types';

const DEFAULT_DOMAINS = ['bbs.hycdn.cn', 'ak.hycdn.cn', 'web.hycdn.cn'];
const DEFAULT_STORAGE_KEYS = {
  access: 'access_token',
  anonymous: 'anonymous_token',
  framework: 'framework_token',
};
const SETTINGS_STORAGE_KEY = 'jei.settings';

const anonBootstrapTasks = new Map<string, Promise<void>>();

type TokenQueryConfig = NonNullable<PackManifest['imageProxy']>['tokenQuery'];
type ImageProxyConfig = {
  urlTemplate: string;
  domains: string[];
  tokenQuery?: TokenQueryConfig;
};
type ImageProxyRuntimeSettings = {
  usePackProvided: boolean;
  useManual: boolean;
  useDev: boolean;
  manualUrlTemplate: string;
  devUrlTemplate: string;
};
type ImageProxyContext = {
  effectiveProxy: ImageProxyConfig | null;
  knownTemplates: string[];
};

function asString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map(asString).filter(Boolean)));
}

function readSettingsRecord(): Record<string, unknown> {
  try {
    const raw = globalThis.localStorage?.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readRuntimeSettings(): ImageProxyRuntimeSettings {
  const parsed = readSettingsRecord();
  const manualUrl =
    typeof parsed.packImageProxyManualUrl === 'string'
      ? parsed.packImageProxyManualUrl
      : typeof parsed.wikiImageProxyUrl === 'string'
        ? parsed.wikiImageProxyUrl
        : '';
  const devUrl =
    typeof parsed.packImageProxyDevUrl === 'string'
      ? parsed.packImageProxyDevUrl
      : '';
  return {
    usePackProvided:
      typeof parsed.packImageProxyUsePackProvided === 'boolean'
        ? parsed.packImageProxyUsePackProvided
        : true,
    useManual:
      typeof parsed.packImageProxyUseManual === 'boolean'
        ? parsed.packImageProxyUseManual
        : typeof parsed.wikiImageUseProxy === 'boolean'
          ? parsed.wikiImageUseProxy
          : false,
    useDev:
      typeof parsed.packImageProxyUseDev === 'boolean'
        ? parsed.packImageProxyUseDev
        : false,
    manualUrlTemplate: asString(manualUrl),
    devUrlTemplate: asString(devUrl),
  };
}

function safeLocalStorageGet(key: string): string {
  if (!key) return '';
  try {
    return asString(globalThis.localStorage?.getItem(key));
  } catch {
    return '';
  }
}

function safeLocalStorageSet(key: string, value: string): void {
  if (!key || !value) return;
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Ignore storage write failures.
  }
}

function hostMatchesDomains(url: string, domains: string[]): boolean {
  if (!domains.length) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function likelyImageUrl(key: string, value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;
  const lowerKey = String(key || '').toLowerCase();
  const lowerValue = value.toLowerCase();
  if (/\.(png|jpg|jpeg|webp|gif|bmp|svg)(\?|$)/i.test(lowerValue)) return true;
  if (/\/image\//i.test(lowerValue)) return true;
  if (/(cover|icon|img|illustration|avatar|thumb|poster|banner|url)$/.test(lowerKey)) return true;
  return false;
}

function readPath(obj: unknown, dotPath: string): unknown {
  if (!dotPath) return undefined;
  const segs = dotPath.split('.').map((s) => s.trim()).filter(Boolean);
  let current: unknown = obj;
  for (const seg of segs) {
    if (!isRecord(current)) return undefined;
    current = current[seg];
  }
  return current;
}

function readTokenFromResponse(raw: unknown, responsePath: string): string {
  const paths = [
    responsePath,
    'data.token',
    'data.anonymous_token',
    'token',
    'anonymous_token',
  ].filter(Boolean);
  for (const p of paths) {
    const v = asString(readPath(raw, p));
    if (v) return v;
  }
  return '';
}

function normalizeDomains(domains?: string[]): string[] {
  const target = domains?.length ? domains : DEFAULT_DOMAINS;
  return uniqueStrings(target.map((d) => asString(d).toLowerCase()));
}

function resolveEffectiveProxy(manifest: PackManifest): ImageProxyContext {
  const settings = readRuntimeSettings();
  const manifestProxy = manifest.imageProxy;
  const knownTemplates = uniqueStrings([
    asString(manifestProxy?.urlTemplate),
    asString(manifestProxy?.devUrlTemplate),
    settings.devUrlTemplate,
    settings.manualUrlTemplate,
  ]);

  const manifestDomains = normalizeDomains(manifestProxy?.domains);
  const selectedDevUrlTemplate = asString(settings.devUrlTemplate || manifestProxy?.devUrlTemplate);
  if (settings.useDev && selectedDevUrlTemplate) {
    return {
      effectiveProxy: {
        urlTemplate: selectedDevUrlTemplate,
        domains: manifestDomains,
        tokenQuery: manifestProxy?.tokenQuery,
      },
      knownTemplates,
    };
  }

  if (settings.useManual && settings.manualUrlTemplate) {
    return {
      effectiveProxy: {
        urlTemplate: settings.manualUrlTemplate,
        domains: manifestDomains,
      },
      knownTemplates,
    };
  }

  if (
    settings.usePackProvided &&
    manifestProxy &&
    manifestProxy.enabled !== false &&
    asString(manifestProxy.urlTemplate)
  ) {
    return {
      effectiveProxy: {
        urlTemplate: asString(manifestProxy.urlTemplate),
        domains: normalizeDomains(manifestProxy.domains),
        tokenQuery: manifestProxy.tokenQuery,
      },
      knownTemplates,
    };
  }

  return {
    effectiveProxy: null,
    knownTemplates,
  };
}

function toEndpointKey(proxy: ImageProxyConfig): string {
  const tq = proxy.tokenQuery;
  return [
    asString(proxy.urlTemplate),
    asString(tq?.anonymousTokenEndpoint),
    asString(tq?.anonymousTokenMethod),
    asString(tq?.anonymousTokenResponsePath),
  ].join('|');
}

function getProxyEndpointPrefix(urlTemplate: string): string {
  const template = asString(urlTemplate);
  if (!template) return '';
  const idx = template.indexOf('{url}');
  return idx >= 0 ? template.slice(0, idx) : template;
}

function isProxyEndpointUrl(url: string, urlTemplate: string): boolean {
  const prefix = getProxyEndpointPrefix(urlTemplate);
  if (prefix && url.startsWith(prefix)) return true;
  try {
    const templateParsed = new URL(
      asString(urlTemplate).replace('{url}', encodeURIComponent('https://example.invalid/image.png')),
    );
    const parsed = new URL(url);
    return (
      parsed.origin === templateParsed.origin &&
      parsed.pathname === templateParsed.pathname
    );
  } catch {
    return false;
  }
}

function buildProxyUrl(originalUrl: string, urlTemplate: string): string {
  if (urlTemplate.includes('{url}')) {
    return urlTemplate.replaceAll('{url}', encodeURIComponent(originalUrl));
  }
  try {
    const parsed = new URL(urlTemplate);
    parsed.searchParams.set('url', originalUrl);
    return parsed.toString();
  } catch {
    return originalUrl;
  }
}

function extractEmbeddedOriginalUrl(proxyUrl: string): string {
  try {
    const parsed = new URL(proxyUrl);
    const embedded = asString(parsed.searchParams.get('url'));
    if (!embedded) return '';
    try {
      return decodeURIComponent(embedded);
    } catch {
      return embedded;
    }
  } catch {
    return '';
  }
}

function extractOriginalFromKnownProxy(url: string, knownTemplates: string[]): string {
  for (const template of knownTemplates) {
    if (!template) continue;
    if (!isProxyEndpointUrl(url, template)) continue;
    const embeddedOriginal = extractEmbeddedOriginalUrl(url);
    if (/^https?:\/\//i.test(embeddedOriginal)) return embeddedOriginal;
  }
  return '';
}

function rewriteImageUrl(url: string, ctx: ImageProxyContext): string {
  const originalUrl = extractOriginalFromKnownProxy(url, ctx.knownTemplates);
  const sourceUrl = originalUrl || url;
  const proxy = ctx.effectiveProxy;
  if (!proxy) return sourceUrl;
  if (!hostMatchesDomains(sourceUrl, proxy.domains)) return sourceUrl;
  return buildProxyUrl(sourceUrl, proxy.urlTemplate);
}

function rewriteImageUrlsDeep<T>(value: T, ctx: ImageProxyContext, keyName = ''): T {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      value[i] = rewriteImageUrlsDeep(value[i], ctx, keyName);
    }
    return value;
  }
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && likelyImageUrl(keyName, value)) {
      return rewriteImageUrl(value, ctx) as T;
    }
    return value;
  }

  Object.entries(value).forEach(([k, v]) => {
    (value as Record<string, unknown>)[k] = rewriteImageUrlsDeep(v, ctx, k);
  });
  return value;
}

async function fetchAnonymousToken(proxy: ImageProxyConfig): Promise<void> {
  const tq = proxy.tokenQuery;
  if (tq?.enabled === false) return;
  if (!tq) return;

  const accessKey = asString(tq.accessTokenStorageKey) || DEFAULT_STORAGE_KEYS.access;
  const anonKey = asString(tq.anonymousTokenStorageKey) || DEFAULT_STORAGE_KEYS.anonymous;
  const accessToken = safeLocalStorageGet(accessKey);
  if (accessToken) return;
  if (safeLocalStorageGet(anonKey)) return;

  const endpoint = asString(tq.anonymousTokenEndpoint);
  if (!endpoint) return;

  const method = asString(tq.anonymousTokenMethod).toUpperCase() === 'POST' ? 'POST' : 'GET';
  const headers = isRecord(tq.anonymousTokenHeaders)
    ? Object.fromEntries(
        Object.entries(tq.anonymousTokenHeaders as Record<string, unknown>).map(([k, v]) => [
          k,
          asString(v),
        ]),
      )
    : {};
  if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';

  const init: RequestInit = { method, headers };
  if (method === 'POST' && isRecord(tq.anonymousTokenRequestBody)) {
    init.body = JSON.stringify(tq.anonymousTokenRequestBody);
  }

  const res = await fetch(endpoint, init);
  if (!res.ok) return;
  const raw = await res.json().catch(() => null);
  const token = readTokenFromResponse(raw, asString(tq.anonymousTokenResponsePath) || 'data.token');
  if (token) safeLocalStorageSet(anonKey, token);
}

export async function ensurePackImageProxyTokens(manifest: PackManifest): Promise<void> {
  const ctx = resolveEffectiveProxy(manifest);
  const proxy = ctx.effectiveProxy;
  if (!proxy || !proxy.tokenQuery) return;
  if (proxy.tokenQuery.enabled === false) return;
  const key = toEndpointKey(proxy);
  if (!key) return;
  const running = anonBootstrapTasks.get(key);
  if (running) {
    await running;
    return;
  }
  const task = fetchAnonymousToken(proxy).catch(() => {
    // Ignore token bootstrap failures; image load may still work.
  });
  anonBootstrapTasks.set(key, task);
  await task;
}

export function applyImageProxyToPack(pack: PackData): void {
  const ctx = resolveEffectiveProxy(pack.manifest);
  pack.items.forEach((item) => rewriteImageUrlsDeep(item, ctx));
  pack.recipes.forEach((recipe) => rewriteImageUrlsDeep(recipe, ctx));
  pack.recipeTypes.forEach((typeDef) => rewriteImageUrlsDeep(typeDef, ctx));
}

export function applyImageProxyToItem(item: Record<string, unknown>, manifest: PackManifest): void {
  const ctx = resolveEffectiveProxy(manifest);
  rewriteImageUrlsDeep(item, ctx);
}

export function resolveImageUrl(url: string, manifest: PackManifest): string {
  const ctx = resolveEffectiveProxy(manifest);
  return rewriteImageUrl(url, ctx);
}
