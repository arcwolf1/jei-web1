<template>
  <div v-if="blocks.length" class="ww__rich-content">
    <div v-for="(block, i) in blocks" :key="i" class="ww__prose" v-html="renderBlock(block)"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { escapeHtml, formatRichContentBlock, isRecordLike, toArray } from '../utils';

const props = defineProps<{ contentTable: unknown }>();

const blocks = computed(() => {
  if (!isRecordLike(props.contentTable)) return [];
  const list = toArray<Record<string, unknown>>(
    (props.contentTable as Record<string, unknown>).contentList,
  );
  return list.map((item) => (typeof item.content === 'string' ? item.content : '')).filter(Boolean);
});

function renderBlock(text: string): string {
  const processed = formatRichContentBlock(text);
  return escapeHtml(processed).replace(/\n/g, '<br>');
}
</script>
