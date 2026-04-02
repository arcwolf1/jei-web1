<template>
  <span
    v-if="isInline"
    :class="[
      'wiki-entry-inline',
      `show-type-${element.entry.showType}`,
      { 'wiki-entry-inline--dark': isDark },
    ]"
    @click.prevent="handleClick"
  >
    <StackView
      class="entry-stack entry-stack--inline"
      :content="stackContent"
      :item-defs-by-key-hash="stackItemDefsByKeyHash"
      :show-subtitle="false"
    />
    <span v-if="showCount" class="entry-count">×{{ element.entry.count }}</span>
  </span>

  <div v-else :class="['wiki-entry-card', { 'wiki-entry-card--dark': isDark }]" @click="handleClick">
    <StackView
      class="entry-stack entry-stack--card"
      :content="stackContent"
      :item-defs-by-key-hash="stackItemDefsByKeyHash"
      :show-subtitle="false"
    />
    <div v-if="showCount" class="card-count">×{{ element.entry.count }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, type Ref } from 'vue';
import { useQuasar } from 'quasar';
import type { ItemDef, SlotContent } from 'src/jei/types';
import { itemKeyHash } from 'src/jei/indexing/key';
import StackView from 'src/jei/components/StackView.vue';
import type { EntryInline, CatalogItemMap } from '../../../types/wiki';

const props = defineProps<{
  element: EntryInline;
}>();

const $q = useQuasar();
const catalogMap = inject<Ref<CatalogItemMap>>('wikiCatalogMap', ref({} as CatalogItemMap));
const useProxyRef = inject<Ref<boolean>>('wikiImageUseProxy', ref(false));
const proxyUrlRef = inject<Ref<string>>('wikiImageProxyUrl', ref(''));
const wikiEntryNavigate = inject<(itemId: string) => void>('wikiEntryNavigate', () => undefined);

const entryId = computed(() => String(props.element.entry.id ?? '').trim());

const catalogEntry = computed(() => {
  const direct = catalogMap.value[entryId.value];
  if (direct) return direct;
  const numericKey = String(Number(entryId.value));
  return catalogMap.value[numericKey];
});

const displayName = computed(() => {
  return catalogEntry.value?.name || String(props.element.entry.id || '');
});

const displayCover = computed(() => {
  return catalogEntry.value?.cover || '';
});

const stackItemId = computed(() => {
  if (catalogEntry.value?.fullId) return catalogEntry.value.fullId;
  return String(props.element.entry.id || '').trim();
});

const stackContent = computed<SlotContent>(() => {
  return {
    kind: 'item',
    id: stackItemId.value,
    amount: 1,
  };
});

const stackItemDefsByKeyHash = computed<Record<string, ItemDef>>(() => {
  const id = stackItemId.value;
  if (!id) return {};

  const key = { id };
  const icon = resolveIconUrl(displayCover.value);

  return {
    [itemKeyHash(key)]: {
      key,
      name: displayName.value || id,
      ...(icon ? { icon } : {}),
    },
  };
});

const showCount = computed(() => {
  return props.element.entry.count && props.element.entry.count !== '0';
});

const isInline = computed(() => props.element.entry.showType !== 'card-big');
const isDark = computed(() => $q.dark.isActive);

const useProxy = computed(() => useProxyRef.value);
const proxyUrl = computed(() => proxyUrlRef.value);

function handleClick() {
  const id = stackItemId.value;
  if (!id) return;
  wikiEntryNavigate(id);
}

function resolveIconUrl(url: string): string {
  if (!url || !useProxy.value || !proxyUrl.value) {
    return url;
  }
  const normalizedProxy = proxyUrl.value.endsWith('/') ? proxyUrl.value : `${proxyUrl.value}/`;
  return `${normalizedProxy}${encodeURIComponent(url)}`;
}
</script>

<style scoped lang="scss">
.wiki-entry-inline {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
  border-radius: 4px;
  vertical-align: middle;

  &:hover {
    background-color: rgba(25, 118, 210, 0.1);
  }

  &.wiki-entry-inline--dark:hover {
    background-color: rgba(144, 202, 249, 0.14);
  }

  .entry-count {
    font-size: 0.85em;
    opacity: 0.8;
  }

  :deep(.stack-view) {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  :deep(.stack-view__main) {
    gap: 4px;
  }

  :deep(.stack-view__icon) {
    width: 18px;
    height: 18px;
    border-radius: 3px;
  }

  :deep(.stack-view__icon-fallback) {
    width: 18px;
    height: 18px;
    font-size: 16px;
  }

  :deep(.stack-view__name) {
    max-width: 20em;
    font-size: inherit;
    line-height: 1.3;
  }

  &.show-type-card-big {
    display: inline-flex;
  }
}

.wiki-entry-card {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background-color: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition:
    background-color 0.2s,
    border-color 0.2s;

  &:hover {
    background-color: #eeeeee;
    border-color: #d0d0d0;
  }

  :deep(.stack-view) {
    min-width: 0;
  }

  :deep(.stack-view__icon) {
    width: 24px;
    height: 24px;
    border-radius: 4px;
  }

  :deep(.stack-view__name) {
    color: #333;
    font-weight: 600;
  }

  &.wiki-entry-card--dark {
    background-color: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.18);

    &:hover {
      background-color: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.28);
    }

    :deep(.stack-view__name) {
      color: rgba(255, 255, 255, 0.92);
    }
  }
}

.card-count {
  font-size: 0.85em;
  opacity: 0.8;
  color: #666 !important;
}

.wiki-entry-card--dark .card-count {
  color: rgba(255, 255, 255, 0.7) !important;
}
</style>
