<template>
  <div>
    <section class="ww__section">
      <h3 class="ww__title">{{ l('Item Info') }}</h3>
      <WInfoGrid :entries="itemEntries" />
    </section>

    <section v-if="displayName" class="ww__section">
      <h3 class="ww__title">{{ l('Display Name') }}</h3>
      <div class="ww__prose ww__prose--box">{{ displayName }}</div>
    </section>

    <section v-if="itemDesc || itemDecoDesc" class="ww__section">
      <h3 class="ww__title">{{ l('Description') }}</h3>
      <div v-if="itemDesc" class="ww__prose ww__prose--box" v-html="formatWikiHtml(itemDesc)"></div>
      <div v-if="itemDecoDesc" class="ww__muted" v-html="formatWikiHtml(itemDecoDesc)"></div>
    </section>

    <section v-if="obtainWayIds.length" class="ww__section">
      <h3 class="ww__title">{{ l('Obtain Ways') }}</h3>
      <div class="ww__badges">
        <span v-for="id in obtainWayIds" :key="id" class="ww__badge" :title="id">
          {{ getWarfarinObtainWayLabel(id, locale) }}
        </span>
      </div>
    </section>

    <section v-if="outcomeItemIds.length" class="ww__section">
      <h3 class="ww__title">{{ l('Outcome Items') }}</h3>
      <div class="ww__badges">
        <span v-for="id in outcomeItemIds" :key="id" class="ww__badge">{{
          resolveLocalizedEntityName(id, undefined, localNameMap, itemDefsByKeyHash)
        }}</span>
      </div>
    </section>

    <section v-if="hasData(useItemTable)" class="ww__section">
      <h3 class="ww__title">{{ l('Use Item Table') }}</h3>
      <div class="ww__stack">
        <div v-if="useItemEntries.length" class="ww__panel">
          <WInfoGrid :entries="useItemEntries" />
        </div>
        <div
          v-if="renderedUseItemDesc"
          class="ww__panel ww__prose ww__prose--box"
          v-html="formatWikiHtml(renderedUseItemDesc)"
        ></div>
        <q-expansion-item
          v-for="(action, index) in useActionBundles"
          :key="`use-action-${index}`"
          dense
          expand-separator
          switch-toggle-side
          :label="action.title"
          class="ww__expansion"
        >
          <div class="ww__stack ww__stack--compact">
            <div v-if="action.entries.length" class="ww__panel">
              <WInfoGrid :entries="action.entries" />
            </div>
            <WDataTable
              v-if="action.blackboardRows.length"
              :columns="blackboardColumns"
              :rows="action.blackboardRows"
            />
          </div>
        </q-expansion-item>
      </div>
    </section>

    <section v-if="hasData(equipItemTable)" class="ww__section">
      <h3 class="ww__title">{{ l('Equip Item Table') }}</h3>
      <div class="ww__stack">
        <div v-if="equipItemEntries.length" class="ww__panel">
          <WInfoGrid :entries="equipItemEntries" />
        </div>
        <div
          v-if="renderedEquipDesc"
          class="ww__panel ww__prose ww__prose--box"
          v-html="formatWikiHtml(renderedEquipDesc)"
        ></div>
        <div
          v-if="renderedEquipExtraDesc"
          class="ww__panel ww__prose ww__prose--box"
          v-html="formatWikiHtml(renderedEquipExtraDesc)"
        ></div>
      </div>
    </section>

    <!-- Recipe Tables -->
    <section v-for="recipe in recipeSections" :key="recipe.title" class="ww__section">
      <h3 class="ww__title">{{ l(recipe.title) }}</h3>
      <div class="ww__stack">
        <div v-for="(formula, fi) in recipe.formulas" :key="fi" class="ww__panel">
          <div class="ww__panel-title">
            {{ formula.displayName || formula.name || formula.id || `${l('Formula')} ${fi + 1}` }}
          </div>
          <div v-if="formula.meta.length" class="ww__recipe-meta">
            <q-badge
              v-for="m in formula.meta"
              :key="`${formula.id || formula.name}-${m.label}`"
              outline
              color="grey-7"
              class="ww__recipe-badge"
            >
              {{ m.label }}: {{ m.value }}
            </q-badge>
          </div>
          <div class="ww__recipe-table">
            <div v-if="formula.machineLabel" class="ww__recipe-column">
              <div class="ww__recipe-column-title">{{ l('Machine') }}</div>
              <div class="ww__recipe-machine">{{ formula.machineLabel }}</div>
            </div>
            <div v-if="formula.ingredients.length" class="ww__recipe-column">
              <div class="ww__recipe-column-title">{{ l('Ingredients') }}</div>
              <div class="ww__recipe-groups">
                <div
                  v-for="(group, gi) in formula.ingredients"
                  :key="`ingredients-${formula.id || formula.name}-${gi}`"
                  class="ww__recipe-group"
                >
                  <div v-if="formula.ingredients.length > 1" class="ww__recipe-group-title">
                    {{ l('Option') }} {{ gi + 1 }}
                  </div>
                  <WItemCostGrid
                    :entries="group"
                    :item-defs-by-key-hash="itemDefsByKeyHash"
                    compact
                  />
                </div>
              </div>
            </div>
            <div class="ww__recipe-arrow">
              <q-icon name="east" size="22px" />
            </div>
            <div v-if="formula.outcomes.length" class="ww__recipe-column">
              <div class="ww__recipe-column-title">{{ l('Outcomes') }}</div>
              <div class="ww__recipe-groups">
                <div
                  v-for="(group, gi) in formula.outcomes"
                  :key="`outcomes-${formula.id || formula.name}-${gi}`"
                  class="ww__recipe-group"
                >
                  <div v-if="formula.outcomes.length > 1" class="ww__recipe-group-title">
                    {{ l('Option') }} {{ gi + 1 }}
                  </div>
                  <WItemCostGrid
                    :entries="group"
                    :item-defs-by-key-hash="itemDefsByKeyHash"
                    compact
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ItemDef } from 'src/jei/types';
import WInfoGrid from './shared/WInfoGrid.vue';
import WDataTable from './shared/WDataTable.vue';
import WItemCostGrid from './shared/WItemCostGrid.vue';
import {
  type MaterialCostEntry,
  type RecordLike,
  isRecordLike,
  toArray,
  hasData,
  formatWikiHtml,
  formatScalar,
  formatLocalizedScalar,
  normalizeItemGroups,
  normalizeMaterialCosts,
  resolveLocalizedEntityName,
  buildInfoEntries,
  toText,
} from './utils';
import { itemTypeNames, itemShowingTypeNames } from './genums';
import {
  getWarfarinEnumLabel,
  getWarfarinObtainWayLabel,
  localizeWarfarinIdentifier,
} from './displayLabels';

