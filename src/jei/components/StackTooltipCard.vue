<template>
  <div
    class="stack-tooltip"
    :class="{ 'stack-tooltip--dark': isDark }"
    :style="tooltipStyle"
  >
    <div class="stack-tooltip__title">{{ title }}</div>
    <div v-if="idLine && !detailGroups.length" class="stack-tooltip__line">{{ idLine }}</div>
    <div v-if="metaLine" class="stack-tooltip__line">{{ metaLine }}</div>
    <div v-if="nbtLine" class="stack-tooltip__line">{{ nbtLine }}</div>
    <div v-if="rarityEntries.length" class="stack-tooltip__divider"></div>
    <div v-if="rarityEntries.length" class="stack-tooltip__source-block">
      <div class="stack-tooltip__source-title">Rarity</div>
      <div
        v-for="entry in rarityEntries"
        :key="entry.key"
        class="stack-tooltip__rarity-row"
      >
        <span class="stack-tooltip__rarity-label">{{ entry.label }}</span>
        <span
          class="stack-tooltip__rarity-stars"
          :style="entry.color ? { color: entry.color } : undefined"
        >
          {{ entry.starsText }}
        </span>
        <span v-if="entry.color" class="stack-tooltip__rarity-color">{{ entry.color }}</span>
      </div>
    </div>

    <template v-if="detailGroups.length">
      <div class="stack-tooltip__divider"></div>
      <div
        v-for="group in detailGroups"
        :key="group.key"
        class="stack-tooltip__source-block"
      >
        <div class="stack-tooltip__source-title">{{ group.title }}</div>
        <div
          v-for="line in group.lines"
          :key="`${group.key}:${line}`"
          class="stack-tooltip__meta"
        >
          {{ line }}
        </div>
      </div>

      <div v-if="detailDescriptions.length" class="stack-tooltip__divider"></div>
      <div
        v-for="entry in detailDescriptions"
        :key="entry.key"
        class="stack-tooltip__source-block"
      >
        <div class="stack-tooltip__source-title">{{ entry.title }}</div>
        <div class="stack-tooltip__desc">{{ entry.description }}</div>
      </div>

      <div v-if="namespaceLines.length" class="stack-tooltip__divider"></div>
      <div v-if="namespaceLines.length" class="stack-tooltip__source-block">
        <div class="stack-tooltip__source-title">Namespaces</div>
        <div
          v-for="line in namespaceLines"
          :key="`ns:${line}`"
          class="stack-tooltip__meta"
        >
          {{ line }}
        </div>
      </div>
    </template>

    <template v-else>
      <div v-if="tagsLine" class="stack-tooltip__line">{{ tagsLine }}</div>
      <div v-if="sourceLine" class="stack-tooltip__line">{{ sourceLine }}</div>
      <div v-if="description" class="stack-tooltip__desc">{{ description }}</div>
      <div v-if="namespace" class="stack-tooltip__ns">{{ namespace }}</div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useQuasar } from 'quasar';

const props = defineProps<{
  title: string;
  idLine: string;
  metaLine: string;
  nbtLine: string;
  maxHeightPx: number;
  detailGroups: Array<{ key: string; title: string; lines: string[] }>;
  detailDescriptions: Array<{ key: string; title: string; description: string }>;
  rarityEntries: Array<{ key: string; label: string; starsText: string; color?: string }>;
  namespaceLines: string[];
  tagsLine: string;
  sourceLine: string;
  description: string;
  namespace: string;
}>();

const $q = useQuasar();
const isDark = computed(() => $q.dark.isActive);
const tooltipStyle = computed(() => ({
  maxHeight: `${Math.max(280, props.maxHeightPx || 0)}px`,
}));
</script>

<style scoped>
.stack-tooltip {
  --stack-tooltip-bg: rgba(255, 255, 255, 0.98);
  --stack-tooltip-border: rgba(15, 23, 42, 0.12);
  --stack-tooltip-shadow: 0 12px 28px rgba(15, 23, 42, 0.18);
  --stack-tooltip-text: #1f2937;
  --stack-tooltip-muted: #6b7280;
  --stack-tooltip-divider: rgba(15, 23, 42, 0.1);
  max-width: 560px;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid var(--stack-tooltip-border);
  background: var(--stack-tooltip-bg);
  color: var(--stack-tooltip-text);
  box-shadow: var(--stack-tooltip-shadow);
}

.stack-tooltip--dark {
  --stack-tooltip-bg: rgba(27, 32, 39, 0.98);
  --stack-tooltip-border: rgba(255, 255, 255, 0.1);
  --stack-tooltip-shadow: 0 14px 32px rgba(0, 0, 0, 0.38);
  --stack-tooltip-text: #f3f4f6;
  --stack-tooltip-muted: #9ca3af;
  --stack-tooltip-divider: rgba(255, 255, 255, 0.1);
}

.stack-tooltip__title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
}

.stack-tooltip__line {
  font-size: 12px;
  color: var(--stack-tooltip-text);
  line-height: 1.35;
}

.stack-tooltip__desc {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.35;
  color: var(--stack-tooltip-text);
  white-space: pre-wrap;
}

.stack-tooltip__ns {
  margin-top: 6px;
  font-size: 11px;
  color: var(--stack-tooltip-muted);
}

.stack-tooltip__divider {
  margin: 10px 0 8px;
  border-top: 1px solid var(--stack-tooltip-divider);
}

.stack-tooltip__source-block + .stack-tooltip__source-block {
  margin-top: 12px;
}

.stack-tooltip__source-title {
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 4px;
}

.stack-tooltip__meta {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.35;
  color: var(--stack-tooltip-text);
  white-space: pre-wrap;
}

.stack-tooltip__rarity-row {
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  line-height: 1.35;
}

.stack-tooltip__rarity-label {
  color: var(--stack-tooltip-text);
}

.stack-tooltip__rarity-stars {
  font-weight: 700;
  letter-spacing: 0.02em;
}

.stack-tooltip__rarity-color {
  color: var(--stack-tooltip-muted);
  font-size: 11px;
}
</style>
