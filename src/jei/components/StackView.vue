<template>
  <div
    ref="stackViewEl"
    class="stack-view"
    :class="{
      'stack-view--clickable': clickable,
      'stack-view--slot': props.variant === 'slot',
      'stack-view--jei-classic': props.iconDisplayMode === 'jei_classic',
    }"
    @click="onClick"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @contextmenu.prevent="onContextMenu"
    v-touch-hold:600="onTouchHold"
  >
    <div class="stack-view__main">
      <q-img
        v-if="iconLoadingAnimation && showIconSrc"
        :src="iconSrc"
        :ratio="1"
        fit="contain"
        loading="lazy"
        decoding="async"
        fetchpriority="low"
        class="stack-view__icon"
      />
      <img
        v-else-if="!iconLoadingAnimation && showIconSrc"
        :src="iconSrc"
        loading="lazy"
        decoding="async"
        class="stack-view__icon"
      />
      <div
        v-else-if="showIconSprite"
        class="stack-view__icon stack-view__icon-sprite"
        :style="spriteWrapperStyle"
      >
        <div class="stack-view__icon-sprite-image" :style="spriteImageStyle"></div>
      </div>
      <div
        v-else-if="showIconPlaceholder"
        class="stack-view__icon stack-view__icon-placeholder"
      ></div>
      <q-icon v-else :name="fallbackIcon" size="22px" class="stack-view__icon-fallback" />
      <div class="stack-view__text">
        <div v-if="effectiveShowName" class="stack-view__name">{{ displayName }}</div>
        <div v-if="effectiveShowSubtitle" class="stack-view__subline">
          <span v-if="rarityLabel" class="stack-view__rarity" :style="rarityStyle">
            {{ rarityLabel }}
          </span>
          <span v-if="subtitle" class="stack-view__sub">{{ subtitle }}</span>
          <span
            v-if="!rarityLabel && !subtitle"
            class="stack-view__sub stack-view__sub-placeholder"
          >
            -
          </span>
        </div>
      </div>
    </div>
    <q-badge v-if="showBadge" color="primary" class="stack-view__badge">{{ badgeText }}</q-badge>
    <q-tooltip
      v-if="tooltipEnabled"
      ref="tooltipRef"
      v-model="tooltipVisible"
      no-parent-event
      :class="tooltipPopupClass"
      max-width="560px"
      :content-class="tooltipPopupClass"
      :content-style="tooltipContentStyle"
      transition-show="fade"
      transition-hide="fade"
    >
      <div
        ref="tooltipContentEl"
        :style="{ pointerEvents: tooltipMouseInteractive ? 'auto' : 'none' }"
        @mouseenter="onTooltipMouseEnter"
        @mouseleave="onTooltipMouseLeave"
        @wheel="onTooltipWheel"
      >
        <stack-tooltip-card
          :title="visibleTooltipTitle"
          :id-line="visibleTooltipIdLine"
          :meta-line="visibleTooltipMetaLine"
          :nbt-line="visibleTooltipNbtLine"
          :max-height-px="tooltipCardMaxHeight"
          :detail-groups="visibleTooltipDetailGroups"
          :detail-descriptions="visibleTooltipDetailDescriptions"
          :rarity-entries="visibleTooltipRarityEntries"
          :namespace-lines="visibleTooltipNamespaceLines"
          :tags-line="visibleTooltipTagsLine"
          :source-line="visibleTooltipSourceLine"
          :description="visibleTooltipDescription"
          :namespace="visibleTooltipNamespace"
        />
      </div>
    </q-tooltip>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { ItemDef, ItemKey, SlotContent, Stack } from 'src/jei/types';
import { itemKeyHash } from 'src/jei/indexing/key';
import { isProxyImageUrl, useCachedImageUrl, useRuntimeImageUrl } from 'src/jei/pack/runtimeImage';
import StackTooltipCard from './StackTooltipCard.vue';
import { useSettingsStore } from 'src/stores/settings';

const props = withDefaults(
  defineProps<{
    content: SlotContent | undefined;
    itemDefsByKeyHash: Record<string, ItemDef>;
    variant?: 'list' | 'slot';
    iconDisplayMode?: 'modern' | 'jei_classic';
    showName?: boolean;
    showSubtitle?: boolean;
    showAmount?: boolean;
    showRarity?: boolean;
    subtitleOverride?: string;
    lazyVisual?: boolean;
  }>(),
  {
    variant: 'list',
    iconDisplayMode: 'modern',
    showName: true,
    showSubtitle: true,
    showAmount: true,
    showRarity: true,
    subtitleOverride: '',
    lazyVisual: false,
  },
);
const settingsStore = useSettingsStore();

