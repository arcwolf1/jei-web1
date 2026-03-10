import { computed, ref, unref, watch, type ComputedRef, type Ref } from 'vue';
import { idbGetIconCache, idbSetIconCache } from 'src/jei/utils/idb';

function asString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  if (value === null || value === undefined) return '';
  return '';
}

export function isProxyImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    return path.includes('/proxy/image') && parsed.searchParams.has('url');
  } catch {
    return false;
  }
}

function normalizeProxyUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Legacy packs may still contain token query params; strip them for safety.
    parsed.searchParams.delete('access_token');
    parsed.searchParams.delete('anonymous_token');
    parsed.searchParams.delete('framework_token');
    return parsed.toString();
  } catch {
    return url;
  }
}

export function useRuntimeImageUrl(
  source: Ref<string> | ComputedRef<string> | (() => string),
): Ref<string> {
  const resolved = ref('');
  const sourceRef = computed(() => asString(typeof source === 'function' ? source() : unref(source)));

  watch(
    sourceRef,
    (nextUrl) => {
      if (!nextUrl) {
        resolved.value = '';
        return;
      }
      // But first let's see if we can import resolveImageUrl.
      resolved.value = isProxyImageUrl(nextUrl) ? normalizeProxyUrl(nextUrl) : nextUrl;
    },
    { immediate: true },
  );

  return resolved;
}

const iconObjectUrls = new Map<string, string>();
const iconInflight = new Map<string, Promise<string>>();

function isCacheableIconUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('blob:') || url.startsWith('data:')) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function ensureCachedIconUrl(url: string): Promise<string> {
  const cachedInMemory = iconObjectUrls.get(url);
  if (cachedInMemory) return cachedInMemory;
  const existing = iconInflight.get(url);
  if (existing) return existing;
  const task = (async () => {
    try {
      const cached = await idbGetIconCache(url);
      if (cached?.blob) {
        const objectUrl = URL.createObjectURL(cached.blob);
        iconObjectUrls.set(url, objectUrl);
        return objectUrl;
      }
      const res = await fetch(url);
      if (!res.ok) return url;
      const blob = await res.blob();
      if (!blob || blob.size === 0) return url;
      await idbSetIconCache(url, {
        url,
        blob,
        size: blob.size,
        updatedAt: Date.now(),
      });
      const objectUrl = URL.createObjectURL(blob);
      iconObjectUrls.set(url, objectUrl);
      return objectUrl;
    } catch {
      return url;
    } finally {
      iconInflight.delete(url);
    }
  })();
  iconInflight.set(url, task);
  return task;
}

export function useCachedImageUrl(
  source: Ref<string> | ComputedRef<string> | (() => string),
): Ref<string> {
  const resolved = ref('');
  const sourceRef = computed(() => asString(typeof source === 'function' ? source() : unref(source)));

  watch(
    sourceRef,
    (nextUrl) => {
      if (!nextUrl) {
        resolved.value = '';
        return;
      }
      if (!isCacheableIconUrl(nextUrl)) {
        resolved.value = nextUrl;
        return;
      }
      resolved.value = '';
      const requestUrl = nextUrl;
      void ensureCachedIconUrl(requestUrl).then((cachedUrl) => {
        if (sourceRef.value !== requestUrl) return;
        resolved.value = cachedUrl || requestUrl;
      });
    },
    { immediate: true },
  );

  return resolved;
}
