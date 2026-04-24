import { computed, type ComputedRef, type Ref } from 'vue';
import { itemKeyHash } from 'src/jei/indexing/key';
import { buildLpGraphFlowModel } from 'src/jei/planner/lpGraphFlow';
import {
  extractRecipeStacks,
  type EnhancedBuildTreeResult,
  type RequirementNode,
} from 'src/jei/planner/planner';
import type { PlannerResult } from 'src/jei/planner/types';
import type { JeiIndex } from 'src/jei/indexing/buildIndex';
import type { ItemId } from 'src/jei/types';
import { finiteOr } from 'src/pages/components/advanced-planner/advancedPlannerViewUtils';
import type {
  AdvancedPlannerTarget,
  CycleSeedInfo,
} from 'src/pages/components/advanced-planner/advancedPlanner.types';

type PlannerResultLike = {
  lpFlow?: PlannerResult['lpFlow'] | null;
};

export function useAdvancedPlannerSummaryView(input: {
  lpMode: Ref<boolean>;
  lpResult: Ref<PlannerResultLike | null>;
  mergedTree: Ref<EnhancedBuildTreeResult | null>;
  targets: Ref<AdvancedPlannerTarget[]>;
  index: ComputedRef<JeiIndex | null | undefined>;
  formatAmount: (amount: number) => string | number;
  perMinuteLabel: ComputedRef<string>;
}): {
  rawItemTotals: ComputedRef<Map<ItemId, number>>;
  rawFluidTotals: ComputedRef<Map<string, number>>;
  catalystTotals: ComputedRef<Map<ItemId, number>>;
  cycleSeedEntries: ComputedRef<CycleSeedInfo[]>;
  formatSummaryAmount: (amount: number) => string;
} {
  const rawItemTotals = computed(() => {
    const totals = new Map<ItemId, number>();
    if (input.lpMode.value && input.lpResult.value?.lpFlow) {
      const model = buildLpGraphFlowModel({
        flow: input.lpResult.value.lpFlow,
        includeFluids: true,
      });
      const incomingCount = new Map<string, number>();
      const outgoingCount = new Map<string, number>();
      model.nodes.forEach((node) => {
        incomingCount.set(node.nodeId, 0);
        outgoingCount.set(node.nodeId, 0);
      });
      model.edges.forEach((edge) => {
        incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1);
        outgoingCount.set(edge.source, (outgoingCount.get(edge.source) ?? 0) + 1);
      });
      model.nodes.forEach((node) => {
        if (node.kind !== 'item') return;
        const isLeafInput = (outgoingCount.get(node.nodeId) ?? 0) === 0;
        const isConsumedSomewhere = (incomingCount.get(node.nodeId) ?? 0) > 0;
        const isExplicitRaw = node.nodeId.startsWith('lgn:raw:');
        if (!isLeafInput) return;
        if (!(isConsumedSomewhere || isExplicitRaw)) return;
        totals.set(node.itemKey.id, (totals.get(node.itemKey.id) ?? 0) + node.amountPerSecond * 60);
      });
      return totals;
    }
    if (!input.mergedTree.value) return totals;

    const maxMachineCountByRecipe = new Map<string, number>();
    const prepass = (node: RequirementNode): void => {
      if (node.kind !== 'item') return;
      const plannerNode = node as RequirementNode & {
        recipeIdUsed?: string;
        machineCount?: number;
        cycle?: boolean;
        recovery?: boolean;
      };
      if (plannerNode.recipeIdUsed && !plannerNode.cycle && !plannerNode.recovery) {
        const machineCount = plannerNode.machineCount ?? 0;
        const existing = maxMachineCountByRecipe.get(plannerNode.recipeIdUsed) ?? 0;
        if (machineCount > existing) maxMachineCountByRecipe.set(plannerNode.recipeIdUsed, machineCount);
      }
      node.children.forEach(prepass);
    };
    prepass(input.mergedTree.value.root as RequirementNode);

    const seenRecipeIds = new Set<string>();
    const walk = (node: RequirementNode) => {
      if (node.kind === 'fluid') return;
      const isLeaf = node.children.length === 0;
      if (isLeaf && !node.cycleSeed) {
        totals.set(node.itemKey.id, (totals.get(node.itemKey.id) ?? 0) + (node.amount ?? 0));
      }
      if (isLeaf) return;

      const plannerNode = node as RequirementNode & {
        recipeIdUsed?: string;
        machineCount?: number;
        cycle?: boolean;
        recovery?: boolean;
      };
      if (plannerNode.recipeIdUsed && !plannerNode.cycle && !plannerNode.recovery) {
        const machineCount = plannerNode.machineCount ?? 0;
        const maxMachineCount = maxMachineCountByRecipe.get(plannerNode.recipeIdUsed) ?? 0;
        if (machineCount < maxMachineCount - 1e-9) return;
        if (seenRecipeIds.has(plannerNode.recipeIdUsed)) return;
        seenRecipeIds.add(plannerNode.recipeIdUsed);
      }
      node.children.forEach(walk);
    };

    walk(input.mergedTree.value.root as RequirementNode);
    return totals;
  });

  const rawFluidTotals = computed(() => {
    const totals = new Map<string, number>();
    if (input.lpMode.value && input.lpResult.value?.lpFlow) {
      const model = buildLpGraphFlowModel({
        flow: input.lpResult.value.lpFlow,
        includeFluids: true,
      });
      const incomingCount = new Map<string, number>();
      const outgoingCount = new Map<string, number>();
      model.nodes.forEach((node) => {
        incomingCount.set(node.nodeId, 0);
        outgoingCount.set(node.nodeId, 0);
      });
      model.edges.forEach((edge) => {
        incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1);
        outgoingCount.set(edge.source, (outgoingCount.get(edge.source) ?? 0) + 1);
      });
      model.nodes.forEach((node) => {
        if (node.kind !== 'fluid') return;
        if ((outgoingCount.get(node.nodeId) ?? 0) !== 0) return;
        if ((incomingCount.get(node.nodeId) ?? 0) <= 0) return;
        totals.set(node.id, (totals.get(node.id) ?? 0) + node.amountPerSecond * 60);
      });
      return totals;
    }
    if (!input.mergedTree.value) return totals;

    const maxMachineCountByRecipe = new Map<string, number>();
    const prepass = (node: RequirementNode): void => {
      if (node.kind !== 'item') return;
      const plannerNode = node as RequirementNode & {
        recipeIdUsed?: string;
        machineCount?: number;
        cycle?: boolean;
        recovery?: boolean;
      };
      if (plannerNode.recipeIdUsed && !plannerNode.cycle && !plannerNode.recovery) {
        const machineCount = plannerNode.machineCount ?? 0;
        const existing = maxMachineCountByRecipe.get(plannerNode.recipeIdUsed) ?? 0;
        if (machineCount > existing) maxMachineCountByRecipe.set(plannerNode.recipeIdUsed, machineCount);
      }
      node.children.forEach(prepass);
    };
    prepass(input.mergedTree.value.root as RequirementNode);

    const seenRecipeIds = new Set<string>();
    const walk = (node: RequirementNode) => {
      if (node.kind === 'fluid') {
        totals.set(node.id, (totals.get(node.id) ?? 0) + (node.amount ?? 0));
        return;
      }

      const plannerNode = node as RequirementNode & {
        recipeIdUsed?: string;
        machineCount?: number;
        cycle?: boolean;
        recovery?: boolean;
      };
      if (plannerNode.recipeIdUsed && !plannerNode.cycle && !plannerNode.recovery) {
        const machineCount = plannerNode.machineCount ?? 0;
        const maxMachineCount = maxMachineCountByRecipe.get(plannerNode.recipeIdUsed) ?? 0;
        if (machineCount < maxMachineCount - 1e-9) return;
        if (seenRecipeIds.has(plannerNode.recipeIdUsed)) return;
        seenRecipeIds.add(plannerNode.recipeIdUsed);
      }
      node.children.forEach(walk);
    };

    walk(input.mergedTree.value.root as RequirementNode);
    return totals;
  });

  const catalystTotals = computed(() => {
    const totals = new Map<ItemId, number>();
    if (input.lpMode.value && input.lpResult.value?.lpFlow && input.index.value) {
      input.lpResult.value.lpFlow.recipes.forEach((recipeRun) => {
        if (recipeRun.ratePerSecond <= 1e-12) return;
        const recipe = input.index.value?.recipesById.get(recipeRun.recipeId);
        if (!recipe) return;
        const recipeType = input.index.value?.recipeTypesByKey.get(recipe.type);
        const { catalysts } = extractRecipeStacks(recipe, recipeType);
        catalysts.forEach((catalyst) => {
          const amount = finiteOr(catalyst.amount, 0);
          totals.set(catalyst.id, Math.max(totals.get(catalyst.id) ?? 0, amount));
        });
      });
      return totals;
    }
    return input.mergedTree.value?.catalysts ?? totals;
  });

  const allTargetsUseItems = computed(
    () =>
      input.targets.value.length > 0 && input.targets.value.every((target) => target.unit === 'items'),
  );

  const cycleSeedEntries = computed<CycleSeedInfo[]>(() => {
    if (input.lpMode.value && input.lpResult.value?.lpFlow) return [];
    if (!input.mergedTree.value) return [];

    const seedsByKey = new Map<string, CycleSeedInfo>();
    const walk = (node: RequirementNode) => {
      if (node.kind !== 'item') return;
      if (node.cycleSeed) {
        const key = itemKeyHash(node.itemKey);
        const amountNeeded = node.cycleAmountNeeded ?? node.amount ?? 0;
        const seedAmount = node.cycleSeedAmount ?? node.amount ?? 0;
        const previous = seedsByKey.get(key);
        if (previous) {
          previous.amountNeeded += amountNeeded;
          previous.seedAmount += seedAmount;
          if (node.cycleFactor && (!previous.cycleFactor || node.cycleFactor > previous.cycleFactor)) {
            previous.cycleFactor = node.cycleFactor;
          }
        } else {
          seedsByKey.set(key, {
            nodeId: node.nodeId,
            itemKey: node.itemKey,
            amountNeeded,
            seedAmount,
            ...(node.cycleFactor !== undefined ? { cycleFactor: node.cycleFactor } : {}),
          });
        }
      }
      node.children.forEach(walk);
    };

    walk(input.mergedTree.value.root as RequirementNode);
    return Array.from(seedsByKey.values()).sort((left, right) => right.amountNeeded - left.amountNeeded);
  });

  const formatSummaryAmount = (amount: number): string => {
    const formatted = input.formatAmount(amount);
    return allTargetsUseItems.value ? String(formatted) : `${formatted} ${input.perMinuteLabel.value}`;
  };

  return {
    rawItemTotals,
    rawFluidTotals,
    catalystTotals,
    cycleSeedEntries,
    formatSummaryAmount,
  };
}