const iconLoadingAnimation = computed(() => settingsStore.itemIconLoadingAnimation);

const emit = defineEmits<{
  (e: 'item-click', itemKey: ItemKey): void;
  (e: 'item-mouseenter', keyHash: string): void;
  (e: 'item-mouseleave'): void;
  (e: 'item-context-menu', evt: Event, keyHash: string): void;
  (e: 'item-touch-hold', evt: unknown, keyHash: string): void;
}>();

const stacks = computed<Stack[]>(() => {
  if (!props.content) return [];
  return Array.isArray(props.content) ? props.content : [props.content];
});

const stack = computed<Stack | undefined>(() => stacks.value[0]);

const clickable = computed(() => stack.value?.kind === 'item');

const badgeText = computed(() => {
  if (stacks.value.length > 1) return `+${stacks.value.length - 1}`;
  return '';
});

const iconSrcRaw = computed(() => {
  const s = stack.value;
  if (!s || s.kind !== 'item') return '';
  const def = props.itemDefsByKeyHash[stackItemKeyHash(s)];
  return def?.icon ?? '';
});
const stackViewEl = ref<HTMLElement | null>(null);
const tooltipRef = ref<{ show?: () => void; hide?: () => void } | null>(null);
const tooltipContentEl = ref<HTMLElement | null>(null);
const tooltipVisible = ref(false);
const tooltipHoverLock = ref(false);
const tooltipCardMaxHeight = ref(0);
const shouldRenderVisual = ref(!props.lazyVisual);
const iconSrcRuntime = useRuntimeImageUrl(iconSrcRaw);
const iconSrc = useCachedImageUrl(() => (shouldRenderVisual.value ? iconSrcRuntime.value : ''));

const iconSprite = computed(() => {
  const s = stack.value;
  if (!s || s.kind !== 'item') return undefined;
  const def = props.itemDefsByKeyHash[stackItemKeyHash(s)];
  return def?.iconSprite;
});
const iconSpriteUrlRaw = computed(() => iconSprite.value?.url ?? '');
const iconSpriteUrlRuntime = useRuntimeImageUrl(iconSpriteUrlRaw);
const iconSpriteUrl = useCachedImageUrl(() =>
  shouldRenderVisual.value ? iconSpriteUrlRuntime.value : '',
);

const itemDef = computed<ItemDef | undefined>(() => {
  const s = stack.value;
  if (!s || s.kind !== 'item') return undefined;
  return props.itemDefsByKeyHash[stackItemKeyHash(s)];
});

const rarity = computed(() => itemDef.value?.rarity);
const rarityColor = computed(() => rarity.value?.color || '');
const rarityLabel = computed(() => {
  if (!props.showRarity) return '';
  const stars = rarity.value?.stars;
  if (!stars) return '';
  return `${stars}★`;
});

const rarityStyle = computed(() => {
  const color = rarityColor.value;
  if (!color) return {};
  return { color };
});

const hasImageVisual = computed(() => !!iconSrcRaw.value || !!iconSprite.value);
const showIconSrc = computed(() => shouldRenderVisual.value && !!iconSrc.value);
const showIconSprite = computed(
  () =>
    shouldRenderVisual.value &&
    !iconSrc.value &&
    !!iconSprite.value &&
    (!!iconSpriteUrl.value || !isProxyImageUrl(iconSprite.value.url)),
);
const showIconPlaceholder = computed(
  () =>
    iconLoadingAnimation.value &&
    ((props.lazyVisual && hasImageVisual.value && !shouldRenderVisual.value) ||
      (shouldRenderVisual.value &&
        ((!!iconSrcRaw.value && !iconSrc.value) ||
          (!!iconSprite.value && !iconSpriteUrl.value && isProxyImageUrl(iconSprite.value.url))))),
);

let visibilityObserver: IntersectionObserver | null = null;

function stopVisualObserver() {
  if (!visibilityObserver) return;
  visibilityObserver.disconnect();
  visibilityObserver = null;
}

function enableVisualRender() {
  if (shouldRenderVisual.value) return;
  shouldRenderVisual.value = true;
  stopVisualObserver();
}

function setupVisualObserver() {
  stopVisualObserver();
  if (!props.lazyVisual || shouldRenderVisual.value || !hasImageVisual.value) return;
  const target = stackViewEl.value;
  if (!target) return;
  if (typeof IntersectionObserver === 'undefined') {
    enableVisualRender();
    return;
  }
  visibilityObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries.some((entry) => entry.isIntersecting || entry.intersectionRatio > 0);
      if (visible) enableVisualRender();
    },
    { rootMargin: '200px' },
  );
  visibilityObserver.observe(target);
}

