import type { ItemId, ItemKey } from 'src/jei/types';

export type PlannerSavePayload = {
  name: string;
  rootItemKey: ItemKey;
  targetAmount: number;
  useProductRecovery?: boolean;
  selectedRecipeIdByItemKeyHash: Record<string, string>;
  selectedItemIdByTagId: Record<string, ItemId>;
  kind?: 'advanced';
  targets?: Array<{
    itemKey: ItemKey;
    itemName?: string;
    rate: number;
    unit: 'per_second' | 'per_minute' | 'per_hour';
  }>;
};

export type PlannerInitialState = {
  loadKey: string;
  targetAmount: number;
  useProductRecovery?: boolean;
  selectedRecipeIdByItemKeyHash: Record<string, string>;
  selectedItemIdByTagId: Record<string, ItemId>;
};

export type PlannerLiveState = {
  targetAmount: number;
  useProductRecovery?: boolean;
  selectedRecipeIdByItemKeyHash: Record<string, string>;
  selectedItemIdByTagId: Record<string, ItemId>;
};
