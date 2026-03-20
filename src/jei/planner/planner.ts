import type { ItemId, ItemKey, PackData, Recipe, RecipeTypeDef, SlotContent, SlotDef, Stack, StackItem, StackTag } from 'src/jei/types';
import type { JeiIndex } from 'src/jei/indexing/buildIndex';
import { recipesProducingItem } from 'src/jei/indexing/buildIndex';
import { itemKeyHash } from 'src/jei/indexing/key';
import { normalizeTagId } from 'src/jei/tags/resolve';

export type PlannerDecision =
  | {
    kind: 'item_recipe';
    itemKey: ItemKey;
    itemKeyHash: string;
    recipeOptions: string[];
  }
  | {
    kind: 'tag_item';
    tagId: string;
    candidateItemIds: ItemId[];
  };

export type RequirementNode =
  | {
    kind: 'item';
    nodeId: string;
    itemKey: ItemKey;
    amount: number;
    unit?: string;
    recovery?: boolean;
    recoverySourceItemKey?: ItemKey;
    recoverySourceRecipeId?: string;
    recoverySourceRecipeTypeKey?: string;
    recoverySourceNodeId?: string;
    recipeIdUsed?: string;
    recipeTypeKeyUsed?: string;
    machineItemId?: ItemId;
    machineName?: string;
    children: RequirementNode[];
    catalysts: StackItem[];
    cycle: boolean;
    cycleSeed?: boolean;
    cycleKeys?: ItemKey[];
    cycleFactor?: number;
    cycleAmountNeeded?: number;
    cycleSeedAmount?: number;
  }
  | {
    kind: 'fluid';
    nodeId: string;
    id: string;
    amount: number;
    unit?: string;
  };

export interface BuildTreeResult {
  root: RequirementNode;
  leafItemTotals: Map<ItemId, number>;
  leafFluidTotals: Map<string, number>;
  catalysts: Map<ItemId, number>;
}

function asArray<T>(v: T | T[]): T[] {
  return Array.isArray(v) ? v : [v];
}

function slotIoFallback(slotId: string): 'input' | 'output' {
  const id = slotId.toLowerCase();
  if (id.startsWith('out') || id.includes('output')) return 'output';
  return 'input';
}

function collectSlotDefsById(typeDef: RecipeTypeDef | undefined): Map<string, SlotDef> {
  const map = new Map<string, SlotDef>();
  typeDef?.slots?.forEach((s) => map.set(s.slotId, s));
  return map;
}