watch(
  () => props.lazyVisual,
  (lazyVisual) => {
    if (!lazyVisual) {
      shouldRenderVisual.value = true;
      stopVisualObserver();
      return;
    }
    if (!hasImageVisual.value) return;
    if (!shouldRenderVisual.value) setupVisualObserver();
  },
  { immediate: true },
);

watch(
  hasImageVisual,
  (hasVisual) => {
    if (!props.lazyVisual) return;
    if (!hasVisual) return;
    if (!shouldRenderVisual.value) setupVisualObserver();
  },
  { immediate: true },
);

onMounted(() => {
  setupVisualObserver();
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', updateTooltipCardMaxHeight);
  }
  updateTooltipCardMaxHeight();
});

onUnmounted(() => {
  stopVisualObserver();
  clearTooltipHideTimer();
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateTooltipCardMaxHeight);
  }
});

const spriteWrapperStyle = computed(() => {
  const sprite = iconSprite.value;
  if (!sprite) return {};
  return {
    backgroundColor: sprite.color ?? 'transparent',
  };
});

const spriteImageStyle = computed(() => {
  const sprite = iconSprite.value;
  if (!sprite) return {};
  const size = sprite.size ?? 64;
  const scale = 28 / size;
  const spriteImageUrl = iconSpriteUrl.value || (isProxyImageUrl(sprite.url) ? '' : sprite.url);
  return {
    width: `${size}px`,
    height: `${size}px`,
    backgroundImage: spriteImageUrl ? `url(${spriteImageUrl})` : 'none',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: sprite.position,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
  };
});

const displayName = computed(() => {
  const s = stack.value;
  if (!s) return '';
  if (s.kind === 'item') {
    const def = props.itemDefsByKeyHash[stackItemKeyHash(s)];
    return def?.name ?? s.id;
  }
  if (s.kind === 'fluid') return s.id;
  return s.id;
});

const subtitle = computed(() => {
  if (props.subtitleOverride) return props.subtitleOverride;
  if (!props.showAmount) return '';
  const s = stack.value;
  if (!s) return '';
  const unit = s.unit ?? (s.kind === 'fluid' ? 'mB' : '');
  const amountText = unit ? `${s.amount}${unit}` : `${s.amount}`;
  if (s.kind === 'tag') return `${amountText} · tag`;
  if (s.kind === 'fluid') return `${amountText} · fluid`;
  return amountText;
});

const effectiveShowName = computed(() => props.iconDisplayMode !== 'jei_classic' && props.showName);

const effectiveShowSubtitle = computed(
  () => props.iconDisplayMode !== 'jei_classic' && props.showSubtitle,
);

const showBadge = computed(() => props.iconDisplayMode !== 'jei_classic' && !!badgeText.value);

const fallbackIcon = computed(() => {
  const s = stack.value;
  if (!s) return 'help';
  if (s.kind === 'fluid') return 'water_drop';
  if (s.kind === 'tag') return 'sell';
  return 'inventory_2';
});

const tooltipMouseInteractive = computed(
  () => settingsStore.hoverTooltipAllowMouseEnter || settingsStore.hoverTooltipTemporaryInteractive,
);
const tooltipPopupClass = computed(() => [
  'stack-tooltip-popup',
  tooltipMouseInteractive.value
    ? 'stack-tooltip-popup--interactive'
    : 'stack-tooltip-popup--passthrough',
]);
const tooltipContentStyle = computed(() => ({
  padding: '0',
  background: 'transparent',
  color: 'inherit',
  boxShadow: 'none',
  border: 'none',
  overflow: 'visible',
  maxHeight: 'none',
  pointerEvents: tooltipMouseInteractive.value ? 'auto' : 'none',
}));

const tooltipTitle = computed(() => displayName.value);

const tooltipIdLine = computed(() => {
  const s = stack.value;
  if (!s) return '';
  if (s.kind === 'item') return `id: ${s.id}`;
  if (s.kind === 'fluid') return `fluid: ${s.id}`;
  return `tag: ${s.id}`;
});

const tooltipMetaLine = computed(() => {
  const s = stack.value;
  if (!s || s.kind !== 'item') return '';
  if (s.meta === undefined) return '';
  return `meta: ${String(s.meta)}`;
});

function nbtToInlineText(nbt: unknown) {
  try {
    const text = JSON.stringify(nbt);
    if (!text) return '';
    return text.length > 200 ? `${text.slice(0, 200)}…` : text;
  } catch {
    return '[unserializable]';
  }
}

