<template>
  <div>
    <section v-if="entryEntries.length" class="ww__section">
      <h3 class="ww__title">Tutorial Entry</h3>
      <WInfoGrid :entries="entryEntries" />
    </section>

    <section v-if="pages.length" class="ww__section">
      <h3 class="ww__title">Tutorial Pages</h3>
      <div class="ww__stack">
        <div v-for="page in pages" :key="page.id" class="ww__panel">
          <div class="ww__panel-title">{{ page.title || page.id || 'Page' }}</div>
          <div class="ww__panel-sub ww__value--mono">
            ID: {{ page.id }} · Order: {{ page.order }} · TutorialID: {{ page.tutorialId }}
          </div>
          <div v-if="page.content" class="ww__prose" v-html="formatWikiHtml(page.content)"></div>
          <div v-if="page.image" class="ww__muted">Image: {{ page.image }}</div>
          <div v-if="page.video" class="ww__muted">Video: {{ page.video }}</div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import WInfoGrid from './shared/WInfoGrid.vue';
import { type RecordLike, isRecordLike, toArray, formatWikiHtml, formatScalar } from './utils';

const props = defineProps<{
  detail: RecordLike;
  list: RecordLike;
}>();

const byEntryTable = computed<RecordLike>(() =>
  isRecordLike(props.detail.wikiTutorialPageByEntryTable)
    ? props.detail.wikiTutorialPageByEntryTable
    : {},
);
const pageTable = computed<RecordLike>(() =>
  isRecordLike(props.detail.wikiTutorialPageTable) ? props.detail.wikiTutorialPageTable : {},
);

const pageIds = computed(() => toArray(byEntryTable.value.pageIds).map(String));

const entryEntries = computed(() => {
  const entries: Array<{ label: string; value: unknown }> = [];
  if (pageIds.value.length) {
    entries.push({ label: 'Page Count', value: pageIds.value.length });
    entries.push({ label: 'Page IDs', value: pageIds.value.join(', ') });
  }
  return entries;
});

const pages = computed(() => {
  const ids = pageIds.value.length ? pageIds.value : Object.keys(pageTable.value);
  return ids
    .map((id) => {
      const page = isRecordLike(pageTable.value[id]) ? pageTable.value[id] : null;
      if (!page) return null;
      return {
        id: formatScalar(page.id ?? id),
        title: page.title,
        order: formatScalar(page.order),
        tutorialId: formatScalar(page.tutorialId),
        content: page.content,
        image: page.image,
        video: page.video,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => Number(a.order) - Number(b.order));
});
</script>
