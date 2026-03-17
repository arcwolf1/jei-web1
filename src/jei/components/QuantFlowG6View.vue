<template>
  <div class="quant-g6-view">
    <div ref="containerEl" class="quant-g6-canvas"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Dark } from 'quasar';
import { Graph } from '@antv/g6';
import type { GraphData } from '@antv/g6';
import type { ItemDef, ItemKey } from 'src/jei/types';
import type { QuantFlowEdge, QuantFlowNode } from 'src/jei/planner/quantFlow';
import { itemKeyHash } from 'src/jei/indexing/key';
import { isProxyImageUrl } from 'src/jei/pack/runtimeImage';
import {
  convertAmountPerMinuteToUnitValue,
  evaluateLineWidthCurve,
  type LineWidthCurveConfig,
} from 'src/jei/planner/lineWidthCurve';

type DisplayUnit = 'items' | 'per_second' | 'per_minute' | 'per_hour';

type QuantModel = {
  nodes: QuantFlowNode[];
  edges: QuantFlowEdge[];
};

const props = withDefaults(
  defineProps<{
    model: QuantModel;
    itemDefsByKeyHash: Record<string, ItemDef>;
    displayUnit: DisplayUnit;
    widthByRate: boolean;
    beltSpeed: number;
    lineWidthCurveConfig: LineWidthCurveConfig;
    lineWidthScale: number;
    machineCountDecimals: number;
  }>(),
  {
    widthByRate: true,
    beltSpeed: 1,
    lineWidthScale: 1,
    machineCountDecimals: 2,
  },
);

const emit = defineEmits<{
  (e: 'item-click', itemKey: ItemKey): void;
  (e: 'item-mouseenter', keyHash: string): void;
  (e: 'item-mouseleave'): void;
}>();

const containerEl = ref<HTMLElement | null>(null);
let graph: Graph | null = null;
let resizeObserver: ResizeObserver | null = null;
let renderToken = 0;
let hoverNodeId: string | null = null;
let iconResolveToken = 0;
const resolvedIconByHash = ref(new Map<string, string>());

function finiteOr(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function formatAmount(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1000) / 1000;
}

function normalizedMachineCountDecimals(): number {
  return Math.max(0, Math.min(4, Math.floor(finiteOr(props.machineCountDecimals, 0))));
}

function formatMachineCount(n: number): string {
  const d = normalizedMachineCountDecimals();
  const value = d === 0 ? Math.round(n) : Math.round(n * 10 ** d) / 10 ** d;
  if (d === 0) return String(value);
  return value.toFixed(d).replace(/\.?0+$/, '');
}

function displayRateFromAmount(amountPerMinute: number, unit: DisplayUnit): number {
  if (unit === 'items') return amountPerMinute;
  if (unit === 'per_second') return amountPerMinute / 60;
  if (unit === 'per_hour') return amountPerMinute * 60;
  return amountPerMinute;
}

function unitSuffix(unit: DisplayUnit): string {
  if (unit === 'items') return '';
  if (unit === 'per_second') return '/s';
  if (unit === 'per_hour') return '/h';
  return '/min';
}

function edgeBaseWidthFromRate(amountPerMinute: number): number {
  const widthScale = Math.max(0.1, finiteOr(props.lineWidthScale, 1));
  if (!props.widthByRate) return 2;
  const cfg = props.lineWidthCurveConfig;
  const unitValue = convertAmountPerMinuteToUnitValue(
    finiteOr(amountPerMinute, 0),
    Math.max(0.001, finiteOr(props.beltSpeed, 1)),
    cfg.unit,
  );
  return evaluateLineWidthCurve(unitValue, cfg) * widthScale;
}

function edgeArrowSizeFromLineWidth(lineWidth: number): number {
  const w = Math.max(1, finiteOr(lineWidth, 2));
  return Math.max(10, Math.round(w + 8));
}

const modelNodeMap = computed(() => new Map(props.model.nodes.map((n) => [n.nodeId, n] as const)));

