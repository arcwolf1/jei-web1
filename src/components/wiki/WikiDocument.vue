<template>
  <div class="wiki-document">
    <WikiBlock
      v-for="entry in topBlocks"
      :key="entry.id"
      :block="entry.block"
      :block-map="document.blockMap"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, inject, provide, ref, type Ref } from 'vue';
import WikiBlock from './WikiBlock.vue';
import type { Document, Block } from '../../types/wiki';

const props = defineProps<{
  document: Document;
  hideLeadingHorizontalRule?: boolean;
  sourcePackId?: string;
}>();

const inheritedSourcePackId = inject<Ref<string | undefined>>('wikiSourcePackId', ref(undefined));

provide(
  'wikiSourcePackId',
  computed(() => props.sourcePackId ?? inheritedSourcePackId.value),
);

const topBlocks = computed(() => {
  let blockIds = props.document.blockIds;

  if (props.hideLeadingHorizontalRule) {
    const firstContentIndex = props.document.blockIds.findIndex(
      (id) => props.document.blockMap[id]?.kind !== 'horizontalLine',
    );
    blockIds = firstContentIndex >= 0 ? props.document.blockIds.slice(firstContentIndex) : [];
  }

  return blockIds
    .map((id) => ({ id, block: props.document.blockMap[id] }))
    .filter((entry): entry is { id: string; block: Block } => Boolean(entry.block));
});
</script>

<style scoped lang="scss">
.wiki-document {
  line-height: 1.7;
  font-size: 15px;
  // color: #1f1f1f;
}
</style>
