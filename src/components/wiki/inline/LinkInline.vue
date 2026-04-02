<template>
  <a
    v-if="href"
    class="wiki-link-inline"
    :href="href"
    target="_blank"
    rel="noopener noreferrer"
  >
    {{ label }}
  </a>
  <span v-else class="wiki-link-inline wiki-link-inline--invalid">{{ label }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { LinkInline } from '../../../types/wiki';

const props = defineProps<{
  element: LinkInline;
}>();

const rawHref = computed(() => props.element.link?.link?.trim() || '');
const label = computed(() => props.element.link?.text?.trim() || rawHref.value || '');

const href = computed(() => {
  const value = rawHref.value;
  if (!value) return '';

  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString();
    }
  } catch {
    return '';
  }

  return '';
});
</script>

<style scoped lang="scss">
.wiki-link-inline {
  color: var(--q-primary);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
  word-break: break-word;

  &:hover {
    opacity: 0.9;
  }
}

.wiki-link-inline--invalid {
  opacity: 0.7;
  text-decoration-style: dashed;
}
</style>
