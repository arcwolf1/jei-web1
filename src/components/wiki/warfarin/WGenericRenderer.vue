<template>
  <div>
    <section v-for="section in sections" :key="section.title" class="ww__section">
      <h3 class="ww__title">{{ section.title }}</h3>
      <WInfoGrid v-if="section.type === 'info'" :entries="section.entries!" />
      <WJsonViewer v-else :value="section.raw" />
    </section>
    <div v-if="!sections.length" class="ww__empty">No structured data available.</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import WInfoGrid from './shared/WInfoGrid.vue';
import WJsonViewer from './shared/WJsonViewer.vue';
import { type RecordLike, isRecordLike, humanizeKey, formatScalar, hasData } from './utils';

interface GenericSection {
  title: string;
  type: 'info' | 'json';
  entries?: Array<{ label: string; value: string; mono: boolean }>;
  raw?: unknown;
}

const props = defineProps<{
  detail: RecordLike;
  list: RecordLike;
}>();

const sections = computed<GenericSection[]>(() => {
  const out: GenericSection[] = [];
  for (const [key, value] of Object.entries(props.detail)) {
    if (!hasData(value)) continue;
    const title = humanizeKey(key);
    if (isRecordLike(value) && !Array.isArray(value)) {
      const entries = Object.entries(value)
        .filter(([, v]) => v !== undefined && v !== null && typeof v !== 'object')
        .map(([k, v]) => ({ label: humanizeKey(k), value: formatScalar(v), mono: false }));
      if (entries.length) {
        out.push({ title, type: 'info', entries });
      }
      out.push({ title: `${title} (Raw)`, type: 'json', raw: value });
    } else {
      out.push({ title, type: 'json', raw: value });
    }
  }
  return out;
});
</script>