const tooltipNbtLine = computed(() => {
  const s = stack.value;
  if (!s || s.kind !== 'item') return '';
  if (s.nbt === undefined) return '';
  const text = nbtToInlineText(s.nbt);
  return text ? `nbt: ${text}` : '';
});

const tooltipTagsLine = computed(() => {
  const s = stack.value;
  if (!s || s.kind !== 'item') return '';
  const def = props.itemDefsByKeyHash[stackItemKeyHash(s)];
  const tags = def?.tags ?? [];
  if (!tags.length) return '';
  const shown = tags.slice(0, 8);
  const more = tags.length > shown.length ? ` …(+${tags.length - shown.length})` : '';
  return `tags: ${shown.join(', ')}${more}`;
});

const tooltipSourceLine = computed(() => {
  const s = stack.value;
  if (!s || s.kind !== 'item') return '';
  const def = props.itemDefsByKeyHash[stackItemKeyHash(s)];
  return def?.source ? `source: ${def.source}` : '';
});

const tooltipDescription = computed(() => {
  const s = stack.value;
  if (!s || s.kind !== 'item') return '';
  const def = props.itemDefsByKeyHash[stackItemKeyHash(s)];
  return def?.description ?? '';
});

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

const tooltipMetaLabelByKey: Record<string, string> = {
  endpoint: 'Endpoint',
  slug: 'Slug',
  source: 'Source',
  generatedAt: 'Generated',
  itemId: 'Raw Item ID',
  primaryLocale: 'Primary Locale',
  locales: 'Locales',
  tagId: 'Tag ID',
  id: 'ID',
};

