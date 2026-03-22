<template>
  <div class="jei-bottombar">
    <div class="row items-center q-gutter-sm">
      <q-select
        :model-value="activePackId"
        @update:model-value="$emit('update:active-pack-id', $event)"
        :options="packOptions"
        dense
        outlined
        emit-value
        map-options
        :disable="loading"
        style="min-width: 220px"
      />
      <q-input
        :model-value="filterText"
        @update:model-value="$emit('update:filter-text', String($event ?? ''))"
        dense
        outlined
        clearable
        :disable="filterDisabled"
        :placeholder="t('filterPlaceholder')"
        class="col"
      >
        <template #append>
          <q-btn
            flat
            round
            dense
            icon="sell"
            color="grey-7"
            @click="quickTagDialogOpen = true"
          />
          <q-icon
            v-if="filterText"
            name="filter_list"
            class="cursor-pointer"
            color="primary"
            @click="filterDialogOpen = true"
          />
          <q-btn
            v-else
            flat
            round
            dense
            icon="tune"
            color="grey-7"
            @click="filterDialogOpen = true"
          />
        </template>
      </q-input>
      <q-btn flat round icon="settings" @click="$emit('open-settings')" />
    </div>

    <!-- 过滤器对话框 -->
    <q-dialog v-model="filterDialogOpen" @show="populateFilterFormFromText">
      <q-card style="min-width: 400px; max-width: 500px">
        <q-card-section>
          <div class="text-h6">{{ t('advancedFilter') }}</div>
          <div class="text-caption text-grey-7 q-mt-xs">{{ t('filterHelp') }}</div>
          <div class="text-caption text-grey-7">{{ t('filterTagNote') }}</div>
          <q-btn-toggle
            v-model="filterMode"
            class="q-mt-sm"
            dense
            unelevated
            toggle-color="primary"
            :options="[
              { label: t('filterModeBuilder'), value: 'builder' },
              { label: t('filterModeExpression'), value: 'expression' },
            ]"
          />
        </q-card-section>

        <q-card-section v-if="filterMode === 'expression'" class="q-pt-none column q-gutter-sm">
          <q-input
            v-model="filterForm.expression"
            type="textarea"
            autogrow
            dense
            outlined
            clearable
            :label="t('filterExpressionLabel')"
            :placeholder="t('filterExpressionPlaceholder')"
          />
          <div class="text-caption text-grey-7">{{ t('filterExpressionHint') }}</div>
          <div class="row q-gutter-xs">
            <q-btn flat dense color="primary" label="(" @click="insertExpressionToken('()')" />
            <q-btn flat dense color="primary" label="|" @click="insertExpressionToken(' | ')" />
            <q-btn flat dense color="primary" label="!" @click="insertExpressionToken('!')" />
            <q-btn
              flat
              dense
              color="primary"
              :label="t('itemId')"
              @click="insertExpressionToken('@id:')"
            />
            <q-btn
              flat
              dense
              color="primary"
              :label="t('namespace')"
              @click="insertExpressionToken('@game:')"
            />
            <q-btn
              flat
              dense
              color="primary"
              :label="t('tags')"
              @click="insertExpressionToken('@tag:')"
            />
          </div>
        </q-card-section>

        <q-card-section v-else class="q-pt-none column q-gutter-sm">
          <div class="row items-center q-gutter-sm">
            <q-input
              v-model="filterForm.text"
              dense
              outlined
              clearable
              :label="t('itemName')"
              :placeholder="t('itemNamePlaceholder')"
              class="col"
            />
            <q-toggle v-model="filterForm.textNegated" :label="t('filterNegate')" dense />
          </div>
          <div class="row items-center q-gutter-sm">
            <q-select
              v-model="filterForm.itemId"
              :options="
                availableItemIdsFiltered.length > 0
                  ? availableItemIdsFiltered
                  : availableItemIds.slice(0, 50)
              "
              dense
              outlined
              clearable
              :label="t('itemId')"
              :placeholder="t('itemIdPlaceholder')"
              class="col"
              use-input
              input-debounce="0"
              :input-value="filterForm.itemId"
              @input-value="filterForm.itemId = $event"
              @filter="filterItemIds"
            />
            <q-toggle v-model="filterForm.itemIdNegated" :label="t('filterNegate')" dense />
          </div>
          <div class="row items-center q-gutter-sm">
            <q-select
              v-model="filterForm.gameId"
              :options="
                availableGameIdsFiltered.length > 0 ? availableGameIdsFiltered : availableGameIds
              "
              dense
              outlined
              clearable
              :label="t('namespace')"
              :placeholder="t('namespacePlaceholder')"
              class="col"
              use-input
              input-debounce="0"
              :input-value="filterForm.gameId"
              @input-value="filterForm.gameId = $event"
              @filter="filterGameIds"
            />
            <q-toggle v-model="filterForm.gameIdNegated" :label="t('filterNegate')" dense />
          </div>
          <div class="column q-gutter-xs">
            <div class="row items-center justify-between q-gutter-sm">
              <div class="text-subtitle2">{{ t('tags') }}</div>
              <div class="row items-center q-gutter-sm">
                <q-btn-toggle
                  v-model="filterForm.tagJoinMode"
                  dense
                  unelevated
                  toggle-color="primary"
                  :options="[
                    { label: t('filterTagModeOr'), value: 'or' },
                    { label: t('filterTagModeAnd'), value: 'and' },
                  ]"
                />
                <q-toggle v-model="filterForm.tagsNegated" :label="t('filterNegate')" dense />
              </div>
            </div>
            <div class="row q-gutter-sm items-center">
              <q-select
                v-for="(tag, idx) in filterForm.tags"
                :key="idx"
                :model-value="tag"
                :options="filteredTagsOptions"
                dense
                outlined
                clearable
                :label="t('tags')"
                :placeholder="t('tagPlaceholder')"
                class="col"
                use-input
                input-debounce="0"
                @input-value="filterForm.tags[idx] = $event"
                @filter="(val, upd) => filterTags(val, upd, idx)"
                @update:model-value="filterForm.tags[idx] = $event || ''"
              >
                <template #append>
                  <q-icon
                    name="close"
                    class="cursor-pointer"
                    @click="filterForm.tags.splice(idx, 1)"
                  />
                </template>
              </q-select>
              <q-btn
                flat
                round
                dense
                icon="add"
                color="primary"
                @click="filterForm.tags.push('')"
              />
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat :label="t('clear')" color="grey-7" @click="resetFilterForm" />
          <q-btn flat :label="t('cancel')" color="grey-7" v-close-popup />
          <q-btn flat :label="t('apply')" color="primary" @click="applyFilter" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- 快速标签对话框 -->
    <q-dialog v-model="quickTagDialogOpen">
      <q-card style="min-width: 400px; max-width: 500px">
        <q-card-section>
          <div class="text-h6">{{ t('quickTagFilter') }}</div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <div v-if="props.availableTags.length === 0" class="text-grey-7">{{ t('noOptions') }}</div>
          <div v-else class="row q-gutter-xs wrap">
            <q-chip
              v-for="tag in props.availableTags"
              :key="tag"
              color="secondary"
              text-color="white"
              clickable
              @click="applyQuickTag(tag)"
            >
              {{ tag }}
            </q-chip>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="t('clear')" color="grey-7" @click="clearQuickTag" />
          <q-btn flat :label="t('cancel')" color="grey-7" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

