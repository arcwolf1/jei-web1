import { computed, type ComputedRef, type Ref } from 'vue';
import { itemKeyHash } from 'src/jei/indexing/key';
import type { EnhancedBuildTreeResult, RequirementNode } from 'src/jei/planner/planner';
import type { ItemKey } from 'src/jei/types';
import type { PlannerResult } from 'src/jei/planner/types';
import { finiteOr } from 'src/pages/components/advanced-planner/advancedPlannerViewUtils';
import type {
  LpTreeNode,
  PlannerTreeNode,
  TreeListRow,
  TreeRow,
} from 'src/pages/components/advanced-planner/advancedPlanner.types';

type PlannerResultLike = {
  lpFlow?: PlannerResult['lpFlow'] | null;
};

export function useAdvancedPlannerTreeView(input: {
  lpMode: Ref<boolean>;
  lpResult: Ref<PlannerResultLike | null>;
  lpTreeRoots: ComputedRef<LpTreeNode[]>;
  mergedTree: Ref<EnhancedBuildTreeResult | null>;
  collapsed: Ref<Set<string>>;
  itemName: (itemKey: ItemKey) => string;
  formatAmount: (amount: number) => string | number;
}): {
  toggleCollapsed: (nodeId: string) => void;
  treeRows: ComputedRef<TreeRow[]>;
  treeListRows: ComputedRef<TreeListRow[]>;
  recoveryProducedByNodeId: ComputedRef<Map<string, Array<{ itemKey: ItemKey; amount: number }>>>;
  recoveryProducedText: (nodeId: string) => string;
} {
  const toggleCollapsed = (nodeId: string) => {
    const next = new Set(input.collapsed.value);
    if (next.has(nodeId)) next.delete(nodeId);
    else next.add(nodeId);
    input.collapsed.value = next;
  };

  const treeRoots = computed<PlannerTreeNode[]>(() =>
    input.lpTreeRoots.value.length
      ? input.lpTreeRoots.value
      : input.mergedTree.value
        ? [input.mergedTree.value.root]
        : [],
  );

  const treeRows = computed<TreeRow[]>(() => {
    if (!treeRoots.value.length) return [];
    const rows: TreeRow[] = [];

    const walk = (node: PlannerTreeNode, depth: number) => {
      rows.push({ node, depth });
      if (node.kind !== 'item') return;
      if (input.collapsed.value.has(node.nodeId)) return;
      node.children.forEach((child) => walk(child, depth + 1));
    };

    treeRoots.value.forEach((root) => walk(root, 0));
    return rows;
  });

  const treeListRows = computed<TreeListRow[]>(() => {
    if (!treeRoots.value.length) return [];
    const rows: TreeListRow[] = [];

    const walk = (node: PlannerTreeNode, connect: boolean[]) => {
      rows.push({ node, connect });
      if (node.kind !== 'item') return;
      if (input.collapsed.value.has(node.nodeId)) return;
      node.children.forEach((child, index) =>
        walk(child, [...connect, index !== node.children.length - 1]),
      );
    };

    treeRoots.value.forEach((root, index) => walk(root, [index !== treeRoots.value.length - 1]));
    return rows;
  });

  const recoveryProducedByNodeId = computed(() => {
    const out = new Map<string, Array<{ itemKey: ItemKey; amount: number }>>();
    if (input.lpMode.value && input.lpResult.value?.lpFlow) return out;
    if (!input.mergedTree.value) return out;

    const byNodeAndItem = new Map<string, Map<string, { itemKey: ItemKey; amount: number }>>();
    const walk = (node: RequirementNode) => {
      if (node.kind !== 'item') return;
      if (node.recovery && node.recoverySourceNodeId) {
        const sourceNodeId = node.recoverySourceNodeId;
        const itemHash = itemKeyHash(node.itemKey);
        const bucket =
          byNodeAndItem.get(sourceNodeId) ?? new Map<string, { itemKey: ItemKey; amount: number }>();
        const previous = bucket.get(itemHash);
        if (previous) previous.amount += finiteOr(node.amount, 0);
        else bucket.set(itemHash, { itemKey: node.itemKey, amount: finiteOr(node.amount, 0) });
        byNodeAndItem.set(sourceNodeId, bucket);
      }
      node.children.forEach(walk);
    };

    walk(input.mergedTree.value.root as RequirementNode);
    byNodeAndItem.forEach((bucket, nodeId) => out.set(nodeId, Array.from(bucket.values())));
    return out;
  });

  const recoveryProducedText = (nodeId: string): string => {
    const entries = recoveryProducedByNodeId.value.get(nodeId) ?? [];
    if (!entries.length) return '';
    return entries
      .map((entry) => `${input.itemName(entry.itemKey)} x${input.formatAmount(entry.amount)}`)
      .join('、');
  };

  return {
    toggleCollapsed,
    treeRows,
    treeListRows,
    recoveryProducedByNodeId,
    recoveryProducedText,
  };
}
