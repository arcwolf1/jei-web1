<template>
  <worldgen-recipe-view
    v-if="recipeType.renderer === 'worldgen_panel'"
    :recipe="recipe"
    :recipe-type="recipeType"
    :item-defs-by-key-hash="itemDefsByKeyHash"
    :lazy-visual="lazyVisual"
    @item-click="emit('item-click', $event)"
  />
  <wiki-doc-recipe-view
    v-else-if="recipeType.renderer === 'wiki_doc_panel'"
    :recipe="recipe"
    :recipe-type="recipeType"
    :item-defs-by-key-hash="itemDefsByKeyHash"
    :lazy-visual="lazyVisual"
    @ensure-recipe-detail="emit('ensure-recipe-detail', $event)"
    @item-click="emit('item-click', $event)"
    @item-mouseenter="emit('item-mouseenter', $event)"
    @item-mouseleave="emit('item-mouseleave')"
    @item-context-menu="(evt: Event, keyHash: string) => emit('item-context-menu', evt, keyHash)"
    @item-touch-hold="(evt: unknown, keyHash: string) => emit('item-touch-hold', evt, keyHash)"
  />
  <slot-layout-recipe-view
    v-else
    :recipe="recipe"
    :recipe-type="recipeType"
    :item-defs-by-key-hash="itemDefsByKeyHash"
    :lazy-visual="lazyVisual"
    @item-click="emit('item-click', $event)"
    @item-mouseenter="emit('item-mouseenter', $event)"
    @item-mouseleave="emit('item-mouseleave')"
    @item-context-menu="(evt: Event, keyHash: string) => emit('item-context-menu', evt, keyHash)"
    @item-touch-hold="(evt: unknown, keyHash: string) => emit('item-touch-hold', evt, keyHash)"
  />
</template>

<script setup lang="ts">
import type { ItemDef, ItemKey, Recipe, RecipeTypeDef } from 'src/jei/types';
import SlotLayoutRecipeView from './SlotLayoutRecipeView.vue';
import WorldgenRecipeView from './WorldgenRecipeView.vue';
import WikiDocRecipeView from './WikiDocRecipeView.vue';

const emit = defineEmits<{
  (e: 'item-click', itemKey: ItemKey): void;
  (e: 'ensure-recipe-detail', recipeId: string): void;
  (e: 'item-mouseenter', keyHash: string): void;
  (e: 'item-mouseleave'): void;
  (e: 'item-context-menu', evt: Event, keyHash: string): void;
  (e: 'item-touch-hold', evt: unknown, keyHash: string): void;
}>();

withDefaults(
  defineProps<{
    recipe: Recipe;
    recipeType: RecipeTypeDef;
    itemDefsByKeyHash: Record<string, ItemDef>;
    lazyVisual?: boolean;
  }>(),
  {
    lazyVisual: false,
  },
);
</script>
