<template>
  <TextInline v-if="textElement" :element="textElement" />
  <EntryInline v-else-if="entryElement" :element="entryElement" />
  <LinkInline v-else-if="linkElement" :element="linkElement" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import TextInline from './inline/TextInline.vue';
import EntryInline from './inline/EntryInline.vue';
import LinkInline from './inline/LinkInline.vue';
import type {
  InlineElement,
  TextInline as TextInlineType,
  EntryInline as EntryInlineType,
  LinkInline as LinkInlineType,
} from '../../types/wiki';

const props = defineProps<{
  element: InlineElement;
}>();

const textElement = computed<TextInlineType | null>(() => {
  return props.element.kind === 'text' ? props.element : null;
});

const entryElement = computed<EntryInlineType | null>(() => {
  return props.element.kind === 'entry' ? props.element : null;
});

const linkElement = computed<LinkInlineType | null>(() => {
  return props.element.kind === 'link' ? props.element : null;
});
</script>
