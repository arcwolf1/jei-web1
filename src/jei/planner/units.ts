/**
 * Unit conversion utilities for the crafting planner
 * Handles conversion between different time units and item/machine units
 */

import type { Rational } from './rational';
import { rational } from './rational';
import { ObjectiveUnit } from './types';

/**
 * Convert a value to per-second rate
 */
export function convertToPerSecond(
  value: Rational,
  unit: ObjectiveUnit
): Rational {
  switch (unit) {
    case ObjectiveUnit.Items:
      // Keep legacy planner semantics: a plain item count is treated like a per-minute amount.
      return value.div(rational(60));
    case ObjectiveUnit.Machines:
      return value;
    case ObjectiveUnit.PerSecond:
      return value;
    case ObjectiveUnit.PerMinute:
      return value.div(rational(60));
    case ObjectiveUnit.PerHour:
      return value.div(rational(3600));
    default:
      return value;
  }
}

/**
 * Convert a per-second rate to the target unit
 */
export function convertFromPerSecond(
  perSecond: Rational,
  unit: ObjectiveUnit
): Rational {
  switch (unit) {
    case ObjectiveUnit.Items:
      return perSecond.mul(rational(60));
    case ObjectiveUnit.Machines:
      return perSecond;
    case ObjectiveUnit.PerSecond:
      return perSecond;
    case ObjectiveUnit.PerMinute:
      return perSecond.mul(rational(60));
    case ObjectiveUnit.PerHour:
      return perSecond.mul(rational(3600));
    default:
      return perSecond;
  }
}

/**
 * Convert from one unit to another
 */
export function convertUnits(
  value: Rational,
  fromUnit: ObjectiveUnit,
  toUnit: ObjectiveUnit
): Rational {
  const perSecond = convertToPerSecond(value, fromUnit);
  return convertFromPerSecond(perSecond, toUnit);
}

/**
 * Calculate machines needed for a target production rate
 * machines = targetItemsPerSecond * recipeTime / outputPerRecipe
 */
export function calculateMachines(
  targetItemsPerSecond: Rational,
  recipeTime: number,      // Recipe time in seconds
  outputPerRecipe: Rational
): Rational {
  const time = rational(recipeTime);
  return targetItemsPerSecond.mul(time).div(outputPerRecipe);
}

/**
 * Calculate production rate from number of machines
 * itemsPerSecond = machines * outputPerRecipe / recipeTime
 */
export function calculateProductionRate(
  machines: Rational,
  recipeTime: number,
  outputPerRecipe: Rational
): Rational {
  const time = rational(recipeTime);
  return machines.mul(outputPerRecipe).div(time);
}

/**
 * Calculate production rates in various units
 */
export function calculateRates(
  machines: Rational,
  recipeTime: number,
  outputPerRecipe: Rational
): {
  perSecond: Rational;
  perMinute: Rational;
  perHour: Rational;
  items: Rational;
} {
  const perSecond = calculateProductionRate(machines, recipeTime, outputPerRecipe);
  return {
    perSecond,
    perMinute: perSecond.mul(rational(60)),
    perHour: perSecond.mul(rational(3600)),
    items: perSecond  // Alias for perSecond when thinking in counts
  };
}

/**
 * Format a rational value for display
 */
export function formatRational(r: Rational, decimals: number = 3): string {
  if (r.isZero()) return '0';
  const asNumber = r.toNumber();
  if (Number.isFinite(asNumber)) {
    // Try to display as a clean decimal first
    const rounded = Math.round(asNumber * 10 ** decimals) / 10 ** decimals;
    return rounded.toString();
  }
  // Fall back to fraction representation
  return r.toString();
}

/**
 * Format a rate with appropriate unit
 */
export function formatRate(
  perSecond: Rational,
  unit: ObjectiveUnit,
  decimals: number = 2
): string {
  const value = convertFromPerSecond(perSecond, unit);
  const unitLabel = getUnitLabel(unit);
  const formatted = formatRational(value, decimals);
  return unitLabel ? `${formatted} ${unitLabel}` : formatted;
}

/**
 * Get display label for a unit
 */
export function getUnitLabel(unit: ObjectiveUnit): string {
  switch (unit) {
    case ObjectiveUnit.Items:
      return 'items';
    case ObjectiveUnit.PerSecond:
      return '/s';
    case ObjectiveUnit.PerMinute:
      return '/min';
    case ObjectiveUnit.PerHour:
      return '/h';
    case ObjectiveUnit.Machines:
      return 'machines';
    default:
      return '';
  }
}

/**
 * Default constants
 */
export const DEFAULT_RECIPE_TIME = 0.2;  // 5 items per second base rate
export const DEFAULT_BELT_SPEED = 15;    // Items per second
export const DEFAULT_WAGON_CAPACITY = 2000; // Items per wagon

/**
 * Calculate belts needed for an item flow rate
 */
export function calculateBelts(
  itemsPerSecond: Rational,
  beltSpeed: number = DEFAULT_BELT_SPEED
): Rational {
  return itemsPerSecond.div(rational(beltSpeed));
}

/**
 * Calculate wagons needed for an item flow rate
 */
export function calculateWagons(
  itemsPerMinute: Rational,
  wagonCapacity: number = DEFAULT_WAGON_CAPACITY
): Rational {
  return itemsPerMinute.div(rational(wagonCapacity));
}
