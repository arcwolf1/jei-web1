<template>
  <q-card flat bordered>
    <q-card-section>
      <div class="text-subtitle2 q-mb-sm">语言设置</div>
      <q-select
        dense
        outlined
        emit-value
        map-options
        label="界面语言 / Language"
        :options="languageOptions"
        :model-value="currentLanguage"
        @update:model-value="$emit('update:language', $event as Language)"
      />
    </q-card-section>
  </q-card>

  <q-card flat bordered>
    <q-card-section>
      <div class="text-subtitle2 q-mb-sm">i18n 覆盖率</div>
      <div class="q-gutter-y-xs text-body2">
        <div>
          总物品数: <b>{{ totalItems }}</b>
        </div>
        <div v-for="loc in localeStats" :key="loc.locale">
          <q-chip
            dense
            :color="loc.count > 0 ? (loc.count === totalItems ? 'positive' : 'warning') : 'grey'"
            text-color="white"
            size="sm"
          >
            {{ loc.locale }}
          </q-chip>
          {{ loc.count }} / {{ totalItems }} ({{ loc.pct }}%)
          <q-linear-progress
            :value="loc.count / Math.max(totalItems, 1)"
            :color="loc.count === totalItems ? 'positive' : 'warning'"
            class="q-mt-xs"
            style="max-width: 200px"
          />
        </div>
        <div v-if="localeStats.length === 0" class="text-grey">当前包不含 i18n 数据</div>
      </div>
    </q-card-section>
  </q-card>

  <q-card flat bordered>
    <q-card-section>
      <div class="row items-center q-gutter-sm q-mb-sm">
        <div class="text-subtitle2">物品 i18n 浏览</div>
        <q-input
          v-model="filterText"
          dense
          outlined
          clearable
          placeholder="搜索物品名称..."
          style="width: 200px"
        />
        <q-select
          v-model="filterMode"
          dense
          outlined
          emit-value
          map-options
          style="width: 140px"
          :options="[
            { label: '全部', value: 'all' },
            { label: '有 i18n', value: 'has' },
            { label: '无 i18n', value: 'none' },
          ]"
        />
      </div>
      <q-list dense separator bordered style="max-height: 300px" class="scroll">
        <q-item
          v-for="item in filteredItems"
          :key="item.key.id"
          clickable
          :active="selectedItemId === item.key.id"
          @click="selectedItemId = item.key.id"
        >
          <q-item-section>
            <q-item-label>{{ item.name }}</q-item-label>
            <q-item-label caption>{{ item.key.id }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-chip
              dense
              size="sm"
              :color="itemHasI18n(item) ? 'primary' : 'grey'"
              text-color="white"
            >
              {{ itemI18nLocales(item).join(', ') || 'none' }}
            </q-chip>
          </q-item-section>
        </q-item>
        <q-item v-if="filteredItems.length === 0">
          <q-item-section class="text-grey">没有匹配的物品</q-item-section>
        </q-item>
      </q-list>
    </q-card-section>
  </q-card>

  <q-card v-if="selectedItem" flat bordered>
    <q-card-section>
      <div class="text-subtitle2 q-mb-sm">i18n 对比: {{ selectedItem.name }}</div>
      <div class="row q-gutter-md">
        <div v-for="entry in selectedItemI18nEntries" :key="entry.locale" class="col">
          <div class="text-caption text-bold q-mb-xs">{{ entry.locale }}</div>
          <q-separator class="q-mb-xs" />
          <div class="text-body2">
            <div><b>name:</b> {{ entry.data.name }}</div>
            <div v-if="entry.data.description">
              <b>description:</b>
              <div class="text-caption q-pl-sm" style="white-space: pre-wrap">
                {{ entry.data.description }}
              </div>
            </div>
            <div v-if="entry.data.wiki">
              <b>wiki:</b>
              <q-chip dense size="sm" color="info" text-color="white">
                {{ (entry.data.wiki as any)?.format ?? 'unknown' }}
              </q-chip>
            </div>
          </div>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ItemDef } from 'src/jei/types';
import type { Language } from 'src/stores/settings';

const props = defineProps<{
  items: ItemDef[];
  currentLanguage: Language;
}>();

defineEmits<{
  'update:language': [value: Language];
}>();

const languageOptions = [
  { label: '简体中文', value: 'zh-CN' as Language },
  { label: 'English', value: 'en-US' as Language },
  { label: '日本語', value: 'ja-JP' as Language },
];

const filterText = ref('');
const filterMode = ref<'all' | 'has' | 'none'>('all');
const selectedItemId = ref<string | null>(null);

const totalItems = computed(() => props.items.length);

function itemI18nLocales(item: ItemDef): string[] {
  const i18n = item.extensions?.jeiweb?.i18n;
  return i18n ? Object.keys(i18n) : [];
}

function itemHasI18n(item: ItemDef): boolean {
  return itemI18nLocales(item).length > 0;
}

const localeStats = computed(() => {
  const counts: Record<string, number> = {};
  for (const item of props.items) {
    for (const loc of itemI18nLocales(item)) {
      counts[loc] = (counts[loc] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([locale, count]) => ({
      locale,
      count,
      pct: totalItems.value > 0 ? Math.round((count / totalItems.value) * 100) : 0,
    }));
});

const filteredItems = computed(() => {
  const text = filterText.value.trim().toLowerCase();
  return props.items.filter((item) => {
    if (filterMode.value === 'has' && !itemHasI18n(item)) return false;
    if (filterMode.value === 'none' && itemHasI18n(item)) return false;
    if (text) {
      const name = (item.name ?? '').toLowerCase();
      const id = (item.key.id ?? '').toLowerCase();
      if (!name.includes(text) && !id.includes(text)) return false;
    }
    return true;
  });
});

const selectedItem = computed(() => {
  if (!selectedItemId.value) return null;
  return props.items.find((it) => it.key.id === selectedItemId.value) ?? null;
});

const selectedItemI18nEntries = computed(() => {
  const item = selectedItem.value;
  if (!item) return [];
  const i18n = item.extensions?.jeiweb?.i18n;
  if (!i18n) return [];
  return Object.entries(i18n).map(([locale, data]) => ({ locale, data }));
});
</script>