function humanizeTooltipKey(key: string): string {
  return (
    tooltipMetaLabelByKey[key] ??
    key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_./-]/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

function formatTooltipMetaScalar(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (typeof value === 'string') return value;
  return '';
}

function collectTooltipMetaLines(value: unknown, prefix = '', depth = 0): string[] {
  if (!isRecordLike(value) || depth > 2) return [];
  const out: string[] = [];
  const hiddenKeys = new Set([
    'aggregateHoverSources',
    'aggregateDetailSources',
    'aggregateSourcePackId',
    'aggregateSourceItemId',
    'aggregateOriginalItemIds',
  ]);

  Object.entries(value).forEach(([key, entry]) => {
    if (hiddenKeys.has(key) || entry === undefined || entry === null || entry === '') return;
    const label = prefix ? `${prefix} / ${humanizeTooltipKey(key)}` : humanizeTooltipKey(key);
    if (Array.isArray(entry)) {
      const scalarEntries = entry
        .map((item) => formatTooltipMetaScalar(item))
        .filter((item) => item.length > 0);
      if (scalarEntries.length === entry.length && scalarEntries.length > 0) {
        out.push(`${label}: ${scalarEntries.join(', ')}`);
        return;
      }
      entry.forEach((nested, index) => {
        out.push(...collectTooltipMetaLines(nested, `${label} ${index + 1}`, depth + 1));
      });
      return;
    }
    if (isRecordLike(entry)) {
      out.push(...collectTooltipMetaLines(entry, label, depth + 1));
      return;
    }
    const formatted = formatTooltipMetaScalar(entry);
    if (!formatted) return;
    out.push(`${label}: ${formatted}`);
  });

  return out;
}

function formatAggregateSourceTitle(sourcePackId: string): string {
  if (sourcePackId === 'warfarin-next') return 'Warfarin';
  if (sourcePackId === 'aef-skland') return 'Skland';
  if (sourcePackId === 'aef') return 'AEF';
  return sourcePackId;
}

type TooltipDetailEntry = {
  key: string;
  title: string;
  id: string;
  tags: string[];
  rarity?: {
    stars: number;
    color?: string;
  };
  sourceLine: string;
  namespace: string;
  description: string;
  metaLines: string[];
  wikiMetaLines: string[];
};

function buildTooltipDetailEntry(
  entry: Record<string, unknown>,
  index: number,
): TooltipDetailEntry[] {
  const sourcePackId =
    typeof entry.sourcePackId === 'string' && entry.sourcePackId.trim()
      ? entry.sourcePackId.trim()
      : `source-${index + 1}`;
  const id = typeof entry.id === 'string' ? entry.id : '';
  if (!id) return [];
  const tags = Array.isArray(entry.tags)
    ? entry.tags.filter((tag): tag is string => typeof tag === 'string')
    : [];
  const rarity = isRecordLike(entry.rarity) ? entry.rarity : undefined;
  return [
    {
      key: `${sourcePackId}:${id}`,
      title: formatAggregateSourceTitle(sourcePackId),
      id,
      tags,
      ...(typeof rarity?.stars === 'number'
        ? {
            rarity: {
              stars: rarity.stars,
              ...(typeof rarity.color === 'string' && rarity.color.trim()
                ? { color: rarity.color.trim() }
                : {}),
            },
          }
        : {}),
      sourceLine: typeof entry.source === 'string' && entry.source ? entry.source : '',
      namespace: typeof entry.namespace === 'string' && entry.namespace ? entry.namespace : '',
      description: typeof entry.description === 'string' ? entry.description : '',
      metaLines: collectTooltipMetaLines(entry.meta),
      wikiMetaLines: collectTooltipMetaLines(entry.wikiMeta),
    },
  ];
}

function buildTooltipFallbackEntry(item: ItemDef): TooltipDetailEntry {
  return {
    key: item.key.id,
    title: 'Item',
    id: item.key.id,
    tags: item.tags ?? [],
    ...(typeof item.rarity?.stars === 'number'
      ? {
          rarity: {
            stars: item.rarity.stars,
            ...(typeof item.rarity.color === 'string' && item.rarity.color.trim()
              ? { color: item.rarity.color.trim() }
              : {}),
          },
        }
      : {}),
    sourceLine: item.source ? item.source : '',
    namespace: item.key.id ? namespaceOf(item.key.id) : '',
    description: item.description ?? '',
    metaLines: collectTooltipMetaLines(item.extensions?.jeiweb?.meta),
    wikiMetaLines: collectTooltipMetaLines(item.extensions?.jeiweb?.wiki?.meta),
  };
}

const tooltipDetailEntries = computed<TooltipDetailEntry[]>(() => {
  const raw = itemDef.value?.extensions?.jeiweb?.meta?.aggregateHoverSources;
  if (Array.isArray(raw)) {
    return raw.flatMap((entry, index) =>
      isRecordLike(entry) ? buildTooltipDetailEntry(entry, index) : [],
    );
  }
  return itemDef.value ? [buildTooltipFallbackEntry(itemDef.value)] : [];
});

type TooltipAggregateGroup = {
  key: string;
  title: string;
  lines: string[];
};

type TooltipAggregateDescriptionEntry = {
  key: string;
  title: string;
  description: string;
};

function buildGroupedAggregateLines(
  entries: Array<{ sourceTitle: string; lines: string[] }>,
): string[] {
  const byLine = new Map<string, Set<string>>();
  const uniqueSources = new Set(entries.map((entry) => entry.sourceTitle));
  entries.forEach(({ sourceTitle, lines }) => {
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const existing = byLine.get(trimmed) ?? new Set<string>();
      existing.add(sourceTitle);
      byLine.set(trimmed, existing);
    });
  });
  return Array.from(byLine.entries()).map(([line, sources]) => {
    if (uniqueSources.size <= 1) return line;
    if (sources.size > 1) return line;
    const [sourceTitle] = Array.from(sources);
    return `${sourceTitle}: ${line}`;
  });
}

const tooltipDetailGroups = computed<TooltipAggregateGroup[]>(() => {
  const entries = tooltipDetailEntries.value;
  if (!entries.length) return [];

  const groups: TooltipAggregateGroup[] = [];
  const ids =
    entries.length > 1
      ? entries.map((entry) => `${entry.title}: ${entry.id}`)
      : entries.map((entry) => `id: ${entry.id}`);
  if (ids.length) groups.push({ key: 'ids', title: 'IDs', lines: ids });

  const tags = Array.from(new Set(entries.flatMap((entry) => entry.tags))).sort();
  if (tags.length) groups.push({ key: 'tags', title: 'Tags', lines: [tags.join(', ')] });

  const sourcePaths = entries
    .filter((entry) => entry.sourceLine.length > 0)
    .map((entry) =>
      entries.length > 1 ? `${entry.title}: ${entry.sourceLine}` : entry.sourceLine,
    );
  if (sourcePaths.length) groups.push({ key: 'paths', title: 'Sources', lines: sourcePaths });

  const infoLines = buildGroupedAggregateLines(
    entries.map((entry) => ({ sourceTitle: entry.title, lines: entry.metaLines })),
  );
  if (infoLines.length) groups.push({ key: 'info', title: 'Info', lines: infoLines });

  const wikiLines = buildGroupedAggregateLines(
    entries.map((entry) => ({ sourceTitle: entry.title, lines: entry.wikiMetaLines })),
  );
  if (wikiLines.length) groups.push({ key: 'wiki', title: 'Wiki', lines: wikiLines });

  return groups;
});

