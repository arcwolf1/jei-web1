<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="text-h4">Items</div>
      <q-space />
      <q-btn color="primary" icon="add" label="Add Item" @click="openDialog()" />
    </div>

    <q-table
      :rows="filteredItems"
      :columns="columns"
      row-key="key.id"
      :pagination="{ rowsPerPage: 20 }"
    >
      <template v-slot:top-right>
        <q-input
          v-model="filterText"
          dense
          outlined
          clearable
          :placeholder="t('filterPlaceholder')"
          style="min-width: 320px"
        >
          <template #append>
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
      </template>

      <template v-slot:body-cell-icon="props">
        <q-td :props="props">
          <div v-if="props.row.iconSprite" :style="getSpriteStyle(props.row.iconSprite)"></div>
          <q-img
            v-else-if="props.row.icon"
            :src="props.row.icon"
            style="width: 32px; height: 32px"
            fit="contain"
          />
          <q-icon v-else name="image_not_supported" size="32px" color="grey" />
        </q-td>
      </template>

      <template v-slot:body-cell-tags="props">
        <q-td :props="props">
          <q-chip
            v-for="(tag, idx) in props.row.tags ?? []"
            :key="`${tag}:${idx}`"
            dense
            size="sm"
            color="secondary"
            text-color="white"
          >
            {{ tag }}
          </q-chip>
        </q-td>
      </template>

      <template v-slot:body-cell-actions="props">
        <q-td :props="props" auto-width>
          <q-btn
            flat
            round
            dense
            color="primary"
            icon="edit"
            @click="openDialog(props.row, props.rowIndex)"
          />
          <q-btn
            flat
            round
            dense
            color="negative"
            icon="delete"
            @click="deleteItem(props.rowIndex)"
          />
        </q-td>
      </template>
    </q-table>

    <q-dialog v-model="filterDialogOpen">
      <q-card style="min-width: 400px; max-width: 500px">
        <q-card-section>
          <div class="text-h6">{{ t('advancedFilter') }}</div>
          <div class="text-caption text-grey-7 q-mt-xs">{{ t('filterHelp') }}</div>
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

    <q-dialog v-model="dialogOpen">
      <q-card style="min-width: 500px">
        <q-card-section>
          <div class="text-h6">{{ isEdit ? 'Edit Item' : 'Add Item' }}</div>
        </q-card-section>

        <q-card-section class="q-gutter-md">
          <q-input
            v-model="currentItem.key.id"
            label="ID"
            :readonly="isEdit"
            :rules="[(val) => !!val || 'Field is required']"
          />
          <q-input v-model="currentItem.name" label="Name" />
          <q-input v-model="currentItem.icon" label="Icon URL (Fallback)" />

          <div class="text-subtitle2">Icon Sprite</div>
          <div class="row q-col-gutter-sm">
            <div class="col-12">
              <q-toggle v-model="hasSprite" label="Enable Sprite" />
            </div>
            <template v-if="hasSprite">
              <div class="col-12">
                <q-input v-model="currentItem.iconSprite!.url" label="Sprite URL" />
              </div>
              <div class="col-6">
                <q-input
                  v-model="currentItem.iconSprite!.position"
                  label="Position (e.g. -10px -20px)"
                />
              </div>
              <div class="col-3">
                <q-input
                  v-model.number="currentItem.iconSprite!.size"
                  type="number"
                  label="Size (px)"
                />
              </div>
              <div class="col-3">
                <q-input v-model="currentItem.iconSprite!.color" label="Color" />
              </div>
              <div class="col-12 flex flex-center q-pa-sm bg-grey-3">
                <div :style="getSpriteStyle(currentItem.iconSprite!)"></div>
              </div>
            </template>
          </div>

          <q-select
            v-model="currentItem.tags"
            label="Tags"
            use-input
            use-chips
            multiple
            hide-dropdown-icon
            input-debounce="0"
            @new-value="createTag"
          />

          <q-input v-model="currentItem.description" label="Description" type="textarea" />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="primary" v-close-popup />
          <q-btn flat label="Save" color="primary" @click="saveItem" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useEditorStore } from 'src/stores/editor';
import type { ItemDef } from 'src/jei/types';
import { useQuasar } from 'quasar';
import type { QTableColumn } from 'quasar';
import { buildTagIndex } from 'src/jei/tags/resolve';
import { pinyin } from 'pinyin-pro';
import {
  evaluateSearchExpression,
  parseSearchExpression,
  type SearchTerm,
} from 'src/utils/searchExpression';

const { t } = useI18n();
const store = useEditorStore();
const $q = useQuasar();

const filterText = ref('');
const filterDialogOpen = ref(false);
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

const dialogOpen = ref(false);
const isEdit = ref(false);
const editIndex = ref(-1);
const hasSprite = ref(false);

const defaultItem: ItemDef = {
  key: { id: '' },
  name: '',
  tags: [],
};

