import { computed, type ComputedRef, type Ref } from 'vue';
import { itemKeyHash } from 'src/jei/indexing/key';
import type { JeiIndex } from 'src/jei/indexing/buildIndex';
import type { PlannerResult } from 'src/jei/planner/types';
import type { ItemId, ItemKey } from 'src/jei/types';
import type {
  AdvancedPlannerTarget,
  LpRawRow,
  PlannerTableColumn,
} from 'src/pages/components/advanced-planner/advancedPlanner.types';

type NumericValueLike = {
  toNumber: () => number;
};

type PlannerStepLike = {
  id: string;
  itemId?: string;
  recipeId?: string;
  perSecond?: NumericValueLike;
  perMinute?: NumericValueLike;
  machines?: NumericValueLike;
  power?: NumericValueLike;
  surplus?: NumericValueLike;
};

type PlannerResultLike = {
  lpFlow?: PlannerResult['lpFlow'] | null;
  steps?: PlannerStepLike[];
};

export function useAdvancedPlannerLpRawView(input: {
  lpResult: Ref<PlannerResultLike | null>;
  targets: Ref<AdvancedPlannerTarget[]>;
  index: ComputedRef<JeiIndex | null | undefined>;
  t: (key: string) => string;
  getItemName: (itemId: ItemId) => string;
}): {
  lpRawRows: ComputedRef<LpRawRow[]>;
  lpRawColumns: ComputedRef<PlannerTableColumn<LpRawRow>[]>;
} {
  const lpTargetHashes = computed(
    () => new Set(input.targets.value.map((target) => itemKeyHash(target.itemKey))),
  );

  const formatLpRecipeItemSummary = (
    label: string,
    items: Array<{ key: ItemKey; amountPerSecond: number }>,
  ): string | null => {
    if (!items.length) return null;
    return `${label}：${items
      .map((item) => `${input.getItemName(item.key.id)} ${item.amountPerSecond.toFixed(4)}/s`)
      .join('，')}`;
  };

  const lpRawRows = computed<LpRawRow[]>(() => {
    if (!input.lpResult.value) return [];
    if (input.lpResult.value.lpFlow) {
      return input.lpResult.value.lpFlow.recipes.map((recipe) => {
        const primaryOutput =
          recipe.outputItems.find((output) => lpTargetHashes.value.has(itemKeyHash(output.key))) ??
          recipe.outputItems[0];
        const recipeDef = input.index.value?.recipesById.get(recipe.recipeId);
        const recipeType = recipeDef ? input.index.value?.recipeTypesByKey.get(recipeDef.type) : undefined;
        const recipeLabel = recipeType?.displayName ?? recipe.recipeTypeKey ?? recipe.recipeId;

        return {
          id: recipe.recipeId,
          name: primaryOutput ? input.getItemName(primaryOutput.key.id) : recipeLabel,
          itemId: primaryOutput?.key.id,
          recipeId: recipe.recipeId,
          recipeLabel,
          inputSummary: formatLpRecipeItemSummary('输入', recipe.inputItems),
          outputSummary: formatLpRecipeItemSummary('输出', recipe.outputItems),
          perSecond: primaryOutput?.amountPerSecond ?? recipe.ratePerSecond,
          perMinute: (primaryOutput?.amountPerSecond ?? recipe.ratePerSecond) * 60,
          machines: recipe.machineCount ?? 0,
          power: recipe.power ?? 0,
          surplus: 0,
        };
      });
    }

    return (input.lpResult.value.steps ?? []).map((step) => ({
      id: step.id,
      name: (input.getItemName(step.itemId ?? '') || step.recipeId) ?? step.id,
      itemId: step.itemId,
      recipeId: step.recipeId,
      recipeLabel: step.recipeId,
      inputSummary: null,
      outputSummary: null,
      perSecond: step.perSecond?.toNumber() ?? 0,
      perMinute: step.perMinute?.toNumber() ?? 0,
      machines: step.machines?.toNumber() ?? 0,
      power: step.power?.toNumber() ?? 0,
      surplus: step.surplus?.toNumber() ?? 0,
    }));
  });

  const lpRawColumns = computed<PlannerTableColumn<LpRawRow>[]>(() => [
    { name: 'name', label: input.t('itemOrRecipe'), field: 'name', align: 'left' as const },
    {
      name: 'perSecond',
      label: input.t('outputPerSecond'),
      field: 'perSecond',
      align: 'right' as const,
      format: (value: number) => (value > 0 ? value.toFixed(4) : '-'),
    },
    {
      name: 'perMinute',
      label: input.t('outputPerMinute'),
      field: 'perMinute',
      align: 'right' as const,
      format: (value: number) => (value > 0 ? value.toFixed(2) : '-'),
    },
    {
      name: 'machines',
      label: input.t('machineCount'),
      field: 'machines',
      align: 'right' as const,
      format: (value: number) => (value > 0 ? value.toFixed(2) : '-'),
    },
    {
      name: 'surplus',
      label: input.t('surplusPerSecond'),
      field: 'surplus',
      align: 'right' as const,
    },
  ]);

  return {
    lpRawRows,
    lpRawColumns,
  };
}