const tooltipRarityEntries = computed(() => {
  const entries = tooltipDetailEntries.value;
  const byStars = new Map<
    number,
    { key: string; label: string; starsText: string; color?: string }
  >();
  entries.forEach((entry) => {
    if (!entry.rarity?.stars) return [];
    const stars = entry.rarity.stars;
    const nextEntry = {
      key: `${entry.title}:${stars}:${entry.rarity.color ?? ''}`,
      label: entries.length > 1 ? entry.title : 'Stars',
      starsText: `${stars}★`,
      ...(entry.rarity.color ? { color: entry.rarity.color } : {}),
    };
    const existing = byStars.get(stars);
    if (!existing) {
      byStars.set(stars, nextEntry);
      return;
    }
    const existingHasColor = typeof existing.color === 'string' && existing.color.length > 0;
    const nextHasColor = typeof nextEntry.color === 'string' && nextEntry.color.length > 0;
    if (!existingHasColor && nextHasColor) {
      byStars.set(stars, nextEntry);
    }
  });
  return Array.from(byStars.values());
});

function normalizeTooltipDescription(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

const tooltipDetailDescriptions = computed<TooltipAggregateDescriptionEntry[]>(() => {
  const hasMultipleSources = tooltipDetailEntries.value.length > 1;
  const byDescription = new Map<string, { description: string; sourceTitles: Set<string> }>();
  tooltipDetailEntries.value.forEach((entry) => {
    const description = entry.description.trim();
    if (!description) return;
    const normalized = normalizeTooltipDescription(description);
    if (!normalized) return;
    const existing = byDescription.get(normalized);
    if (existing) {
      existing.sourceTitles.add(entry.title);
      if (description.length > existing.description.length) {
        existing.description = description;
      }
      return;
    }
    byDescription.set(normalized, {
      description,
      sourceTitles: new Set([entry.title]),
    });
  });

  return Array.from(byDescription.entries())
    .map(([normalized, entry]) => {
      const sourceLabel = Array.from(entry.sourceTitles).join(' / ');
      return {
        key: normalized,
        title: hasMultipleSources && sourceLabel ? `Description (${sourceLabel})` : 'Description',
        description: entry.description,
      };
    })
    .sort((a, b) => b.description.length - a.description.length || a.title.localeCompare(b.title));
});

const tooltipNamespaceLines = computed(() => {
  const entries = tooltipDetailEntries.value;
  const namespaces = entries.map((entry) => entry.namespace).filter((line) => line.length > 0);
  if (entries.length <= 1) return Array.from(new Set(namespaces));
  return Array.from(
    new Set(
      entries
        .filter((entry) => entry.namespace.length > 0)
        .map((entry) => `${entry.title}: ${entry.namespace}`),
    ),
  );
});

function namespaceOf(id: string) {
  if (id.includes(':')) return id.split(':')[0] || '';
  if (id.includes('.')) return id.split('.')[0] || '';
  return '';
}

const tooltipNamespace = computed(() => {
  const s = stack.value;
  if (!s) return '';
  const id = s.id;
  const ns = namespaceOf(id);
  return ns ? `namespace: ${ns}` : 'namespace: (none)';
});

const visibleTooltipTitle = computed(() =>
  settingsStore.hoverTooltipDisplay.title ? tooltipTitle.value : '',
);
const visibleTooltipIdLine = computed(() =>
  settingsStore.hoverTooltipDisplay.idLine ? tooltipIdLine.value : '',
);
const visibleTooltipMetaLine = computed(() =>
  settingsStore.hoverTooltipDisplay.metaLine ? tooltipMetaLine.value : '',
);
const visibleTooltipNbtLine = computed(() =>
  settingsStore.hoverTooltipDisplay.nbtLine ? tooltipNbtLine.value : '',
);
const visibleTooltipRarityEntries = computed(() =>
  settingsStore.hoverTooltipDisplay.rarity ? tooltipRarityEntries.value : [],
);
const visibleTooltipDetailGroups = computed(() => {
  const visibilityByGroupKey: Record<string, boolean> = {
    ids: settingsStore.hoverTooltipDisplay.detailIds,
    tags: settingsStore.hoverTooltipDisplay.detailTags,
    paths: settingsStore.hoverTooltipDisplay.detailSources,
    info: settingsStore.hoverTooltipDisplay.detailInfo,
    wiki: settingsStore.hoverTooltipDisplay.detailWiki,
  };
  return tooltipDetailGroups.value.filter((group) => visibilityByGroupKey[group.key] ?? true);
});
const visibleTooltipDetailDescriptions = computed(() =>
  settingsStore.hoverTooltipDisplay.detailDescriptions ? tooltipDetailDescriptions.value : [],
);
const visibleTooltipNamespaceLines = computed(() =>
  settingsStore.hoverTooltipDisplay.namespaceLines ? tooltipNamespaceLines.value : [],
);
const visibleTooltipTagsLine = computed(() =>
  settingsStore.hoverTooltipDisplay.tagsLine ? tooltipTagsLine.value : '',
);
const visibleTooltipSourceLine = computed(() =>
  settingsStore.hoverTooltipDisplay.sourceLine ? tooltipSourceLine.value : '',
);
const visibleTooltipDescription = computed(() =>
  settingsStore.hoverTooltipDisplay.description ? tooltipDescription.value : '',
);
const visibleTooltipNamespace = computed(() =>
  settingsStore.hoverTooltipDisplay.namespace ? tooltipNamespace.value : '',
);

const tooltipEnabled = computed(() => {
  if (!stack.value) return false;
  return Boolean(
    visibleTooltipTitle.value ||
    visibleTooltipIdLine.value ||
    visibleTooltipMetaLine.value ||
    visibleTooltipNbtLine.value ||
    visibleTooltipRarityEntries.value.length ||
    visibleTooltipDetailGroups.value.length ||
    visibleTooltipDetailDescriptions.value.length ||
    visibleTooltipNamespaceLines.value.length ||
    visibleTooltipTagsLine.value ||
    visibleTooltipSourceLine.value ||
    visibleTooltipDescription.value ||
    visibleTooltipNamespace.value,
  );
});

function stackItemKeyHash(s: { id: string; meta?: number | string; nbt?: unknown }): string {
  const key: ItemKey = { id: s.id };
  if (s.meta !== undefined) key.meta = s.meta;
  if (s.nbt !== undefined) key.nbt = s.nbt;
  return itemKeyHash(key);
}

function onClick() {
  const s = stack.value;
  if (!s || s.kind !== 'item') return;
  const key: ItemKey = { id: s.id };
  if (s.meta !== undefined) key.meta = s.meta;
  if (s.nbt !== undefined) key.nbt = s.nbt;
  emit('item-click', key);
}

let tooltipHideTimer: ReturnType<typeof setTimeout> | null = null;

function clearTooltipHideTimer() {
  if (!tooltipHideTimer) return;
  clearTimeout(tooltipHideTimer);
  tooltipHideTimer = null;
}

function showTooltip() {
  if (!tooltipEnabled.value) return;
  updateTooltipCardMaxHeight();
  clearTooltipHideTimer();
  tooltipVisible.value = true;
  tooltipRef.value?.show?.();
}

function scheduleTooltipHide() {
  clearTooltipHideTimer();
  tooltipHideTimer = setTimeout(() => {
    tooltipHoverLock.value = false;
    tooltipVisible.value = false;
    tooltipRef.value?.hide?.();
    tooltipHideTimer = null;
  }, 160);
}

function onMouseEnter() {
  showTooltip();
  const s = stack.value;
  if (!s || s.kind !== 'item') return;
  const keyHash = stackItemKeyHash(s);
  emit('item-mouseenter', keyHash);
}

function onMouseLeave() {
  scheduleTooltipHide();
  emit('item-mouseleave');
}

function onTooltipMouseEnter() {
  if (!tooltipMouseInteractive.value) return;
  tooltipHoverLock.value = true;
  showTooltip();
}

function onTooltipMouseLeave() {
  tooltipHoverLock.value = false;
  scheduleTooltipHide();
}

function onTooltipWheel(event: WheelEvent) {
  if (!tooltipMouseInteractive.value) return;
  const scrollEl = tooltipContentEl.value?.querySelector('.stack-tooltip');
  if (!(scrollEl instanceof HTMLElement)) return;
  if (scrollEl.scrollHeight <= scrollEl.clientHeight) return;
  scrollEl.scrollTop += event.deltaY;
  event.preventDefault();
  event.stopPropagation();
}

watch(tooltipMouseInteractive, (interactive) => {
  if (interactive) return;
  if (!tooltipHoverLock.value) return;
  tooltipHoverLock.value = false;
  scheduleTooltipHide();
});

function onContextMenu(evt: Event) {
  clearTooltipHideTimer();
  tooltipVisible.value = false;
  tooltipHoverLock.value = false;
  tooltipRef.value?.hide?.();
  const s = stack.value;
  if (!s || s.kind !== 'item') return;
  const keyHash = stackItemKeyHash(s);
  emit('item-context-menu', evt, keyHash);
}

function onTouchHold(evt: unknown) {
  clearTooltipHideTimer();
  tooltipVisible.value = false;
  tooltipHoverLock.value = false;
  tooltipRef.value?.hide?.();
  const s = stack.value;
  if (!s || s.kind !== 'item') return;
  const keyHash = stackItemKeyHash(s);
  emit('item-touch-hold', evt, keyHash);
}

function updateTooltipCardMaxHeight() {
  if (typeof window === 'undefined') {
    tooltipCardMaxHeight.value = 0;
    return;
  }
  const viewportHeight = window.innerHeight || 0;
  const fallbackHeight = Math.max(280, viewportHeight - 32);
  const target = stackViewEl.value;
  if (!target || viewportHeight <= 0) {
    tooltipCardMaxHeight.value = fallbackHeight;
    return;
  }
  const rect = target.getBoundingClientRect();
  const spaceAbove = Math.max(0, rect.top - 16);
  const spaceBelow = Math.max(0, viewportHeight - rect.bottom - 16);
  const preferredHeight = Math.max(spaceAbove, spaceBelow);
  tooltipCardMaxHeight.value = Math.max(280, Math.min(viewportHeight - 24, preferredHeight));
}
</script>

<style scoped>
.stack-view {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  position: relative;
}

.stack-view--clickable {
  cursor: pointer;
}

.stack-view--clickable:hover .stack-view__name {
  text-decoration: underline;
}

.stack-view--jei-classic {
  justify-content: center;
  gap: 0;
}

.stack-view__main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1 1 auto;
}

