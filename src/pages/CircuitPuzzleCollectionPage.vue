<template>
  <q-page
    :class="['collection-page', isDark ? 'collection-page--dark' : 'collection-page--light']"
    :style="pageStyle"
  >
    <div class="collection-shell">
      <section class="collection-head">
        <h1>{{ t('circuitPuzzleCollection') }}</h1>
        <p class="collection-tip">
          {{ t('circuitPuzzleDirTip') }}
        </p>
        <div class="head-actions">
          <button type="button" class="collection-btn" @click="reloadIndex">
            {{ t('reloadIndex') }}
          </button>
          <label class="search-box">
            <span>{{ t('levelSearch') }}</span>
            <input
              v-model.trim="searchKeyword"
              type="text"
              :placeholder="t('levelSearchPlaceholder')"
            />
          </label>
          <label class="preview-toggle">
            <input
              type="checkbox"
              :checked="settingsStore.circuitCollectionPreviewShowPieces"
              @change="onPreviewToggleChange"
            />
            <span>{{ t('previewShowPieces') }}</span>
          </label>
        </div>
      </section>

      <div v-if="indexLoading" class="state-card">{{ t('loadingIndex') }}</div>
      <div v-else-if="indexError" class="state-card state-card--error">{{ indexError }}</div>

      <div v-else class="collection-grid">
        <aside class="entry-list-panel">
          <h2>{{ collectionIndex?.title ?? t('puzzleList') }}</h2>
          <div class="entry-list-body">
            <div v-if="!entries.length" class="empty-text">
              {{ t('indexEmpty') }}
            </div>
            <div v-else-if="!visibleEntries.length" class="empty-text">
              {{ t('noMatch') }}
            </div>
            <button
              v-for="entry in visibleEntries"
              :key="entry.id"
              type="button"
              class="entry-btn"
              :class="{ 'entry-btn--active': selectedEntryId === entry.id }"
              @click="selectEntry(entry.id)"
            >
              <div class="entry-title">{{ entry.title }}</div>
              <div class="entry-meta">
                <span>{{ entry.id }}</span>
                <span v-if="entry.difficulty">{{ t('difficulty') }}: {{ entry.difficulty }}</span>
                <span v-if="entry.author">{{ t('author') }}: {{ entry.author }}</span>
              </div>
              <div v-if="entry.tags.length" class="entry-tags">
                <span v-for="tag in entry.tags" :key="`${entry.id}-${tag}`" class="tag-chip">{{
                  tag
                }}</span>
              </div>
              <div class="entry-preview-wrap">
                <div
                  v-if="entry.id in previewErrorById"
                  class="entry-preview-tip entry-preview-tip--error"
                >
                  {{ t('previewLoadFailed') }}
                </div>
                <div v-else-if="previewLoadingById[entry.id]" class="entry-preview-tip">
                  {{ t('previewLoading') }}
                </div>
                <div
                  v-else-if="entry.id in previewById"
                  class="entry-preview-board"
                  :style="previewBoardStyle(entry.id)"
                >
                  <div class="entry-preview-top">
                    <span class="entry-preview-score entry-preview-score--corner" />
                    <span
                      v-for="(score, idx) in previewColTargets(entry.id)"
                      :key="`${entry.id}-col-${idx}`"
                      class="entry-preview-score"
                      >{{ formatScore(score) }}</span
                    >
                  </div>
                  <div class="entry-preview-body">
                    <div
                      v-for="row in previewRows(entry.id)"
                      :key="`${entry.id}-row-${row.y}`"
                      class="entry-preview-row"
                    >
                      <span class="entry-preview-score">{{ formatScore(row.targetScore) }}</span>
                      <span
                        v-for="cell in row.cells"
                        :key="cell.key"
                        class="entry-preview-cell"
                        :class="{
                          'entry-preview-cell--blocked': cell.blocked,
                          'entry-preview-cell--piece': !!cell.pieceColor,
                        }"
                        :style="previewCellStyle(cell)"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </button>
          </div>
        </aside>

        <main class="entry-detail-panel">
          <div class="entry-detail-body">
            <div v-if="!selectedEntry" class="state-card">{{ t('selectPuzzle') }}</div>

            <template v-else>
              <header class="detail-head">
                <div>
                  <h2>{{ selectedEntry.title }}</h2>
                  <p class="collection-tip">id: {{ selectedEntry.id }}</p>
                </div>
                <div class="head-actions">
                  <button
                    type="button"
                    class="collection-btn"
                    :disabled="!loadedLevel"
                    @click="openInPuzzle('play')"
                  >
                    {{ t('openInPlay') }}
                  </button>
                  <button
                    type="button"
                    class="collection-btn"
                    :disabled="!loadedLevel"
                    @click="openInPuzzle('editor')"
                  >
                    {{ t('openInEditor') }}
                  </button>
                </div>
              </header>

              <section class="asset-card">
                <div>
                  <strong>JSON:</strong>
                  <a :href="resolvedJsonPath" target="_blank" rel="noreferrer">{{
                    resolvedJsonPath
                  }}</a>
                </div>
                <div v-if="resolvedMarkdownPath">
                  <strong>Markdown:</strong>
                  <a :href="resolvedMarkdownPath" target="_blank" rel="noreferrer">{{
                    resolvedMarkdownPath
                  }}</a>
                </div>
              </section>

              <div v-if="entryLoading" class="state-card">{{ t('loadingPuzzle') }}</div>
              <div v-else-if="entryError" class="state-card state-card--error">
                {{ entryError }}
              </div>

              <template v-else>
                <section class="markdown-card">
                  <h3>{{ t('puzzleDescription') }}</h3>
                  <div class="doc-md" v-html="renderedMarkdown"></div>
                </section>

                <section class="markdown-card">
                  <details class="json-details">
                    <summary>{{ t('levelJsonPreview') }}</summary>
                    <pre class="json-preview">{{ levelJsonPreview }}</pre>
                  </details>
                </section>
              </template>
            </template>
          </div>
        </main>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import MarkdownIt from 'markdown-it';
