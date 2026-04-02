<template>
  <div class="commonmark-wiki">
    <template v-for="(node, index) in parsedNodes" :key="index">
      <div v-if="node.type === 'html'" class="commonmark-wiki__html" v-html="node.html"></div>

      <div v-else-if="node.type === 'tabs'" class="commonmark-wiki__tabs">
        <q-tabs v-model="tabStates[node.tabGroupId]" dense align="left" class="text-primary">
          <q-tab v-for="tab in node.tabs" :key="tab.name" :name="tab.name" :label="tab.title" />
        </q-tabs>
        <q-separator />
        <q-tab-panels v-model="tabStates[node.tabGroupId]" animated>
          <q-tab-panel v-for="tab in node.tabs" :key="tab.name" :name="tab.name">
            <div class="commonmark-wiki__html" v-html="tab.html"></div>
          </q-tab-panel>
        </q-tab-panels>
      </div>

      <div
        v-else-if="node.type === 'callout'"
        class="commonmark-wiki__callout"
        :class="`commonmark-wiki__callout--${node.calloutType}`"
      >
        <div v-if="node.title" class="commonmark-wiki__callout-title">{{ node.title }}</div>
        <div class="commonmark-wiki__callout-body" v-html="node.html"></div>
      </div>

      <div v-else-if="node.type === 'details'" class="commonmark-wiki__details">
        <q-expansion-item
          dense
          expand-separator
          switch-toggle-side
          :default-opened="node.defaultOpen"
          :label="node.title"
          header-class="commonmark-wiki__details-header"
        >
          <div class="commonmark-wiki__details-body commonmark-wiki__html" v-html="node.html"></div>
        </q-expansion-item>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue';
import MarkdownIt from 'markdown-it';

type ParsedHtmlNode = { type: 'html'; html: string };
type ParsedTabsNode = {
  type: 'tabs';
  tabGroupId: string;
  tabs: { name: string; title: string; html: string }[];
};
type ParsedCalloutNode = {
  type: 'callout';
  calloutType: string;
  title: string;
  html: string;
};
type ParsedDetailsNode = {
  type: 'details';
  title: string;
  html: string;
  defaultOpen: boolean;
};
type ParsedNode = ParsedHtmlNode | ParsedTabsNode | ParsedCalloutNode | ParsedDetailsNode;

const props = defineProps<{
  source: unknown;
}>();

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

const tabStates = reactive<Record<string, string>>({});

function extractSource(): string {
  if (typeof props.source === 'string') return props.source;
  if (props.source && typeof props.source === 'object') {
    const rec = props.source as Record<string, unknown>;
    if (typeof rec.content === 'string') return rec.content;
    if (typeof rec.markdown === 'string') return rec.markdown;
    if (typeof rec.text === 'string') return rec.text;
  }
  return '';
}

function stripFrontmatter(source: string): string {
  if (!source.startsWith('---\n')) return source;
  const end = source.indexOf('\n---\n', 4);
  if (end < 0) return source;
  return source.slice(end + 5);
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizeInlineDirectives(source: string): string {
  return source.replace(
    /:item\{\s*id\s*=\s*"([^"]+)"(?:\s+label\s*=\s*"([^"]+)")?\s*\}/g,
    (_, itemId: string, label?: string) => {
      const text = label?.trim() || itemId.trim();
      return `<span class="commonmark-wiki__item-ref" data-item-id="${escapeHtmlAttr(itemId.trim())}">${md.utils.escapeHtml(text)}</span>`;
    },
  );
}

/**
 * Parse the markdown source into structured nodes.
 *
 * We use a line-based pre-pass to extract custom directive blocks
 * (:::tabs, :::callout) before sending remaining content through markdown-it.
 */