const props = defineProps<{
  detail: RecordLike;
  list: RecordLike;
  refs?: RecordLike | undefined;
  localNameMap: RecordLike;
  idToPackItemId?: RecordLike | undefined;
  itemDefsByKeyHash?: Record<string, ItemDef> | undefined;
}>();

const { locale } = useI18n();
const l = (value: string) => localizeWarfarinIdentifier(value, locale.value);

function resolveRecipeText(value: unknown): string {
  const raw =
    typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
  if (!raw) return '';
  const localized = resolveLocalizedEntityName(
    raw,
    props.refs,
    props.localNameMap,
    props.itemDefsByKeyHash,
  );
  if (localized && localized !== raw) return localized;
  return l(raw);
}

const itemTableData = computed<RecordLike>(() =>
  isRecordLike(props.detail.itemTable) ? props.detail.itemTable : {},
);

const useItemTable = computed(() => props.detail.useItemTable);
const equipItemTable = computed(() => props.detail.equipItemTable);

const blackboardColumns = computed(() => [
  { key: 'source', label: l('Source') },
  { key: 'key', label: l('Key') },
  { key: 'value', label: l('Value') },
  { key: 'valueStr', label: l('Value Str') },
]);

const itemEntries = computed(() =>
  buildInfoEntries(itemTableData.value, [
    { key: 'name', label: l('Name') },
    { key: 'id', label: l('ID'), mono: true },
    { key: 'iconId', label: l('Icon ID'), mono: true },
    { key: 'iconCompositeId', label: l('Icon Composite ID'), mono: true },
    {
      key: 'type',
      label: l('Type'),
      format: (v: unknown) => getWarfarinEnumLabel(itemTypeNames, v, locale.value),
    },
    { key: 'rarity', label: l('Rarity') },
    {
      key: 'showingType',
      label: l('Showing Type'),
      format: (v: unknown) => getWarfarinEnumLabel(itemShowingTypeNames, v, locale.value),
    },
    { key: 'maxStackCount', label: l('Max Stack') },
    { key: 'maxBackpackStackCount', label: l('Max Backpack Stack') },
    {
      key: 'backpackCanDiscard',
      label: l('Can Discard'),
      format: (v: unknown) => formatLocalizedScalar(v, locale.value),
    },
    { key: 'valuableTabType', label: l('Tab Type') },
    { key: 'sortId1', label: l('Sort ID 1') },
    { key: 'sortId2', label: l('Sort ID 2') },
  ]),
);

