import type { Edge } from '@vue-flow/core';
import type { PlannerTargetUnit } from 'src/jei/planner/plannerUi';
import type { PlannerTreeNode } from 'src/pages/components/advanced-planner/advancedPlanner.types';

export function finiteOr(n: unknown, fallback: number): number {
  const value = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(value) ? value : fallback;
}

export function formatAmount(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1000) / 1000;
}

export function unitSuffix(unit: PlannerTargetUnit): string {
  if (unit === 'items') return '';
  if (unit === 'per_second') return '/s';
  if (unit === 'per_hour') return '/h';
  return '/min';
}

export function displayRateFromAmount(
  amountPerMinute: number,
  unit: PlannerTargetUnit,
): number {
  if (unit === 'items') return amountPerMinute;
  if (unit === 'per_second') return amountPerMinute / 60;
  if (unit === 'per_hour') return amountPerMinute * 60;
  return amountPerMinute;
}

export function rateByUnitFromPerSecond(
  perSecond: number,
  unit: PlannerTargetUnit,
): number {
  if (unit === 'items') return perSecond * 60;
  if (unit === 'per_second') return perSecond;
  if (unit === 'per_hour') return perSecond * 3600;
  return perSecond * 60;
}

export function nodeDisplayAmount(node: { amount?: unknown }): number {
  return finiteOr(node.amount, 0);
}

export function nodeDisplayRateByUnit(
  node: { amount?: unknown },
  unit: PlannerTargetUnit,
): number {
  return displayRateFromAmount(nodeDisplayAmount(node), unit);
}

export function nodeBeltsText(node: PlannerTreeNode, beltSpeed: number): string {
  if (node.kind !== 'item') return '';
  const perSecond = nodeDisplayAmount(node) / 60;
  const belts = perSecond / beltSpeed;
  if (!Number.isFinite(belts) || belts <= 0) return '';
  if (belts < 0.1) return '<0.1';
  return String(formatAmount(belts));
}

export function nodeMachinesText(node: PlannerTreeNode): string {
  if (node.kind !== 'item') return '';
  const meta = node as PlannerTreeNode & { machineCount?: unknown; machines?: unknown };
  const machineCount = finiteOr(meta.machineCount, 0);
  if (Number.isFinite(machineCount) && machineCount > 0) return String(Math.round(machineCount));
  const machines = finiteOr(meta.machines, 0);
  if (!Number.isFinite(machines) || machines <= 0) return '';
  return String(Math.ceil(machines - 1e-9));
}

export function nodePowerText(node: PlannerTreeNode): string {
  if (node.kind !== 'item') return '';
  const power = finiteOr((node as PlannerTreeNode & { power?: unknown }).power, 0);
  if (!Number.isFinite(power) || power <= 0) return '';
  return `${formatAmount(power)} kW`;
}

export function formatMachineCountForDisplay(value: unknown, decimals: number): number {
  const numeric = finiteOr(value, 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  const safeDecimals = Math.max(0, Math.min(4, Math.floor(finiteOr(decimals, 0))));
  if (safeDecimals === 0) return Math.round(numeric);
  const factor = 10 ** safeDecimals;
  return Math.round(numeric * factor) / factor;
}

export function lineEdgeStrokeWidth(
  edge: Edge,
  emphasis: 'normal' | 'toRoot' | 'connected' | 'path' | 'fromLeaf',
  baseStrokeWidth = 2,
): number {
  const base = finiteOr(
    (edge.style as { strokeWidth?: number } | undefined)?.strokeWidth,
    baseStrokeWidth,
  );
  if (emphasis === 'connected') return base + 1;
  if (emphasis === 'path') return base + 0.7;
  if (emphasis === 'toRoot') return base + 0.5;
  if (emphasis === 'fromLeaf') return base + 0.3;
  return base;
}
