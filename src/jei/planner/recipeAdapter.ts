/**
 * recipeAdapter.ts
 *
 * Normalizes Recipe (slotContents-based) into a flat, LP-ready structure.
 * All amounts are per-cycle (per one craft execution).
 */

import type { Recipe, RecipeTypeDef, ItemKey } from '../types';
import { extractRecipeStacks, getRecipeTime } from './planner';
import { itemKeyHash } from '../indexing/key';

// ─── Public interface ──────────────────────────────────────────────────────────

export interface NormalizedRecipeItem {
  /** Original ItemKey (for reverse lookups / further exploration) */
  key: ItemKey;
  /** Amount produced/consumed per cycle */
  amount: number;
}

export interface NormalizedRecipe {
  id: string;
  recipeTypeKey: string;

  /** Items consumed per cycle (catalysts excluded) */
  inputItems: NormalizedRecipeItem[];
  /** Items produced per cycle */
  outputItems: NormalizedRecipeItem[];
  /** Fluids consumed per cycle: fluidId → amount */
  fluidsIn: Map<string, number>;
  /** Fluids produced per cycle: fluidId → amount */
  fluidsOut: Map<string, number>;

  /**
   * Quick lookup maps keyed by itemKeyHash.
   * These are derived from inputItems/outputItems.
   */
  inputByHash: Map<string, number>;
  outputByHash: Map<string, number>;

  /** Seconds per cycle */
  time: number;

  /** Machine that runs this recipe (if any) */
  machineId?: string | undefined;
  machineName?: string | undefined;

  /** Default power/pollution from recipeType.defaults */
  defaultPower?: number;
  defaultPollution?: number;
  defaultSpeed?: number;
}

// ─── Implementation ────────────────────────────────────────────────────────────

function stackToItemKey(s: { id: string; meta?: number | string; nbt?: unknown }): ItemKey {
  const key: ItemKey = { id: s.id };
  if (s.meta !== undefined) key.meta = s.meta;
  if (s.nbt !== undefined) key.nbt = s.nbt;
  return key;
}

function finiteOr(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeRecipe(
  recipe: Recipe,
  recipeType: RecipeTypeDef | undefined,
): NormalizedRecipe {
  const { inputs, outputs } = extractRecipeStacks(recipe, recipeType);

  const inputItems: NormalizedRecipeItem[] = [];
  const outputItems: NormalizedRecipeItem[] = [];
  const fluidsIn = new Map<string, number>();
  const fluidsOut = new Map<string, number>();

  for (const stack of inputs) {
    const amount = finiteOr(stack.amount, 0);
    if (amount <= 0) continue;
    if (stack.kind === 'item') {
      inputItems.push({ key: stackToItemKey(stack), amount });
    } else if (stack.kind === 'fluid') {
      fluidsIn.set(stack.id, (fluidsIn.get(stack.id) ?? 0) + amount);
    }
    // 'tag' inputs should have been resolved to concrete items before reaching LP
  }

  for (const stack of outputs) {
    const amount = finiteOr(stack.amount, 0);
    if (amount <= 0) continue;
    if (stack.kind === 'item') {
      outputItems.push({ key: stackToItemKey(stack), amount });
    } else if (stack.kind === 'fluid') {
      fluidsOut.set(stack.id, (fluidsOut.get(stack.id) ?? 0) + amount);
    }
  }

  // Build hash maps for O(1) LP coefficient lookup
  const inputByHash = new Map<string, number>();
  for (const item of inputItems) {
    const h = itemKeyHash(item.key);
    inputByHash.set(h, (inputByHash.get(h) ?? 0) + item.amount);
  }
  const outputByHash = new Map<string, number>();
  for (const item of outputItems) {
    const h = itemKeyHash(item.key);
    outputByHash.set(h, (outputByHash.get(h) ?? 0) + item.amount);
  }

  const time = Math.max(getRecipeTime(recipe, recipeType), 1e-6);

  // Machine info
  let machineId: string | undefined;
  let machineName: string | undefined;
  if (recipeType?.machine) {
    const m = Array.isArray(recipeType.machine) ? recipeType.machine[0] : recipeType.machine;
    if (m) {
      machineId = m.id;
      machineName = m.name;
    }
  }

  // Default energy/pollution from recipeType.defaults
  const defaults = recipeType?.defaults ?? {};
  const rawPower = finiteOr(defaults.power, NaN);
  const rawPollution = finiteOr(defaults.pollution, NaN);
  const rawSpeed = finiteOr(defaults.speed, NaN);

  const result: NormalizedRecipe = {
    id: recipe.id,
    recipeTypeKey: recipe.type,
    inputItems,
    outputItems,
    fluidsIn,
    fluidsOut,
    inputByHash,
    outputByHash,
    time,
  };
  if (machineId !== undefined) result.machineId = machineId;
  if (machineName !== undefined) result.machineName = machineName;
  if (Number.isFinite(rawPower)) result.defaultPower = rawPower;
  if (Number.isFinite(rawPollution)) result.defaultPollution = rawPollution;
  if (Number.isFinite(rawSpeed)) result.defaultSpeed = rawSpeed;
  return result;
}