import {
  parseCollectionIndex,
  resolveCollectionAssetPath,
  type PuzzleCollectionEntry,
  type PuzzleCollectionIndex,
} from 'src/components/circuit-puzzle/collection-index';
import { solveLevel } from 'src/components/circuit-puzzle/auto-solver';
import { levelToJson } from 'src/components/circuit-puzzle/levelFormat';
import {
  multiPuzzleToJson,
  multiPuzzleToSingleLevel,
  parsePuzzleJsonDocument,
  type PuzzleJsonDocument,
  type PuzzleMultiLevelDefinition,
} from 'src/components/circuit-puzzle/multi-level-format';

const { t } = useI18n();
import {
  collectType2BlockIds,
  isType2PuzzleDocument,
  parseType2BlockJson,
  parseType2PuzzleDocument,
} from 'src/components/circuit-puzzle/type2-format';
import {
  encodeMultiLevelForUrlV3,
  encodeSingleLevelForUrlV3,
} from 'src/components/circuit-puzzle/url-format-v3';
import type { GridCell, PuzzleLevelDefinition } from 'src/components/circuit-puzzle/types';
import { useSettingsStore } from 'src/stores/settings';
import { appPath } from 'src/utils/app-path';

const INDEX_PATH = appPath('/circuit-puzzle-levels/index.json');
const PREVIEW_HINT_FALLBACK = '#9ddb22';
const type2BlockCache = new Map<string, GridCell[]>();

type EntryPreviewCell = {
  key: string;
  blocked: boolean;
  hintColor?: string;
};

type EntryPreview = {
  rows: number;
  cols: number;
  rowTargets: number[];
  colTargets: number[];
  cells: EntryPreviewCell[];
};

type EntryPreviewRenderCell = EntryPreviewCell & {
  pieceColor?: string;
};

type EntryPreviewRenderRow = {
  y: number;
  targetScore: number;
  cells: EntryPreviewRenderCell[];
};

type RuntimeCollectionEntry = PuzzleCollectionEntry & {
  __stageIndex?: number;
  __sourceDirectory?: string;
};

const $q = useQuasar();
const settingsStore = useSettingsStore();
const route = useRoute();
const router = useRouter();
const isDark = computed(() => $q.dark.isActive);
const markdown = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

const pageHeight = ref(window.innerHeight);
const pageStyle = computed(() => ({
  height: `${pageHeight.value}px`,
}));
let headerObserver: ResizeObserver | null = null;

function updateAvailableHeight(): void {
  const header = document.querySelector('.q-header');
  const headerHeight = header ? header.getBoundingClientRect().height : 0;
  pageHeight.value = Math.floor(Math.max(0, window.innerHeight - headerHeight));
}