.stack-view__icon {
  width: 28px;
  height: 28px;
  border-radius: 4px;
}

.stack-view__icon-placeholder {
  background: rgba(0, 0, 0, 0.08);
}

.stack-view__icon-sprite {
  overflow: hidden;
}

.stack-view__icon-sprite-image {
  border-radius: 0;
}

.stack-view__icon-fallback {
  width: 28px;
  height: 28px;
}

.stack-view__text {
  min-width: 0;
  flex: 1 1 auto;
}

.stack-view__name {
  font-size: 12px;
  line-height: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 220px;
}

.stack-view__sub {
  font-size: 11px;
  opacity: 0.7;
  line-height: 13px;
}

.stack-view__subline {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  min-height: 13px;
}

.stack-view__rarity {
  font-size: 10px;
  line-height: 12px;
  font-weight: 600;
}

.stack-view__sub-placeholder {
  visibility: hidden;
}

.stack-view__badge {
  flex: 0 0 auto;
}

.stack-view--jei-classic .stack-view__main {
  justify-content: center;
  gap: 0;
  width: 100%;
}

.stack-view--jei-classic .stack-view__text {
  display: none;
}

.stack-view--jei-classic .stack-view__badge {
  display: none;
}

.stack-view--jei-classic .stack-view__icon,
.stack-view--jei-classic .stack-view__icon-fallback {
  width: 32px;
  height: 32px;
}

