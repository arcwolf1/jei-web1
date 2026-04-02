<template>
  <div class="wiki-doc-view">
    <div v-if="inputSlotIds.length || outputSlotIds.length" class="wiki-doc-view__io">
      <q-card v-if="inputSlotIds.length" flat bordered class="wiki-doc-view__io-card">
        <div class="wiki-doc-view__io-title">{{ t('input') }}</div>
        <div class="wiki-doc-view__io-list">
          <stack-view
            v-for="slotId in inputSlotIds"
            :key="slotId"
            :content="recipe.slotContents[slotId]"
            :item-defs-by-key-hash="itemDefsByKeyHash"
            :show-subtitle="false"
            :lazy-visual="lazyVisual"
            @item-click="emit('item-click', $event)"
            @item-mouseenter="emit('item-mouseenter', $event)"
            @item-mouseleave="emit('item-mouseleave')"
            @item-context-menu="
              (evt: Event, keyHash: string) => emit('item-context-menu', evt, keyHash)
            "
            @item-touch-hold="
              (evt: unknown, keyHash: string) => emit('item-touch-hold', evt, keyHash)
            "
          />
        </div>
      </q-card>

      <q-card v-if="outputSlotIds.length" flat bordered class="wiki-doc-view__io-card">
        <div class="wiki-doc-view__io-title">{{ t('output') }}</div>
        <div class="wiki-doc-view__io-list">
          <stack-view
            v-for="slotId in outputSlotIds"
            :key="slotId"
            :content="recipe.slotContents[slotId]"
            :item-defs-by-key-hash="itemDefsByKeyHash"
            :show-subtitle="false"
            :lazy-visual="lazyVisual"
            @item-click="emit('item-click', $event)"
            @item-mouseenter="emit('item-mouseenter', $event)"
            @item-mouseleave="emit('item-mouseleave')"
            @item-context-menu="
              (evt: Event, keyHash: string) => emit('item-context-menu', evt, keyHash)
            "
            @item-touch-hold="
              (evt: unknown, keyHash: string) => emit('item-touch-hold', evt, keyHash)
            "
          />
        </div>
      </q-card>
    </div>

    <q-card flat bordered class="wiki-doc-view__doc">
      <div class="wiki-doc-view__title">{{ displayTitle }}</div>

      <div v-if="contextLine" class="wiki-doc-view__context">{{ contextLine }}</div>

      <WikiDocument v-if="wikiDocument" :document="wikiDocument" />
      <div
        v-else-if="renderedMarkdown"
        class="wiki-doc-view__markdown wiki-description"
        v-html="renderedMarkdown"
      ></div>
      <div
        v-else-if="htmlText"
        class="wiki-doc-view__markdown wiki-description"
        v-html="htmlText"
      ></div>
      <ul v-else-if="methods.length" class="wiki-doc-view__methods">
        <li v-for="(line, index) in methods" :key="index">{{ line }}</li>
      </ul>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import MarkdownIt from 'markdown-it';
import { useI18n } from 'vue-i18n';
import type { ItemDef, ItemKey, Recipe, RecipeTypeDef } from 'src/jei/types';
import type { Document } from 'src/types/wiki';
import StackView from './StackView.vue';
import WikiDocument from 'src/components/wiki/WikiDocument.vue';

const { t } = useI18n();

const props = defineProps<{
  recipe: Recipe;
  recipeType: RecipeTypeDef;
  itemDefsByKeyHash: Record<string, ItemDef>;
  lazyVisual?: boolean;
}>();

const emit = defineEmits<{
  (e: 'item-click', itemKey: ItemKey): void;
  (e: 'item-mouseenter', keyHash: string): void;
  (e: 'item-mouseleave'): void;
  (e: 'item-context-menu', evt: Event, keyHash: string): void;
  (e: 'item-touch-hold', evt: unknown, keyHash: string): void;
  (e: 'ensure-recipe-detail', recipeId: string): void;
}>();

