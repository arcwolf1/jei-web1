<template>
  <div>
    <section class="ww__section">
      <h3 class="ww__title">Lore Content</h3>
      <WRichContent v-if="hasData(richContentTable)" :content-table="richContentTable" />
      <div v-else class="ww__empty">No lore content available.</div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import WRichContent from './shared/WRichContent.vue';
import { type RecordLike, hasData } from './utils';

const props = defineProps<{
  detail: RecordLike;
  list: RecordLike;
}>();

const richContentTable = computed(() => props.detail.richContentTable);
</script>