.stack-view--slot {
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
}

.stack-view--slot .stack-view__main {
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.stack-view--slot .stack-view__text {
  text-align: center;
}

.stack-view--slot .stack-view__name {
  max-width: 92px;
  white-space: normal;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 13px;
}

.stack-view--slot .stack-view__sub {
  font-size: 10px;
  line-height: 12px;
  opacity: 0.7;
}

.stack-view--slot .stack-view__subline {
  justify-content: center;
  min-height: 12px;
}

.stack-view--slot .stack-view__rarity {
  font-size: 10px;
  line-height: 12px;
}

.stack-view--slot .stack-view__badge {
  position: absolute;
  top: -6px;
  right: -6px;
}

:global(.stack-tooltip-popup),
:global(.q-tooltip.stack-tooltip-popup),
:global(.stack-tooltip-popup.q-tooltip) {
  padding: 0 !important;
  background: transparent !important;
  color: inherit !important;
  box-shadow: none !important;
  border: none !important;
  overflow: visible !important;
  max-height: none !important;
}

:global(.stack-tooltip-popup.stack-tooltip-popup--interactive),
:global(.q-tooltip.stack-tooltip-popup.stack-tooltip-popup--interactive),
:global(.stack-tooltip-popup.q-tooltip.stack-tooltip-popup--interactive) {
  pointer-events: auto !important;
}

:global(.stack-tooltip-popup.stack-tooltip-popup--passthrough),
:global(.q-tooltip.stack-tooltip-popup.stack-tooltip-popup--passthrough),
:global(.stack-tooltip-popup.q-tooltip.stack-tooltip-popup--passthrough) {
  pointer-events: none !important;
}
</style>
