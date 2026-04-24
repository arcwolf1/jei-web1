import { computed, type ComputedRef, type Ref } from 'vue';
import { itemKeyHash } from 'src/jei/indexing/key';
import type { EnhancedBuildTreeResult, RequirementNode } from 'src/jei/planner/planner';
import type { PlannerResult } from 'src/jei/planner/types';
import type { ItemId, ItemKey } from 'src/jei/types';
import type { PlannerTargetUnit } from 'src/jei/planner/plannerUi';
import { unitSuffix } from 'src/pages/components/advanced-planner/advancedPlannerViewUtils';
import type {
  CalcForcedRawRow,
  CalcIntermediateRow,
  CalcItemRow,
  CalcMachineRow,
  PlannerTableColumn,
} from 'src/pages/components/advanced-planner/advancedPlanner.types';

type PlannerResultLike = {
  lpFlow?: PlannerResult['lpFlow'] | null;
};

export function useAdvancedPlannerCalcView(input: {
  lpMode: Ref<boolean>;
  lpResult: Ref<PlannerResultLike | null>;
  mergedTree: Ref<EnhancedBuildTreeResult | null>;
  calcDisplayUnit: Ref<PlannerTargetUnit>;
  targetRootHashes: ComputedRef<Set<string>>;
  targetUnitOptions: ComputedRef<Array<{ label: string; value: string }>>;
  t: (key: string) => string;
  getItemName: (itemId: ItemId) => string;
  isForcedRawKey: (itemKey: ItemKey) => boolean;
  forcedRawMatchKey: (itemKey: ItemKey) => string | null;
  nodeDisplayAmount: (node: RequirementNode) => number;
  displayRateFromAmount: (amountPerMinute: number, unit: PlannerTargetUnit) => number;
  rateByUnitFromPerSecond: (perSecond: number, unit: PlannerTargetUnit) => number;
}): {
  calcPower: ComputedRef<number>;
  calcPollution: ComputedRef<number>;
  calcMachineRows: ComputedRef<CalcMachineRow[]>;
  calcItemRows: ComputedRef<CalcItemRow[]>;
  calcIntermediateRows: ComputedRef<CalcIntermediateRow[]>;
  calcForcedRawRows: ComputedRef<CalcForcedRawRow[]>;
  calcMachineColumns: ComputedRef<PlannerTableColumn<CalcMachineRow>[]>;
  calcItemColumns: ComputedRef<PlannerTableColumn<CalcItemRow>[]>;
  calcIntermediateColumns: ComputedRef<PlannerTableColumn<CalcIntermediateRow>[]>;
  calcForcedRawColumns: ComputedRef<PlannerTableColumn<CalcForcedRawRow>[]>;
  getRateUnitLabel: (unit: PlannerTargetUnit) => string;
} {
  const lpCalcSummary = computed(() => {
    if (!(input.lpMode.value && input.lpResult.value?.lpFlow)) return null;

    const EPS = 1e-12;
    const flow = input.lpResult.value.lpFlow;
    const itemTotalsByHash = new Map<
      string,
      {
        itemKey: ItemKey;
        produced: number;
        consumed: number;
        external: number;
        unproduceable: number;
        target: number;
        surplus: number;
      }
    >();
    const machineRowsById = new Map<ItemId, CalcMachineRow>();

    const ensureItemTotals = (itemKey: ItemKey) => {
      const hash = itemKeyHash(itemKey);
      const previous = itemTotalsByHash.get(hash);
      if (previous) return previous;
      const next = {
        itemKey,
        produced: 0,
        consumed: 0,
        external: 0,
        unproduceable: 0,
        target: 0,
        surplus: 0,
      };
      itemTotalsByHash.set(hash, next);
      return next;
    };

    flow.targets.forEach(({ key, amountPerSecond }) => {
      ensureItemTotals(key).target += amountPerSecond;
    });
    flow.externalInputs.forEach(({ key, amountPerSecond }) => {
      ensureItemTotals(key).external += amountPerSecond;
    });
    flow.unproduceableInputs.forEach(({ key, amountPerSecond }) => {
      ensureItemTotals(key).unproduceable += amountPerSecond;
    });
    flow.surpluses.forEach(({ key, amountPerSecond }) => {
      ensureItemTotals(key).surplus += amountPerSecond;
    });

    let power = 0;
    let pollution = 0;
    flow.recipes.forEach((recipe) => {
      power += recipe.power ?? 0;
      pollution += recipe.pollution ?? 0;
      if (recipe.machineId) {
        const previous = machineRowsById.get(recipe.machineId);
        if (previous) {
          previous.count += recipe.machineCount;
        } else {
          machineRowsById.set(recipe.machineId, {
            id: recipe.machineId,
            name: input.getItemName(recipe.machineId),
            count: recipe.machineCount,
          });
        }
      }
      recipe.inputItems.forEach(({ key, amountPerSecond }) => {
        ensureItemTotals(key).consumed += amountPerSecond;
      });
      recipe.outputItems.forEach(({ key, amountPerSecond }) => {
        ensureItemTotals(key).produced += amountPerSecond;
      });
    });

    const machineRows = Array.from(machineRowsById.values()).sort((left, right) => right.count - left.count);
    const itemRows = Array.from(itemTotalsByHash.values())
      .map((totals) => {
        const amountPerSecond = Math.max(
          Math.max(0, totals.produced - totals.surplus) + totals.external + totals.unproduceable,
          totals.consumed,
          totals.target,
        );
        return {
          id: totals.itemKey.id,
          name: input.getItemName(totals.itemKey.id),
          rate: input.rateByUnitFromPerSecond(amountPerSecond, input.calcDisplayUnit.value),
        };
      })
      .filter((row) => row.rate > EPS)
      .sort((left, right) => right.rate - left.rate);

    const intermediateRows = Array.from(itemTotalsByHash.values())
      .map((totals) => {
        const forcedRaw = input.isForcedRawKey(totals.itemKey);
        const isTarget = input.targetRootHashes.value.has(itemKeyHash(totals.itemKey));
        const amountPerSecond = Math.min(
          totals.consumed,
          Math.max(0, totals.produced - totals.surplus),
        );
        return {
          id: totals.itemKey.id,
          name: input.getItemName(totals.itemKey.id),
          amount: input.rateByUnitFromPerSecond(amountPerSecond, input.calcDisplayUnit.value),
          rate: input.rateByUnitFromPerSecond(amountPerSecond, input.calcDisplayUnit.value),
          forcedRaw,
          isTarget,
        };
      })
      .filter((row) => row.amount > EPS && !row.isTarget && !row.forcedRaw)
      .sort((left, right) => right.rate - left.rate || left.name.localeCompare(right.name));

    const forcedRawRowsByKey = new Map<string, CalcForcedRawRow>();
    Array.from(itemTotalsByHash.values()).forEach((totals) => {
      const matchKey = input.forcedRawMatchKey(totals.itemKey);
      if (!matchKey || input.targetRootHashes.value.has(itemKeyHash(totals.itemKey))) return;

      const amountPerSecond = totals.external + totals.unproduceable;
      if (amountPerSecond <= EPS) return;

      const amount = input.rateByUnitFromPerSecond(amountPerSecond, input.calcDisplayUnit.value);
      const previous = forcedRawRowsByKey.get(matchKey);
      if (previous) {
        previous.amount += amount;
        previous.rate += amount;
        return;
      }

      forcedRawRowsByKey.set(matchKey, {
        keyHash: matchKey,
        itemKey: totals.itemKey,
        name: input.getItemName(totals.itemKey.id),
        amount,
        rate: amount,
      });
    });

    return {
      power,
      pollution,
      machineRows,
      itemRows,
      intermediateRows,
      forcedRawRows: Array.from(forcedRawRowsByKey.values()).sort(
        (left, right) => right.rate - left.rate || left.name.localeCompare(right.name),
      ),
    };
  });

  const calcTotals = computed(() => input.mergedTree.value?.totals ?? null);
  const calcPower = computed(() => lpCalcSummary.value?.power ?? calcTotals.value?.power ?? 0);
  const calcPollution = computed(() => lpCalcSummary.value?.pollution ?? calcTotals.value?.pollution ?? 0);

  const calcMachineRows = computed(() => {
    if (lpCalcSummary.value) return lpCalcSummary.value.machineRows;
    if (!calcTotals.value) return [] as CalcMachineRow[];
    return Array.from(calcTotals.value.machines.entries())
      .map(([id, count]) => ({ id, name: input.getItemName(id), count }))
      .sort((left, right) => right.count - left.count);
  });

  const calcItemRows = computed(() => {
    if (lpCalcSummary.value) return lpCalcSummary.value.itemRows;
    if (!calcTotals.value) return [] as CalcItemRow[];
    return Array.from(calcTotals.value.perSecond.entries())
      .map(([id, perSecond]) => ({
        id,
        name: input.getItemName(id),
        rate: input.rateByUnitFromPerSecond(perSecond, input.calcDisplayUnit.value),
      }))
      .sort((left, right) => right.rate - left.rate);
  });

  const calcIntermediateRows = computed(() => {
    if (lpCalcSummary.value) return lpCalcSummary.value.intermediateRows;
    if (!input.mergedTree.value) return [] as CalcIntermediateRow[];

    const amountById = new Map<ItemId, number>();
    const rateById = new Map<ItemId, number>();
    const walk = (node: RequirementNode, isRoot: boolean) => {
      if (node.kind !== 'item') return;
      const forcedRaw = input.isForcedRawKey(node.itemKey);
      const isTarget = input.targetRootHashes.value.has(itemKeyHash(node.itemKey));
      const isIntermediate = !isRoot && !isTarget && node.children.length > 0 && !forcedRaw;
      if (isIntermediate) {
        const itemId = node.itemKey.id;
        amountById.set(itemId, (amountById.get(itemId) ?? 0) + input.nodeDisplayAmount(node));
        rateById.set(
          itemId,
          (rateById.get(itemId) ?? 0) +
            input.displayRateFromAmount(input.nodeDisplayAmount(node), input.calcDisplayUnit.value),
        );
      }
      node.children.forEach((child) => walk(child, false));
    };

    walk(input.mergedTree.value.root as RequirementNode, true);
    return Array.from(amountById.entries())
      .map(([id, amount]) => ({
        id,
        name: input.getItemName(id),
        amount,
        rate: rateById.get(id) ?? 0,
        forcedRaw: input.isForcedRawKey({ id }),
      }))
      .sort((left, right) => right.rate - left.rate || left.name.localeCompare(right.name));
  });

  const calcForcedRawRows = computed(() => {
    if (lpCalcSummary.value) return lpCalcSummary.value.forcedRawRows;
    if (!input.mergedTree.value) return [] as CalcForcedRawRow[];

    const rowsByHash = new Map<string, CalcForcedRawRow>();
    const walk = (node: RequirementNode) => {
      if (node.kind !== 'item') return;
      const matchKey = input.forcedRawMatchKey(node.itemKey);
      if (matchKey && !input.targetRootHashes.value.has(itemKeyHash(node.itemKey))) {
        const previous = rowsByHash.get(matchKey);
        const amount = input.nodeDisplayAmount(node);
        const rate = input.displayRateFromAmount(amount, input.calcDisplayUnit.value);
        if (previous) {
          previous.amount += amount;
          previous.rate += rate;
        } else {
          rowsByHash.set(matchKey, {
            keyHash: matchKey,
            itemKey: node.itemKey,
            name: input.getItemName(node.itemKey.id),
            amount,
            rate,
          });
        }
      }
      node.children.forEach(walk);
    };

    walk(input.mergedTree.value.root as RequirementNode);
    return Array.from(rowsByHash.values()).sort(
      (left, right) => right.rate - left.rate || left.name.localeCompare(right.name),
    );
  });

  const calcMachineColumns = computed<PlannerTableColumn<CalcMachineRow>[]>(() => [
    { name: 'name', label: input.t('equipment'), field: 'name', align: 'left' as const },
    { name: 'count', label: input.t('itemCount'), field: 'count', align: 'right' as const },
  ]);

  const calcAmountLabel = computed(() =>
    input.calcDisplayUnit.value === 'items' ? input.t('itemCount') : input.t('amountPerMin'),
  );

  const labelWithUnit = (label: string, unit: PlannerTargetUnit) => {
    const suffix = unitSuffix(unit);
    return suffix ? `${label} (${suffix})` : label;
  };

  const calcItemColumns = computed<PlannerTableColumn<CalcItemRow>[]>(() => [
    { name: 'name', label: input.t('item'), field: 'name', align: 'left' as const },
    {
      name: 'rate',
      label: labelWithUnit(input.t('outputRate'), input.calcDisplayUnit.value),
      field: 'rate',
      align: 'right' as const,
      style: 'width: 180px',
      headerStyle: 'width: 180px',
    },
    {
      name: 'action',
      label: input.t('recipeSelection'),
      field: 'action',
      align: 'left' as const,
      style: 'width: 196px',
      headerStyle: 'width: 196px',
    },
  ]);

  const calcIntermediateColumns = computed<PlannerTableColumn<CalcIntermediateRow>[]>(() => [
    { name: 'name', label: input.t('item'), field: 'name', align: 'left' as const },
    {
      name: 'amount',
      label: calcAmountLabel.value,
      field: 'amount',
      align: 'right' as const,
      style: 'width: 160px',
      headerStyle: 'width: 160px',
    },
    {
      name: 'rate',
      label: labelWithUnit(input.t('productionSpeed'), input.calcDisplayUnit.value),
      field: 'rate',
      align: 'right' as const,
      style: 'width: 180px',
      headerStyle: 'width: 180px',
    },
    {
      name: 'action',
      label: input.t('action'),
      field: 'action',
      align: 'left' as const,
      style: 'width: 196px',
      headerStyle: 'width: 196px',
    },
  ]);

  const calcForcedRawColumns = computed<PlannerTableColumn<CalcForcedRawRow>[]>(() => [
    { name: 'name', label: input.t('item'), field: 'name', align: 'left' as const },
    {
      name: 'amount',
      label: calcAmountLabel.value,
      field: 'amount',
      align: 'right' as const,
      style: 'width: 160px',
      headerStyle: 'width: 160px',
    },
    {
      name: 'rate',
      label: labelWithUnit(input.t('productionSpeed'), input.calcDisplayUnit.value),
      field: 'rate',
      align: 'right' as const,
      style: 'width: 180px',
      headerStyle: 'width: 180px',
    },
    {
      name: 'action',
      label: input.t('action'),
      field: 'action',
      align: 'left' as const,
      style: 'width: 196px',
      headerStyle: 'width: 196px',
    },
  ]);

  const getRateUnitLabel = (unit: PlannerTargetUnit) =>
    input.targetUnitOptions.value.find((option) => option.value === unit)?.label ?? unit;

  return {
    calcPower,
    calcPollution,
    calcMachineRows,
    calcItemRows,
    calcIntermediateRows,
    calcForcedRawRows,
    calcMachineColumns,
    calcItemColumns,
    calcIntermediateColumns,
    calcForcedRawColumns,
    getRateUnitLabel,
  };
}
