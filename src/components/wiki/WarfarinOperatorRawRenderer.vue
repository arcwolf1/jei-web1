<template>
  <div class="warfarin-operator-wiki">
    <div v-if="!payload" class="warfarin-operator-wiki__empty">No operator raw data.</div>

    <template v-else>
      <q-tabs v-model="activeTab" dense align="left" class="text-primary">
        <q-tab name="overview" label="Overview" />
        <q-tab name="voices" label="Voices / Records" />
        <q-tab name="skills" label="Skills" />
        <q-tab name="raw" label="Raw" />
      </q-tabs>
      <q-separator />

      <q-tab-panels v-model="activeTab" animated>
        <q-tab-panel name="overview">
          <section class="warfarin-operator-wiki__section">
            <h3 class="warfarin-operator-wiki__title">Basic Info</h3>
            <div class="warfarin-operator-wiki__grid">
              <div class="warfarin-operator-wiki__card">
                <div class="warfarin-operator-wiki__label">Name</div>
                <div class="warfarin-operator-wiki__value">
                  {{ characterTable?.name || list?.name || '-' }}
                </div>
              </div>
              <div class="warfarin-operator-wiki__card">
                <div class="warfarin-operator-wiki__label">English Name</div>
                <div class="warfarin-operator-wiki__value">
                  {{ characterTable?.engName || '-' }}
                </div>
              </div>
              <div class="warfarin-operator-wiki__card">
                <div class="warfarin-operator-wiki__label">ID</div>
                <div class="warfarin-operator-wiki__value warfarin-operator-wiki__value--mono">
                  {{ characterTable?.charId || list?.id || '-' }}
                </div>
              </div>
              <div class="warfarin-operator-wiki__card">
                <div class="warfarin-operator-wiki__label">Rarity</div>
                <div class="warfarin-operator-wiki__value">
                  {{ formatRarity(characterTable?.rarity ?? list?.rarity) }}
                </div>
              </div>
              <div class="warfarin-operator-wiki__card">
                <div class="warfarin-operator-wiki__label">Type</div>
                <div class="warfarin-operator-wiki__value">
                  {{ characterTable?.charTypeId || list?.charTypeId || '-' }}
                </div>
              </div>
              <div class="warfarin-operator-wiki__card">
                <div class="warfarin-operator-wiki__label">Profession</div>
                <div class="warfarin-operator-wiki__value">
                  {{ list?.profession || characterTable?.profession || '-' }}
                </div>
              </div>
              <div class="warfarin-operator-wiki__card">
                <div class="warfarin-operator-wiki__label">Weapon Type</div>
                <div class="warfarin-operator-wiki__value">
                  {{ characterTable?.weaponType || list?.weaponType || '-' }}
                </div>
              </div>
              <div class="warfarin-operator-wiki__card">
                <div class="warfarin-operator-wiki__label">Department</div>
                <div class="warfarin-operator-wiki__value">
                  {{ characterTable?.department || '-' }}
                </div>
              </div>
              <div class="warfarin-operator-wiki__card">
                <div class="warfarin-operator-wiki__label">Default Weapon</div>
                <div class="warfarin-operator-wiki__value warfarin-operator-wiki__value--mono">
                  {{ characterTable?.defaultWeaponId || '-' }}
                </div>
              </div>
            </div>
          </section>

          <section v-if="cvEntries.length" class="warfarin-operator-wiki__section">
            <h3 class="warfarin-operator-wiki__title">CV / 声优</h3>
            <div class="warfarin-operator-wiki__grid">
              <div
                v-for="entry in cvEntries"
                :key="entry.label"
                class="warfarin-operator-wiki__card"
              >
                <div class="warfarin-operator-wiki__label">{{ entry.label }}</div>
                <div class="warfarin-operator-wiki__value">{{ entry.value }}</div>
              </div>
            </div>
          </section>

          <section v-if="tagEntries.length" class="warfarin-operator-wiki__section">
            <h3 class="warfarin-operator-wiki__title">Tags</h3>
            <div class="warfarin-operator-wiki__tag-box">
              <div
                v-for="entry in tagEntries"
                :key="entry.label"
                class="warfarin-operator-wiki__tag-row"
              >
                <span class="warfarin-operator-wiki__tag-label">{{ entry.label }}</span>
                <span>{{ entry.value }}</span>
              </div>
            </div>
          </section>

          <section v-if="itemTable" class="warfarin-operator-wiki__section">
            <h3 class="warfarin-operator-wiki__title">Item / 物品</h3>
            <div class="warfarin-operator-wiki__grid">
              <div class="warfarin-operator-wiki__card">
                <div class="warfarin-operator-wiki__label">Item ID</div>
                <div class="warfarin-operator-wiki__value warfarin-operator-wiki__value--mono">
                  {{ itemTable.id || '-' }}
                </div>
              </div>
              <div class="warfarin-operator-wiki__card">
                <div class="warfarin-operator-wiki__label">Item Name</div>
                <div class="warfarin-operator-wiki__value">{{ itemTable.name || '-' }}</div>
              </div>
              <div class="warfarin-operator-wiki__card">
                <div class="warfarin-operator-wiki__label">Icon ID</div>
                <div class="warfarin-operator-wiki__value warfarin-operator-wiki__value--mono">
                  {{ itemTable.iconId || '-' }}
                </div>
              </div>
            </div>
            <div
              v-if="itemTable.desc"
              class="warfarin-operator-wiki__prose warfarin-operator-wiki__prose--box"
              v-html="formatWikiHtml(itemTable.desc)"
            ></div>
            <div
              v-if="itemTable.decoDesc"
              class="warfarin-operator-wiki__muted-prose"
              v-html="formatWikiHtml(itemTable.decoDesc)"
            ></div>
          </section>

          <section v-if="attributeStages.length" class="warfarin-operator-wiki__section">
            <h3 class="warfarin-operator-wiki__title">Attributes / 属性</h3>
            <q-expansion-item
              v-for="stage in attributeStages"
              :key="`attr-${stage.breakStage}`"
              dense
              expand-separator
              switch-toggle-side
              :label="`Break Stage ${stage.breakStage} (${stage.entries.length} Levels)`"
              class="warfarin-operator-wiki__expansion"
            >
              <div class="warfarin-operator-wiki__table-wrap">
                <table class="warfarin-operator-wiki__table warfarin-operator-wiki__table--wide">
                  <thead>
                    <tr>
                      <th>Level</th>
                      <th v-for="type in stage.attrTypes" :key="type">
                        {{ getAttrName(type) }}
                        <span class="warfarin-operator-wiki__attr-type">#{{ type }}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in stage.rows" :key="formatScalar(row.level)">
                      <td>{{ `Lv ${formatScalar(row.level)}` }}</td>
                      <td v-for="type in stage.attrTypes" :key="`${row.level}-${type}`">
                        {{ formatScalar(row.values[type]) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </q-expansion-item>
          </section>

          <section v-if="potentialBundles.length" class="warfarin-operator-wiki__section">
            <h3 class="warfarin-operator-wiki__title">Potential / 潜能</h3>
            <div class="warfarin-operator-wiki__stack">
              <div
                v-for="bundle in potentialBundles"
                :key="formatScalar(bundle.level)"
                class="warfarin-operator-wiki__panel"
              >
                <div class="warfarin-operator-wiki__panel-title">
                  Potential {{ bundle.level }}<span v-if="bundle.name"> · {{ bundle.name }}</span>
                </div>
                <div class="warfarin-operator-wiki__panel-sub">
                  {{ formatItemBundle(bundle.itemIds, bundle.itemCnts) || '-' }}
                </div>
              </div>
            </div>
          </section>

          <section v-if="growthNodes.length" class="warfarin-operator-wiki__section">
            <h3 class="warfarin-operator-wiki__title">Growth / 成长</h3>
            <div class="warfarin-operator-wiki__stack">
              <div
                v-for="node in growthNodes"
                :key="formatScalar(node.nodeId)"
                class="warfarin-operator-wiki__panel"
              >
                <div class="warfarin-operator-wiki__panel-title">
                  {{ node.name || node.nodeId }}
                </div>
                <div class="warfarin-operator-wiki__panel-sub">
                  {{
                    node.nodeType === 1
                      ? 'Promotion / 精英化'
                      : node.nodeType === 2
                        ? 'Outfitting / 装备'
                        : 'Node'
                  }}
                </div>
                <div
                  v-if="node.description"
                  class="warfarin-operator-wiki__prose warfarin-operator-wiki__prose--small"
                  v-html="formatWikiHtml(node.description)"
                ></div>
                <div class="warfarin-operator-wiki__muted-prose">
                  {{ formatRequiredItems(node.requiredItem) || 'No required items' }}
                </div>
              </div>
            </div>
          </section>

          <section v-if="snapshotEntries.length" class="warfarin-operator-wiki__section">
            <h3 class="warfarin-operator-wiki__title">Artwork / 立绘</h3>
            <div class="warfarin-operator-wiki__grid">
              <div
                v-for="snapshot in snapshotEntries"
                :key="toText(snapshot.pictureId, toText(snapshot.imgId, 'snapshot'))"
                class="warfarin-operator-wiki__card warfarin-operator-wiki__card--media"
              >
                <img
                  v-if="snapshot.imgId || snapshot.pictureId"
                  :src="toCdnAssetUrl(snapshot.imgId || snapshot.pictureId)"
                  :alt="toText(snapshot.name, toText(snapshot.pictureId, 'snapshot'))"
                  class="warfarin-operator-wiki__image"
                />
                <div class="warfarin-operator-wiki__value">
                  {{ snapshot.name || snapshot.pictureId || '-' }}
                </div>
                <div class="warfarin-operator-wiki__label warfarin-operator-wiki__value--mono">
                  {{ snapshot.pictureId || snapshot.imgId || '-' }}
                </div>
                <div v-if="snapshot.decoDescription" class="warfarin-operator-wiki__muted-prose">
                  {{ stripWikiText(snapshot.decoDescription) }}
                </div>
                <div v-if="snapshot.description" class="warfarin-operator-wiki__muted-prose">
                  {{ stripWikiText(snapshot.description) }}
                </div>
                <div class="warfarin-operator-wiki__label">
                  By {{ snapshot.author || 'Unknown' }}
                </div>
              </div>
            </div>
          </section>
        </q-tab-panel>

        <q-tab-panel name="voices">
          <section v-if="profileRecords.length" class="warfarin-operator-wiki__section">
            <h3 class="warfarin-operator-wiki__title">Profile Records / 档案记录</h3>
            <div class="warfarin-operator-wiki__stack">
              <div
                v-for="record in profileRecords"
                :key="toText(record.id, toText(record.recordID, 'record'))"
                class="warfarin-operator-wiki__panel"
              >
                <div class="warfarin-operator-wiki__panel-title">
                  {{ record.recordTitle || 'Record' }}
                </div>
                <div
                  v-if="record.unlockType || record.unlockValue"
                  class="warfarin-operator-wiki__panel-sub"
                >
                  Unlock: type {{ record.unlockType ?? 0 }}, value {{ record.unlockValue ?? 0 }}
                </div>
                <div
                  class="warfarin-operator-wiki__prose"
                  v-html="formatWikiHtml(record.recordDesc)"
                ></div>
              </div>
            </div>
          </section>

          <section v-if="voiceGroups.length" class="warfarin-operator-wiki__section">
            <h3 class="warfarin-operator-wiki__title">Voice Lines / 语音</h3>
            <q-expansion-item
              v-for="group in voiceGroups"
              :key="group.title"
              dense
              expand-separator
              switch-toggle-side
              :label="`${group.title} (${group.items.length})`"
              class="warfarin-operator-wiki__expansion"
            >
              <div class="warfarin-operator-wiki__stack warfarin-operator-wiki__stack--compact">
                <div
                  v-for="voice in group.items"
                  :key="toText(voice.id, toText(voice.voId, 'voice'))"
                  class="warfarin-operator-wiki__panel"
                >
                  <div class="warfarin-operator-wiki__panel-title">
                    {{ voice.voiceTitle || 'Voice' }}
                  </div>
                  <div
                    class="warfarin-operator-wiki__prose"
                    v-html="formatWikiHtml(voice.voiceDesc)"
                  ></div>
                  <div
                    v-if="voice.voId"
                    class="warfarin-operator-wiki__panel-sub warfarin-operator-wiki__value--mono"
                  >
                    {{ voice.voId }}
                  </div>
                </div>
              </div>
            </q-expansion-item>
          </section>
        </q-tab-panel>

        <q-tab-panel name="skills">
          <section v-if="skillGroups.length" class="warfarin-operator-wiki__section">
            <h3 class="warfarin-operator-wiki__title">Skill Level Up</h3>
            <q-expansion-item
              v-for="group in skillGroups"
              :key="group.skillGroupId"
              dense
              expand-separator
              switch-toggle-side
              :label="group.name || group.skillGroupId"
              class="warfarin-operator-wiki__expansion"
            >
              <div
                v-if="group.desc"
                class="warfarin-operator-wiki__prose q-mb-md"
                v-html="formatWikiHtml(group.desc)"
              ></div>
              <div class="warfarin-operator-wiki__table-wrap">
                <table class="warfarin-operator-wiki__table">
                  <thead>
                    <tr>
                      <th>Level</th>
                      <th>Gold</th>
                      <th>Materials</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="entry in group.levels" :key="`${group.skillGroupId}-${entry.level}`">
                      <td>{{ `Lv ${formatScalar(entry.level)}` }}</td>
                      <td>{{ formatScalar(entry.goldCost) }}</td>
                      <td>{{ formatRequiredItems(entry.itemBundle) || '-' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </q-expansion-item>
          </section>

          <section v-if="potentialEffectEntries.length" class="warfarin-operator-wiki__section">
            <h3 class="warfarin-operator-wiki__title">Potential Talent Effects / 潜能天赋</h3>
            <div class="warfarin-operator-wiki__stack warfarin-operator-wiki__stack--compact">
              <div
                v-for="entry in potentialEffectEntries"
                :key="entry.key"
                class="warfarin-operator-wiki__panel"
              >
                <div class="warfarin-operator-wiki__panel-title">{{ entry.title }}</div>
                <div class="warfarin-operator-wiki__panel-sub warfarin-operator-wiki__value--mono">
                  {{ entry.key }}
                </div>
                <div
                  v-if="entry.description"
                  class="warfarin-operator-wiki__prose"
                  v-html="formatWikiHtml(entry.description)"
                ></div>
              </div>
            </div>
          </section>
        </q-tab-panel>

        <q-tab-panel name="raw">
          <pre class="warfarin-operator-wiki__raw">{{ rawJson }}</pre>
        </q-tab-panel>
      </q-tab-panels>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ItemDef } from 'src/jei/types';

type RecordLike = Record<string, unknown>;

interface AttributeStageRow {
  level: unknown;
  values: Record<string, unknown>;
}

const props = defineProps<{
  source: unknown;
  itemDefsByKeyHash?: Record<string, ItemDef> | undefined;
}>();

const activeTab = ref('overview');

function isRecordLike(value: unknown): value is RecordLike {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripWikiText(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value as string | number | boolean)
    .replace(/<@[^>]+>/g, '')
    .replace(/<#[^>]+>/g, '')
    .replace(/<\/?>/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

function formatWikiHtml(value: unknown): string {
  const text = stripWikiText(value);
  if (!text) return '';
  return escapeHtml(text).replace(/\n/g, '<br>');
}

function formatScalar(value: unknown): string {
  if (value === undefined || value === null || value === '') return '-';
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(3).replace(/\.?0+$/, '');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value as string | number | boolean);
}

function toText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return fallback;
}

function formatRarity(value: unknown): string {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return '-';
  return `${'★'.repeat(num)} (${num})`;
}

function normalizePayload(source: unknown): RecordLike | null {
  if (!isRecordLike(source)) return null;
  if (isRecordLike(source.list) && isRecordLike(source.detail)) return source;
  if (isRecordLike(source.raw)) {
    const nested = source.raw;
    if (isRecordLike(nested.list) && isRecordLike(nested.detail)) return nested;
  }
  return null;
}

const payload = computed(() => normalizePayload(props.source));
const list = computed<RecordLike | null>(() =>
  payload.value && isRecordLike(payload.value.list) ? payload.value.list : null,
);
const detail = computed<RecordLike | null>(() =>
  payload.value && isRecordLike(payload.value.detail) ? payload.value.detail : null,
);
const characterTable = computed<RecordLike | null>(() =>
  detail.value && isRecordLike(detail.value.characterTable) ? detail.value.characterTable : null,
);
const charTagTable = computed<RecordLike>(() =>
  detail.value && isRecordLike(detail.value.charTagTable) ? detail.value.charTagTable : {},
);
const growthTable = computed<RecordLike>(() =>
  detail.value && isRecordLike(detail.value.charGrowthTable) ? detail.value.charGrowthTable : {},
);
const itemTable = computed<RecordLike | null>(() =>
  detail.value && isRecordLike(detail.value.itemTable) ? detail.value.itemTable : null,
);
const potentialTable = computed<RecordLike>(() =>
  detail.value && isRecordLike(detail.value.characterPotentialTable)
    ? detail.value.characterPotentialTable
    : {},
);
const potentialEffects = computed<RecordLike>(() =>
  detail.value && isRecordLike(detail.value.potentialTalentEffectTable)
    ? detail.value.potentialTalentEffectTable
    : {},
);

const attrNameMap: Record<string, string> = {
  '1': '生命值',
  '2': '攻击力',
  '3': '防御力',
  '4': '物理伤害减免',
  '5': '灼热伤害减免',
  '6': '电磁伤害减免',
  '7': '寒冷伤害减免',
  '9': '暴击率',
  '39': '力量',
  '40': '敏捷',
  '41': '智识',
  '42': '意志',
  '48': '自然伤害减免',
  '49': '法术异常和爆发伤害',
  '50': '物理伤害加成',
  '51': '灼热伤害加成',
  '52': '电磁伤害加成',
  '53': '寒冷伤害加成',
  '54': '自然伤害加成',
  '60': '超域伤害减免',
};

function getAttrName(attrType: string): string {
  return attrNameMap[attrType] || `Attr ${attrType}`;
}

function resolveItemName(rawId: unknown): string {
  const itemId = typeof rawId === 'string' ? rawId : '';
  if (!itemId) return '-';
  const values = Object.values(props.itemDefsByKeyHash || {});
  const found = values.find(
    (entry) => typeof entry?.key?.id === 'string' && entry.key.id.endsWith(itemId),
  );
  return found?.name || itemId;
}

function formatRequiredItems(value: unknown): string {
  const items = toArray<RecordLike>(value);
  return items
    .map((item) => {
      const itemId = typeof item.id === 'string' ? item.id : '';
      const count = item.count ?? item.cnt ?? item.amount;
      return `${resolveItemName(itemId)} x${formatScalar(count)}`;
    })
    .filter((entry) => entry.trim().length > 0)
    .join(', ');
}

function formatItemBundle(ids: unknown, counts: unknown): string {
  const idList = toArray(ids);
  const countList = toArray(counts);
  return idList
    .map((id, index) => `${resolveItemName(id)} x${formatScalar(countList[index])}`)
    .join(', ');
}

function toCdnAssetUrl(assetId: unknown): string {
  const id = typeof assetId === 'string' ? assetId.trim() : '';
  return id ? `https://cdn.warfarin.wiki/assets/${id}.png` : '';
}

const cvEntries = computed(() => {
  const cv =
    characterTable.value && isRecordLike(characterTable.value.cvName)
      ? characterTable.value.cvName
      : {};
  return [
    { label: '中文CV', value: cv.ChiCVName },
    { label: '英文CV', value: cv.EngCVName },
    { label: '日文CV', value: cv.JapCVName },
    { label: '韩文CV', value: cv.KorCVName },
  ].filter(
    (entry): entry is { label: string; value: string } =>
      typeof entry.value === 'string' && entry.value.trim().length > 0,
  );
});

const tagEntries = computed(() => {
  const tags: Array<{ label: string; value: string }> = [];
  const table = charTagTable.value;
  const pushArray = (label: string, value: unknown) => {
    const arr = toArray(value)
      .map((entry) => toText(entry))
      .filter((entry) => entry.length > 0);
    if (arr.length) tags.push({ label, value: arr.join(', ') });
  };
  if (typeof table.raceTagId === 'string' && table.raceTagId) {
    tags.push({ label: '种族', value: table.raceTagId });
  }
  if (typeof table.blocTagId === 'string' && table.blocTagId) {
    tags.push({ label: '阵营', value: table.blocTagId });
  }
  pushArray('专家', table.expertTagIds);
  pushArray('性格', table.dispositionTagIds);
  pushArray('爱好', table.hobbyTagIds);
  pushArray('厌恶', table.behaviourHateTagIds);
  pushArray('礼物偏好', table.giftPreferTagId);
  return tags;
});

const profileRecords = computed(() => toArray<RecordLike>(characterTable.value?.profileRecord));

const voiceGroups = computed(() => {
  const voices = toArray<RecordLike>(characterTable.value?.profileVoice);
  const groups = new Map<string, RecordLike[]>();
  voices.forEach((voice) => {
    const rawTitle = typeof voice.voiceTitle === 'string' ? voice.voiceTitle.trim() : 'Voice';
    const groupTitle = rawTitle.replace(/\d+$/, '').trim() || rawTitle;
    const bucket = groups.get(groupTitle) ?? [];
    bucket.push(voice);
    groups.set(groupTitle, bucket);
  });
  return Array.from(groups.entries()).map(([title, items]) => ({ title, items }));
});

const attributeStages = computed(() => {
  const grouped = new Map<number, RecordLike[]>();
  toArray<RecordLike>(characterTable.value?.attributes).forEach((entry) => {
    const breakStage = Number(entry.breakStage ?? 0);
    const bucket = grouped.get(breakStage) ?? [];
    bucket.push(entry);
    grouped.set(breakStage, bucket);
  });

  return Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([breakStage, entries]) => {
      const typeSet = new Set<string>();
      const rows: AttributeStageRow[] = [];
      entries.forEach((entry, index) => {
        const attrSource = isRecordLike(entry.Attribute) ? entry.Attribute.attrs : entry.attrs;
        const attrs = toArray<RecordLike>(attrSource);
        if (!attrs.length) return;
        let level: unknown = index + 1;
        const values: Record<string, unknown> = {};
        attrs.forEach((attr) => {
          if (attr.attrType === undefined || attr.attrValue === undefined) return;
          const type = toText(attr.attrType);
          if (!type) return;
          if (type === '0') {
            level = attr.attrValue;
            return;
          }
          values[type] = attr.attrValue;
          typeSet.add(type);
        });
        rows.push({ level, values });
      });
      rows.sort((a, b) => Number(a.level) - Number(b.level));
      return {
        breakStage,
        entries,
        rows,
        attrTypes: Array.from(typeSet).sort((a, b) => Number(a) - Number(b)),
      };
    })
    .filter((stage) => stage.rows.length > 0 && stage.attrTypes.length > 0);
});

const potentialBundles = computed(() =>
  toArray<RecordLike>(potentialTable.value.potentialUnlockBundle),
);

const growthNodes = computed(() =>
  Object.values(
    isRecordLike(growthTable.value.charBreakCostMap) ? growthTable.value.charBreakCostMap : {},
  ).filter((entry): entry is RecordLike => isRecordLike(entry)),
);

const skillGroups = computed(() => {
  const groupMap = isRecordLike(growthTable.value.skillGroupMap)
    ? growthTable.value.skillGroupMap
    : {};
  const levelUps = toArray<RecordLike>(growthTable.value.skillLevelUp);
  return Object.values(groupMap)
    .filter((entry): entry is RecordLike => isRecordLike(entry))
    .map((entry) => {
      const skillGroupId = typeof entry.skillGroupId === 'string' ? entry.skillGroupId : '';
      return {
        skillGroupId,
        name: typeof entry.name === 'string' ? entry.name : skillGroupId,
        desc: entry.desc,
        sortKey: Number(entry.skillGroupType ?? 999),
        levels: levelUps
          .filter((item) => item.skillGroupId === skillGroupId)
          .sort((a, b) => Number(a.level ?? 0) - Number(b.level ?? 0)),
      };
    })
    .sort((a, b) => a.sortKey - b.sortKey || a.name.localeCompare(b.name));
});

const potentialEffectEntries = computed(() =>
  Object.entries(potentialEffects.value)
    .map(([key, value]) => {
      const entry = isRecordLike(value) ? value : {};
      const title =
        typeof entry.name === 'string' && entry.name.trim().length > 0 ? entry.name : key;
      const candidate = toArray<RecordLike>(entry.candidates)[0];
      const description =
        entry.desc ?? entry.description ?? candidate?.description ?? candidate?.desc;
      return { key, title, description };
    })
    .filter((entry) => entry.description !== undefined && entry.description !== null),
);

const snapshotEntries = computed(() =>
  Object.values(isRecordLike(detail.value?.snapshots) ? detail.value?.snapshots : {}).filter(
    (entry): entry is RecordLike => isRecordLike(entry),
  ),
);

const rawJson = computed(() => JSON.stringify(payload.value, null, 2));
</script>

<style scoped>
.warfarin-operator-wiki__empty {
  color: rgba(0, 0, 0, 0.6);
}

.warfarin-operator-wiki__section {
  margin-bottom: 1.5rem;
}

.warfarin-operator-wiki__title {
  margin: 0 0 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  color: var(--q-primary);
  font-size: 1rem;
  font-weight: 600;
}

.warfarin-operator-wiki__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}

.warfarin-operator-wiki__card,
.warfarin-operator-wiki__panel,
.warfarin-operator-wiki__tag-box {
  background: rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
}

.warfarin-operator-wiki__card {
  padding: 1rem;
}

.warfarin-operator-wiki__card--media {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.warfarin-operator-wiki__image {
  width: 100%;
  border-radius: 6px;
  object-fit: cover;
}

.warfarin-operator-wiki__label,
.warfarin-operator-wiki__panel-sub {
  color: rgba(0, 0, 0, 0.6);
  font-size: 0.75rem;
}

.warfarin-operator-wiki__value,
.warfarin-operator-wiki__panel-title {
  font-size: 0.95rem;
  font-weight: 600;
}

.warfarin-operator-wiki__value--mono {
  font-family: Consolas, 'Courier New', monospace;
  word-break: break-all;
}

.warfarin-operator-wiki__tag-box,
.warfarin-operator-wiki__panel {
  padding: 0.9rem 1rem;
}

.warfarin-operator-wiki__tag-row + .warfarin-operator-wiki__tag-row,
.warfarin-operator-wiki__panel + .warfarin-operator-wiki__panel {
  margin-top: 0.75rem;
}

.warfarin-operator-wiki__tag-label {
  display: inline-block;
  min-width: 5rem;
  color: var(--q-primary);
  font-weight: 600;
}

.warfarin-operator-wiki__stack {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.warfarin-operator-wiki__stack--compact {
  gap: 0.75rem;
}

.warfarin-operator-wiki__prose {
  margin-top: 0.75rem;
  line-height: 1.65;
}

.warfarin-operator-wiki__prose--box {
  margin-top: 1rem;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 8px;
}

.warfarin-operator-wiki__prose--small {
  font-size: 0.875rem;
}

.warfarin-operator-wiki__muted-prose {
  margin-top: 0.5rem;
  color: rgba(0, 0, 0, 0.68);
  font-size: 0.85rem;
  line-height: 1.55;
}

.warfarin-operator-wiki__table-wrap {
  overflow: auto;
}

.warfarin-operator-wiki__table {
  width: 100%;
  border-collapse: collapse;
  background: white;
}

.warfarin-operator-wiki__table--wide {
  min-width: 720px;
}

.warfarin-operator-wiki__table th,
.warfarin-operator-wiki__table td {
  padding: 0.5rem 0.625rem;
  border: 1px solid rgba(0, 0, 0, 0.12);
  text-align: left;
  vertical-align: top;
}

.warfarin-operator-wiki__table th {
  position: sticky;
  top: 0;
  background: #f7f7f7;
  z-index: 1;
}

.warfarin-operator-wiki__attr-type {
  display: block;
  color: rgba(0, 0, 0, 0.45);
  font-size: 0.7rem;
  font-weight: 400;
}

.warfarin-operator-wiki__expansion {
  background: rgba(0, 0, 0, 0.02);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  margin-bottom: 0.75rem;
}

.warfarin-operator-wiki__raw {
  margin: 0;
  padding: 1rem;
  overflow: auto;
  background: #111827;
  color: #e5e7eb;
  border-radius: 8px;
  font-size: 0.75rem;
  line-height: 1.55;
}
</style>