onMounted(() => {
  updateAvailableHeight();
  window.addEventListener('resize', updateAvailableHeight);
  const header = document.querySelector('.q-header');
  if (header && typeof ResizeObserver !== 'undefined') {
    headerObserver = new ResizeObserver(() => updateAvailableHeight());
    headerObserver.observe(header);
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', updateAvailableHeight);
  headerObserver?.disconnect();
  headerObserver = null;
});

const indexLoading = ref(false);
const indexError = ref('');
const collectionIndex = ref<
  (Omit<PuzzleCollectionIndex, 'entries'> & { entries: RuntimeCollectionEntry[] }) | null
>(null);
const selectedEntryId = ref<string | null>(null);

const entryLoading = ref(false);
const entryError = ref('');
const loadedLevel = ref<PuzzleLevelDefinition | null>(null);
const loadedMultiPuzzle = ref<PuzzleMultiLevelDefinition | null>(null);
const loadedMarkdown = ref('');
const searchKeyword = ref('');
const previewById = ref<Record<string, EntryPreview>>({});
const previewLoadingById = ref<Record<string, boolean>>({});
const previewErrorById = ref<Record<string, string>>({});
const previewLevelById = ref<Record<string, PuzzleLevelDefinition>>({});
const previewPieceOverlayById = ref<Record<string, Record<string, string>>>({});
const previewPieceLoadingById = ref<Record<string, boolean>>({});

const entries = computed<RuntimeCollectionEntry[]>(() => collectionIndex.value?.entries ?? []);
const visibleEntries = computed<RuntimeCollectionEntry[]>(() => {
  const keyword = searchKeyword.value.trim().toLowerCase();
  if (!keyword) return entries.value;
  return entries.value.filter((entry) => {
    const haystack = [
      entry.id,
      entry.title,
      entry.author ?? '',
      entry.difficulty ?? '',
      ...entry.tags,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(keyword);
  });
});
const selectedEntry = computed<RuntimeCollectionEntry | null>(
  () => entries.value.find((item) => item.id === selectedEntryId.value) ?? null,
);
const resolvedJsonPath = computed(() => {
  if (!collectionIndex.value || !selectedEntry.value) return '';
  return resolveCollectionAssetPath(collectionIndex.value.basePath, selectedEntry.value.json);
});
const resolvedMarkdownPath = computed(() => {
  if (!collectionIndex.value || !selectedEntry.value?.markdown) return '';
  return resolveCollectionAssetPath(collectionIndex.value.basePath, selectedEntry.value.markdown);
});
const renderedMarkdown = computed(() =>
  markdown.render(loadedMarkdown.value || `_${t('noDescription')}_`),
);
const levelJsonPreview = computed(() => {
  if (loadedMultiPuzzle.value) {
    return JSON.stringify(multiPuzzleToJson(loadedMultiPuzzle.value), null, 2);
  }
  if (!loadedLevel.value) return '';
  return JSON.stringify(levelToJson(loadedLevel.value), null, 2);
});

function resolveType2BlockPath(jsonPath: string, blockId: string): string {
  const normalized = jsonPath.replace(/\\/g, '/');
  const clean = normalized.split('?')[0] ?? normalized;
  const slashIndex = clean.lastIndexOf('/');
  const baseDir = slashIndex >= 0 ? clean.slice(0, slashIndex) : '';
  return `${baseDir}/blocks/${blockId}.json`;
}

async function loadType2BlockLibrary(
  value: unknown,
  jsonPath: string,
): Promise<{ blockCellsById: Map<string, GridCell[]>; errors: string[] }> {
  const blockCellsById = new Map<string, GridCell[]>();
  const errors: string[] = [];
  const blockIds = collectType2BlockIds(value);
  if (!blockIds.length) {
    return {
      blockCellsById,
      errors: ['type2 attachBlocks has no block references'],
    };
  }

  await Promise.all(
    blockIds.map(async (blockId) => {
      const blockPath = resolveType2BlockPath(jsonPath, blockId);
      const cached = type2BlockCache.get(blockPath);
      if (cached) {
        blockCellsById.set(
          blockId,
          cached.map((cell) => ({ ...cell })),
        );
        return;
      }

      try {
        const resp = await fetch(blockPath, { headers: { Accept: 'application/json' } });
        if (!resp.ok) {
          errors.push(`type2 block fetch failed: ${blockPath}`);
          return;
        }
        const raw = (await resp.json()) as unknown;
        const parsed = parseType2BlockJson(raw);
        if (!parsed.cells) {
          errors.push(`type2 block invalid (${blockPath}): ${parsed.errors.join('; ')}`);
          return;
        }
        type2BlockCache.set(
          blockPath,
          parsed.cells.map((cell) => ({ ...cell })),
        );
        blockCellsById.set(
          blockId,
          parsed.cells.map((cell) => ({ ...cell })),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown';
        errors.push(`type2 block load failed (${blockPath}): ${message}`);
      }
    }),
  );

  return { blockCellsById, errors };
}

async function parseDocumentWithType2Fallback(
  value: unknown,
  jsonPath: string,
): Promise<{ document: PuzzleJsonDocument | null; errors: string[] }> {
  const parsed = parsePuzzleJsonDocument(value);
  if (parsed.document) return parsed;
  if (!isType2PuzzleDocument(value)) return parsed;

  const library = await loadType2BlockLibrary(value, jsonPath);
  if (library.errors.length) {
    return { document: null, errors: library.errors };
  }

  const type2Parsed = parseType2PuzzleDocument(value, library.blockCellsById);
  if (type2Parsed.document) {
    return type2Parsed;
  }

  return {
    document: null,
    errors: [...parsed.errors, ...type2Parsed.errors],
  };
}

async function parsePrimaryLevelFromDocument(
  value: unknown,
  jsonPath: string,
  preferredLevelIndex = 0,
): Promise<{
  level: PuzzleLevelDefinition | null;
  errors: string[];
}> {
  const parsed = await parseDocumentWithType2Fallback(value, jsonPath);
  if (!parsed.document) return { level: null, errors: parsed.errors };
  if (parsed.document.kind === 'single') return { level: parsed.document.level, errors: [] };

  try {
    const safeLevelIndex =
      Number.isInteger(preferredLevelIndex) && preferredLevelIndex >= 0 ? preferredLevelIndex : 0;
    return { level: multiPuzzleToSingleLevel(parsed.document.puzzle, safeLevelIndex), errors: [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'multi puzzle first level parse failed';
    return { level: null, errors: [message] };
  }
}

function normalizeRelativeAssetPath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .trim();
}

function joinRelativeAssetPath(baseDir: string, child: string): string {
  const base = normalizeRelativeAssetPath(baseDir);
  const next = child
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .trim();
  if (!next) return base;
  if (next.startsWith('/')) return next.slice(1);
  if (!base) return next;
  return `${base}/${next}`;
}

function sanitizeEntryIdSegment(value: string): string {
  const safe = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return safe || 'stage';
}

function addDirectoryTag(tags: string[], directory: string): string[] {
  const base =
    normalizeRelativeAssetPath(directory).split('/').filter(Boolean).pop() ?? 'directory';
  const next = [...tags];
  if (!next.includes(base)) next.push(base);
  return next;
}

function getEntryStageIndex(entry: PuzzleCollectionEntry): number | null {
  const raw = (entry as RuntimeCollectionEntry).__stageIndex;
  return Number.isInteger(raw) && Number(raw) >= 0 ? Number(raw) : null;
}

function getEntryDirectory(entry: PuzzleCollectionEntry): string | null {
  const runtimeDirectory = (entry as RuntimeCollectionEntry).__sourceDirectory;
  if (typeof runtimeDirectory === 'string' && runtimeDirectory.trim()) {
    return normalizeRelativeAssetPath(runtimeDirectory);
  }
  if (typeof entry.directory === 'string' && entry.directory.trim()) {
    return normalizeRelativeAssetPath(entry.directory);
  }
  return null;
}

function buildDirectoryStageEntries(
  entry: PuzzleCollectionEntry,
  directory: string,
  sourceJsonRelativePath: string,
  parsed: PuzzleJsonDocument,
): RuntimeCollectionEntry[] {
  if (parsed.kind === 'single') {
    return [
      {
        ...entry,
        json: sourceJsonRelativePath,
        directory,
        __sourceDirectory: directory,
      },
    ];
  }

  return parsed.puzzle.levels.map((level, idx) => {
    const stageTitle = level.name?.trim() || level.id?.trim() || `Stage ${idx + 1}`;
    const stageId = sanitizeEntryIdSegment(level.id || stageTitle || String(idx + 1));
    return {
      ...entry,
      id: `${entry.id}--${String(idx + 1).padStart(3, '0')}-${stageId}`,
      title: `${entry.title} · ${stageTitle}`,
      json: sourceJsonRelativePath,
      tags: addDirectoryTag(entry.tags, directory),
      directory,
      __stageIndex: idx,
      __sourceDirectory: directory,
    };
  });
}

async function tryExpandDirectoryEntryByNestedIndex(
  entry: PuzzleCollectionEntry,
  basePath: string,
  directory: string,
): Promise<RuntimeCollectionEntry[] | null> {
  const nestedIndexRelativePath = joinRelativeAssetPath(directory, 'index.json');
  const nestedIndexPath = resolveCollectionAssetPath(basePath, nestedIndexRelativePath);
  const resp = await fetch(nestedIndexPath, { headers: { Accept: 'application/json' } });
  if (!resp.ok) return null;
  const raw = (await resp.json()) as unknown;
  const parsed = parseCollectionIndex(raw);
  if (!parsed.index) return null;

  return parsed.index.entries.map((child) => ({
    ...child,
    id: `${entry.id}--${sanitizeEntryIdSegment(child.id)}`,
    title: `${entry.title} · ${child.title}`,
    json: joinRelativeAssetPath(directory, child.json),
    ...(child.markdown ? { markdown: joinRelativeAssetPath(directory, child.markdown) } : {}),
    tags: addDirectoryTag(child.tags, directory),
    directory,
    __sourceDirectory: directory,
  }));
}

async function expandDirectoryEntry(
  entry: PuzzleCollectionEntry,
  basePath: string,
): Promise<RuntimeCollectionEntry[]> {
  const directory = getEntryDirectory(entry);
  if (!directory) return [entry];

  const type2RelativePath = joinRelativeAssetPath(directory, 'minigame_puzzle.json');
  const type2JsonPath = resolveCollectionAssetPath(basePath, type2RelativePath);
  try {
    const resp = await fetch(type2JsonPath, { headers: { Accept: 'application/json' } });
    if (resp.ok) {
      const raw = (await resp.json()) as unknown;
      const parsed = await parseDocumentWithType2Fallback(raw, type2JsonPath);
      if (parsed.document) {
        return buildDirectoryStageEntries(entry, directory, type2RelativePath, parsed.document);
      }
    }
  } catch {
    // Fall through to nested index strategy.
  }

  try {
    const nested = await tryExpandDirectoryEntryByNestedIndex(entry, basePath, directory);
    if (nested && nested.length) return nested;
  } catch {
    // Keep a fallback entry.
  }

  return [
    {
      ...entry,
      json: type2RelativePath,
      directory,
      tags: addDirectoryTag(entry.tags, directory),
      __sourceDirectory: directory,
    },
  ];
}

async function expandCollectionEntries(
  basePath: string,
  inputEntries: PuzzleCollectionEntry[],
): Promise<RuntimeCollectionEntry[]> {
  const groups = await Promise.all(
    inputEntries.map((entry) => expandDirectoryEntry(entry, basePath)),
  );
  const output: RuntimeCollectionEntry[] = [];
  const usedIds = new Set<string>();
  for (const group of groups) {
    for (const item of group) {
      const baseId = item.id;
      if (!usedIds.has(baseId)) {
        usedIds.add(baseId);
        output.push(item);
        continue;
      }

      let serial = 2;
      let nextId = `${baseId}-${serial}`;
      while (usedIds.has(nextId)) {
        serial += 1;
        nextId = `${baseId}-${serial}`;
      }
      usedIds.add(nextId);
      output.push({
        ...item,
        id: nextId,
      });
    }
  }
  return output;
}

function getSingleQueryValue(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return null;
}

function buildQueryFromRoute(): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, raw] of Object.entries(route.query)) {
    const value = getSingleQueryValue(raw);
    if (value === null) continue;
    next[key] = value;
  }
  return next;
}

function selectEntry(entryId: string): void {
  selectedEntryId.value = entryId;
}

function toKey(x: number, y: number): string {
  return `${x},${y}`;
}

function normalizeHexColor(input: string): string | null {
  const raw = input.trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) return raw.toLowerCase();
  return null;
}

