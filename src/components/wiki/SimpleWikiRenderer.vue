<template>
  <div class="simple-wiki column q-gutter-md">
    <template v-for="(block, index) in renderedBlocks" :key="index">
      <div v-if="block.type === 'markdown'" class="simple-wiki__markdown" v-html="block.html"></div>

      <blockquote v-else-if="block.type === 'quote'" class="simple-wiki__quote">
        <div v-html="block.html"></div>
      </blockquote>

      <div v-else-if="block.type === 'table'" class="simple-wiki__table-wrap">
        <table class="simple-wiki__table">
          <thead v-if="block.headers.length">
            <tr>
              <th v-for="(header, headerIndex) in block.headers" :key="headerIndex">
                {{ header }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, rowIndex) in block.rows" :key="rowIndex">
              <td v-for="(cell, cellIndex) in row" :key="cellIndex">{{ cell }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <ol v-else-if="block.type === 'list' && block.ordered" class="simple-wiki__list">
        <li v-for="(item, itemIndex) in block.items" :key="itemIndex">{{ item }}</li>
      </ol>

      <ul v-else-if="block.type === 'list'" class="simple-wiki__list">
        <li v-for="(item, itemIndex) in block.items" :key="itemIndex">{{ item }}</li>
      </ul>

      <hr v-else-if="block.type === 'divider'" class="simple-wiki__divider" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import MarkdownIt from 'markdown-it';

type SimpleWikiBlock =
  | {
      type: 'markdown';
      html: string;
    }
  | {
      type: 'quote';
      html: string;
    }
  | {
      type: 'table';
      headers: string[];
      rows: string[][];
    }
  | {
      type: 'list';
      ordered: boolean;
      items: string[];
    }
  | {
      type: 'divider';
    };

const props = defineProps<{
  source: unknown;
}>();

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function pickText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (!isRecordLike(value)) return '';
  if (typeof value.content === 'string') return value.content.trim();
  if (typeof value.text === 'string') return value.text.trim();
  if (typeof value.markdown === 'string') return value.markdown.trim();
  return '';
}

function normalizeTableRows(raw: unknown): string[][] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!Array.isArray(entry)) return null;
      const row = entry.map((cell) => String(cell ?? '').trim());
      return row.length ? row : null;
    })
    .filter((row): row is string[] => Array.isArray(row));
}

function normalizeListItems(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => String(entry ?? '').trim())
    .filter((entry) => entry.length > 0);
}

function normalizeInputBlocks(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (isRecordLike(raw) && Array.isArray(raw.blocks)) return raw.blocks;
  if (typeof raw === 'string') return [raw];
  return [];
}

function normalizeSimpleWikiBlock(raw: unknown): SimpleWikiBlock | null {
  if (typeof raw === 'string') {
    const html = md.render(raw).trim();
    return html ? { type: 'markdown', html } : null;
  }

  if (!isRecordLike(raw)) return null;

  const kindRaw = typeof raw.kind === 'string' ? raw.kind : typeof raw.type === 'string' ? raw.type : '';
  const kind = kindRaw.trim().toLowerCase();

  if (kind === 'table') {
    const headers = Array.isArray(raw.headers)
      ? raw.headers.map((header) => String(header ?? '').trim())
      : [];
    const rows = normalizeTableRows(raw.rows);
    if (!headers.length && !rows.length) return null;
    return { type: 'table', headers, rows };
  }

  if (kind === 'list') {
    const items = normalizeListItems(raw.items);
    if (!items.length) return null;
    return {
      type: 'list',
      ordered: raw.ordered === true || raw.listKind === 'ordered',
      items,
    };
  }

  if (kind === 'quote') {
    const text = pickText(raw);
    if (!text) return null;
    const html = md.render(text).trim();
    return html ? { type: 'quote', html } : null;
  }

  if (kind === 'divider' || kind === 'horizontal-line' || kind === 'hr') {
    return { type: 'divider' };
  }

  if (kind === 'markdown' || kind === 'text' || kind === 'paragraph' || kind === '') {
    const text = pickText(raw);
    if (!text) return null;
    const html = md.render(text).trim();
    return html ? { type: 'markdown', html } : null;
  }

  return null;
}

const renderedBlocks = computed<SimpleWikiBlock[]>(() => {
  const blocks = normalizeInputBlocks(props.source);
  const out: SimpleWikiBlock[] = [];
  blocks.forEach((block) => {
    const normalized = normalizeSimpleWikiBlock(block);
    if (normalized) out.push(normalized);
  });
  return out;
});
</script>

<style scoped>
.simple-wiki__markdown {
  line-height: 1.6;
}

.simple-wiki__markdown :deep(h1),
.simple-wiki__markdown :deep(h2),
.simple-wiki__markdown :deep(h3),
.simple-wiki__markdown :deep(h4),
.simple-wiki__markdown :deep(h5),
.simple-wiki__markdown :deep(h6) {
  margin-top: 1em;
  margin-bottom: 0.5em;
  font-weight: 600;
}

.simple-wiki__markdown :deep(h1) {
  font-size: 1.5em;
}

.simple-wiki__markdown :deep(h2) {
  font-size: 1.3em;
}

.simple-wiki__markdown :deep(h3) {
  font-size: 1.1em;
}

.simple-wiki__markdown :deep(p) {
  margin-bottom: 0.75em;
}

.simple-wiki__markdown :deep(a) {
  color: #1976d2;
  text-decoration: none;
}

.simple-wiki__markdown :deep(a:hover) {
  text-decoration: underline;
}

.simple-wiki__markdown :deep(img) {
  max-width: 100%;
  height: auto;
}

.simple-wiki__quote {
  border-left: 4px solid rgba(0, 0, 0, 0.12);
  padding-left: 1em;
  margin: 0;
  color: rgba(0, 0, 0, 0.7);
}

.simple-wiki__table-wrap {
  overflow-x: auto;
}

.simple-wiki__table {
  width: 100%;
  border-collapse: collapse;
}

.simple-wiki__table th,
.simple-wiki__table td {
  border: 1px solid rgba(0, 0, 0, 0.12);
  padding: 0.5em;
  text-align: left;
}

.simple-wiki__table th {
  background: rgba(0, 0, 0, 0.03);
  font-weight: 600;
}

.simple-wiki__list {
  margin: 0;
  padding-left: 1.25rem;
}

.simple-wiki__divider {
  border: 0;
  border-top: 1px solid rgba(0, 0, 0, 0.12);
  margin: 0;
}
</style>