function ensureRecipeDetailRequest() {
  if (props.recipe.detailLoaded) return;
  if (!props.recipe.detailPath) return;
  emit('ensure-recipe-detail', props.recipe.id);
}

onMounted(() => {
  ensureRecipeDetailRequest();
});

watch(
  () => [props.recipe.id, props.recipe.detailPath, props.recipe.detailLoaded] as const,
  () => {
    ensureRecipeDetailRequest();
  },
);

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

const params = computed<Record<string, unknown>>(() => {
  return isRecord(props.recipe.params) ? props.recipe.params : {};
});

const inputSlotIds = computed(() => {
  const fromType = (props.recipeType.slots || [])
    .filter((slot) => slot.io === 'input')
    .map((slot) => slot.slotId)
    .filter((slotId) => props.recipe.slotContents[slotId]);
  if (fromType.length) return fromType;
  return Object.keys(props.recipe.slotContents).filter((slotId) => slotId.startsWith('in'));
});

const outputSlotIds = computed(() => {
  const fromType = (props.recipeType.slots || [])
    .filter((slot) => slot.io === 'output')
    .map((slot) => slot.slotId)
    .filter((slotId) => props.recipe.slotContents[slotId]);
  if (fromType.length) return fromType;
  return Object.keys(props.recipe.slotContents).filter((slotId) => slotId.startsWith('out'));
});

const displayTitle = computed(() => {
  const title = params.value.title;
  if (typeof title === 'string' && title.trim()) return title.trim();
  const sectionType = params.value.sectionType;
  if (sectionType === 'usage') return t('usage');
  if (sectionType === 'acquisition') return t('acquisition');
  return props.recipeType.displayName || t('document');
});

const contextLine = computed(() => {
  const context = params.value.context;
  if (!isRecord(context)) return '';
  const parts = [
    asText(context.groupTitle),
    asText(context.widgetTitle),
    asText(context.panelTitle),
  ].filter(Boolean);
  return parts.join(' / ');
});

const methods = computed<string[]>(() => {
  const raw = params.value.methods;
  if (!Array.isArray(raw)) return [];
  return raw.map((line) => String(line || '').trim()).filter(Boolean);
});

const markdownText = computed(() => {
  const raw = params.value.markdown;
  return typeof raw === 'string' ? raw.trim() : '';
});

const htmlText = computed(() => {
  const raw = params.value.html;
  return typeof raw === 'string' ? raw.trim() : '';
});

const renderedMarkdown = computed(() => {
  if (!markdownText.value) return '';
  return md.render(markdownText.value);
});

const wikiDocument = computed<Document | null>(() => {
  const raw = params.value.wikiDoc;
  if (!isRecord(raw)) return null;
  if (!Array.isArray(raw.blockIds)) return null;
  if (!isRecord(raw.blockMap)) return null;
  return raw as unknown as Document;
});
</script>

<style scoped>
.wiki-doc-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.wiki-doc-view__io {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
}

.wiki-doc-view__io-card,
.wiki-doc-view__doc {
  padding: 12px;
}

.wiki-doc-view__io-title {
  font-size: 12px;
  opacity: 0.8;
  margin-bottom: 8px;
  font-weight: 600;
}

.wiki-doc-view__io-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wiki-doc-view__title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 6px;
}

.wiki-doc-view__context {
  font-size: 12px;
  opacity: 0.7;
  margin-bottom: 10px;
}

.wiki-doc-view__methods {
  margin: 0;
  padding-left: 1.2em;
}

.wiki-doc-view__markdown :deep(p),
.wiki-doc-view__markdown :deep(ul),
.wiki-doc-view__markdown :deep(ol),
.wiki-doc-view__markdown :deep(table),
.wiki-doc-view__markdown :deep(blockquote) {
  margin-bottom: 0.75em;
}

.wiki-doc-view__markdown :deep(table) {
  border-collapse: collapse;
  width: 100%;
}

.wiki-doc-view__markdown :deep(th),
.wiki-doc-view__markdown :deep(td) {
  border: 1px solid rgba(0, 0, 0, 0.12);
  padding: 0.4em 0.5em;
}
</style>