function finiteNumberOr(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function isForcedRawItem(
  key: ItemKey,
  forcedRawItemKeyHashes?: ReadonlySet<string>,
): boolean {
  if (!forcedRawItemKeyHashes || forcedRawItemKeyHashes.size === 0) return false;
  return forcedRawItemKeyHashes.has(itemKeyHash(key));
}

function recipeTypeHasMachine(recipeType: RecipeTypeDef | undefined): boolean {
  if (!recipeType?.machine) return false;
  return Array.isArray(recipeType.machine) ? recipeType.machine.length > 0 : true;
}

export function getRecipeTypePlannerPriority(recipeType: RecipeTypeDef | undefined): number {
  const explicit = recipeType?.plannerPriority;
  if (typeof explicit === 'number' && Number.isFinite(explicit)) return explicit;
  if (recipeType?.renderer === 'wiki_doc_panel') return -200;
  if (recipeTypeHasMachine(recipeType)) return 100;
  return 0;
}

function hasRecipeTimeInfo(recipe: Recipe, recipeType: RecipeTypeDef | undefined): boolean {
  if (recipe.params) {
    const timeParams = ['time', 'duration', 'processTime', 'processingTime'];
    for (const param of timeParams) {
      if (param in recipe.params) {
        const value = finiteNumberOr(recipe.params[param], 0);
        if (value > 0) return true;
      }
    }
  }

  if (recipeType?.defaults) {
    const defaultTime = finiteNumberOr(recipeType.defaults.time, 0);
    if (defaultTime > 0) return true;
  }

  return false;
}

function getRecipeSortTuple(
  index: JeiIndex,
  itemKey: ItemKey,
  recipeId: string,
): [number, number, number, number, string] {
  const recipe = index.recipesById.get(recipeId);
  if (!recipe) return [-9999, 0, Number.POSITIVE_INFINITY, 9999, recipeId];
  const recipeType = index.recipeTypesByKey.get(recipe.type);
  const priority = getRecipeTypePlannerPriority(recipeType);
  const hasTime = hasRecipeTimeInfo(recipe, recipeType) ? 1 : 0;
  const time = hasTime ? getRecipeTime(recipe, recipeType) : Number.POSITIVE_INFINITY;
  const { inputs } = extractRecipeStacks(recipe, recipeType);
  const outputForItem = perCraftOutputAmountFor(recipe, recipeType, itemKey);
  // Prefer higher planner priority and meaningful output before minimizing complexity.
  const inputsLen = outputForItem > 0 ? inputs.length : 9998;
  return [priority, hasTime, time, inputsLen, recipeId];
}

export function sortRecipeOptionsForItem(
  index: JeiIndex,
  itemKey: ItemKey,
  recipeIds: string[],
): string[] {
  return recipeIds
    .slice()
    .sort((a, b) => {
      const [pa, ta, taTime, ia, ra] = getRecipeSortTuple(index, itemKey, a);
      const [pb, tb, tbTime, ib, rb] = getRecipeSortTuple(index, itemKey, b);
      if (pa !== pb) return pb - pa;
      if (ta !== tb) return tb - ta;
      if (taTime !== tbTime) return taTime - tbTime;
      if (ia !== ib) return ia - ib;
      return ra.localeCompare(rb);
    });
}

export function extractRecipeStacks(recipe: Recipe, recipeType: RecipeTypeDef | undefined): {
  inputs: Stack[];
  outputs: Stack[];
  catalysts: StackItem[];
} {
  const slotDefsById = collectSlotDefsById(recipeType);
  const inputs: Stack[] = [];
  const outputs: Stack[] = [];
  const catalysts: StackItem[] = [];

  for (const slotId of Object.keys(recipe.slotContents)) {
    const def = slotDefsById.get(slotId);
    const io = def?.io ?? slotIoFallback(slotId);
    const content: SlotContent = recipe.slotContents[slotId]!;
    const stacks = asArray<Stack>(content as Stack | Stack[]);

    if (io === 'output') outputs.push(...stacks);
    else if (io === 'catalyst') catalysts.push(...stacks.filter((s): s is StackItem => s.kind === 'item'));
    else inputs.push(...stacks);
  }

  return { inputs, outputs, catalysts };
}

function stackItemToKey(s: StackItem): ItemKey {
  const key: ItemKey = { id: s.id };
  if (s.meta !== undefined) key.meta = s.meta;
  if (s.nbt !== undefined) key.nbt = s.nbt;
  return key;
}

function stackMatchesKey(stack: StackItem, key: ItemKey): boolean {
  if (stack.id !== key.id) return false;
  if (key.meta !== undefined && stack.meta !== key.meta) return false;
  if (key.nbt !== undefined) {
    try {
      return JSON.stringify(stack.nbt) === JSON.stringify(key.nbt);
    } catch {
      return false;
    }
  }
  return true;
}

export function perCraftOutputAmountFor(recipe: Recipe, recipeType: RecipeTypeDef | undefined, itemKey: ItemKey): number {
  const { outputs } = extractRecipeStacks(recipe, recipeType);
  let total = 0;
  for (const s of outputs) {
    if (s.kind !== 'item') continue;
    if (!stackMatchesKey(s, itemKey)) continue;
    total += finiteNumberOr(s.amount, 0);
  }
  return total;
}

function perCraftInputAmountFor(recipe: Recipe, recipeType: RecipeTypeDef | undefined, itemKey: ItemKey): number {
  const { inputs } = extractRecipeStacks(recipe, recipeType);
  let total = 0;
  for (const s of inputs) {
    if (s.kind !== 'item') continue;
    if (!stackMatchesKey(s, itemKey)) continue;
    total += finiteNumberOr(s.amount, 0);
  }
  return total;
}

export function computePlannerDecisions(args: {
  pack: PackData;
  index: JeiIndex;
  rootItemKey: ItemKey;
  selectedRecipeIdByItemKeyHash: Map<string, string>;
  selectedItemIdByTagId: Map<string, ItemId>;
  forcedRawItemKeyHashes?: ReadonlySet<string>;
  maxDepth?: number;
}): PlannerDecision[] {
  const { pack, index, rootItemKey, selectedRecipeIdByItemKeyHash, selectedItemIdByTagId } = args;
  const maxDepth = args.maxDepth ?? 20;
  const defaultNs = pack.manifest.gameId;

  const decisions: PlannerDecision[] = [];
  const visiting = new Set<string>();

  const visitItem = (key: ItemKey, depth: number) => {
    if (depth > maxDepth) return;
    const h = itemKeyHash(key);
    if (visiting.has(h)) return;
    visiting.add(h);

    if (isForcedRawItem(key, args.forcedRawItemKeyHashes)) {
      visiting.delete(h);
      return;
    }

    const options = sortRecipeOptionsForItem(index, key, recipesProducingItem(index, key));
    if (options.length > 1 && !selectedRecipeIdByItemKeyHash.has(h)) {
      decisions.push({ kind: 'item_recipe', itemKey: key, itemKeyHash: h, recipeOptions: options.slice() });
      visiting.delete(h);
      return;
    }

    const chosenRecipeId = selectedRecipeIdByItemKeyHash.get(h) ?? (options.length === 1 ? options[0] : undefined);
    if (!chosenRecipeId) {
      visiting.delete(h);
      return;
    }

    const recipe = index.recipesById.get(chosenRecipeId);
    if (!recipe) {
      visiting.delete(h);
      return;
    }

    const recipeType = index.recipeTypesByKey.get(recipe.type);
    const { inputs } = extractRecipeStacks(recipe, recipeType);
    for (const input of inputs) {
      if (input.kind === 'item') {
        visitItem(stackItemToKey(input), depth + 1);
      } else if (input.kind === 'tag') {
        visitTag(input, depth + 1);
      }
    }

    visiting.delete(h);
  };

  const visitTag = (tag: StackTag, depth: number) => {
    if (depth > maxDepth) return;
    const normalized = normalizeTagId(tag.id, defaultNs);
    const set = index.itemIdsByTagId.get(normalized);
    const candidates = set ? Array.from(set.values()).sort() : [];
    if (candidates.length === 0) {
      decisions.push({ kind: 'tag_item', tagId: normalized, candidateItemIds: [] });
      return;
    }
    if (candidates.length > 1 && !selectedItemIdByTagId.has(normalized)) {
      decisions.push({ kind: 'tag_item', tagId: normalized, candidateItemIds: candidates });
      return;
    }
    const chosen = selectedItemIdByTagId.get(normalized) ?? (candidates.length === 1 ? candidates[0] : undefined);
    if (!chosen) return;
    visitItem({ id: chosen }, depth + 1);
  };

  visitItem(rootItemKey, 0);
  return decisions;
}

export function autoPlanSelections(args: {
  pack: PackData;
  index: JeiIndex;
  rootItemKey: ItemKey;
  useProductRecovery?: boolean;
  maxDepth?: number;
}): {
  selectedRecipeIdByItemKeyHash: Record<string, string>;
  selectedItemIdByTagId: Record<string, ItemId>;
} {
  const { pack, index, rootItemKey } = args;
  const maxDepth = args.maxDepth ?? 20;
  const useProductRecovery = args.useProductRecovery === true;
  const defaultNs = pack.manifest.gameId;

  const selectedRecipeIdByItemKeyHash = new Map<string, string>();
  const selectedItemIdByTagId = new Map<string, ItemId>();

  const stackHashes: string[] = [];
  const stackKeys: ItemKey[] = [];

  const getChosenRecipe = (key: ItemKey) => {
    const h = itemKeyHash(key);
    const chosenRecipeId = selectedRecipeIdByItemKeyHash.get(h);
    if (!chosenRecipeId) return null;
    const recipe = index.recipesById.get(chosenRecipeId);
    if (!recipe) return null;
    const recipeType = index.recipeTypesByKey.get(recipe.type);
    return { chosenRecipeId, recipe, recipeType };
  };

  const cycleFactorFor = (cycleStartHash: string): number => {
    const cycleStart = stackHashes.indexOf(cycleStartHash);
    const cycleKeys = cycleStart >= 0 ? stackKeys.slice(cycleStart) : [];
    if (!cycleKeys.length) return 0;
    let factor = 1;
    for (let i = 0; i < cycleKeys.length; i += 1) {
      const fromKey = cycleKeys[i]!;
      const toKey = (i + 1 < cycleKeys.length ? cycleKeys[i + 1] : cycleKeys[0])!;
      const chosen = getChosenRecipe(fromKey);
      if (!chosen) return 0;
      const out = perCraftOutputAmountFor(chosen.recipe, chosen.recipeType, fromKey);
      const inp = perCraftInputAmountFor(chosen.recipe, chosen.recipeType, toKey);
      if (out <= 0 || inp <= 0) return 0;
      factor *= out / inp;
    }
    return factor;
  };

  const isAcceptableCycle = (cycleStartHash: string): boolean => {
    const factor = cycleFactorFor(cycleStartHash);
    if (factor > 1.000001) return true;
    return useProductRecovery && factor > 0 && factor < 0.999999;
  };

  type Op =
    | { kind: 'recipe'; keyHash: string; prev: string | undefined }
    | { kind: 'tag'; tagId: string; prev: ItemId | undefined };

  const ops: Op[] = [];
  const setRecipe = (keyHash: string, recipeId: string) => {
    ops.push({ kind: 'recipe', keyHash, prev: selectedRecipeIdByItemKeyHash.get(keyHash) });
    selectedRecipeIdByItemKeyHash.set(keyHash, recipeId);
  };
  const setTag = (tagId: string, itemId: ItemId) => {
    ops.push({ kind: 'tag', tagId, prev: selectedItemIdByTagId.get(tagId) });
    selectedItemIdByTagId.set(tagId, itemId);
  };
  const rollbackTo = (checkpoint: number) => {
    while (ops.length > checkpoint) {
      const op = ops.pop()!;
      if (op.kind === 'recipe') {
        if (op.prev === undefined) selectedRecipeIdByItemKeyHash.delete(op.keyHash);
        else selectedRecipeIdByItemKeyHash.set(op.keyHash, op.prev);
      } else {
        if (op.prev === undefined) selectedItemIdByTagId.delete(op.tagId);
        else selectedItemIdByTagId.set(op.tagId, op.prev);
      }
    }
  };

  const planItem = (key: ItemKey, depth: number): boolean => {
    if (depth > maxDepth) return true;
    const h = itemKeyHash(key);
    if (stackHashes.includes(h)) {
      // Found a cycle - allow growth cycles and, optionally, dissipative recovery cycles.
      return isAcceptableCycle(h);
    }

    stackHashes.push(h);
    stackKeys.push(key);

    const options = sortRecipeOptionsForItem(index, key, recipesProducingItem(index, key));
    if (!options.length) {
      stackHashes.pop();
      stackKeys.pop();
      return true;
    }

    const useRecipe = (recipeId: string): boolean => {
      const checkpoint = ops.length;
      setRecipe(h, recipeId);

      const recipe = index.recipesById.get(recipeId);
      if (!recipe) {
        rollbackTo(checkpoint);
        return false;
      }
      const recipeType = index.recipeTypesByKey.get(recipe.type);
      const { inputs } = extractRecipeStacks(recipe, recipeType);
      for (const input of inputs) {
        if (input.kind === 'item') {
          if (!planItem(stackItemToKey(input), depth + 1)) {
            rollbackTo(checkpoint);
            return false;
          }
        } else if (input.kind === 'tag') {
          const normalized = normalizeTagId(input.id, defaultNs);
          const set = index.itemIdsByTagId.get(normalized);
          const candidates = set ? Array.from(set.values()).sort() : [];
          if (!candidates.length) continue;
          const chosen = selectedItemIdByTagId.get(normalized) ?? candidates[0]!;
          if (!selectedItemIdByTagId.has(normalized)) setTag(normalized, chosen);
          if (!planItem({ id: chosen }, depth + 1)) {
            rollbackTo(checkpoint);
            return false;
          }
        }
      }
      return true;
    };

    const chosen = selectedRecipeIdByItemKeyHash.get(h);
    if (chosen) {
      const ok = useRecipe(chosen);
      stackHashes.pop();
      stackKeys.pop();
      return ok;
    }

    let ok = false;
    for (const rid of options) {
      const checkpoint = ops.length;
      if (useRecipe(rid)) {
        ok = true;
        break;
      }
      rollbackTo(checkpoint);
    }

    if (!ok) {
      stackHashes.pop();
      stackKeys.pop();
      return false;
    }

    stackHashes.pop();
    stackKeys.pop();
    return ok;
  };

  planItem(rootItemKey, 0);
  return {
    selectedRecipeIdByItemKeyHash: Object.fromEntries(selectedRecipeIdByItemKeyHash.entries()),
    selectedItemIdByTagId: Object.fromEntries(selectedItemIdByTagId.entries()),
  };
}

export function buildRequirementTree(args: {
  pack: PackData;
  index: JeiIndex;
  rootItemKey: ItemKey;
  targetAmount: number;
  targetUnit?: 'items' | 'per_second' | 'per_minute' | 'per_hour';
  selectedRecipeIdByItemKeyHash: Map<string, string>;
  selectedItemIdByTagId: Map<string, ItemId>;
  useProductRecovery?: boolean;
  forcedRawItemKeyHashes?: ReadonlySet<string>;
  maxDepth?: number;
}): BuildTreeResult {
  const { pack, index, rootItemKey, selectedRecipeIdByItemKeyHash, selectedItemIdByTagId } = args;
  const maxDepth = args.maxDepth ?? 20;
  const useProductRecovery = args.useProductRecovery === true;
  const rawTargetAmount = finiteNumberOr(args.targetAmount, 1);
  const targetUnit = args.targetUnit ?? 'items';
  const targetAmount =
    targetUnit === 'per_second'
      ? rawTargetAmount * 60
      : targetUnit === 'per_hour'
        ? rawTargetAmount / 60
        : rawTargetAmount;
  const defaultNs = pack.manifest.gameId;

  type RecoveryItemCredit = {
    sourceItemKey: ItemKey;
    sourceRecipeId?: string;
    sourceRecipeTypeKey?: string;
    sourceNodeId?: string;
    amount: number;
  };

  let seq = 0;
  const leafItemTotals = new Map<ItemId, number>();
  const leafFluidTotals = new Map<string, number>();
  const catalysts = new Map<ItemId, number>();
  const recoveryItemCreditsByKeyHash = new Map<string, RecoveryItemCredit[]>();
  const recoveryFluidCreditsById = new Map<string, number>();

  const addLeafItem = (itemId: ItemId, amount: number) => {
    const prev = leafItemTotals.get(itemId) ?? 0;
    leafItemTotals.set(itemId, prev + amount);
  };
  const addLeafFluid = (fluidId: string, amount: number) => {
    const prev = leafFluidTotals.get(fluidId) ?? 0;
    leafFluidTotals.set(fluidId, prev + amount);
  };
  const addCatalyst = (itemId: ItemId, amount: number) => {
    const prev = catalysts.get(itemId) ?? 0;
    catalysts.set(itemId, Math.max(prev, amount));
  };
  const addRecoveryItemCredit = (
    key: ItemKey,
    amount: number,
    source: {
      sourceItemKey: ItemKey;
      sourceRecipeId?: string;
      sourceRecipeTypeKey?: string;
      sourceNodeId?: string;
    },
  ) => {
    if (amount <= 0) return;
    const h = itemKeyHash(key);
    const bucket = recoveryItemCreditsByKeyHash.get(h) ?? [];
    const sourceHash = itemKeyHash(source.sourceItemKey);
    const same = bucket.find(
      (entry) =>
        itemKeyHash(entry.sourceItemKey) === sourceHash
        && entry.sourceRecipeId === source.sourceRecipeId
        && entry.sourceRecipeTypeKey === source.sourceRecipeTypeKey
        && entry.sourceNodeId === source.sourceNodeId,
    );
    if (same) {
      same.amount += amount;
    } else {
      bucket.push({
        sourceItemKey: source.sourceItemKey,
        ...(source.sourceRecipeId ? { sourceRecipeId: source.sourceRecipeId } : {}),
        ...(source.sourceRecipeTypeKey ? { sourceRecipeTypeKey: source.sourceRecipeTypeKey } : {}),
        ...(source.sourceNodeId ? { sourceNodeId: source.sourceNodeId } : {}),
        amount,
      });
    }
    recoveryItemCreditsByKeyHash.set(h, bucket);
  };
  const consumeRecoveryItemCredit = (key: ItemKey, amount: number): RecoveryItemCredit[] => {
    if (amount <= 0) return [];
    const h = itemKeyHash(key);
    const bucket = recoveryItemCreditsByKeyHash.get(h);
    if (!bucket?.length) return [];
    const usedChunks: RecoveryItemCredit[] = [];
    let remain = amount;
    while (remain > 1e-9 && bucket.length > 0) {
      const credit = bucket[0]!;
      if (credit.amount <= 1e-9) {
        bucket.shift();
        continue;
      }
      const used = Math.min(credit.amount, remain);
      usedChunks.push({
        sourceItemKey: credit.sourceItemKey,
        ...(credit.sourceRecipeId ? { sourceRecipeId: credit.sourceRecipeId } : {}),
        ...(credit.sourceRecipeTypeKey ? { sourceRecipeTypeKey: credit.sourceRecipeTypeKey } : {}),
        ...(credit.sourceNodeId ? { sourceNodeId: credit.sourceNodeId } : {}),
        amount: used,
      });
      credit.amount -= used;
      remain -= used;
      if (credit.amount <= 1e-9) bucket.shift();
    }
    if (!bucket.length) recoveryItemCreditsByKeyHash.delete(h);
    else recoveryItemCreditsByKeyHash.set(h, bucket);
    return usedChunks;
  };
  const addRecoveryFluidCredit = (fluidId: string, amount: number) => {
    if (amount <= 0) return;
    const prev = recoveryFluidCreditsById.get(fluidId) ?? 0;
    recoveryFluidCreditsById.set(fluidId, prev + amount);
  };
  const consumeRecoveryFluidCredit = (fluidId: string, amount: number): number => {
    if (amount <= 0) return 0;
    const prev = recoveryFluidCreditsById.get(fluidId) ?? 0;
    if (prev <= 0) return 0;
    const used = Math.min(prev, amount);
    const next = prev - used;
    if (next <= 1e-9) recoveryFluidCreditsById.delete(fluidId);
    else recoveryFluidCreditsById.set(fluidId, next);
    return used;
  };

  const visiting = new Set<string>();
  const stackHashes: string[] = [];
  const stackKeys: ItemKey[] = [];

  const getChosenRecipe = (key: ItemKey) => {
    const h = itemKeyHash(key);
    const options = recipesProducingItem(index, key);
    const chosenRecipeId =
      selectedRecipeIdByItemKeyHash.get(h) ?? (options.length === 1 ? options[0] : undefined);
    if (!chosenRecipeId) return null;
    const recipe = index.recipesById.get(chosenRecipeId);
    if (!recipe) return null;
    const recipeType = index.recipeTypesByKey.get(recipe.type);
    return { chosenRecipeId, recipe, recipeType };
  };

  const buildForItem = (key: ItemKey, amountNeeded: number, depth: number): RequirementNode => {
    const nodeId = `n${(seq += 1)}`;
    if (depth > maxDepth) {
      addLeafItem(key.id, amountNeeded);
      return { kind: 'item', nodeId, itemKey: key, amount: amountNeeded, children: [], catalysts: [], cycle: false };
    }

    if (isForcedRawItem(key, args.forcedRawItemKeyHashes)) {
      addLeafItem(key.id, amountNeeded);
      return {
        kind: 'item',
        nodeId,
        itemKey: key,
        amount: amountNeeded,
        children: [],
        catalysts: [],
        cycle: false,
      };
    }

    const h = itemKeyHash(key);
    if (visiting.has(h)) {
      const cycleStart = stackHashes.indexOf(h);
      const cycleKeys = cycleStart >= 0 ? stackKeys.slice(cycleStart) : [];
      const cycleFactor = (() => {
        if (!cycleKeys.length) return 0;
        let factor = 1;
        for (let i = 0; i < cycleKeys.length; i += 1) {
          const fromKey = cycleKeys[i]!;
          const toKey = (i + 1 < cycleKeys.length ? cycleKeys[i + 1] : cycleKeys[0])!;
          const chosen = getChosenRecipe(fromKey);
          if (!chosen) return 0;
          const out = perCraftOutputAmountFor(chosen.recipe, chosen.recipeType, fromKey);
          const inp = perCraftInputAmountFor(chosen.recipe, chosen.recipeType, toKey);
          if (out <= 0 || inp <= 0) return 0;
          factor *= out / inp;
        }
        return factor;
      })();

      const growth = cycleFactor > 1.000001;
      const seedFromPredecessor = (() => {
        if (!cycleKeys.length) return 0;
        const predecessorKey = cycleKeys[cycleKeys.length - 1]!;
        const chosen = getChosenRecipe(predecessorKey);
        if (!chosen) return 0;
        return perCraftInputAmountFor(chosen.recipe, chosen.recipeType, key);
      })();

      const chosenForNode = getChosenRecipe(key);
      const recoverySeedAmount =
        useProductRecovery && cycleFactor > 0 && cycleFactor < 0.999999
          ? amountNeeded * (1 - cycleFactor)
          : null;
      const rawSeedAmount =
        growth && seedFromPredecessor > 0
          ? seedFromPredecessor
          : recoverySeedAmount !== null
            ? Math.max(recoverySeedAmount, 0)
            : amountNeeded;
      const recoveredForSeedChunks =
        useProductRecovery && rawSeedAmount > 0 ? consumeRecoveryItemCredit(key, rawSeedAmount) : [];
      const recoveredForSeed = recoveredForSeedChunks.reduce((sum, entry) => sum + entry.amount, 0);
      const seedAmount = Math.max(rawSeedAmount - recoveredForSeed, 0);

      addLeafItem(key.id, seedAmount);
      const machine = chosenForNode?.recipeType?.machine
        ? Array.isArray(chosenForNode.recipeType.machine)
          ? chosenForNode.recipeType.machine[0]
          : chosenForNode.recipeType.machine
        : undefined;
      return {
        kind: 'item',
        nodeId,
        itemKey: key,
        amount: seedAmount,
        ...(chosenForNode ? { recipeIdUsed: chosenForNode.chosenRecipeId } : {}),
        ...(chosenForNode?.recipe.type ? { recipeTypeKeyUsed: chosenForNode.recipe.type } : {}),
        ...(machine?.id ? { machineItemId: machine.id } : {}),
        ...(machine?.name ? { machineName: machine.name } : {}),
        children: [],
        catalysts: [],
        cycle: true,
        ...(growth ? { cycleSeed: true } : {}),
        ...(cycleKeys.length ? { cycleKeys } : {}),
        ...(cycleFactor > 0 ? { cycleFactor } : {}),
        cycleAmountNeeded: amountNeeded,
        cycleSeedAmount: seedAmount,
      };
    }
    visiting.add(h);
    stackHashes.push(h);
    stackKeys.push(key);

    const options = recipesProducingItem(index, key);
    const chosenRecipeId = selectedRecipeIdByItemKeyHash.get(h) ?? (options.length === 1 ? options[0] : undefined);
    if (!chosenRecipeId) {
      addLeafItem(key.id, amountNeeded);
      visiting.delete(h);
      stackHashes.pop();
      stackKeys.pop();
      return { kind: 'item', nodeId, itemKey: key, amount: amountNeeded, children: [], catalysts: [], cycle: false };
    }

    const recipe = index.recipesById.get(chosenRecipeId);
    if (!recipe) {
      addLeafItem(key.id, amountNeeded);
      visiting.delete(h);
      stackHashes.pop();
      stackKeys.pop();
      return { kind: 'item', nodeId, itemKey: key, amount: amountNeeded, children: [], catalysts: [], cycle: false };
    }

    const recipeType = index.recipeTypesByKey.get(recipe.type);
    const perCraftYield = perCraftOutputAmountFor(recipe, recipeType, key);
    const multiplier = perCraftYield > 0 ? amountNeeded / perCraftYield : 0;

    const { inputs, outputs, catalysts: recipeCatalysts } = extractRecipeStacks(recipe, recipeType);
    recipeCatalysts.forEach((c) => addCatalyst(c.id, finiteNumberOr(c.amount, 0)));
    if (useProductRecovery && multiplier > 0) {
      for (const output of outputs) {
        const produced = finiteNumberOr(output.amount, 0) * multiplier;
        if (produced <= 0) continue;
        if (output.kind === 'item') {
          if (stackMatchesKey(output, key)) continue;
          addRecoveryItemCredit(stackItemToKey(output), produced, {
            sourceItemKey: key,
            sourceRecipeId: chosenRecipeId,
            sourceRecipeTypeKey: recipe.type,
            sourceNodeId: nodeId,
          });
        } else if (output.kind === 'fluid') {
          addRecoveryFluidCredit(output.id, produced);
        }
      }
    }

    const children: RequirementNode[] = [];
    for (const input of inputs) {
      const grossNeeded = finiteNumberOr(input.amount, 0) * multiplier;
      let needed = grossNeeded;
      if (useProductRecovery && grossNeeded > 0) {
        if (input.kind === 'item') {
          const coveredChunks = consumeRecoveryItemCredit(stackItemToKey(input), grossNeeded);
          const covered = coveredChunks.reduce((sum, entry) => sum + entry.amount, 0);
          needed = Math.max(grossNeeded - covered, 0);
          coveredChunks.forEach((entry) => {
            children.push({
              kind: 'item',
              nodeId: `n${(seq += 1)}`,
              itemKey: stackItemToKey(input),
              amount: entry.amount,
              recovery: true,
              recoverySourceItemKey: entry.sourceItemKey,
              ...(entry.sourceRecipeId ? { recoverySourceRecipeId: entry.sourceRecipeId } : {}),
              ...(entry.sourceRecipeTypeKey
                ? { recoverySourceRecipeTypeKey: entry.sourceRecipeTypeKey }
                : {}),
              ...(entry.sourceNodeId ? { recoverySourceNodeId: entry.sourceNodeId } : {}),
              children: [],
              catalysts: [],
              cycle: false,
            });
          });
        } else if (input.kind === 'fluid') {
          const covered = consumeRecoveryFluidCredit(input.id, grossNeeded);
          needed = Math.max(grossNeeded - covered, 0);
        }
      }
      if (needed <= 0) continue;

      if (input.kind === 'item') {
        children.push(buildForItem(stackItemToKey(input), needed, depth + 1));
      } else if (input.kind === 'tag') {
        const normalized = normalizeTagId(input.id, defaultNs);
        const set = index.itemIdsByTagId.get(normalized);
        const candidates = set ? Array.from(set.values()) : [];
        const chosen = selectedItemIdByTagId.get(normalized) ?? (candidates.length === 1 ? candidates[0] : undefined);
        if (!chosen) continue;
        children.push(buildForItem({ id: chosen }, needed, depth + 1));
      } else {
        addLeafFluid(input.id, needed);
        children.push({
          kind: 'fluid',
          nodeId: `n${(seq += 1)}`,
          id: input.id,
          amount: needed,
          ...(input.unit ? { unit: input.unit } : {}),
        });
      }
    }

    visiting.delete(h);
    stackHashes.pop();
    stackKeys.pop();
    return {
      kind: 'item',
      nodeId,
      itemKey: key,
      amount: amountNeeded,
      recipeIdUsed: chosenRecipeId,
      recipeTypeKeyUsed: recipe.type,
      ...(() => {
        const machine = recipeType?.machine
          ? Array.isArray(recipeType.machine)
            ? recipeType.machine[0]
            : recipeType.machine
          : undefined;
        return {
          ...(machine?.id ? { machineItemId: machine.id } : {}),
          ...(machine?.name ? { machineName: machine.name } : {}),
        };
      })(),
      children,
      catalysts: recipeCatalysts,
      cycle: false,
    };
  };

  const root = buildForItem(rootItemKey, targetAmount, 0);
  return { root, leafItemTotals, leafFluidTotals, catalysts };
}

// ============================================================================
// Enhanced planner with machine count and rate calculations
// ============================================================================

/**
 * Base requirement node type for type checking
 */
export type BaseRequirementNode = RequirementNode extends infer T ? T : never;

/**
 * Enhanced requirement node with rate information
 * This is a union type that mirrors RequirementNode but with additional properties
 */
export type EnhancedRequirementNode =
  | {
    kind: 'item';
    nodeId: string;
    itemKey: ItemKey;
    amount: number;
    unit?: string;
    recovery?: boolean;
    recoverySourceItemKey?: ItemKey;
    recoverySourceRecipeId?: string;
    recoverySourceRecipeTypeKey?: string;
    recoverySourceNodeId?: string;
    recipeIdUsed?: string;
    recipeTypeKeyUsed?: string;
    machineItemId?: ItemId;
    machineName?: string;
    children: RequirementNode[];
    catalysts: StackItem[];
    cycle: boolean;
    cycleSeed?: boolean;
    cycleKeys?: ItemKey[];
    cycleFactor?: number;
    cycleAmountNeeded?: number;
    cycleSeedAmount?: number;
    // Enhanced properties
    perSecond?: number;
    perMinute?: number;
    perHour?: number;
    machines?: number;
    machineCount?: number;
    recipeTime?: number;
    power?: number;
    pollution?: number;
  }
  | {
    kind: 'fluid';
    nodeId: string;
    id: string;
    amount: number;
    unit?: string;
    // Enhanced properties for fluids
    perSecond?: number;
    perMinute?: number;
    perHour?: number;
  };

/**
 * Get recipe processing time in seconds
 * For AEF format, recipe time is typically stored in params
 */
export function getRecipeTime(recipe: Recipe, recipeType: RecipeTypeDef | undefined): number {
  // Check for time in recipe params (AEF format)
  if (recipe.params) {
    // Common time parameter names in AEF
    const timeParams = ['time', 'duration', 'processTime', 'processingTime'];
    for (const param of timeParams) {
      if (param in recipe.params) {
        const value = finiteNumberOr(recipe.params[param], 0);
        if (value > 0) {
          // AEF typically uses ticks (20 ticks = 1 second)
          // Or sometimes seconds directly, need to detect
          // If value > 100, it's likely in ticks
          return value > 100 ? value / 20 : value;
        }
      }
    }
  }

  // Check for recipe type defaults
  if (recipeType?.defaults) {
    const defaultTime = finiteNumberOr(recipeType.defaults.time, 0);
    if (defaultTime > 0) {
      return defaultTime > 100 ? defaultTime / 20 : defaultTime;
    }
  }

  // Default recipe time (200 ticks = 10 seconds for vanilla Minecraft smelting)
  // For crafting recipes, typically 0.2s (4 ticks)
  return 0.2;
}

/**
 * Calculate machines needed for a recipe
 */
export function calculateMachinesForRecipe(
  targetAmount: number,
  recipe: Recipe,
  recipeType: RecipeTypeDef | undefined,
  itemKey: ItemKey
): {
  machines: number;
  perSecond: number;
  perMinute: number;
  perHour: number;
} | null {
  const outputPerCraft = perCraftOutputAmountFor(recipe, recipeType, itemKey);
  if (outputPerCraft <= 0) return null;

  const recipeTime = getRecipeTime(recipe, recipeType);

  // Machines = (targetAmount / outputPerCraft) * recipeTime
  // This gives us machines needed to produce targetAmount per second
  // But usually targetAmount is a total count, so we need to divide by time

  // For total production: machines = targetAmount * recipeTime / outputPerCraft / 60
  // (60 is the number of seconds per minute, standard factorio rate)

  const machines = (targetAmount * recipeTime) / outputPerCraft / 60;
  const perSecond = (machines * outputPerCraft) / recipeTime;
  const perMinute = perSecond * 60;
  const perHour = perSecond * 3600;

  return {
    machines,
    perSecond,
    perMinute,
    perHour,
  };
}

/**
 * Enhanced tree builder with rate information
 */
export interface EnhancedBuildTreeResult extends BuildTreeResult {
  root: EnhancedRequirementNode;
  // Additional rate information
  totals: {
    machines: Map<ItemId, number>;
    perSecond: Map<string, number>;
    power: number;
    pollution: number;
  };
}

export function buildEnhancedRequirementTree(args: {
  pack: PackData;
  index: JeiIndex;
  rootItemKey: ItemKey;
  targetAmount: number;
  selectedRecipeIdByItemKeyHash: Map<string, string>;
  selectedItemIdByTagId: Map<string, ItemId>;
  useProductRecovery?: boolean;
  forcedRawItemKeyHashes?: ReadonlySet<string>;
  maxDepth?: number;
  targetUnit?: 'items' | 'per_second' | 'per_minute' | 'per_hour';
}): EnhancedBuildTreeResult {
  // First build the basic tree
  const baseResult = buildRequirementTree(args);

  const totals = {
    machines: new Map<ItemId, number>(),
    perSecond: new Map<string, number>(),
    power: 0,
    pollution: 0,
  };

  // Pre-pass: compute max machineCount per recipeId so that when a multi-output recipe
  // appears multiple times in the tree (once per output), we use the highest demand rate.
  const maxMachineCountByRecipeId = new Map<string, number>();
  const prePassWalk = (node: RequirementNode): void => {
    if (node.kind !== 'item') return;
    if (node.recipeIdUsed && node.machineItemId && !node.cycle && !node.recovery) {
      const recipe = args.index.recipesById.get(node.recipeIdUsed);
      if (recipe) {
        const recipeType = args.index.recipeTypesByKey.get(recipe.type);
        const recipeTime = getRecipeTime(recipe, recipeType);
        const outputPerCraft = perCraftOutputAmountFor(recipe, recipeType, node.itemKey);
        if (outputPerCraft > 0 && recipeTime > 0) {
          const machineSpeed = (recipeType?.defaults?.speed as number) ?? 1;
          const adjustedTime = recipeTime / (machineSpeed || 1);
          const machines = (node.amount * adjustedTime) / outputPerCraft / 60;
          const machineCount = machines > 0 ? Math.ceil(machines - 1e-9) : 0;
          const existing = maxMachineCountByRecipeId.get(node.recipeIdUsed) ?? 0;
          if (machineCount > existing) maxMachineCountByRecipeId.set(node.recipeIdUsed, machineCount);
        }
      }
    }
    node.children.forEach(prePassWalk);
  };
  prePassWalk(baseResult.root);

  // Track first occurrence of each recipeId to avoid double-counting totals.
  const seenRecipeIdsForTotals = new Set<string>();

  // Enhance nodes with rate information
  const enhanceNode = (node: RequirementNode): EnhancedRequirementNode => {
    if (node.kind === 'item') {
      // This is an item node
      const enhanced: EnhancedRequirementNode & { kind: 'item' } = { ...node };

      if (node.recipeIdUsed && node.machineItemId) {
        const recipe = args.index.recipesById.get(node.recipeIdUsed);
        if (recipe) {
          const recipeType = args.index.recipeTypesByKey.get(recipe.type);
          const recipeTime = getRecipeTime(recipe, recipeType);
          const outputPerCraft = perCraftOutputAmountFor(recipe, recipeType, node.itemKey);

          if (outputPerCraft > 0 && recipeTime > 0) {
            // Get machine defaults for power/pollution calculations
            const machinePower = (recipeType?.defaults?.power as number) ?? 100;
            const machinePollution = (recipeType?.defaults?.pollution as number) ?? 0;
            const machineSpeed = (recipeType?.defaults?.speed as number) ?? 1;

            // Calculate machines needed (adjusted by machine speed)
            const adjustedTime = recipeTime / (machineSpeed || 1);
            const machines = (node.amount * adjustedTime) / outputPerCraft / 60;
            enhanced.machines = machines;
            const machineCount = machines > 0 ? Math.ceil(machines - 1e-9) : 0;
            enhanced.machineCount = machineCount;
            enhanced.recipeTime = recipeTime;

            // Calculate rates
            const perSecond = (machines * outputPerCraft) / adjustedTime;
            enhanced.perSecond = perSecond;
            enhanced.perMinute = perSecond * 60;
            enhanced.perHour = perSecond * 3600;

            // Calculate power and pollution for this step
            const stepPower = machineCount * machinePower;
            const stepPollution = machineCount * machinePollution;
            enhanced.power = stepPower;
            enhanced.pollution = stepPollution;

            // Track totals — only for the first occurrence of each recipe to avoid
            // double-counting multi-output recipes that appear multiple times in the tree.
            if (!node.recovery && !node.cycle && !seenRecipeIdsForTotals.has(node.recipeIdUsed)) {
              seenRecipeIdsForTotals.add(node.recipeIdUsed);
              // Use the max machine count seen across all occurrences of this recipe.
              const effectiveCount = maxMachineCountByRecipeId.get(node.recipeIdUsed) ?? machineCount;
              totals.machines.set(node.machineItemId, (totals.machines.get(node.machineItemId) ?? 0) + effectiveCount);

              // Track per second totals by item ID
              totals.perSecond.set(node.itemKey.id, (totals.perSecond.get(node.itemKey.id) ?? 0) + perSecond);

              // Track total power and pollution
              totals.power += stepPower;
              totals.pollution += stepPollution;
            }
          }
        }
      }

      // Recursively enhance children
      enhanced.children = node.children.map(enhanceNode);
      return enhanced;
    } else {
      // This is a fluid node - return as-is for now
      return node;
    }
  };

  const root = enhanceNode(baseResult.root);

  return {
    ...baseResult,
    root,
    totals,
  };
}

/**
 * Format number for display with appropriate precision
 */
export function formatPlannerAmount(n: number, decimals: number = 2): string {
  if (!Number.isFinite(n)) return '0';
  if (Math.abs(n) < 0.001 && n !== 0) {
    return n.toExponential(decimals);
  }
  const rounded = Math.round(n * 10 ** decimals) / 10 ** decimals;
  return rounded.toLocaleString('en-US', { maximumFractionDigits: decimals });
}

/**
 * Get display label for rate unit
 */
export function getRateUnitLabel(unit: 'items' | 'per_second' | 'per_minute' | 'per_hour'): string {
  switch (unit) {
    case 'items':
      return 'items';
    case 'per_second':
      return '/s';
    case 'per_minute':
      return '/min';
    case 'per_hour':
      return '/h';
  }
}
