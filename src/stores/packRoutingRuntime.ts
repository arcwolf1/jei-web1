import { defineStore } from 'pinia';

export type MirrorMode = 'auto' | 'manual';

export type PackSourceSnapshot = {
  label: string;
  mirrors: string[];
};

function normalizeMirrorUrls(urls: string[]): string[] {
  return Array.from(
    new Set(urls.map((m) => m.replace(/\/+$/, '').trim()).filter((m) => m.length > 0)),
  );
}

export const usePackRoutingRuntimeStore = defineStore('packRoutingRuntime', {
  state: () => ({
    sourcesByPack: {} as Record<string, PackSourceSnapshot>,
    activeBaseUrlByPack: {} as Record<string, string>,
    latencyByPack: {} as Record<string, Record<string, number | null>>,
  }),
  actions: {
    setSources(next: Record<string, PackSourceSnapshot>) {
      this.sourcesByPack = Object.fromEntries(
        Object.entries(next).map(([packId, source]) => [
          packId,
          {
            label: source.label,
            mirrors: normalizeMirrorUrls(source.mirrors),
          },
        ]),
      );
    },
    setActiveBaseUrl(packId: string, url: string | null) {
      const normalized = (url ?? '').replace(/\/+$/, '');
      if (!normalized) {
        const rest = { ...this.activeBaseUrlByPack };
        delete rest[packId];
        this.activeBaseUrlByPack = rest;
        return;
      }
      this.activeBaseUrlByPack = {
        ...this.activeBaseUrlByPack,
        [packId]: normalized,
      };
    },
    setLatency(packId: string, url: string, latencyMs: number | null) {
      const normalized = url.replace(/\/+$/, '').trim();
      if (!normalized) return;
      const current = this.latencyByPack[packId] ?? {};
      this.latencyByPack = {
        ...this.latencyByPack,
        [packId]: {
          ...current,
          [normalized]: latencyMs,
        },
      };
    },
    setLatencyBatch(packId: string, entries: Array<readonly [string, number | null]>) {
      if (!entries.length) return;
      const current = this.latencyByPack[packId] ?? {};
      const next = { ...current };
      entries.forEach(([url, latency]) => {
        const normalized = url.replace(/\/+$/, '').trim();
        if (!normalized) return;
        next[normalized] = latency;
      });
      this.latencyByPack = {
        ...this.latencyByPack,
        [packId]: next,
      };
    },
    getLatency(packId: string, url: string): number | null {
      const normalized = url.replace(/\/+$/, '').trim();
      return this.latencyByPack[packId]?.[normalized] ?? null;
    },
    getMirrorsForPack(
      packId: string,
      mode: MirrorMode = 'auto',
      manualMirror?: string,
    ): string[] {
      const source = this.sourcesByPack[packId];
      if (!source?.mirrors?.length) return [];
      const mirrors = normalizeMirrorUrls(source.mirrors);
      if (!mirrors.length) return [];

      const manual = (manualMirror ?? '').replace(/\/+$/, '').trim();
      if (mode === 'manual' && manual && mirrors.includes(manual)) {
        return [manual, ...mirrors.filter((m) => m !== manual)];
      }

      const latency = this.latencyByPack[packId] ?? {};
      return mirrors
        .map((url, idx) => ({
          url,
          idx,
          latencyMs: latency[url],
        }))
        .sort((a, b) => {
          if (typeof a.latencyMs === 'number' && typeof b.latencyMs === 'number') {
            const delta = a.latencyMs - b.latencyMs;
            if (Math.abs(delta) > 20) return delta;
          }
          const aReachable = typeof a.latencyMs === 'number';
          const bReachable = typeof b.latencyMs === 'number';
          if (aReachable !== bReachable) return aReachable ? -1 : 1;
          const aDead = a.latencyMs === null;
          const bDead = b.latencyMs === null;
          if (aDead !== bDead) return aDead ? 1 : -1;
          return a.idx - b.idx;
        })
        .map((it) => it.url);
    },
  },
});