const itemDesc = computed(() => itemTableData.value.desc);
const itemDecoDesc = computed(() => itemTableData.value.decoDesc);

const obtainWayIds = computed(() =>
  toArray(itemTableData.value.obtainWayIds).map(String).filter(Boolean),
);
const outcomeItemIds = computed(() =>
  toArray(itemTableData.value.outcomeItemIds).map(String).filter(Boolean),
);

// Build liquid container name map for item_fbottle_* display
const liquidMap = computed(() => {
  const map = new Map<string, string>();
  const id = typeof itemTableData.value.id === 'string' ? itemTableData.value.id : '';
  if (!id.startsWith('item_fbottle_')) return map;
  // Try to extract liquid names from recipe tables
  const craftTables = [
    props.detail.inFactoryMachineCraftTable,
    props.detail.outFactoryMachineCraftTable,
    props.detail.factoryHubCraftTable,
  ];
  for (const table of craftTables) {
    if (!isRecordLike(table)) continue;
    const formulas = toArray<RecordLike>(table.formula ?? Object.values(table));
    for (const formula of formulas) {
      if (!isRecordLike(formula)) continue;
      const outcomes = toArray<RecordLike>(formula.outcomes ?? formula.outcome);
      for (const groups of outcomes) {
        const items = Array.isArray(groups) ? groups : [groups];
        for (const item of items) {
          if (!isRecordLike(item)) continue;
          const itemId = typeof item.id === 'string' ? item.id : '';
          if (itemId.startsWith('item_fbottle_')) {
            const name = resolveLocalizedEntityName(
              itemId,
              undefined,
              props.localNameMap,
              props.itemDefsByKeyHash,
            );
            if (name !== itemId) map.set(itemId, name);
          }
        }
      }
    }
  }
  return map;
});

const displayName = computed(() => {
  const id = typeof itemTableData.value.id === 'string' ? itemTableData.value.id : '';
  if (!id.startsWith('item_fbottle_') || !liquidMap.value.size) return '';
  const baseName = resolveLocalizedEntityName(
    id,
    undefined,
    props.localNameMap,
    props.itemDefsByKeyHash,
  );
  const liquidName = liquidMap.value.get(id);
  return liquidName ? `${baseName} (${liquidName})` : '';
});

function formatTokenValue(value: unknown, format: string | undefined): string {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return formatScalar(value);
  if (!format) return formatScalar(num);
  if (format.includes('%')) {
    const digits = Number((format.match(/:(\d+)/)?.[1] ?? '0').trim());
    return `${(num * 100)
      .toFixed(digits)
      .replace(/\.0+$/, '')
      .replace(/(\.\d*?)0+$/, '$1')}%`;
  }
  const digits = Number((format.match(/:(\d+)/)?.[1] ?? '0').trim());
  return num
    .toFixed(digits)
    .replace(/\.0+$/, '')
    .replace(/(\.\d*?)0+$/, '$1');
}