type PackOption = { label: string; value: string };

type ParsedSearch = {
  text: string[];
  itemId: string[];
  gameId: string[];
  tag: string[];
};

const props = defineProps<{
  activePackId: string;
  packOptions: PackOption[];
  filterText: string;
  filterDisabled: boolean;
  loading: boolean;
  availableItemIds: string[];
  availableGameIds: string[];
  availableTags: string[];
}>();

const emit = defineEmits<{
  'update:active-pack-id': [value: string];
  'update:filter-text': [value: string];
  'open-settings': [];
}>();

const filterDialogOpen = ref(false);
const quickTagDialogOpen = ref(false);
const filterMode = ref<'builder' | 'expression'>('builder');
const filterForm = ref({
  expression: '',
  text: '',
  textNegated: false,
  itemId: '',
  itemIdNegated: false,
  gameId: '',
  gameIdNegated: false,
  tags: [] as string[],
  tagsNegated: false,
  tagJoinMode: 'or' as 'and' | 'or',
});

const availableItemIdsFiltered = ref<string[]>([]);
const availableGameIdsFiltered = ref<string[]>([]);
const availableTagsFiltered = ref<string[]>([]);

const filteredTagsOptions = computed(() => {
  return availableTagsFiltered.value.length > 0
    ? availableTagsFiltered.value
    : props.availableTags.slice(0, 50);
});

function filterItemIds(val: string, update: (callback: () => void) => void) {
  if (val === '') {
    update(() => {
      availableItemIdsFiltered.value = props.availableItemIds.slice(0, 50);
    });
    return;
  }
  update(() => {
    const needle = val.toLowerCase();
    availableItemIdsFiltered.value = props.availableItemIds
      .filter((v) => v.toLowerCase().includes(needle))
      .slice(0, 50);
  });
}

function filterGameIds(val: string, update: (callback: () => void) => void) {
  if (val === '') {
    update(() => {
      availableGameIdsFiltered.value = props.availableGameIds;
    });
    return;
  }
  update(() => {
    const needle = val.toLowerCase();
    availableGameIdsFiltered.value = props.availableGameIds.filter((v) =>
      v.toLowerCase().includes(needle),
    );
  });
}

function filterTags(val: string, update: (callback: () => void) => void, idx: number) {
  if (val === '') {
    update(() => {
      const selected = new Set(filterForm.value.tags.filter((_, i) => i !== idx));
      availableTagsFiltered.value = props.availableTags
        .filter((t) => !selected.has(t))
        .slice(0, 50);
    });
    return;
  }
  update(() => {
    const needle = val.toLowerCase();
    const selected = new Set(filterForm.value.tags.filter((_, i) => i !== idx));
    availableTagsFiltered.value = props.availableTags
      .filter((v) => v.toLowerCase().includes(needle) && !selected.has(v))
      .slice(0, 50);
  });
}

