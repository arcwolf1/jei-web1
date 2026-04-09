<template>
  <div class="slot-layout">
    <div class="slot-layout__grid" :style="gridStyle">
      <div
        v-for="s in slots"
        :key="s.slotId"
        class="slot-layout__cell"
        :style="cellStyle(s.x, s.y)"
      >
        <q-card flat bordered class="slot-layout__slot">
          <div class="slot-layout__slot-head">
            <div class="slot-layout__slot-label">{{ s.label || s.slotId }}</div>
            <q-badge
              v-if="s.io === 'catalyst'"
              color="warning"
              class="slot-layout__slot-io"
            >
              {{ s.io }}
            </q-badge>
          </div>
          <div class="slot-layout__slot-body">
            <stack-view
              :content="recipe.slotContents[s.slotId]"
              :item-defs-by-key-hash="itemDefsByKeyHash"
              variant="slot"
              :show-name="settingsStore.recipeSlotShowName"
              :lazy-visual="lazyVisual"
              @item-click="emit('item-click', $event)"
              @item-mouseenter="emit('item-mouseenter', $event)"
              @item-mouseleave="emit('item-mouseleave')"
              @item-context-menu="
                (evt: Event, keyHash: string) => emit('item-context-menu', evt, keyHash)
              "
              @item-touch-hold="
                (evt: unknown, keyHash: string) => emit('item-touch-hold', evt, keyHash)
              "
            />
          </div>
        </q-card>
      </div>
      <div v-if="arrowColIndex !== null" class="slot-layout__arrow" :style="arrowStyle">
        <q-icon name="east" size="18px" />
      </div>
    </div>
    <recipe-params-view :recipe="recipe" :recipe-type="recipeType" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ItemDef, ItemKey, Recipe, RecipeTypeDef, SlotDef } from 'src/jei/types';
import { useSettingsStore } from 'src/stores/settings';
import StackView from './StackView.vue';
import RecipeParamsView from './RecipeParamsView.vue';

const props = defineProps<{
  recipe: Recipe;
  recipeType: RecipeTypeDef;
  itemDefsByKeyHash: Record<string, ItemDef>;
  lazyVisual?: boolean;
}>();

const emit = defineEmits<{
  (e: 'item-click', itemKey: ItemKey): void;
  (e: 'item-mouseenter', keyHash: string): void;
  (e: 'item-mouseleave'): void;
  (e: 'item-context-menu', evt: Event, keyHash: string): void;
  (e: 'item-touch-hold', evt: unknown, keyHash: string): void;
}>();

const settingsStore = useSettingsStore();

const slots = computed<SlotDef[]>(() => props.recipeType.slots ?? []);

const layout = computed(() => {
  const xs = Array.from(new Set(slots.value.map((s) => s.x))).sort((a, b) => a - b);
  const ys = Array.from(new Set(slots.value.map((s) => s.y))).sort((a, b) => a - b);

  const outputs = slots.value.filter((s) => s.io === 'output');
  const nonOutputs = slots.value.filter((s) => s.io !== 'output');
  const maxNonOutputX = nonOutputs.reduce((m, s) => Math.max(m, s.x), Number.NEGATIVE_INFINITY);
  const minOutputX = outputs.reduce((m, s) => Math.min(m, s.x), Number.POSITIVE_INFINITY);
  const shouldInsertArrow =
    outputs.length > 0 && nonOutputs.length > 0 && minOutputX > maxNonOutputX;

  const cols: Array<{ kind: 'slot'; x: number } | { kind: 'arrow' }> = [];
  xs.forEach((x) => {
    cols.push({ kind: 'slot', x });
    if (shouldInsertArrow && x === maxNonOutputX) cols.push({ kind: 'arrow' });
  });
  if (!cols.length) cols.push({ kind: 'slot', x: 0 });

  const xToCol = new Map<number, number>();
  cols.forEach((c, i) => {
    if (c.kind === 'slot') xToCol.set(c.x, i);
  });
  const yToRow = new Map<number, number>();
  ys.forEach((y, i) => yToRow.set(y, i));

  const arrowColIndex = cols.findIndex((c) => c.kind === 'arrow');
  const maxRow = Math.max(0, ys.length - 1);

  return { cols, xToCol, yToRow, arrowColIndex: arrowColIndex >= 0 ? arrowColIndex : null, maxRow };
});

const gridStyle = computed(() => {
  const ys = Array.from(new Set(slots.value.map((s) => s.y))).sort((a, b) => a - b);
  return {
    gridTemplateColumns: layout.value.cols
      .map((c) => (c.kind === 'arrow' ? '36px' : 'max-content'))
      .join(' '),
    gridTemplateRows: `repeat(${Math.max(1, ys.length)}, auto)`,
  };
});

function cellStyle(x: number, y: number) {
  const col = layout.value.xToCol.get(x) ?? 0;
  const row = layout.value.yToRow.get(y) ?? 0;
  return {
    gridColumn: `${(col < 0 ? 0 : col) + 1} / ${(col < 0 ? 0 : col) + 2}`,
    gridRow: `${(row < 0 ? 0 : row) + 1} / ${(row < 0 ? 0 : row) + 2}`,
  };
}

const arrowColIndex = computed(() => layout.value.arrowColIndex);
const arrowStyle = computed(() => {
  if (arrowColIndex.value === null) return {};
  const col = arrowColIndex.value;
  return {
    gridColumn: `${col + 1} / ${col + 2}`,
    gridRow: `1 / ${layout.value.maxRow + 2}`,
  };
});
</script>

<style scoped>
.slot-layout {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.slot-layout__grid {
  display: grid;
  gap: 10px;
  width: 100%;
  overflow-x: auto;
  justify-content: start;
}

.slot-layout__arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.65;
}

.slot-layout__slot {
  padding: 10px;
}

.slot-layout__slot-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.slot-layout__slot-label {
  font-size: 12px;
  opacity: 0.75;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 140px;
}

.slot-layout__slot-io {
  font-size: 10px;
}
</style>