function renderTemplateWithTokens(text: unknown, tokens: Record<string, unknown>): string {
  if (typeof text !== 'string' || !text) return '';
  return text.replace(
    /\{([a-zA-Z0-9_]+)(:[^}]*)?\}/g,
    (_match, key: string, format: string | undefined) => {
      if (!(key in tokens)) return _match;
      return formatTokenValue(tokens[key], format);
    },
  );
}

function extractBlackboardRows(action: RecordLike): Array<Record<string, string>> {
  const groups = [
    ['buff', isRecordLike(action.buffBBData) ? action.buffBBData : {}],
    ['skill', isRecordLike(action.skillBBData) ? action.skillBBData : {}],
  ] as const;
  return groups.flatMap(([source, data]) => {
    const rows = toArray<RecordLike>(data.blackboard);
    return rows.map((row) => ({
      source,
      key: toText(row.key, '-'),
      value: formatScalar(row.value),
      valueStr: toText(row.valueStr, ''),
    }));
  });
}

function collectActionTokens(action: RecordLike): Record<string, unknown> {
  const tokens: Record<string, unknown> = {};
  const sources = [
    isRecordLike(action.buffBBData) ? action.buffBBData : {},
    isRecordLike(action.skillBBData) ? action.skillBBData : {},
  ];
  for (const source of sources) {
    const rows = toArray<RecordLike>(source.blackboard);
    for (const row of rows) {
      const key = toText(row.key);
      if (!key) continue;
      tokens[key] = row.value ?? row.valueStr;
    }
  }
  return tokens;
}

const useItemEntries = computed(() =>
  isRecordLike(useItemTable.value)
    ? buildInfoEntries(useItemTable.value, [
        { key: 'itemId', label: l('Item ID'), mono: true },
        { key: 'effectType', label: l('Effect Type') },
        { key: 'uiType', label: l('UI Type') },
        { key: 'targetNumType', label: l('Target Num Type') },
        { key: 'duration', label: l('Duration') },
        { key: 'stackingKey', label: l('Stacking Key'), mono: true },
        {
          key: 'isPersistentBuff',
          label: l('Persistent Buff'),
          format: (v: unknown) => formatLocalizedScalar(v, locale.value),
        },
        {
          key: 'isValuableDepot',
          label: l('Valuable Depot'),
          format: (v: unknown) => formatLocalizedScalar(v, locale.value),
        },
      ])
    : [],
);

const useActionBundles = computed(() => {
  if (!isRecordLike(useItemTable.value)) return [];
  return toArray<RecordLike>(useItemTable.value.useActions).map((action, index) => {
    const buff = isRecordLike(action.buffBBData) ? action.buffBBData : {};
    const skill = isRecordLike(action.skillBBData) ? action.skillBBData : {};
    const useType = action.useType === undefined ? '-' : formatScalar(action.useType);
    return {
      title: `${l('Use Action')} ${index + 1} · ${l('Type')} ${useType}`,
      entries: buildInfoEntries(
        {
          useType: action.useType,
          buffId: buff.buffId,
          skillId: skill.skillId,
          skillPath: skill.skillPath,
        },
        [
          { key: 'useType', label: l('Use Type') },
          { key: 'buffId', label: l('Buff ID'), mono: true },
          { key: 'skillId', label: l('Skill ID'), mono: true },
          { key: 'skillPath', label: l('Skill Path'), mono: true },
        ],
      ),
      blackboardRows: extractBlackboardRows(action),
      tokens: collectActionTokens(action),
    };
  });
});

const renderedUseItemDesc = computed(() => {
  if (!isRecordLike(useItemTable.value)) return '';
  const tokens: Record<string, unknown> = { duration: useItemTable.value.duration };
  for (const action of useActionBundles.value) {
    Object.assign(tokens, action.tokens);
  }
  return renderTemplateWithTokens(useItemTable.value.itemUseDesc, tokens);
});

