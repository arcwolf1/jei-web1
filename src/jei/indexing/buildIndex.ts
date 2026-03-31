import type { ItemDef, ItemId, ItemKey, PackData, Recipe, RecipeTypeDef, SlotDef, SlotContent, Stack, StackItem } from 'src/jei/types';
import { isExactItemKey, itemKeyHash, stackItemToItemKey } from './key';
import { buildTagIndex } from 'src/jei/tags/resolve';
import { getItemLookupIds } from './itemLookup';

export interface JeiIndex {
  itemsByKeyHash: Map<string, ItemDef>;
  itemKeyHashesByItemId: Map<ItemId, string[]>;
  recipeTypesByKey: Map<string, RecipeTypeDef>;
  recipesById: Map<string, Recipe>;
  producingByKeyHash: Map<string, string[]>;
  consumingByKeyHash: Map<string, string[]>;
  producingByItemId: Map<ItemId, string[]>;
  consumingByItemId: Map<ItemId, string[]>;
  itemIdsByTagId: Map<string, Set<ItemId>>;
  tagIdsByItemId: Map<ItemId, Set<string>>;
}

function asArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

function addToMapArray<K>(map: Map<K, string[]>, key: K, recipeId: string): void {
  const list = map.get(key);
  if (!list) {
    map.set(key, [recipeId]);
    return;
  }
  list.push(recipeId);
}

function slotIoFallback(slotId: string): 'input' | 'output' {
  const id = slotId.toLowerCase();
  if (id.startsWith('out') || id.includes('output')) return 'output';
  return 'input';
}

function collectSlotDefsById(typeDef: RecipeTypeDef | undefined): Map<string, SlotDef> {
  const map = new Map<string, SlotDef>();
  typeDef?.slots?.forEach((s) => map.set(s.slotId, s));
  return map;
}

function indexItemStack(
  stack: StackItem,
  recipeId: string,
  direction: 'producing' | 'consuming',
  index: Pick<JeiIndex, 'producingByKeyHash' | 'consumingByKeyHash' | 'producingByItemId' | 'consumingByItemId'>,
): void {
  const itemKey = stackItemToItemKey(stack);
  const mapExact = direction === 'producing' ? index.producingByKeyHash : index.consumingByKeyHash;
  const mapWildcard = direction === 'producing' ? index.producingByItemId : index.consumingByItemId;

  if (isExactItemKey(itemKey)) {
    addToMapArray(mapExact, itemKeyHash(itemKey), recipeId);
  } else {
    addToMapArray(mapWildcard, itemKey.id, recipeId);
  }
}

function indexRecipe(
  recipe: Recipe,
  recipeType: RecipeTypeDef | undefined,
  index: Pick<JeiIndex, 'producingByKeyHash' | 'consumingByKeyHash' | 'producingByItemId' | 'consumingByItemId'>,
): void {
  const slotDefsById = collectSlotDefsById(recipeType);
  Object.keys(recipe.slotContents).forEach((slotId) => {
    const def = slotDefsById.get(slotId);
    const io = def?.io ?? slotIoFallback(slotId);
    const direction = io === 'output' ? 'producing' : 'consuming';

    const content: SlotContent = recipe.slotContents[slotId]!;
    const stacks = asArray<Stack>(content as Stack | Stack[]);
    stacks.forEach((stack) => {
      if (stack.kind !== 'item') return;
      indexItemStack(stack, recipe.id, direction, index);
    });
  });
}

export function buildJeiIndex(pack: PackData): JeiIndex {
  const itemsByKeyHash = new Map<string, ItemDef>();
  const itemKeyHashesByItemId = new Map<ItemId, string[]>();

  pack.items.forEach((it) => {
    const h = itemKeyHash(it.key);
    itemsByKeyHash.set(h, it);
    getItemLookupIds(it).forEach((lookupId) => {
      const list = itemKeyHashesByItemId.get(lookupId) ?? [];
      if (!list.includes(h)) list.push(h);
      itemKeyHashesByItemId.set(lookupId, list);
    });
  });

  const recipeTypesByKey = new Map<string, RecipeTypeDef>();
  pack.recipeTypes.forEach((rt) => recipeTypesByKey.set(rt.key, rt));

  const recipesById = new Map<string, Recipe>();
  pack.recipes.forEach((r) => recipesById.set(r.id, r));

  const producingByKeyHash = new Map<string, string[]>();
  const consumingByKeyHash = new Map<string, string[]>();
  const producingByItemId = new Map<ItemId, string[]>();
  const consumingByItemId = new Map<ItemId, string[]>();

  pack.recipes.forEach((r) => {
    indexRecipe(r, recipeTypesByKey.get(r.type), {
      producingByKeyHash,
      consumingByKeyHash,
      producingByItemId,
      consumingByItemId,
    });
  });

  const tags = buildTagIndex(pack);

  return {
    itemsByKeyHash,
    itemKeyHashesByItemId,
    recipeTypesByKey,
    recipesById,
    producingByKeyHash,
    consumingByKeyHash,
    producingByItemId,
    consumingByItemId,
    itemIdsByTagId: tags.itemIdsByTagId,
    tagIdsByItemId: tags.tagIdsByItemId,
  };
}

export function recipesProducingItem(
  index: JeiIndex,
  itemKey: ItemKey,
): string[] {
  const ids = new Set<string>();
  const exact = itemKeyHash(itemKey);
  index.producingByKeyHash.get(exact)?.forEach((id) => ids.add(id));
  index.producingByItemId.get(itemKey.id)?.forEach((id) => ids.add(id));
  return Array.from(ids);
}

export function recipesConsumingItem(
  index: JeiIndex,
  itemKey: ItemKey,
): string[] {
  const ids = new Set<string>();
  const exact = itemKeyHash(itemKey);
  index.consumingByKeyHash.get(exact)?.forEach((id) => ids.add(id));
  index.consumingByItemId.get(itemKey.id)?.forEach((id) => ids.add(id));
  return Array.from(ids);
}
