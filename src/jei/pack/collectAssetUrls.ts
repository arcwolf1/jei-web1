import type { ItemDef, Recipe, RecipeTypeDef } from 'src/jei/types';
import { packBasePath } from 'src/utils/app-path';

function collectFromItem(out: Set<string>, item: ItemDef) {
  if (item.icon) out.add(item.icon);
  if (item.iconSprite?.url) out.add(item.iconSprite.url);
}

function collectFromRecipeType(out: Set<string>, type: RecipeTypeDef) {
  const machine = type.machine;
  if (machine) {
    if (Array.isArray(machine)) {
      machine.forEach((m) => {
        if (m.icon) out.add(m.icon);
      });
    } else {
      if (machine.icon) out.add(machine.icon);
    }
  }
}

function collectFromRecipe(out: Set<string>, recipe: Recipe) {
  recipe.inlineItems?.forEach((it) => collectFromItem(out, it));
}

export function collectPackAssetUrls(args: {
  packId: string;
  items: ItemDef[];
  recipeTypes: RecipeTypeDef[];
  recipes: Recipe[];
}): string[] {
  const base = packBasePath(args.packId, true);
  const out = new Set<string>();
  args.items.forEach((it) => collectFromItem(out, it));
  args.recipeTypes.forEach((rt) => collectFromRecipeType(out, rt));
  args.recipes.forEach((r) => collectFromRecipe(out, r));
  return Array.from(out)
    .filter((u) => typeof u === 'string' && u.startsWith(base))
    .sort((a, b) => a.localeCompare(b));
}
