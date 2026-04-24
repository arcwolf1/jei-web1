/**
 * Core types for the crafting planner
 * Based on FactorioLab's objective and step system
 */

import type { ItemKey, Recipe } from '../types';
import type { Rational } from './rational';

/**
 * Objective types - what the user wants to achieve
 */
export enum ObjectiveType {
  Output = 0,    // Produce a specific amount of items
  Input = 1,     // Consume a specific amount of items
  Maximize = 2,  // Maximize production of items
  Limit = 3      // Limit production or consumption
}

/**
 * Unit types for objectives
 */
export enum ObjectiveUnit {
  Items = 'items',           // Count of items
  PerSecond = 'per_second',  // Items per second
  PerMinute = 'per_minute',  // Items per minute
  PerHour = 'per_hour',      // Items per hour
  Machines = 'machines'      // Number of machines
}

/**
 * Base objective interface
 */
export interface ObjectiveBase {
  targetId: string;     // Item ID or recipe ID
  unit: ObjectiveUnit;
  type?: ObjectiveType;
}

/**
 * Complete objective state
 */
export interface ObjectiveState extends ObjectiveBase {
  id: string;
  value: Rational;
  type: ObjectiveType;
  recipe?: Recipe;       // Associated recipe (for recipe objectives)
  recipeId?: string;     // Specific recipe selection
}

/**
 * Recipe objective (Output or Maximize targeting a specific recipe)
 */
export interface RecipeObjective extends ObjectiveState {
  type: ObjectiveType.Output | ObjectiveType.Maximize;
  recipeId: string;
  recipe: Recipe;
}

/**
 * Item values aggregation
 */
export interface ItemValues {
  out: Rational;        // Output objective total
  in?: Rational;        // Input objective total
  max?: Rational;       // Maximize objective total
  lim?: Rational;       // Limit objective minimum
}

/**
 * Enhanced step with production details
 */
export interface Step {
  id: string;
  checked?: boolean;

  // Item identification
  itemId?: string;
  itemKey?: ItemKey;

  // Production amounts
  items: Rational;          // Total production
  output?: Rational;        // Target output
  surplus?: Rational;       // Surplus production

  // Recipe information
  recipeId?: string;
  recipe?: Recipe;

  // Machine information
  machines?: Rational;      // Machines required
  machineId?: string;
  machineName?: string;

  // Rate information
  perSecond?: Rational;
  perMinute?: Rational;
  perHour?: Rational;

  // Power and pollution
  power?: Rational;         // Power consumption (watts)
  pollution?: Rational;     // Pollution per second

  // Parent relationships (parent step ID -> amount)
  parents: Map<string, Rational>;

  // Tree structure
  children: Step[];

  // Cycle detection
  cycle?: boolean;
  cycleSeed?: boolean;

  // Depth in tree
  depth: number;

  // Recipe objective ID (if from a recipe objective)
  recipeObjectiveId?: string;
}

/**
 * Matrix state for linear programming
 */
export interface MatrixState {
  objectives: ObjectiveState[];
  recipeObjectives: RecipeObjective[];
  steps: Step[];
  recipes: Record<string, Recipe>;
  itemValues: Record<string, ItemValues>;
  recipeLimits: Record<string, Rational>;
  unproduceableIds: Set<string>;
  excludedIds: Set<string>;
  itemIds: string[];
  maximizeType: MaximizeType;
  requireMachinesOutput: boolean;
  hasSurplusCost: boolean;
}

/**
 * Maximization strategies
 */
export enum MaximizeType {
  Ratio = 'ratio',   // Maximize by ratio
  Weight = 'weight'  // Maximize by weight
}

/**
 * Recipe settings per objective
 */
export interface RecipeSettings {
  recipeId: string;
  machineId?: string;
  fuelId?: string;
  overclock?: Rational;
  modules?: ModuleSetting[];
  beacons?: BeaconSetting[];
}

/**
 * Module configuration
 */
export interface ModuleSetting {
  moduleId: string;
  count: number;
}

/**
 * Beacon configuration
 */
export interface BeaconSetting {
  beaconId: string;
  count: number;
  modules: ModuleSetting[];
}

/**
 * Cost settings for optimization
 */
export interface CostSettings {
  machines?: Rational;
  fuel?: Rational;
  modules?: Rational;
  beacons?: Rational;
  surplus?: Rational;
  inputs?: Rational;
  pollution?: Rational;
  power?: Rational;
}

/**
 * Planner calculation options
 */
export interface PlannerOptions {
  maxDepth?: number;
  defaultRecipeTime?: number;  // Default recipe processing time in seconds
  beltSpeed?: number;          // Items per second on belt
  wagonCapacity?: number;      // Items per wagon
  maximizeType?: MaximizeType;
  requireMachinesOutput?: boolean;
  hasSurplusCost?: boolean;
  costs?: CostSettings;
}

export interface LpFlowItemAmount {
  key: ItemKey;
  amountPerSecond: number;
}

export interface LpFlowFluidAmount {
  id: string;
  amountPerSecond: number;
  unit?: string;
}

export interface LpFlowRecipeRun {
  recipeId: string;
  recipeTypeKey: string;
  ratePerSecond: number;
  machineCount: number;
  machineId?: string;
  machineName?: string;
  power?: number;
  pollution?: number;
  inputItems: LpFlowItemAmount[];
  outputItems: LpFlowItemAmount[];
  inputFluids: LpFlowFluidAmount[];
  outputFluids: LpFlowFluidAmount[];
}

export interface LpFlowData {
  recipes: LpFlowRecipeRun[];
  targets: LpFlowItemAmount[];
  externalInputs: LpFlowItemAmount[];
  unproduceableInputs: LpFlowItemAmount[];
  surpluses: LpFlowItemAmount[];
}

/**
 * Planner result
 */
export interface PlannerResult {
  steps: Step[];
  totals: Totals;
  matrixState?: MatrixState;
  lpFlow?: LpFlowData;
  diagnostics?: PlannerDiagnostics;
  resultType: ResultType;
}

export interface PlannerDiagnostics {
  solverStatus?: string;
  solverReturnCode?: string;
  unboundedRecipeId?: string;
  unboundedItemHash?: string;
}

/**
 * Aggregate totals
 */
export interface Totals {
  power?: Rational;        // Total power consumption
  pollution?: Rational;    // Total pollution
  machines?: Record<string, Rational>;  // Machines by type
  items?: Record<string, Rational>;     // Items by type
}

/**
 * Result type
 */
export enum ResultType {
  Solved = 'solved',
  Infeasible = 'infeasible',
  Unbounded = 'unbounded',
  Skipped = 'skipped',
  Paused = 'paused'
}