const equipItemEntries = computed(() => {
  if (!isRecordLike(equipItemTable.value)) return [];
  const condParams = toArray(equipItemTable.value.condParams).map(String).filter(Boolean);
  const baseEntries = buildInfoEntries(equipItemTable.value, [
    { key: 'itemId', label: l('Item ID'), mono: true },
    { key: 'castTime', label: l('Cast Time') },
    { key: 'cooldown', label: l('Cooldown') },
    { key: 'chargeCount', label: l('Charge Count') },
    { key: 'levelUpChargeCount', label: l('Level Up Charge Count') },
    { key: 'recoverTime', label: l('Recover Time') },
    { key: 'recoverUpperCount', label: l('Recover Upper Count') },
    { key: 'levelUpRecoverUpperCount', label: l('Level Up Recover Upper Count') },
    {
      key: 'checkTarget',
      label: l('Check Target'),
      format: (v: unknown) => formatLocalizedScalar(v, locale.value),
    },
    { key: 'condType', label: l('Condition Type') },
    { key: 'useTarget', label: l('Use Target') },
    {
      key: 'autoCheckNotInFight',
      label: l('Auto Check Not In Fight'),
      format: (v: unknown) => formatLocalizedScalar(v, locale.value),
    },
    { key: 'toMainCharCount', label: l('To Main Character Count') },
  ]);
  if (condParams.length) {
    baseEntries.push({ label: l('Condition Params'), value: condParams.join(', '), mono: false });
  }
  return baseEntries;
});

function buildEquipTokens(table: RecordLike): Record<string, unknown> {
  const tokens: Record<string, unknown> = {
    count: table.chargeCount,
    cooldown: table.cooldown,
    castTime: table.castTime,
    recoverTime: table.recoverTime,
    recoverUpperCount: table.recoverUpperCount,
    levelUpChargeCount: table.levelUpChargeCount,
    levelUpRecoverUpperCount: table.levelUpRecoverUpperCount,
  };
  const condParams = toArray(table.condParams);
  condParams.forEach((value, index) => {
    tokens[`param${index + 1}`] = value;
  });
  return tokens;
}

const renderedEquipDesc = computed(() =>
  isRecordLike(equipItemTable.value)
    ? renderTemplateWithTokens(
        equipItemTable.value.equipDesc,
        buildEquipTokens(equipItemTable.value),
      )
    : '',
);

const renderedEquipExtraDesc = computed(() =>
  isRecordLike(equipItemTable.value)
    ? renderTemplateWithTokens(
        equipItemTable.value.equipExtraDesc,
        buildEquipTokens(equipItemTable.value),
      )
    : '',
);

interface RecipeFormula {
  name: string;
  id: string;
  displayName: string;
  meta: Array<{ label: string; value: string }>;
  machineLabel?: string | undefined;
  ingredients: MaterialCostEntry[][];
  outcomes: MaterialCostEntry[][];
}

interface RecipeSection {
  title: string;
  formulas: RecipeFormula[];
}

function normalizeRecipeMaterialGroups(value: unknown): MaterialCostEntry[][] {
  return normalizeItemGroups(value)
    .map((group) =>
      normalizeMaterialCosts(
        group,
        props.localNameMap,
        props.itemDefsByKeyHash,
        props.idToPackItemId,
      ),
    )
    .filter((group) => group.length > 0);
}

function parseMachineCraftTable(table: unknown, title: string): RecipeSection | null {
  if (!isRecordLike(table)) return null;
  const formulas = toArray<RecordLike>(table.formula);
  if (!formulas.length) return null;
  return {
    title,
    formulas: formulas.map((f) => ({
      name: typeof f.formulaDesc === 'string' ? f.formulaDesc : '',
      id: typeof f.id === 'string' ? f.id : '',
      displayName: resolveRecipeText(f.formulaDesc ?? f.id),
      meta: [
        ...(f.machineId ? [{ label: l('Machine'), value: resolveRecipeText(f.machineId) }] : []),
        ...(f.formulaGroupId
          ? [{ label: l('Group'), value: resolveRecipeText(f.formulaGroupId) }]
          : []),
        ...(f.progressRound ? [{ label: l('Rounds'), value: formatScalar(f.progressRound) }] : []),
        ...(f.totalProgress
          ? [{ label: l('Progress'), value: formatScalar(f.totalProgress) }]
          : []),
      ],
      machineLabel:
        typeof f.machineId === 'string' || typeof f.machineId === 'number'
          ? resolveLocalizedEntityName(
              String(f.machineId),
              props.refs,
              props.localNameMap,
              props.itemDefsByKeyHash,
            )
          : undefined,
      ingredients: normalizeRecipeMaterialGroups(f.ingredients),
      outcomes: normalizeRecipeMaterialGroups(f.outcomes),
    })),
  };
}

