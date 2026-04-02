<template>
  <div
    v-if="html"
    :class="['ww__prose', compact ? 'ww__prose--small' : '', className]"
    v-html="html"
    @click="handleClick"
  ></div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import type { ItemDef } from 'src/jei/types';
import { renderWarfarinTextHtml } from '../text';
import type { RecordLike } from '../utils';

const props = defineProps<{
  value: unknown;
  className?: string | undefined;
  compact?: boolean | undefined;
  semantic?: boolean | undefined;
  blackboard?: Record<string, number> | undefined;
  refs?: RecordLike | undefined;
  localNameMap?: RecordLike | undefined;
  idToPackItemId?: RecordLike | undefined;
  itemDefsByKeyHash?: Record<string, ItemDef> | undefined;
}>();

const navigate = inject<((itemId: string) => void) | undefined>('wikiEntryNavigate', undefined);
const openImage = inject<((src: string, name?: string) => void) | undefined>('wikiImageOpen', undefined);

const html = computed(() =>
  renderWarfarinTextHtml(props.value, {
    blackboard: props.blackboard,
    refs: props.refs,
    localNameMap: props.localNameMap,
    idToPackItemId: props.idToPackItemId,
    itemDefsByKeyHash: props.itemDefsByKeyHash,
    semantic: props.semantic,
  }),
);

function handleClick(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const link = target.closest('[data-ww-item-id]');
  if (link instanceof HTMLElement) {
    event.preventDefault();
    const itemId = link.dataset.wwItemId;
    if (itemId) navigate?.(itemId);
    return;
  }

  const image = target.closest('img');
  if (image instanceof HTMLImageElement) {
    openImage?.(image.currentSrc || image.src, image.alt || '');
  }
}
</script>