function withAlpha(color: string, alpha: number): string {
  const safe = normalizeHexColor(color) ?? PREVIEW_HINT_FALLBACK;
  const match = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(safe);
  if (!match) return `rgba(157, 219, 34, ${alpha})`;
  const hex = match[1] ?? '';
  if (!hex) return `rgba(157, 219, 34, ${alpha})`;
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((ch) => `${ch}${ch}`)
          .join('')
      : hex;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildPreview(level: PuzzleLevelDefinition): EntryPreview {
  const blocked = new Set(level.blocked.map((cell) => toKey(cell.x, cell.y)));
  const hintColors: Record<string, string> = {};

  for (const hint of level.hintCells) {
    hintColors[toKey(hint.x, hint.y)] = PREVIEW_HINT_FALLBACK;
  }
  for (const [key, color] of Object.entries(level.hintColors ?? {})) {
    const normalized = normalizeHexColor(color);
    if (!normalized) continue;
    hintColors[key] = normalized;
  }

  const cells: EntryPreviewCell[] = [];
  for (let y = 0; y < level.rows; y += 1) {
    for (let x = 0; x < level.cols; x += 1) {
      const key = toKey(x, y);
      cells.push({
        key,
        blocked: blocked.has(key),
        ...(hintColors[key] ? { hintColor: hintColors[key] } : {}),
      });
    }
  }

  return {
    rows: level.rows,
    cols: level.cols,
    rowTargets: [...level.rowTargets],
    colTargets: [...level.colTargets],
    cells,
  };
}

function formatScore(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  if (Math.abs(safe - Math.round(safe)) < 1e-6) return String(Math.round(safe));
  return safe.toFixed(1);
}

function previewColTargets(entryId: string): number[] {
  return previewById.value[entryId]?.colTargets ?? [];
}

function previewRows(entryId: string): EntryPreviewRenderRow[] {
  const preview = previewById.value[entryId];
  if (!preview) return [];
  const pieceOverlay = settingsStore.circuitCollectionPreviewShowPieces
    ? (previewPieceOverlayById.value[entryId] ?? {})
    : {};

  const rows: EntryPreviewRenderRow[] = [];
  for (let y = 0; y < preview.rows; y += 1) {
    const rowCells: EntryPreviewRenderCell[] = [];
    for (let x = 0; x < preview.cols; x += 1) {
      const idx = y * preview.cols + x;
      const baseCell = preview.cells[idx];
      if (!baseCell) continue;
      rowCells.push({
        ...baseCell,
        ...(pieceOverlay[baseCell.key] ? { pieceColor: pieceOverlay[baseCell.key] } : {}),
      });
    }
    rows.push({
      y,
      targetScore: preview.rowTargets[y] ?? 0,
      cells: rowCells,
    });
  }
  return rows;
}

function previewBoardStyle(entryId: string): Record<string, string> {
  const preview = previewById.value[entryId];
  if (!preview) return {};
  return {
    '--preview-cols': String(preview.cols),
  };
}

function previewCellStyle(cell: EntryPreviewRenderCell): Record<string, string> {
  if (cell.blocked) return {};
  if (settingsStore.circuitCollectionPreviewShowPieces && cell.pieceColor) {
    return {
      backgroundColor: withAlpha(cell.pieceColor, 0.84),
      borderColor: withAlpha(cell.pieceColor, 0.95),
    };
  }
  return {};
}

async function loadEntryPreview(entry: PuzzleCollectionEntry): Promise<void> {
  if (!collectionIndex.value) return;
  previewLoadingById.value = { ...previewLoadingById.value, [entry.id]: true };

  const nextErrors = { ...previewErrorById.value };
  delete nextErrors[entry.id];
  previewErrorById.value = nextErrors;

  try {
    const jsonPath = resolveCollectionAssetPath(collectionIndex.value.basePath, entry.json);
    const jsonResp = await fetch(jsonPath, { headers: { Accept: 'application/json' } });
    if (!jsonResp.ok) throw new Error(`preview json fetch failed: ${jsonPath}`);
    const rawJson = (await jsonResp.json()) as unknown;
    const preferredLevelIndex = getEntryStageIndex(entry) ?? 0;
    const parsed = await parsePrimaryLevelFromDocument(rawJson, jsonPath, preferredLevelIndex);
    if (!parsed.level)
      throw new Error(`preview json invalid: ${entry.id}; ${parsed.errors.join('; ')}`);

    previewLevelById.value = {
      ...previewLevelById.value,
      [entry.id]: parsed.level,
    };
    previewById.value = {
      ...previewById.value,
      [entry.id]: buildPreview(parsed.level),
    };
    if (settingsStore.circuitCollectionPreviewShowPieces) {
      ensurePreviewPieceOverlay(entry.id);
    }
  } catch {
    previewErrorById.value = {
      ...previewErrorById.value,
      [entry.id]: 'preview failed',
    };
  } finally {
    previewLoadingById.value = { ...previewLoadingById.value, [entry.id]: false };
  }
}

async function loadAllPreviews(entriesList: PuzzleCollectionEntry[]): Promise<void> {
  await Promise.all(entriesList.map((entry) => loadEntryPreview(entry)));
}

function buildPreviewPieceOverlay(level: PuzzleLevelDefinition): Record<string, string> {
  const hasHints = level.hintCells.length > 0;
  const strict = solveLevel(level, {
    exactHintCover: hasHints,
    onlyHintCells: hasHints,
    enforceHintColors: true,
    timeoutMs: 1_200,
    maxNodes: 160_000,
  });
  const result =
    strict.status === 'no-solution' && hasHints
      ? solveLevel(level, {
          exactHintCover: false,
          onlyHintCells: false,
          enforceHintColors: true,
          timeoutMs: 1_200,
          maxNodes: 160_000,
        })
      : strict;

  if (result.status !== 'solved' || !result.solution) return {};

  const byKey: Record<string, string> = {};
  for (const placement of result.solution) {
    for (const cell of placement.cells) {
      byKey[toKey(cell.x, cell.y)] =
        normalizeHexColor(placement.pieceColor) ?? PREVIEW_HINT_FALLBACK;
    }
  }
  return byKey;
}

function ensurePreviewPieceOverlay(entryId: string): void {
  if (!settingsStore.circuitCollectionPreviewShowPieces) return;
  if (previewPieceOverlayById.value[entryId]) return;
  if (previewPieceLoadingById.value[entryId]) return;

  const level = previewLevelById.value[entryId];
  if (!level) return;

  previewPieceLoadingById.value = { ...previewPieceLoadingById.value, [entryId]: true };
  try {
    const overlay = buildPreviewPieceOverlay(level);
    previewPieceOverlayById.value = {
      ...previewPieceOverlayById.value,
      [entryId]: overlay,
    };
  } finally {
    previewPieceLoadingById.value = { ...previewPieceLoadingById.value, [entryId]: false };
  }
}

function preloadPieceOverlays(): void {
  if (!settingsStore.circuitCollectionPreviewShowPieces) return;
  for (const entryId of Object.keys(previewLevelById.value)) {
    ensurePreviewPieceOverlay(entryId);
  }
}

function onPreviewToggleChange(event: Event): void {
  const target = event.target as HTMLInputElement | null;
  const checked = !!target?.checked;
  settingsStore.setCircuitCollectionPreviewShowPieces(checked);
  if (checked) preloadPieceOverlays();
}

async function loadEntryAssets(entry: PuzzleCollectionEntry): Promise<void> {
  if (!collectionIndex.value) return;
  entryLoading.value = true;
  entryError.value = '';
  loadedLevel.value = null;
  loadedMultiPuzzle.value = null;
  loadedMarkdown.value = '';

  try {
    const jsonPath = resolveCollectionAssetPath(collectionIndex.value.basePath, entry.json);
    const jsonResp = await fetch(jsonPath, { headers: { Accept: 'application/json' } });
    if (!jsonResp.ok) throw new Error(`${t('jsonLoadFailed')}: ${jsonPath}`);
    const rawJson = (await jsonResp.json()) as unknown;
    const parsed = await parseDocumentWithType2Fallback(rawJson, jsonPath);
    if (!parsed.document) {
      throw new Error(`${t('levelJsonValidationFailed')}: ${parsed.errors.join('; ')}`);
    }
    if (parsed.document.kind === 'multi') {
      const preferredLevelIndex = getEntryStageIndex(entry) ?? 0;
      loadedLevel.value = multiPuzzleToSingleLevel(parsed.document.puzzle, preferredLevelIndex);
      loadedMultiPuzzle.value = getEntryStageIndex(entry) === null ? parsed.document.puzzle : null;
    } else {
      loadedMultiPuzzle.value = null;
      loadedLevel.value = parsed.document.level;
    }

    if (entry.markdown) {
      const mdPath = resolveCollectionAssetPath(collectionIndex.value.basePath, entry.markdown);
      const mdResp = await fetch(mdPath, { headers: { Accept: 'text/markdown, text/plain' } });
      if (!mdResp.ok) throw new Error(`${t('mdLoadFailed')}: ${mdPath}`);
      loadedMarkdown.value = await mdResp.text();
    }
  } catch (err) {
    entryError.value = err instanceof Error ? err.message : t('puzzleResourceLoadFailed');
  } finally {
    entryLoading.value = false;
  }
}

async function reloadIndex(): Promise<void> {
  indexLoading.value = true;
  indexError.value = '';
  collectionIndex.value = null;
  selectedEntryId.value = null;
  loadedLevel.value = null;
  loadedMultiPuzzle.value = null;
  loadedMarkdown.value = '';
  entryError.value = '';
  previewById.value = {};
  previewLoadingById.value = {};
  previewErrorById.value = {};
  previewLevelById.value = {};
  previewPieceOverlayById.value = {};
  previewPieceLoadingById.value = {};

  try {
    const resp = await fetch(INDEX_PATH, { headers: { Accept: 'application/json' } });
    if (!resp.ok) throw new Error(`${t('indexFileLoadFailed')}: ${INDEX_PATH}`);
    const raw = (await resp.json()) as unknown;
    const parsed = parseCollectionIndex(raw);
    if (!parsed.index) {
      throw new Error(`${t('indexFormatError')}: ${parsed.errors.join('; ')}`);
    }
    const expandedEntries = await expandCollectionEntries(
      parsed.index.basePath,
      parsed.index.entries,
    );
    collectionIndex.value = {
      ...parsed.index,
      entries: expandedEntries,
    };

    const queryEntryId = getSingleQueryValue(route.query.id);
    const firstId = expandedEntries[0]?.id ?? null;
    const initialId =
      queryEntryId && expandedEntries.some((entry) => entry.id === queryEntryId)
        ? queryEntryId
        : firstId;
    if (initialId) {
      selectedEntryId.value = initialId;
    }
    void loadAllPreviews(expandedEntries);
  } catch (err) {
    indexError.value = err instanceof Error ? err.message : t('indexLoadFailed');
  } finally {
    indexLoading.value = false;
  }
}

function openInPuzzle(tab: 'play' | 'editor'): void {
  const level = loadedLevel.value;
  const entry = selectedEntry.value;
  if (!level || !entry) return;

  try {
    let encoded = '';
    if (loadedMultiPuzzle.value) {
      encoded = encodeMultiLevelForUrlV3(loadedMultiPuzzle.value);
    } else {
      encoded = encodeSingleLevelForUrlV3(level, {
        rootId: entry.id,
        rootName: entry.title,
        mode: 'sequential',
      });
    }
    void router.push({
      path: '/circuit-puzzle',
      query: {
        l: encoded,
        tab,
        source: 'collection',
        id: entry.id,
      },
    });
  } catch {
    $q.notify({
      type: 'negative',
      message: t('puzzleEncodeFailed'),
    });
  }
}

watch(
  () => selectedEntry.value,
  (entry) => {
    if (!entry) return;
    const query = buildQueryFromRoute();
    query.id = entry.id;
    void router.replace({ path: route.path, query }).catch(() => undefined);
    void loadEntryAssets(entry);
  },
  { immediate: false },
);

watch(
  () => getSingleQueryValue(route.query.id),
  (queryId) => {
    if (!queryId) return;
    if (!entries.value.some((entry) => entry.id === queryId)) return;
    if (selectedEntryId.value === queryId) return;
    selectedEntryId.value = queryId;
  },
);

watch(
  () => settingsStore.circuitCollectionPreviewShowPieces,
  (enabled) => {
    if (enabled) preloadPieceOverlays();
  },
);

void reloadIndex();
</script>

<style scoped>
.collection-page {
  --cp-page-bg: #f0f7f4;
  --cp-page-text: #1d2b2a;
  --cp-panel-border: rgba(96, 125, 117, 0.35);
  --cp-panel-bg: rgba(248, 252, 251, 0.94);
  --cp-title: #2a463f;
  --cp-muted: #4c6560;
  --cp-btn-bg: rgba(235, 243, 240, 0.95);
  --cp-btn-text: #2f4d46;
  --cp-btn-border: rgba(114, 145, 137, 0.45);
  --cp-btn-hover: rgba(120, 185, 37, 0.8);
  --cp-btn-accent: #6f9f23;
  --cp-item-bg: rgba(242, 249, 247, 0.98);
  --cp-card-bg: rgba(242, 248, 246, 0.92);
  --cp-error-border: rgba(215, 70, 70, 0.5);
  --cp-error-bg: rgba(255, 238, 238, 0.85);
  --cp-error-text: #8c2b2b;
  --cp-json-text: #243937;
  padding: 12px;
  color: var(--cp-page-text);
  background: var(--cp-page-bg);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.collection-page--dark {
  --cp-page-bg: #0b1412;
  --cp-page-text: #d8e8e2;
  --cp-panel-border: rgba(155, 178, 172, 0.35);
  --cp-panel-bg: rgba(10, 18, 18, 0.86);
  --cp-title: #e8ff9f;
  --cp-muted: #cfe2dc;
  --cp-btn-bg: rgba(26, 35, 34, 0.95);
  --cp-btn-text: #d2e1dd;
  --cp-btn-border: rgba(163, 185, 179, 0.4);
  --cp-btn-hover: rgba(198, 255, 73, 0.75);
  --cp-btn-accent: #e8ff9f;
  --cp-item-bg: rgba(26, 35, 34, 0.95);
  --cp-card-bg: rgba(15, 25, 24, 0.86);
  --cp-error-border: rgba(255, 107, 107, 0.56);
  --cp-error-bg: rgba(62, 14, 14, 0.7);
  --cp-error-text: #ffc9c9;
  --cp-json-text: #d6e8e1;
}
.collection-shell {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-height: 0;
}
.collection-head {
  border: 1px solid var(--cp-panel-border);
  border-radius: 12px;
  background: var(--cp-panel-bg);
  padding: 12px;
}
.collection-head h1 {
  margin: 0 0 8px;
  font-size: 20px;
  color: var(--cp-title);
}
.collection-tip {
  margin: 0;
  font-size: 12px;
  color: var(--cp-muted);
}
.head-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
  align-items: center;
}
.search-box {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--cp-btn-text);
}
.search-box input {
  width: 220px;
  border: 1px solid var(--cp-btn-border);
  border-radius: 8px;
  background: var(--cp-btn-bg);
  color: var(--cp-btn-text);
  font-size: 12px;
  padding: 7px 9px;
}
.search-box input::placeholder {
  color: var(--cp-muted);
}
.preview-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--cp-btn-text);
}
.preview-toggle input {
  margin: 0;
}
.collection-grid {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 10px;
  min-height: 0;
  flex: 1;
}
.entry-list-panel,
.entry-detail-panel {
  border: 1px solid var(--cp-panel-border);
  border-radius: 12px;
  background: var(--cp-panel-bg);
  padding: 10px;
  overflow: hidden;
}
.entry-list-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.entry-list-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-right: 2px;
}
.entry-detail-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.entry-detail-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-right: 2px;
}
.entry-list-panel h2,
.entry-detail-panel h2 {
  margin: 0 0 10px;
  color: var(--cp-title);
  font-size: 16px;
}
.entry-btn {
  width: 100%;
  text-align: left;
  border: 1px solid var(--cp-btn-border);
  border-radius: 8px;
  background: var(--cp-item-bg);
  color: var(--cp-btn-text);
  padding: 8px;
  cursor: pointer;
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.entry-btn:hover {
  border-color: var(--cp-btn-hover);
}
.entry-btn--active {
  border-color: var(--cp-btn-hover);
  box-shadow: inset 0 0 0 1px rgba(124, 178, 95, 0.35);
}
.entry-title {
  font-size: 14px;
  font-weight: 600;
}
.entry-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  color: var(--cp-muted);
}
.entry-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tag-chip {
  border: 1px solid var(--cp-btn-border);
  border-radius: 99px;
  padding: 2px 7px;
  font-size: 11px;
  color: var(--cp-page-text);
}
.entry-preview-wrap {
  margin-top: 3px;
  min-height: 16px;
}
.entry-preview-tip {
  font-size: 11px;
  color: var(--cp-muted);
}
.entry-preview-tip--error {
  color: var(--cp-error-text);
}
.entry-preview-board {
  width: max-content;
  border: 1px solid var(--cp-btn-border);
  border-radius: 4px;
  padding: 2px;
  background: var(--cp-card-bg);
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.entry-preview-top,
.entry-preview-row {
  display: grid;
  grid-template-columns: 14px repeat(var(--preview-cols), 12px);
  gap: 1px;
  align-items: center;
}
.entry-preview-body {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.entry-preview-score {
  width: 12px;
  height: 12px;
  font-size: 9px;
  line-height: 12px;
  text-align: center;
  color: var(--cp-muted);
  user-select: none;
}
.entry-preview-score--corner {
  opacity: 0;
}
.entry-preview-cell {
  width: 12px;
  height: 12px;
  border: 1px solid rgba(123, 146, 138, 0.22);
  border-radius: 2px;
  background: rgba(220, 232, 228, 0.52);
}
.collection-page--dark .entry-preview-cell {
  border-color: rgba(121, 148, 140, 0.25);
  background: rgba(17, 28, 26, 0.78);
}
.entry-preview-cell--blocked {
  background:
    repeating-linear-gradient(
      135deg,
      rgba(140, 150, 150, 0.45) 0 3px,
      rgba(100, 110, 110, 0.35) 3px 6px
    ),
    rgba(35, 41, 41, 0.85);
  border-color: rgba(137, 147, 147, 0.48);
}
.entry-preview-cell--piece {
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.5);
}
.collection-btn {
  border: 1px solid var(--cp-btn-border);
  border-radius: 8px;
  background: var(--cp-btn-bg);
  color: var(--cp-btn-text);
  font-size: 13px;
  line-height: 1;
  padding: 9px 12px;
  cursor: pointer;
}
.collection-btn:hover {
  border-color: var(--cp-btn-hover);
  color: var(--cp-btn-accent);
}
.collection-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.detail-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 8px;
}
.asset-card,
.markdown-card,
.state-card {
  border: 1px solid var(--cp-panel-border);
  border-radius: 8px;
  background: var(--cp-card-bg);
  padding: 10px;
  margin-bottom: 8px;
}
.state-card {
  color: var(--cp-page-text);
}
.state-card--error {
  border-color: var(--cp-error-border);
  background: var(--cp-error-bg);
  color: var(--cp-error-text);
}
.empty-text {
  font-size: 13px;
  color: var(--cp-muted);
  padding: 10px 0;
}
.markdown-card h3 {
  margin: 0 0 8px;
  color: var(--cp-title);
  font-size: 14px;
}
.json-details > summary {
  cursor: pointer;
  font-size: 13px;
  color: var(--cp-btn-text);
  user-select: none;
}
.json-details[open] > summary {
  margin-bottom: 8px;
}
.json-preview {
  margin: 0;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--cp-json-text);
  font-family: Consolas, 'Courier New', monospace;
}
.doc-md :deep(pre) {
  white-space: pre-wrap;
  word-break: break-word;
}
.doc-md :deep(h1) {
  font-size: 18px;
  margin: 0 0 8px;
}
.doc-md :deep(h2) {
  font-size: 16px;
  margin: 12px 0 8px;
}
.doc-md :deep(p),
.doc-md :deep(ul),
.doc-md :deep(ol) {
  margin: 6px 0;
}
@media (max-width: 980px) {
  .collection-grid {
    grid-template-columns: 1fr;
  }
}
</style>