function parseManualCraftTable(table: unknown, title: string): RecipeSection | null {
  if (!isRecordLike(table)) return null;
  const entries = Object.entries(table);
  if (!entries.length) return null;
  return {
    title,
    formulas: entries.flatMap(([key, value]) => {
      if (!isRecordLike(value)) return [];
      const entry = value;
      return {
        name: typeof entry.name === 'string' ? entry.name : key,
        id: typeof entry.id === 'string' ? entry.id : key,
        displayName: resolveRecipeText(entry.name ?? entry.id ?? key),
        meta: [
          ...(entry.domainId
            ? [{ label: l('Domain'), value: resolveRecipeText(entry.domainId) }]
            : []),
          ...(entry.rarity !== undefined
            ? [{ label: l('Rarity'), value: formatScalar(entry.rarity) }]
            : []),
        ],
        ingredients: normalizeRecipeMaterialGroups(entry.ingredients),
        outcomes: normalizeRecipeMaterialGroups(entry.outcomes),
      };
    }),
  };
}

function parseEquipFormulaTable(table: unknown, title: string): RecipeSection | null {
  if (!isRecordLike(table)) return null;
  const entries = Object.values(table).filter((v): v is RecordLike => isRecordLike(v));
  if (!entries.length) return null;
  return {
    title,
    formulas: entries.map((entry) => {
      const costIds = toArray(entry.costItemId);
      const costNums = toArray(entry.costItemNum);
      const ingredientGroup: RecordLike[] = costIds.map((id, i) => ({
        id,
        count: costNums[i] ?? 1,
      }));
      if (entry.costGoldNum && entry.costGoldId) {
        ingredientGroup.push({ id: entry.costGoldId, count: entry.costGoldNum });
      }
      const ingredients = ingredientGroup.length
        ? normalizeRecipeMaterialGroups([ingredientGroup])
        : [];
      const outcomes = entry.outcomeEquipId
        ? normalizeRecipeMaterialGroups([[{ id: entry.outcomeEquipId, count: 1 }]])
        : [];
      return {
        name: typeof entry.formulaId === 'string' ? entry.formulaId : '',
        id: typeof entry.formulaId === 'string' ? entry.formulaId : '',
        displayName: resolveRecipeText(entry.formulaId),
        meta: [
          ...(entry.packId ? [{ label: l('Pack'), value: resolveRecipeText(entry.packId) }] : []),
          ...(entry.unlockType !== undefined
            ? [
                {
                  label: l('Unlock'),
                  value: `${resolveRecipeText(entry.unlockType)} : ${resolveRecipeText(entry.unlockKey)} = ${toText(entry.unlockValue)}`,
                },
              ]
            : []),
        ],
        ingredients,
        outcomes,
      };
    }),
  };
}

function parseFactoryHubCraftTable(table: unknown, title: string): RecipeSection | null {
  if (!isRecordLike(table)) return null;
  const entries = Object.entries(table);
  if (!entries.length) return null;
  return {
    title,
    formulas: entries.flatMap(([key, value]) => {
      if (!isRecordLike(value)) return [];
      const entry = value;
      return {
        name: typeof entry.id === 'string' ? entry.id : key,
        id: typeof entry.id === 'string' ? entry.id : key,
        displayName: resolveRecipeText(entry.name ?? entry.id ?? key),
        meta: [
          ...(entry.usableLevel !== undefined
            ? [{ label: l('Level'), value: formatScalar(entry.usableLevel) }]
            : []),
          ...(entry.rarity !== undefined
            ? [{ label: l('Rarity'), value: formatScalar(entry.rarity) }]
            : []),
        ],
        ingredients: normalizeRecipeMaterialGroups(entry.ingredients),
        outcomes: normalizeRecipeMaterialGroups(entry.outcomes),
      };
    }),
  };
}

