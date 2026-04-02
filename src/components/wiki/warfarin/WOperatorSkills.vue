<template>
  <div>
    <section v-if="talentEntries.length" id="operator-talents" class="ww__section">
      <h3 class="ww__title">{{ t('warfarin.operator.talents') }}</h3>
      <div class="ww__stack ww__stack--compact">
        <div v-for="node in talentEntries" :key="node.key" class="ww__talent-card">
          <div class="ww__talent-head">
            <div class="ww__talent-icon-box">
              <img
                v-if="node.icon"
                :src="node.icon"
                :alt="node.name"
                class="ww__talent-icon"
              />
              <div v-else class="ww__talent-icon-fallback">{{ node.name.slice(0, 1) || '?' }}</div>
            </div>
            <div class="ww__talent-copy">
              <div class="ww__talent-name">{{ node.name }}</div>
              <div class="ww__talent-sub">{{ node.unlockLabel }}</div>
            </div>
          </div>
          <WTextRenderer
            :value="node.description"
            :local-name-map="localNameMap"
            :id-to-pack-item-id="idToPackItemId"
            :item-defs-by-key-hash="itemDefsByKeyHash"
            :refs="refs"
            :blackboard="node.blackboard"
            class-name="ww__talent-desc"
          />
        </div>
      </div>
    </section>

    <section v-if="potentialEffectEntries.length" id="operator-potential-effects" class="ww__section">
      <h3 class="ww__title">{{ t('warfarin.operator.potentials') }}</h3>
      <div class="ww__stack">
        <div v-for="entry in potentialEffectEntries" :key="entry.key" class="ww__potential-card">
          <div class="ww__potential-index">{{ entry.level }}</div>
          <div class="ww__potential-body">
            <div class="ww__potential-name">{{ entry.title }}</div>
            <WTextRenderer
              :value="entry.description"
              :local-name-map="localNameMap"
              :id-to-pack-item-id="idToPackItemId"
            :item-defs-by-key-hash="itemDefsByKeyHash"
            :refs="refs"
            :blackboard="entry.blackboard"
            semantic
            class-name="ww__potential-desc"
          />
          </div>
        </div>
      </div>
    </section>

    <section v-if="combatSkillGroups.length" id="operator-combat-skills" class="ww__section">
      <h3 class="ww__title">{{ t('warfarin.operator.combatSkills') }}</h3>
      <div class="ww__stack">
        <div v-for="group in combatSkillGroups" :key="group.id" class="ww__panel">
          <div class="ww__panel-title">{{ group.name }}</div>
          <div class="ww__panel-sub">{{ group.kindLabel }}</div>
          <WTextRenderer
            v-if="group.description"
            :value="group.description"
            :local-name-map="localNameMap"
            :id-to-pack-item-id="idToPackItemId"
            :item-defs-by-key-hash="itemDefsByKeyHash"
            :refs="refs"
            :blackboard="group.blackboard"
            semantic
          />

          <div v-if="group.rows.length" class="ww__table-wrap q-mt-md">
            <table class="ww__table ww__table--wide">
              <thead>
                <tr>
                  <th>{{ t('warfarin.common.stat') }}</th>
                  <th v-for="level in group.levelLabels" :key="level">{{ level }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in group.rows" :key="row.label">
                  <td>{{ row.label }}</td>
                  <td v-for="level in group.levelLabels" :key="`${row.label}-${level}`">
                    {{ row.values[level] ?? '-' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <q-expansion-item
            v-if="group.materialRows.length"
            dense
            expand-separator
            switch-toggle-side
            :label="t('warfarin.common.skillMaterialCost')"
            class="ww__expansion q-mt-md"
          >
            <div class="ww__material-upgrades">
              <div v-for="material in group.materialRows" :key="material.label" class="ww__material-column">
                <div class="ww__material-column-title">{{ material.label }}</div>
                <WItemCostGrid
                  :entries="material.materials"
                  :item-defs-by-key-hash="itemDefsByKeyHash"
                  compact
                />
              </div>
            </div>
          </q-expansion-item>
        </div>
      </div>
    </section>

    <section v-if="spaceshipGroups.length" id="operator-base-skills" class="ww__section">
      <h3 class="ww__title">{{ t('warfarin.operator.baseSkills') }}</h3>
      <div class="ww__stack ww__stack--compact">
        <div v-for="group in spaceshipGroups" :key="group.title" class="ww__panel">
          <div class="ww__panel-title">{{ group.title }}</div>
          <div class="ww__stack ww__stack--compact q-mt-md">
            <div v-for="skill in group.skills" :key="skill.skillId" class="ww__subpanel">
              <div class="ww__panel-title">{{ skill.name }}</div>
              <div v-if="skill.unlockHint" class="ww__panel-sub">{{ skill.unlockHint }}</div>
              <WTextRenderer
                v-if="skill.desc"
                :value="skill.desc"
                compact
                :local-name-map="localNameMap"
                :id-to-pack-item-id="idToPackItemId"
                :item-defs-by-key-hash="itemDefsByKeyHash"
                :refs="refs"
              />
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
import WTextRenderer from './shared/WTextRenderer.vue';
import WItemCostGrid from './shared/WItemCostGrid.vue';
import {
  type MaterialCostEntry,
  type RecordLike,
  isRecordLike,
  toArray,
  normalizeMaterialCosts,
  formatScalar,
  toCdnAssetUrl,
  toText,
} from './utils';
import { buildWarfarinBlackboardMap, pickWarfarinText } from './text';

const props = defineProps<{
  detail: RecordLike;
  refs: RecordLike;
  localNameMap: RecordLike;
  idToPackItemId?: RecordLike | undefined;
  itemDefsByKeyHash?: Record<string, ItemDef> | undefined;
}>();

const { t } = useI18n();

const growthTable = computed<RecordLike>(() =>
  isRecordLike(props.detail.charGrowthTable) ? props.detail.charGrowthTable : {},
);
const potentialEffects = computed<RecordLike>(() =>
  isRecordLike(props.detail.potentialTalentEffectTable)
    ? props.detail.potentialTalentEffectTable
    : {},
);
const potentialTable = computed<RecordLike>(() =>
  isRecordLike(props.detail.characterPotentialTable) ? props.detail.characterPotentialTable : {},
);
const skillPatchTable = computed<RecordLike>(() =>
  isRecordLike(props.detail.skillPatchTable) ? props.detail.skillPatchTable : {},
);

function toSnakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
}

function skillLevelLabel(level: number): string {
  if (level >= 10) return `M${level - 9}`;
  return String(level);
}

const talentEntries = computed(() => {
  const talentNodeMap = isRecordLike(growthTable.value.talentNodeMap) ? growthTable.value.talentNodeMap : {};
  return Object.values(talentNodeMap)
    .filter((entry): entry is RecordLike => isRecordLike(entry) && Number(entry.nodeType ?? 0) === 4)
    .map((entry) => {
      const passive = isRecordLike(entry.passiveSkillNodeInfo) ? entry.passiveSkillNodeInfo : {};
      const effectId = typeof passive.talentEffectId === 'string' ? passive.talentEffectId : '';
      const rawEffect = potentialEffects.value[effectId];
      const effect = isRecordLike(rawEffect) ? rawEffect : {};
      const breakStage = Number(passive.breakStage ?? 0);
      const level = Number(passive.level ?? 1);
      return {
        key: typeof entry.nodeId === 'string' ? entry.nodeId : effectId,
        name: typeof passive.name === 'string' ? passive.name : effectId,
        level,
        effectId,
        unlockLabel:
          level > 1
            ? t('warfarin.common.breakStageEffectUpgrade', { breakStage })
            : t('warfarin.common.breakStageUnlock', { breakStage }),
        description: pickWarfarinText(effect),
        blackboard: buildWarfarinBlackboardMap(effect),
        icon: toCdnAssetUrl(passive.iconId),
        index: Number(passive.index ?? 0),
        breakStage,
      };
    })
    .sort((a, b) => a.index - b.index || a.level - b.level || a.name.localeCompare(b.name));
});

const potentialEffectEntries = computed(() =>
  toArray<RecordLike>(potentialTable.value.potentialUnlockBundle)
    .map((bundle) => {
      const effectId = typeof bundle.potentialEffectId === 'string' ? bundle.potentialEffectId : '';
      const rawEffect = effectId ? potentialEffects.value[effectId] : undefined;
      const entry = isRecordLike(rawEffect) ? rawEffect : {};
      return {
        key: effectId || toText(bundle.level),
        level: Number(bundle.level ?? 0),
        title: toText(bundle.name, effectId || '-'),
        description: pickWarfarinText(entry),
        blackboard: buildWarfarinBlackboardMap(entry),
      };
    })
    .filter((entry) => toText(entry.description).trim().length > 0)
    .sort((a, b) => a.level - b.level),
);

type CombatSkillGroup = {
  id: string;
  name: string;
  kindLabel: string;
  description: unknown;
  blackboard: Record<string, number>;
  levelLabels: string[];
  rows: Array<{ label: string; values: Record<string, string> }>;
  materialRows: Array<{ label: string; materials: MaterialCostEntry[] }>;
};

function extractPatchRows(bundles: RecordLike[]): Array<{ label: string; values: Record<string, string> }> {
  const rowMap = new Map<string, Record<string, string>>();
  bundles.forEach((bundle) => {
    const level = Number(bundle.level ?? 0);
    const levelLabel = skillLevelLabel(level);
    const names = toArray(bundle.subDescNameList)
      .map((entry) => toText(entry).trim())
      .filter((entry) => entry.length > 0);
    const values = toArray(bundle.subDescList).map((entry) => formatScalar(entry));
    names.forEach((name, index) => {
      const row = rowMap.get(name) ?? {};
      row[levelLabel] = values[index] ?? '-';
      rowMap.set(name, row);
    });
  });
  return Array.from(rowMap.entries()).map(([label, values]) => ({ label, values }));
}

const combatSkillGroups = computed<CombatSkillGroup[]>(() => {
  const groupMap = isRecordLike(growthTable.value.skillGroupMap) ? growthTable.value.skillGroupMap : {};
  const skillLevelUps = toArray<RecordLike>(growthTable.value.skillLevelUp);
  const allPatchEntries = Object.entries(skillPatchTable.value).filter((entry): entry is [string, RecordLike] =>
    isRecordLike(entry[1]),
  );

  const groups = Object.values(groupMap)
    .filter((entry): entry is RecordLike => isRecordLike(entry))
    .map((group) => {
      const id = typeof group.skillGroupId === 'string' ? group.skillGroupId : '';
      const suffix = toSnakeCase(id.split('_').at(-1) || '');
      let patchEntries = allPatchEntries.filter(([key]) => key.endsWith(`_${suffix}`));
      if (suffix === 'normal_attack') {
        patchEntries = allPatchEntries.filter(
          ([key, value]) => {
            const firstBundle = toArray<RecordLike>(value.SkillPatchDataBundle)[0];
            const iconId = typeof firstBundle?.iconId === 'string' ? firstBundle.iconId : '';
            return (
              key.includes('_attack') ||
              key.includes('_plunging') ||
              key.includes('_dash_attack') ||
              iconId.startsWith('icon_attack_')
            );
          },
        );
      }
      const bundles = patchEntries.flatMap(([, value]) =>
        toArray<RecordLike>(value.SkillPatchDataBundle).filter((entry) => isRecordLike(entry)),
      );
      const levelLabels = Array.from(
        new Set(bundles.map((bundle) => skillLevelLabel(Number(bundle.level ?? 0))).filter(Boolean)),
      );
      const materialRows = skillLevelUps
        .filter((entry) => entry.skillGroupId === id)
        .map((entry) => ({
          label: skillLevelLabel(Number(entry.level ?? 0)),
          materials: normalizeMaterialCosts(
            entry.itemBundle,
            props.localNameMap,
            props.itemDefsByKeyHash,
            props.idToPackItemId,
          ).concat(
            Number(entry.goldCost ?? 0) > 0
              ? [
                  {
                    rawId: 'item_gold',
                    packItemId: undefined,
                    name: t('warfarin.common.creditCost'),
                    count: entry.goldCost,
                    icon: undefined,
                  },
                ]
              : [],
          ),
        }));

      return {
        id,
        name: typeof group.name === 'string' ? group.name : id,
        kindLabel:
          Number(group.skillGroupType ?? -1) === 0
            ? t('warfarin.common.basicAttack')
            : Number(group.skillGroupType ?? -1) === 1
              ? t('warfarin.common.battleSkill')
              : Number(group.skillGroupType ?? -1) === 2
                ? t('warfarin.common.ultimateSkill')
                : Number(group.skillGroupType ?? -1) === 3
                  ? t('warfarin.common.comboSkill')
                  : t('warfarin.common.skill'),
        description: pickWarfarinText(group),
        blackboard: buildWarfarinBlackboardMap(bundles),
        levelLabels,
        rows: extractPatchRows(bundles),
        materialRows,
        sortKey: Number(group.skillGroupType ?? 999),
      };
    })
    .filter((group) => group.rows.length || group.materialRows.length || toText(group.description).trim().length > 0);

  return groups.sort((a, b) => a.sortKey - b.sortKey || a.name.localeCompare(b.name));
});

const spaceshipGroups = computed(() => {
  const charSkillTable = isRecordLike(props.detail.spaceshipCharSkillTable)
    ? props.detail.spaceshipCharSkillTable
    : {};
  const skillTable = isRecordLike(props.detail.spaceshipSkillTable)
    ? props.detail.spaceshipSkillTable
    : {};

  const unlockHintBySkillId = new Map<string, string>();
  Object.values(charSkillTable)
    .filter((entry): entry is RecordLike => isRecordLike(entry))
    .forEach((entry) => {
      const skillId = typeof entry.skillId === 'string' ? entry.skillId : '';
      if (skillId && typeof entry.unlockHint === 'string') {
        unlockHintBySkillId.set(skillId, entry.unlockHint);
      }
    });

  const groups = new Map<string, Array<{ skillId: string; name: string; desc: unknown; unlockHint: string }>>();
  Object.values(skillTable)
    .filter((entry): entry is RecordLike => isRecordLike(entry))
    .forEach((skill) => {
      const title = typeof skill.talentName === 'string' ? skill.talentName : toText(skill.name);
      const bucket = groups.get(title) ?? [];
      const skillId = typeof skill.id === 'string' ? skill.id : '';
      bucket.push({
        skillId,
        name: typeof skill.name === 'string' ? skill.name : skillId,
        desc: pickWarfarinText(skill),
        unlockHint: unlockHintBySkillId.get(skillId) ?? '',
      });
      groups.set(title, bucket);
    });

  return Array.from(groups.entries()).map(([title, skills]) => ({
    title,
    skills: skills.sort((a, b) => a.name.localeCompare(b.name)),
  }));
});
</script>
