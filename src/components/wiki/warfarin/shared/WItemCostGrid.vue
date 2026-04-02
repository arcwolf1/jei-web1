<template>
  <div v-if="entries.length" class="ww__cost-grid" :class="{ 'ww__cost-grid--compact': compact }">
    <div
      v-for="entry in entries"
      :key="`${entry.rawId}-${String(entry.count)}`"
      class="ww__cost-card"
      :class="{ 'ww__cost-card--clickable': !!entry.packItemId }"
    >
      <stack-view
        v-if="entry.packItemId && itemDefsByKeyHash"
        class="ww__cost-stack"
        :content="{ kind: 'item', id: entry.packItemId, amount: 1 }"
        :item-defs-by-key-hash="itemDefsByKeyHash"
        variant="slot"
        :show-rarity="false"
        :subtitle-override="`x${formatScalar(entry.count)}`"
        @item-click="handleClick"
      />
      <button
        v-else
        type="button"
        class="ww__cost-fallback-card"
        :class="{ 'ww__cost-card--clickable': !!entry.packItemId }"
        @click="handleClick(entry.packItemId)"
      >
        <div class="ww__cost-thumb">
          <img
            v-if="entry.icon"
            :src="entry.icon"
            :alt="entry.name"
            class="ww__cost-image"
          />
          <div v-else class="ww__cost-fallback">{{ entry.name.slice(0, 1) }}</div>
        </div>
        <div class="ww__cost-name">{{ entry.name }}</div>
        <div class="ww__cost-count-row">x{{ formatScalar(entry.count) }}</div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue';
import type { ItemDef, ItemKey } from 'src/jei/types';
import StackView from 'src/jei/components/StackView.vue';
import { formatScalar, type MaterialCostEntry } from '../utils';

defineProps<{
  entries: MaterialCostEntry[];
  compact?: boolean | undefined;
  itemDefsByKeyHash?: Record<string, ItemDef> | undefined;
}>();

const navigate = inject<((itemId: string) => void) | undefined>('wikiEntryNavigate', undefined);

function handleClick(item: string | ItemKey | undefined): void {
  const itemId =
    typeof item === 'string' ? item : item && typeof item.id === 'string' ? item.id : undefined;
  if (!itemId) return;
  navigate?.(itemId);
}
</script>
