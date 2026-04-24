import { itemKeyHash } from '../indexing/key';
import type { LpFlowData } from './types';

export function mergeLpRecipeSelections(args: {
  base: Map<string, string>;
  lpFlow?: LpFlowData;
}): Map<string, string> {
  const merged = new Map(args.base);
  const flow = args.lpFlow;
  if (!flow) return merged;

  const EPS = 1e-12;
  const bestRecipeByItemHash = new Map<string, { recipeId: string; amountPerSecond: number }>();

  flow.recipes.forEach((recipe) => {
    recipe.outputItems.forEach((output) => {
      if (output.amountPerSecond <= EPS) return;
      const hash = itemKeyHash(output.key);
      const prev = bestRecipeByItemHash.get(hash);
      if (
        !prev
        || output.amountPerSecond > prev.amountPerSecond + EPS
        || (
          Math.abs(output.amountPerSecond - prev.amountPerSecond) <= EPS
          && recipe.recipeId.localeCompare(prev.recipeId) < 0
        )
      ) {
        bestRecipeByItemHash.set(hash, {
          recipeId: recipe.recipeId,
          amountPerSecond: output.amountPerSecond,
        });
      }
    });
  });

  bestRecipeByItemHash.forEach((best, hash) => {
    merged.set(hash, best.recipeId);
  });

  return merged;
}
