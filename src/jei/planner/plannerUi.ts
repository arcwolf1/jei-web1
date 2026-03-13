import type { ItemId, ItemKey } from 'src/jei/types';
import type { ObjectiveType, ObjectiveUnit } from './types';

/** A single objective entry in an advanced plan save payload */
export type AdvancedObjectiveEntry = {
  itemKey: ItemKey;
  itemName?: string;
  /** Numeric value (exact amount or rate depending on `unit`) */
  value: number;
  unit: ObjectiveUnit;
  type: ObjectiveType;
};

export type PlannerSavePayload = {
  name: string;
  rootItemKey: ItemKey;
  targetAmount: number;
  useProductRecovery?: boolean;
  selectedRecipeIdByItemKeyHash: Record<string, string>;
  selectedItemIdByTagId: Record<string, ItemId>;
  /** 'advanced' = use LP-backed multi-objective planner */
  kind?: 'advanced';
  /**
   * Multi-objective targets for the advanced planner.
   * When `kind === 'advanced'` this supersedes `rootItemKey + targetAmount`.
   */
  targets?: AdvancedObjectiveEntry[];
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