function parseNodes(source: string): ParsedNode[] {
  const lines = source.split('\n');
  const nodes: ParsedNode[] = [];
  let htmlBuffer: string[] = [];
  let tabGroupCounter = 0;

  function flushHtml() {
    if (htmlBuffer.length === 0) return;
    const raw = htmlBuffer.join('\n');
    const rendered = md.render(raw).trim();
    if (rendered) {
      nodes.push({ type: 'html', html: rendered });
    }
    htmlBuffer = [];
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trimStart();

    // :::tabs
    if (/^:::tabs\s*$/.test(trimmed)) {
      flushHtml();
      i++;
      const tabs: { name: string; title: string; lines: string[] }[] = [];
      let currentTab: { name: string; title: string; lines: string[] } | null = null;

      while (i < lines.length) {
        const tabLine = lines[i]!;
        const tabTrimmed = tabLine.trimStart();

        if (/^:::$/.test(tabTrimmed)) {
          // End of tabs block
          if (currentTab) tabs.push(currentTab);
          i++;
          break;
        }

        const tabMatch = tabTrimmed.match(/^:::tab\{?\s*title\s*=\s*"([^"]+)"\s*\}?\s*$/);
        if (tabMatch) {
          if (currentTab) tabs.push(currentTab);
          currentTab = { name: `tab-${tabs.length}`, title: tabMatch[1]!, lines: [] };
          i++;
          continue;
        }

        // Check for end of individual tab :::
        if (currentTab && /^:::$/.test(tabTrimmed)) {
          tabs.push(currentTab);
          currentTab = null;
          i++;
          continue;
        }

        if (currentTab) {
          currentTab.lines.push(tabLine);
        }
        i++;
      }

      if (tabs.length > 0) {
        const groupId = `tab-group-${tabGroupCounter++}`;
        if (!tabStates[groupId]) {
          tabStates[groupId] = tabs[0]!.name;
        }
        nodes.push({
          type: 'tabs',
          tabGroupId: groupId,
          tabs: tabs.map((tab) => ({
            name: tab.name,
            title: tab.title,
            html: md.render(tab.lines.join('\n')).trim(),
          })),
        });
      }
      continue;
    }

    // :::callout{type="info" title="xxx"}
    const calloutMatch = trimmed.match(
      /^:::callout\{?\s*type\s*=\s*"([^"]+)"(?:\s+title\s*=\s*"([^"]*)")?\s*\}?\s*$/,
    );
    if (calloutMatch) {
      flushHtml();
      i++;
      const calloutType = calloutMatch[1]!;
      const calloutTitle = calloutMatch[2] ?? '';
      const calloutLines: string[] = [];

      while (i < lines.length) {
        const cLine = lines[i]!;
        if (/^\s*:::$/.test(cLine)) {
          i++;
          break;
        }
        calloutLines.push(cLine);
        i++;
      }

      nodes.push({
        type: 'callout',
        calloutType,
        title: calloutTitle,
        html: md.render(calloutLines.join('\n')).trim(),
      });
      continue;
    }

    const detailsMatch = trimmed.match(
      /^:::details\{?\s*title\s*=\s*"([^"]+)"(?:\s+open\s*=\s*"(true|false)")?\s*\}?\s*$/,
    );
    if (detailsMatch) {
      flushHtml();
      i++;
      const detailsTitle = detailsMatch[1]!;
      const defaultOpen = detailsMatch[2] === 'true';
      const detailsLines: string[] = [];

      while (i < lines.length) {
        const dLine = lines[i]!;
        if (/^\s*:::$/.test(dLine)) {
          i++;
          break;
        }
        detailsLines.push(dLine);
        i++;
      }

      nodes.push({
        type: 'details',
        title: detailsTitle,
        defaultOpen,
        html: md.render(detailsLines.join('\n')).trim(),
      });
      continue;
    }

    // Regular line — buffer for markdown-it
    htmlBuffer.push(line);
    i++;
  }

  flushHtml();
  return nodes;
}

const parsedNodes = computed<ParsedNode[]>(() => {
  const source = normalizeInlineDirectives(stripFrontmatter(extractSource()));
  if (!source.trim()) return [];
  return parseNodes(source);
});
</script>

<style lang="scss">
.commonmark-wiki {
  &__html {
    line-height: 1.6;

    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      margin-top: 1em;
      margin-bottom: 0.5em;
      font-weight: 600;
    }

    h1 {
      font-size: 1.5em;
    }
    h2 {
      font-size: 1.3em;
    }
    h3 {
      font-size: 1.15em;
    }

    table {
      border-collapse: collapse;
      width: 100%;
      margin: 0.5em 0;
      font-size: 0.9em;

      th,
      td {
        border: 1px solid rgba(128, 128, 128, 0.3);
        padding: 4px 8px;
        text-align: left;
      }

      th {
        background: rgba(128, 128, 128, 0.1);
        font-weight: 600;
      }
    }

    ul,
    ol {
      padding-left: 1.5em;
      margin: 0.5em 0;
    }

    blockquote {
      border-left: 4px solid rgba(128, 128, 128, 0.3);
      margin: 0.5em 0;
      padding: 0.25em 1em;
      color: rgba(128, 128, 128, 0.8);
    }

    code {
      background: rgba(128, 128, 128, 0.1);
      padding: 0.1em 0.3em;
      border-radius: 3px;
      font-size: 0.9em;
    }

    pre {
      background: rgba(128, 128, 128, 0.08);
      padding: 0.75em 1em;
      border-radius: 4px;
      overflow-x: auto;

      code {
        background: none;
        padding: 0;
      }
    }

    hr {
      border: none;
      border-top: 1px solid rgba(128, 128, 128, 0.3);
      margin: 1em 0;
    }

    p {
      margin: 0.4em 0;
    }

    img {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
      display: block;
      margin: 0.75em 0;
    }
  }

  &__tabs {
    margin: 0.5em 0;
    border: 1px solid rgba(128, 128, 128, 0.2);
    border-radius: 4px;
    overflow: hidden;
  }

  &__callout {
    margin: 0.5em 0;
    padding: 0.75em 1em;
    border-radius: 4px;
    border-left: 4px solid;

    &--info {
      border-left-color: #2196f3;
      background: rgba(33, 150, 243, 0.06);
    }
    &--warning {
      border-left-color: #ff9800;
      background: rgba(255, 152, 0, 0.06);
    }
    &--tip {
      border-left-color: #4caf50;
      background: rgba(76, 175, 80, 0.06);
    }
    &--danger {
      border-left-color: #f44336;
      background: rgba(244, 67, 54, 0.06);
    }
  }

  &__callout-title {
    font-weight: 600;
    margin-bottom: 0.25em;
  }

  &__callout-body {
    line-height: 1.6;
  }

  &__details {
    margin: 0.5em 0;
    border: 1px solid rgba(128, 128, 128, 0.18);
    border-radius: 6px;
    overflow: hidden;
  }

  &__details-header {
    font-weight: 600;
  }

  &__details-body {
    padding: 0 1rem 1rem;
  }

  &__item-ref {
    display: inline-block;
    padding: 0.05em 0.45em;
    border-radius: 999px;
    background: rgba(25, 118, 210, 0.1);
    color: #1565c0;
    font-size: 0.92em;
    white-space: nowrap;
  }
}
</style>