const currentItem = ref<ItemDef>(JSON.parse(JSON.stringify(defaultItem)));

const columns: QTableColumn[] = [
  { name: 'icon', label: 'Icon', field: 'icon', align: 'center' },
  { name: 'id', label: 'ID', field: (row: ItemDef) => row.key.id, align: 'left', sortable: true },
  { name: 'name', label: 'Name', field: 'name', align: 'left', sortable: true },
  { name: 'tags', label: 'Tags', field: 'tags', align: 'left' },
  { name: 'actions', label: 'Actions', field: 'actions', align: 'right' },
];

type ParsedSearch = {
  text: string[];
  itemId: string[];
  gameId: string[];
  tag: string[];
};

const tagIndex = computed(() => buildTagIndex(store.exportPack()));

const parsedSearchExpression = computed(() => parseSearchExpression(filterText.value));
const parsedSearch = computed<ParsedSearch>(() => parseSearch(filterText.value));

type NameSearchKeys = {
  nameLower: string;
  pinyinFull: string;
  pinyinFirst: string;
};

function normalizePinyinQuery(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function buildNameSearchKeys(name: string): NameSearchKeys {
  const nameLower = (name ?? '').toLowerCase();
  try {
    const pinyinFull = normalizePinyinQuery(
      pinyin(name ?? '', { toneType: 'none', nonZh: 'consecutive' }),
    );
    const pinyinFirst = normalizePinyinQuery(
      pinyin(name ?? '', { toneType: 'none', pattern: 'first', nonZh: 'consecutive' }),
    );
    return { nameLower, pinyinFull, pinyinFirst };
  } catch {
    return { nameLower, pinyinFull: '', pinyinFirst: '' };
  }
}

const nameSearchKeysByItemId = computed(() => {
  const out = new Map<string, NameSearchKeys>();
  for (const def of store.items) {
    out.set(def.key.id, buildNameSearchKeys(def.name ?? ''));
  }
  return out;
});

const availableTags = computed(() => {
  const tags = new Set<string>();
  for (const tagIds of tagIndex.value.tagIdsByItemId.values()) {
    for (const tag of tagIds) tags.add(tag);
  }
  return Array.from(tags).sort();
});

const availableItemIds = computed(() => {
  const ids = new Set<string>();
  store.items.forEach((def) => ids.add(def.key.id));
  return Array.from(ids).sort();
});

const availableGameIds = computed(() => {
  const namespaces = new Set<string>();
  for (const id of availableItemIds.value) {
    const parts = id.includes(':') ? id.split(':') : id.split('.');
    const ns = parts[0];
    if (ns) namespaces.add(ns);
  }
  return Array.from(namespaces).sort();
});

const filteredItems = computed(() => {
  const searchExpression = parsedSearchExpression.value;
  const keysByItemId = nameSearchKeysByItemId.value;
  const filtered = store.items.filter((def) =>
    matchesSearch(def, searchExpression, keysByItemId.get(def.key.id)),
  );
  filtered.sort((a, b) => a.name.localeCompare(b.name));
  return filtered;
});

function applyFilter() {
  filterText.value =
    filterMode.value === 'expression'
      ? filterForm.value.expression.trim()
      : buildFilterExpression();
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

function populateFilterFormFromText() {
  const search = parsedSearch.value;
  filterMode.value = hasComplexExpressionSyntax(filterText.value) ? 'expression' : 'builder';
  filterForm.value = {
    expression: filterText.value,
    text: search.text.join(' ') || '',
    textNegated: false,
    itemId: search.itemId.join(' ') || '',
    itemIdNegated: false,
    gameId: search.gameId.join(' ') || '',
    gameIdNegated: false,
    tags: [...search.tag],
    tagsNegated: false,
    tagJoinMode: filterText.value.includes('|') ? 'or' : 'and',
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

function insertExpressionToken(token: string) {
  if (token === '()') {
    filterForm.value.expression = `${filterForm.value.expression}()`.trim();
    return;
  }
  filterForm.value.expression = `${filterForm.value.expression}${token}`;
}

watch(filterDialogOpen, (isOpen) => {
  if (isOpen) populateFilterFormFromText();
});

const availableItemIdsFiltered = ref<string[]>([]);
const availableGameIdsFiltered = ref<string[]>([]);
const availableTagsFiltered = ref<string[]>([]);

function filterItemIds(val: string, update: (callback: () => void) => void) {
  if (val === '') {
    update(() => {
      availableItemIdsFiltered.value = availableItemIds.value.slice(0, 50);
    });
    return;
  }
  update(() => {
    const needle = val.toLowerCase();
    availableItemIdsFiltered.value = availableItemIds.value
      .filter((v) => v.toLowerCase().includes(needle))
      .slice(0, 50);
  });
}

function filterGameIds(val: string, update: (callback: () => void) => void) {
  if (val === '') {
    update(() => {
      availableGameIdsFiltered.value = availableGameIds.value;
    });
    return;
  }
  update(() => {
    const needle = val.toLowerCase();
    availableGameIdsFiltered.value = availableGameIds.value.filter((v) =>
      v.toLowerCase().includes(needle),
    );
  });
}

function filterTags(val: string, update: (callback: () => void) => void, idx: number) {
  if (val === '') {
    update(() => {
      const selected = new Set(filterForm.value.tags.filter((_, i) => i !== idx));
      availableTagsFiltered.value = availableTags.value
        .filter((t) => !selected.has(t))
        .slice(0, 50);
    });
    return;
  }
  update(() => {
    const needle = val.toLowerCase();
    const selected = new Set(filterForm.value.tags.filter((_, i) => i !== idx));
    availableTagsFiltered.value = availableTags.value
      .filter((v) => v.toLowerCase().includes(needle) && !selected.has(v))
      .slice(0, 50);
  });
}

const filteredTagsOptions = computed(() => {
  return availableTagsFiltered.value.length > 0
    ? availableTagsFiltered.value
    : availableTags.value.slice(0, 50);
});

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

function matchesSearch(
  def: ItemDef,
  searchExpression: ReturnType<typeof parseSearchExpression>,
  nameKeys?: NameSearchKeys,
): boolean {
  const name = nameKeys?.nameLower ?? (def.name ?? '').toLowerCase();
  const pinyinFull = nameKeys?.pinyinFull ?? '';
  const pinyinFirst = nameKeys?.pinyinFirst ?? '';
  const id = def.key.id.toLowerCase();
  const gameId = (id.includes(':') ? id.split(':')[0] : id.split('.')[0]) ?? '';
  const tags = tagIndex.value.tagIdsByItemId.get(def.key.id);

  const tagMatches = (term: string): boolean => {
    if (!tags) return false;
    return Array.from(tags).some((tagId) => tagId.toLowerCase().includes(term));
  };

  const matchesTerm = (term: SearchTerm): boolean => {
    switch (term.field) {
      case 'text': {
        if (name.includes(term.value)) return true;
        const q = normalizePinyinQuery(term.value);
        if (q && (pinyinFull.includes(q) || pinyinFirst.includes(q))) return true;
        if (id.includes(term.value)) return true;
        if (tagMatches(term.value)) return true;
        return false;
      }
      case 'itemId':
        return id.includes(term.value);
      case 'gameId':
        return gameId.includes(term.value);
      case 'tag':
        return tagMatches(term.value);
    }
  };

  return evaluateSearchExpression(searchExpression, matchesTerm);
}

watch(hasSprite, (val) => {
  if (val && !currentItem.value.iconSprite) {
    currentItem.value.iconSprite = {
      url: '',
      position: '0 0',
      size: 32,
    };
  } else if (!val) {
    delete currentItem.value.iconSprite;
  }
});

function openDialog(item?: ItemDef, index?: number) {
  if (item && index !== undefined) {
    isEdit.value = true;
    editIndex.value = index;
    currentItem.value = JSON.parse(JSON.stringify(item));
    hasSprite.value = !!currentItem.value.iconSprite;
  } else {
    isEdit.value = false;
    editIndex.value = -1;
    currentItem.value = JSON.parse(JSON.stringify(defaultItem));
    hasSprite.value = false;
  }
  dialogOpen.value = true;
}

function createTag(
  val: string,
  done: (item: string, mode: 'add' | 'add-unique' | 'toggle') => void,
) {
  if (val.length > 0) {
    done(val, 'add-unique');
  }
}

function saveItem() {
  if (!currentItem.value.key.id) {
    $q.notify({ type: 'warning', message: 'ID is required' });
    return;
  }

  if (isEdit.value) {
    store.updateItem(editIndex.value, currentItem.value);
  } else {
    // Check for duplicate ID
    if (store.items.some((i) => i.key.id === currentItem.value.key.id)) {
      $q.notify({ type: 'negative', message: 'Item ID already exists' });
      return;
    }
    store.addItem(currentItem.value);
  }
  dialogOpen.value = false;
}

function deleteItem(index: number) {
  $q.dialog({
    title: 'Confirm',
    message: 'Are you sure you want to delete this item?',
    cancel: true,
    persistent: true,
  }).onOk(() => {
    store.deleteItem(index);
  });
}

function getSpriteStyle(sprite: NonNullable<ItemDef['iconSprite']>) {
  const size = sprite.size || 32;
  return {
    width: `${size}px`,
    height: `${size}px`,
    backgroundImage: `url(${sprite.url})`,
    backgroundPosition: sprite.position,
    backgroundColor: sprite.color || 'transparent',
    backgroundRepeat: 'no-repeat',
    display: 'inline-block',
  };
}
</script>