function parseManualFormulaUnlockTable(table: unknown, title: string): RecipeSection | null {
  if (!isRecordLike(table)) return null;
  const entries = Object.values(table).filter((v): v is RecordLike => isRecordLike(v));
  if (!entries.length) return null;
  return {
    title,
    formulas: entries.map((entry) => {
      const ingredients: MaterialCostEntry[][] = [];
      const outcomes: MaterialCostEntry[][] = [];
      if (entry.itemId) {
        outcomes.push(
          ...normalizeRecipeMaterialGroups([[{ id: entry.itemId, count: entry.gainItemNum ?? 1 }]]),
        );
      }
      // Collect reward items (rewardItemId1..N / rewardItemCount1..N)
      const rewards: RecordLike[] = [];
      for (let i = 1; i <= 10; i++) {
        const rid = entry[`rewardItemId${i}`];
        const rcount = entry[`rewardItemCount${i}`];
        if (rid) rewards.push({ id: rid, count: rcount ?? 1 });
      }
      if (rewards.length) outcomes.push(...normalizeRecipeMaterialGroups([rewards]));
      return {
        name: typeof entry.id === 'string' ? entry.id : '',
        id: typeof entry.id === 'string' ? entry.id : '',
        displayName: resolveRecipeText(entry.name ?? entry.id),
        meta: [],
        ingredients,
        outcomes,
      };
    }),
  };
}

const recipeSections = computed<RecipeSection[]>(() => {
  const sections: RecipeSection[] = [];
  const tryAdd = (result: RecipeSection | null) => {
    if (result) sections.push(result);
  };
  tryAdd(
    parseMachineCraftTable(props.detail.inFactoryMachineCraftTable, 'In Factory Machine Craft'),
  );
  tryAdd(
    parseMachineCraftTable(props.detail.outFactoryMachineCraftTable, 'Out Factory Machine Craft'),
  );
  tryAdd(parseManualCraftTable(props.detail.factoryManualCraftTable, 'Factory Manual Craft'));
  tryAdd(parseEquipFormulaTable(props.detail.equipFormulaTable, 'Equip Formula'));
  tryAdd(parseFactoryHubCraftTable(props.detail.factoryHubCraftTable, 'Factory Hub Craft'));
  tryAdd(
    parseManualFormulaUnlockTable(
      props.detail.factoryManualCraftFormulaUnlockTable,
      'Manual Formula Unlock',
    ),
  );
  return sections;
});
</script>

<style scoped>
.ww__recipe-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.3rem 0.4rem;
  margin-top: 0.35rem;
}

.ww__recipe-badge {
  font-size: 0.7rem;
}

.ww__recipe-table {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem 0.9rem;
  margin-top: 0.7rem;
}

.ww__recipe-column {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: fit-content;
  max-width: min(100%, 360px);
}

.ww__recipe-column-title {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--ww-muted);
  margin-bottom: 0.35rem;
  text-align: center;
}

.ww__recipe-machine {
  min-height: 0;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--ww-border);
  border-radius: 8px;
  background: var(--ww-surface-soft);
  color: var(--ww-text);
  text-align: center;
}

.ww__recipe-groups {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.55rem;
}

.ww__recipe-group-title {
  font-size: 0.76rem;
  color: var(--ww-muted);
  margin-bottom: 0.28rem;
  text-align: center;
}

.ww__recipe-group {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.ww__recipe-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  color: var(--ww-muted);
}

@media (max-width: 900px) {
  .ww__recipe-table {
    flex-direction: column;
    gap: 0.75rem;
  }

  .ww__recipe-arrow {
    transform: rotate(90deg);
  }
}
</style>