function parseSearch(input: string): ParsedSearch {
  const normalized = input
    .replace(/[()]/g, ' ')
    .replace(/\|/g, ' ')
    .replace(/(^|\s)[!-](?=\S)/g, '$1');
  const tokens = normalized.trim().split(/\s+/).filter(Boolean);
  const out: ParsedSearch = { text: [], itemId: [], gameId: [], tag: [] };

  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (!t) continue;
    if (!t.startsWith('@')) {
      out.text.push(t.toLowerCase());
      continue;
    }

    const raw = t.slice(1);
    const [nameRaw, valueInline] = splitDirective(raw);
    const name = nameRaw.toLowerCase();
    let value: string | undefined = valueInline || undefined;

    const next = tokens[i + 1];
    if (!value && next && !next.startsWith('@')) {
      value = next;
      i += 1;
    }

    const v = (value ?? '').trim();

    if (name === 'itemid' || name === 'id') {
      if (!v) continue;
      out.itemId.push(v.toLowerCase());
    } else if (name === 'gameid' || name === 'game') {
      if (!v) continue;
      out.gameId.push(v.toLowerCase());
    } else if (name === 'tag' || name === 't') {
      if (!v) continue;
      out.tag.push(v.toLowerCase());
    } else {
      out.tag.push(raw.toLowerCase());
    }
  }

  return out;
}

function splitDirective(raw: string): [string, string] {
  const idx = raw.search(/[:=]/);
  if (idx < 0) return [raw, ''];
  return [raw.slice(0, idx), raw.slice(idx + 1)];
}

function populateFilterFormFromText() {
  const search = parseSearch(props.filterText);
  filterMode.value = hasComplexExpressionSyntax(props.filterText) ? 'expression' : 'builder';
  filterForm.value = {
    expression: props.filterText,
    text: search.text.join(' ') || '',
    textNegated: false,
    itemId: search.itemId.join(' ') || '',
    itemIdNegated: false,
    gameId: search.gameId.join(' ') || '',
    gameIdNegated: false,
    tags: [...search.tag],
    tagsNegated: false,
    tagJoinMode: props.filterText.includes('|') ? 'or' : 'and',
  };
}

function hasComplexExpressionSyntax(input: string): boolean {
  return /[()|]|(^|\s)[!-](?=\S)/.test(input);
}

function wrapExpression(expression: string, negated: boolean): string {
  const trimmed = expression.trim();
  if (!trimmed) return '';
  if (!negated) return trimmed;
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) return `!${trimmed}`;
  return `!(${trimmed})`;
}

function buildFilterExpression(): string {
  const f = filterForm.value;
  const parts: string[] = [];

  if (f.text.trim()) parts.push(wrapExpression(f.text.trim(), f.textNegated));
  if (f.itemId.trim()) parts.push(wrapExpression(`@id:${f.itemId.trim()}`, f.itemIdNegated));
  if (f.gameId.trim()) {
    parts.push(wrapExpression(`@game:${f.gameId.trim()}`, f.gameIdNegated));
  }

  const tagTerms = f.tags
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .map((tag) => `@tag:${tag}`);
  if (tagTerms.length === 1) {
    parts.push(wrapExpression(tagTerms[0]!, f.tagsNegated));
  } else if (tagTerms.length > 1) {
    const separator = f.tagJoinMode === 'or' ? ' | ' : ' ';
    parts.push(wrapExpression(`(${tagTerms.join(separator)})`, f.tagsNegated));
  }

  return parts.join(' ').trim();
}

function applyFilter() {
  const nextText =
    filterMode.value === 'expression'
      ? filterForm.value.expression.trim()
      : buildFilterExpression();
  emit('update:filter-text', nextText);
}

function resetFilterForm() {
  filterForm.value = {
    expression: '',
    text: '',
    textNegated: false,
    itemId: '',
    itemIdNegated: false,
    gameId: '',
    gameIdNegated: false,
    tags: [],
    tagsNegated: false,
    tagJoinMode: 'or',
  };
}

function insertExpressionToken(token: string) {
  if (token === '()') {
    filterForm.value.expression = `${filterForm.value.expression}()`.trim();
    return;
  }
  filterForm.value.expression = `${filterForm.value.expression}${token}`;
}

function applyQuickTag(tag: string) {
  emit('update:filter-text', `@tag:${tag}`);
  quickTagDialogOpen.value = false;
}

function clearQuickTag() {
  emit('update:filter-text', '');
  quickTagDialogOpen.value = false;
}
</script>

<style scoped>
.jei-bottombar {
  flex: 0 0 auto;
  z-index: 10;
  padding: 12px 16px;
  background: white;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

@media (max-width: 599px) {
  .jei-bottombar .row {
    flex-wrap: wrap;
  }
  .jei-bottombar .q-select {
    width: 100%;
    min-width: 0 !important;
    margin-bottom: 8px;
  }
}
</style>
