<template>
  <div class="ww__raw-viewer">
    <div class="ww__raw-toolbar">
      <q-input
        v-model="query"
        dense
        outlined
        clearable
        class="ww__raw-search"
        :placeholder="t('warfarin.common.rawSearch')"
        @keyup.enter="focusNextMatch"
      >
        <template #prepend>
          <q-icon name="search" />
        </template>
      </q-input>

      <div v-if="query" class="ww__raw-search-meta">
        {{
          matchCount > 0
            ? t('warfarin.common.rawMatchCount', { current: activeMatchIndex + 1, total: matchCount })
            : t('warfarin.common.rawNoMatch')
        }}
      </div>

      <div class="ww__raw-toolbar-actions">
        <q-btn
          flat
          dense
          icon="keyboard_arrow_up"
          :disable="matchCount <= 1"
          :aria-label="t('warfarin.common.rawPrevious')"
          @click="focusPreviousMatch"
        />
        <q-btn
          flat
          dense
          icon="keyboard_arrow_down"
          :disable="matchCount <= 1"
          :aria-label="t('warfarin.common.rawNext')"
          @click="focusNextMatch"
        />
        <q-btn
          outline
          dense
          icon="content_copy"
          :label="t('warfarin.common.rawCopyAll')"
          @click="copyAll"
        />
      </div>
    </div>

    <div ref="rawContainerRef" class="ww__raw-shell">
      <pre class="ww__raw" v-html="highlightedHtml"></pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ value: unknown }>();

const $q = useQuasar();
const { t } = useI18n();

const query = ref('');
const activeMatchIndex = ref(0);
const rawContainerRef = ref<HTMLElement | null>(null);

const formatted = computed(() => {
  const json = JSON.stringify(props.value, null, 2);
  if (json !== undefined) return json;
  if (typeof props.value === 'string') return props.value;
  if (
    typeof props.value === 'number' ||
    typeof props.value === 'boolean' ||
    typeof props.value === 'bigint'
  ) {
    return String(props.value);
  }
  return '';
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const matchCount = computed(() => {
  const trimmed = query.value.trim();
  if (!trimmed) return 0;
  const matches = formatted.value.match(new RegExp(escapeRegex(trimmed), 'gi'));
  return matches?.length ?? 0;
});

const highlightedHtml = computed(() => {
  const raw = formatted.value;
  const trimmed = query.value.trim();
  if (!trimmed) return escapeHtml(raw);

  const matcher = new RegExp(escapeRegex(trimmed), 'gi');
  let matchIndex = 0;
  let cursor = 0;
  let html = '';

  for (const match of raw.matchAll(matcher)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    html += escapeHtml(raw.slice(cursor, start));
    html += `<mark class="ww__raw-hit${matchIndex === activeMatchIndex.value ? ' is-active' : ''}">${escapeHtml(match[0])}</mark>`;
    cursor = end;
    matchIndex += 1;
  }

  html += escapeHtml(raw.slice(cursor));
  return html;
});

function clampActiveMatchIndex(): void {
  if (matchCount.value <= 0) {
    activeMatchIndex.value = 0;
    return;
  }
  if (activeMatchIndex.value >= matchCount.value) {
    activeMatchIndex.value = matchCount.value - 1;
  }
}

function scrollActiveMatchIntoView(): void {
  const hits = rawContainerRef.value?.querySelectorAll<HTMLElement>('.ww__raw-hit');
  if (!hits?.length) return;
  const target = hits[activeMatchIndex.value];
  target?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
}

function focusPreviousMatch(): void {
  if (matchCount.value <= 1) return;
  activeMatchIndex.value =
    (activeMatchIndex.value - 1 + matchCount.value) % matchCount.value;
}

function focusNextMatch(): void {
  if (matchCount.value <= 1) return;
  activeMatchIndex.value = (activeMatchIndex.value + 1) % matchCount.value;
}

async function copyAll(): Promise<void> {
  const text = formatted.value;
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    window.prompt(t('warfarin.common.rawCopyAll'), text);
    return;
  }
  $q.notify({
    type: 'positive',
    message: t('warfarin.common.rawCopied'),
  });
}

watch(query, () => {
  activeMatchIndex.value = 0;
});

watch([query, activeMatchIndex], async () => {
  clampActiveMatchIndex();
  await nextTick();
  scrollActiveMatchIntoView();
});
</script>

<style scoped>
.ww__raw-viewer {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
}

.ww__raw-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.ww__raw-search {
  flex: 1 1 280px;
  min-width: 220px;
}

.ww__raw-search-meta {
  color: var(--ww-muted);
  font-size: 0.8rem;
  white-space: nowrap;
}

.ww__raw-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-left: auto;
}

.ww__raw-shell {
  min-width: 0;
  border: 1px solid var(--ww-border);
  border-radius: 10px;
  overflow: auto;
  background: var(--ww-raw-bg);
}

.ww__raw {
  min-width: max-content;
  overflow: visible;
}

.ww__raw :deep(.ww__raw-hit) {
  padding: 0 0.12rem;
  border-radius: 3px;
  background: rgba(250, 204, 21, 0.28);
  color: inherit;
}

.ww__raw :deep(.ww__raw-hit.is-active) {
  background: rgba(245, 158, 11, 0.62);
}

@media (max-width: 720px) {
  .ww__raw-toolbar-actions {
    width: 100%;
    margin-left: 0;
    justify-content: flex-end;
  }
}
</style>