function itemColorOfDef(def?: ItemDef): string | null {
  const fromDef = (def as { color?: string } | undefined)?.color?.trim();
  if (fromDef) return fromDef;
  const fromRarity = def?.rarity?.color?.trim();
  if (fromRarity) return fromRarity;
  const fromSprite = def?.iconSprite?.color?.trim();
  if (fromSprite) return fromSprite;
  return null;
}

function parseSpritePosition(position: string): { x: number; y: number } {
  const nums = Array.from(position.matchAll(/-?\d+(?:\.\d+)?/g)).map((m) => Number(m[0]));
  if (nums.length < 2) return { x: 0, y: 0 };
  return { x: nums[0] ?? 0, y: nums[1] ?? 0 };
}

function normalizeImageUrl(url: string): string {
  if (!isProxyImageUrl(url)) return url;
  try {
    const parsed = new URL(url, window.location.origin);
    parsed.searchParams.delete('access_token');
    parsed.searchParams.delete('anonymous_token');
    parsed.searchParams.delete('framework_token');
    return parsed.toString();
  } catch {
    return url;
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

async function loadImageWithFallback(url: string): Promise<HTMLImageElement> {
  try {
    return await loadImage(url);
  } catch {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch image: ${url}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      return await loadImage(objectUrl);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

function drawImageContain(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  targetX: number,
  targetY: number,
  targetWidth: number,
  targetHeight: number,
  sourceWidth: number,
  sourceHeight: number,
) {
  const safeSourceWidth = Math.max(1, sourceWidth);
  const safeSourceHeight = Math.max(1, sourceHeight);
  const scale = Math.min(targetWidth / safeSourceWidth, targetHeight / safeSourceHeight);
  const drawWidth = safeSourceWidth * scale;
  const drawHeight = safeSourceHeight * scale;
  const dx = targetX + (targetWidth - drawWidth) / 2;
  const dy = targetY + (targetHeight - drawHeight) / 2;
  ctx.drawImage(source, dx, dy, drawWidth, drawHeight);
}

function colorWithAlpha(color: string, alpha: number): string {
  const s = color.trim();
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1]!;
    const normalized =
      raw.length === 3 ? `${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}` : raw;
    const r = Number.parseInt(normalized.slice(0, 2), 16);
    const g = Number.parseInt(normalized.slice(2, 4), 16);
    const b = Number.parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
  }
  const rgb = s.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (rgb) {
    const r = Number(rgb[1] ?? 0);
    const g = Number(rgb[2] ?? 0);
    const b = Number(rgb[3] ?? 0);
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
  }
  return color;
}

function drawIconBackgroundCircle(ctx: CanvasRenderingContext2D, bgColor: string | null) {
  if (!bgColor) return;
  ctx.fillStyle = colorWithAlpha(bgColor, Dark.isActive ? 0.26 : 0.34);
  ctx.beginPath();
  ctx.arc(48, 48, 45, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
}

async function resolveDirectIcon(iconUrl: string, bgColor: string | null): Promise<string | null> {
  try {
    const source = await loadImageWithFallback(normalizeImageUrl(iconUrl));
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawIconBackgroundCircle(ctx, bgColor);
    ctx.imageSmoothingEnabled = true;
    drawImageContain(ctx, source, 5, 5, 86, 86, source.width, source.height);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

async function resolveSpriteIcon(def: ItemDef, bgColor: string | null): Promise<string | null> {
  const sprite = def.iconSprite;
  if (!sprite?.url) return null;

  try {
    const source = await loadImageWithFallback(normalizeImageUrl(sprite.url));
    const { x, y } = parseSpritePosition(sprite.position);
    const size = Math.max(1, Math.round(finiteOr(sprite.size, 64)));
    const sx = x < 0 ? -x : x;
    const sy = y < 0 ? -y : y;

    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawIconBackgroundCircle(ctx, bgColor);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(source, sx, sy, size, size, 5, 5, 86, 86);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

async function ensureResolvedIcons() {
  const token = ++iconResolveToken;
  const nextTinted = new Map<string, string>();
  const itemNodes = props.model.nodes.filter(
    (node): node is Extract<QuantFlowNode, { kind: 'item' }> => node.kind === 'item',
  );
  const requiredHashes = new Set<string>();
  itemNodes.forEach((node) => {
    requiredHashes.add(itemKeyHash(node.itemKey));
    if (node.machineItemId) {
      requiredHashes.add(itemKeyHash({ id: node.machineItemId }));
    }
  });

  const iconTasks = Array.from(requiredHashes).map(async (hash) => {
    const def = props.itemDefsByKeyHash[hash];
    if (!def) return;
    const itemColor = itemColorOfDef(def);
    if (def.icon) {
      const resolvedTinted = await resolveDirectIcon(def.icon, itemColor);
      nextTinted.set(hash, resolvedTinted ?? normalizeImageUrl(def.icon));
      return;
    }
    if (!def.iconSprite) return;
    const iconTinted = await resolveSpriteIcon(def, itemColor);
    if (iconTinted) nextTinted.set(hash, iconTinted);
  });
  await Promise.all(iconTasks);

  if (token !== iconResolveToken) return;
  resolvedIconByHash.value = nextTinted;
}

function toGraphData(): GraphData {
  const isDark = Dark.isActive;
  const machineNameByItemId = new Map<string, string>();
  Object.values(props.itemDefsByKeyHash).forEach((def) => {
    if (!def?.key?.id) return;
    if (!machineNameByItemId.has(def.key.id))
      machineNameByItemId.set(def.key.id, def.name ?? def.key.id);
  });
  const itemTintFill = (itemColor: string | null, isRoot: boolean): string => {
    if (itemColor) return colorWithAlpha(itemColor, isDark ? 0.2 : 0.25);
    if (isRoot) return isDark ? '#1d3f66' : '#e6f0ff';
    return isDark ? '#2d3748' : '#f2f4f8';
  };

  const nodes = props.model.nodes.map((node) => {
    if (node.kind === 'item') {
      const hash = itemKeyHash(node.itemKey);
      const def = props.itemDefsByKeyHash[hash];
      const itemColor = itemColorOfDef(def);
      const title = def?.name ?? node.itemKey.id;
      const subtitle = `${formatAmount(displayRateFromAmount(node.amount, props.displayUnit))}${unitSuffix(props.displayUnit)}`;
      const fill = itemTintFill(itemColor, !!node.isRoot);
      const stroke = itemColor
        ? itemColor
        : node.isRoot
          ? '#1976d2'
          : isDark
            ? '#6b7280'
            : '#9aa5b1';
      const resolvedIcon = resolvedIconByHash.value.get(hash);
      return {
        id: node.nodeId,
        type: 'circle',
        data: {
          kind: 'item',
          itemKey: node.itemKey,
          itemKeyHash: hash,
        },
        style: {
          size: 96,
          fill,
          stroke,
          lineWidth: 2.4,
          shadowColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.18)',
          shadowBlur: 12,
          label: true,
          labelText: `${title}\n${subtitle}`,
          labelPlacement: 'bottom' as const,
          labelOffsetY: 10,
          labelTextAlign: 'center' as const,
          labelFill: isDark ? '#e5e7eb' : '#1f2937',
          labelFontSize: 14,
          labelLineHeight: 18,
          labelMaxWidth: 176,
          labelWordWrap: true,
          icon: true,
          ...(resolvedIcon
            ? { iconSrc: resolvedIcon }
            : { iconText: title.slice(0, 1).toUpperCase() }),
          iconWidth: 86,
          iconHeight: 86,
          iconFontSize: 24,
          iconFill: isDark ? '#f3f4f6' : '#0f172a',
        },
      };
    }

    const subtitle = `${formatAmount(displayRateFromAmount(node.amount, props.displayUnit))}${unitSuffix(props.displayUnit)}${node.unit ?? ''}`;
    return {
      id: node.nodeId,
      type: 'circle',
      data: {
        kind: 'fluid',
      },
      style: {
        size: 92,
        fill: isDark ? '#115e73' : '#d9f4fb',
        stroke: isDark ? '#67e8f9' : '#0ea5e9',
        lineWidth: 2,
        shadowColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.16)',
        shadowBlur: 8,
        label: true,
        labelText: `${node.id}\n${subtitle}`,
        labelPlacement: 'bottom' as const,
        labelOffsetY: 10,
        labelTextAlign: 'center' as const,
        labelFill: isDark ? '#e5e7eb' : '#1f2937',
        labelFontSize: 14,
        labelLineHeight: 18,
        icon: true,
        iconText: '液',
        iconFontSize: 28,
        iconFill: isDark ? '#d1f5ff' : '#0c4a6e',
      },
    };
  });

  const edges = props.model.edges.map((edge) => {
    const fluid = edge.kind === 'fluid';
    const recovery = edge.kind === 'item' && edge.recovery;
    const edgeItemColor =
      edge.kind === 'item'
        ? itemColorOfDef(props.itemDefsByKeyHash[itemKeyHash(edge.itemKey)])
        : null;
    const stroke = recovery
      ? '#26a69a'
      : (edgeItemColor ?? (fluid ? '#0ea5e9' : Dark.isActive ? '#9ca3af' : '#6b7280'));
    const amount = finiteOr(edge.amount, 0);
    const rateLabel = `${formatAmount(displayRateFromAmount(amount, props.displayUnit))}${unitSuffix(props.displayUnit)}${edge.kind === 'fluid' ? (edge.unit ?? '') : ''}`;
    const edgeMachineItemId = typeof edge.machineItemId === 'string' ? edge.machineItemId : '';
    const edgeMachineName = typeof edge.machineName === 'string' ? edge.machineName : '';
    const edgeMachineCountRaw = finiteOr(edge.machineCount, 0);
    const target = modelNodeMap.value.get(edge.target);
    const targetMachineItemId =
      target?.kind === 'item' && typeof target.machineItemId === 'string'
        ? target.machineItemId
        : '';
    const targetMachineName =
      target?.kind === 'item' && typeof target.machineName === 'string' ? target.machineName : '';
    const targetMachineCountRaw = target?.kind === 'item' ? finiteOr(target.machineCount, 0) : 0;
    const targetMachineCount =
      Number.isFinite(targetMachineCountRaw) && targetMachineCountRaw > 0
        ? formatMachineCount(targetMachineCountRaw)
        : '';
    const edgeMachineCount =
      Number.isFinite(edgeMachineCountRaw) && edgeMachineCountRaw > 0
        ? formatMachineCount(edgeMachineCountRaw)
        : '';
    const machineItemId = edgeMachineItemId || targetMachineItemId;
    const machineName = edgeMachineName || targetMachineName;
    const machineCount = edgeMachineCount || targetMachineCount;
    const machineLabelName = machineName || machineNameByItemId.get(machineItemId) || machineItemId;
    const machineLabel =
      machineLabelName && machineCount ? `${machineLabelName} x${machineCount}` : '';
    const labelCore = machineLabel ? `${rateLabel}\n${machineLabel}` : rateLabel;
    const recoveryFirstLeg =
      edge.kind === 'item' && !!(edge as { recoveryFirstLeg?: true }).recoveryFirstLeg;
    const label = recoveryFirstLeg ? '副产物' : recovery ? `${labelCore}\nrecovery` : labelCore;
    const edgeLineWidth = edgeBaseWidthFromRate(amount);
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'quadratic',
      style: {
        stroke,
        lineWidth: edgeLineWidth,
        ...(recovery ? { lineDash: [6, 4] } : {}),
        curveOffset: 0,
        endArrow: true,
        endArrowType: 'triangle',
        endArrowFill: stroke,
        endArrowSize: edgeArrowSizeFromLineWidth(edgeLineWidth),
        label: true,
        labelText: label,
        labelFontSize: 13,
        labelLineHeight: 16,
        labelFill: Dark.isActive ? '#e5e7eb' : '#374151',
        labelBackground: true,
        labelBackgroundFill: Dark.isActive ? 'rgba(17,24,39,0.78)' : 'rgba(255,255,255,0.82)',
        labelPadding: [1, 4],
      },
    };
  });
  return { nodes, edges };
}

function eventNodeId(event: unknown): string | null {
  const evt = event as { target?: { id?: string }; data?: { id?: string } } | undefined;
  return evt?.target?.id ?? evt?.data?.id ?? null;
}

async function renderGraph(fitView: boolean) {
  if (!graph) return;
  const token = ++renderToken;
  graph.setData(toGraphData());
  await graph.render();
  if (token !== renderToken) return;
  if (fitView) {
    await graph.fitView();
  }
}

function clearHoverEmit() {
  if (!hoverNodeId) return;
  hoverNodeId = null;
  emit('item-mouseleave');
}

onMounted(() => {
  const el = containerEl.value;
  if (!el) return;

  const width = Math.max(1, Math.floor(el.clientWidth));
  const height = Math.max(1, Math.floor(el.clientHeight));

  graph = new Graph({
    container: el,
    width,
    height,
    animation: false,
    data: toGraphData(),
    transforms: [
      {
        key: 'parallel-edges',
        type: 'process-parallel-edges',
        mode: 'bundle',
        distance: 26,
      },
    ],
    layout: {
      type: 'dagre',
      rankdir: 'LR',
      nodesep: 40,
      ranksep: 120,
      controlPoints: true,
    },
    node: {
      type: (datum) => datum.type ?? 'circle',
      style: (datum) => (datum.style ?? {}) as Record<string, unknown>,
    },
    edge: {
      type: 'quadratic',
      style: (datum) => (datum.style ?? {}) as Record<string, unknown>,
    },
    behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
  });

  graph.on('node:click', (evt) => {
    const id = eventNodeId(evt);
    if (!id) return;
    const node = modelNodeMap.value.get(id);
    if (!node || node.kind !== 'item') return;
    emit('item-click', node.itemKey);
  });

  graph.on('node:pointerenter', (evt) => {
    const id = eventNodeId(evt);
    if (!id) return;
    const node = modelNodeMap.value.get(id);
    if (!node || node.kind !== 'item') return;
    hoverNodeId = id;
    emit('item-mouseenter', itemKeyHash(node.itemKey));
  });

  graph.on('node:pointerleave', () => {
    clearHoverEmit();
  });

  void renderGraph(true);
  void ensureResolvedIcons().then(() => renderGraph(false));

  resizeObserver = new ResizeObserver(() => {
    if (!graph || !containerEl.value) return;
    const rawWidth = containerEl.value.clientWidth;
    const rawHeight = containerEl.value.clientHeight;
    // 容器被 display:none 隐藏时尺寸为 0，跳过处理；
    // 标签切回来时 ResizeObserver 会再次触发，届时尺寸恢复正常再执行 resize/fitView。
    if (rawWidth === 0 || rawHeight === 0) return;
    const nextWidth = Math.floor(rawWidth);
    const nextHeight = Math.floor(rawHeight);
    graph.resize(nextWidth, nextHeight);
    void graph.fitView();
  });
  resizeObserver.observe(el);
});

watch(
  () => [
    props.model,
    props.itemDefsByKeyHash,
    props.displayUnit,
    props.widthByRate,
    props.lineWidthScale,
    props.machineCountDecimals,
    props.beltSpeed,
    props.lineWidthCurveConfig,
    Dark.isActive,
  ],
  () => {
    void renderGraph(true);
    void ensureResolvedIcons().then(() => renderGraph(false));
  },
  { deep: true },
);

onBeforeUnmount(() => {
  clearHoverEmit();
  resizeObserver?.disconnect();
  resizeObserver = null;
  graph?.destroy();
  graph = null;
});
</script>

<style scoped>
.quant-g6-view {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.quant-g6-canvas {
  position: absolute;
  inset: 0;
}
</style>
