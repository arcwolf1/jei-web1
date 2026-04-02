<template>
  <div :class="['circuit-game', isDark ? 'circuit-game--dark' : 'circuit-game--light']">
    <!-- Victory Overlay -->
    <Transition name="victory">
      <div v-if="solved && showVictory" class="victory-overlay" @click="showVictory = false">
        <div class="victory-modal" @click.stop>
          <div class="victory-icon">🎉</div>
          <h2 class="victory-title">{{ t('congratulations') }}</h2>
          <p class="victory-message">{{ t('circuitChallengeComplete') }}</p>
          <button type="button" class="victory-btn" @click="showVictory = false">
            {{ t('continue') }}
          </button>
        </div>
      </div>
    </Transition>

    <section class="board-section">
      <div class="board-title">
        <h2>{{ level.name }}</h2>
        <p>Pick a block, rotate with <b>R</b>, place it, and match row/col clues.</p>
      </div>

      <div ref="boardStageRef" class="board-stage">
        <CircuitPuzzleBoard
          :rows="level.rows"
          :cols="level.cols"
          :blocked-keys="blockedKeys"
          :locked-keys="fixedOccupiedKeys"
          :hint-keys="hintKeys"
          :hint-cells="hintCells"
          :show-hints="showHints"
          :occupied-keys="occupiedKeys"
          :occupied-cells="occupiedCells"
          :preview-keys="previewKeys"
          :preview-cells="previewCells"
          :preview-valid="previewValid"
          :row-targets="level.rowTargets"
          :row-filled="rowFilled"
          :row-target-parts="rowTargetParts"
          :row-filled-parts="rowFilledParts"
          :col-targets="level.colTargets"
          :col-filled="colFilled"
          :col-target-parts="colTargetParts"
          :col-filled-parts="colFilledParts"
          :selected-piece-name="selectedPieceName"
          :focus-row="focusRow"
          :focus-col="focusCol"
          :display-mode="displayMode"
          :max-board-size="boardAvailableSize"
          @cell-click="onCellClick"
          @cell-hover="onCellHover"
          @board-leave="hoverCell = null"
          @cancel-selection="cancelSelection"
        />
      </div>
    </section>

    <aside class="panel-section">
      <div class="status-card">
        <div class="status-line">
          <span>Progress</span>
          <span>{{ placedCount }} / {{ totalPieceCount }}</span>
        </div>
        <div class="status-line">
          <span>Row/Col</span>
          <span
            >{{ satisfiedRowCount }}/{{ level.rows }} + {{ satisfiedColCount }}/{{
              level.cols
            }}</span
          >
        </div>
        <div class="status-hint" :class="{ 'status-hint--ok': solved }">
          {{ solved ? 'Solved' : 'Not solved yet' }}
        </div>

        <div v-if="colorWeightEntries.length" class="weight-list">
          <span class="weight-title">Color score:</span>
          <span v-for="entry in colorWeightEntries" :key="entry.color" class="weight-item">
            <i class="weight-color" :style="{ backgroundColor: entry.color }" />
            x{{ formatScore(entry.weight) }}
          </span>
        </div>

        <div class="display-switch">
          <button
            type="button"
            class="switch-btn"
            :class="{ 'switch-btn--active': displayMode === 'graphic' }"
            @click="displayMode = 'graphic'"
          >
            {{ t('graphicMode') }}
          </button>
          <button
            type="button"
            class="switch-btn"
            :class="{ 'switch-btn--active': displayMode === 'numeric' }"
            @click="displayMode = 'numeric'"
          >
            {{ t('numericMode') }}
          </button>
        </div>

        <div class="display-switch display-switch--single">
          <button
            type="button"
            class="switch-btn"
            :class="{ 'switch-btn--active': showHints }"
            @click="showHints = !showHints"
          >
            {{ t('hintOutline') }} {{ showHints ? t('on') : t('off') }}
          </button>
        </div>

        <div class="status-actions">
          <button type="button" class="action-btn" :disabled="autoSolving" @click="autoSolve">
            {{ autoSolving ? t('autoSolving') : t('autoSolve') }}
          </button>
          <button type="button" class="action-btn" @click="resetAll">Reset All</button>
          <button
            type="button"
            class="action-btn"
            :disabled="!canRotateSelected"
            @click="rotateSelectedPiece"
          >
            Rotate (R)
          </button>
        </div>
      </div>

      <div class="piece-list">
        <div
          v-for="entry in pieceTypeEntries"
          :key="entry.piece.id"
          class="piece-type-wrap"
          :class="{ 'piece-type-wrap--empty': entry.remaining === 0 }"
        >
          <CircuitPuzzlePieceCard
            :item-id="entry.piece.id"
            :piece="entry.piece"
            :label="entry.piece.name"
            :counter-text="`${t('remaining')} ${entry.remaining}/${entry.total}`"
            :footer-text="entry.remaining === 0 ? t('unavailable') : `${t('placed')} ${entry.used}`"
            :rotation="entry.rotation"
            :placed-anchor="null"
            :selected="entry.selected"
            :can-rotate="entry.canRotate"
            :can-pickup="false"
            :show-pickup="false"
            :unavailable="entry.remaining === 0"
            @select="selectPieceType"
            @rotate="rotatePieceType"
          />
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import CircuitPuzzleBoard from './CircuitPuzzleBoard.vue';
import CircuitPuzzlePieceCard from './CircuitPuzzlePieceCard.vue';
import { solveLevel, verifySolution } from './auto-solver';
import { useKeyBindingsStore, eventMatchesBinding } from 'src/stores/keybindings';
import type {
  ClueDisplayMode,
  GridCell,
  PuzzleFixedPlacementDefinition,
  PuzzleLevelDefinition,
  PuzzlePieceDefinition,
  PuzzleScorePart,
} from './types';

const { t } = useI18n();

const keyBindingsStore = useKeyBindingsStore();

type PieceRuntimeState = {
  rotation: number;
  anchor: GridCell | null;
  shape: GridCell[];
};

type PieceInstance = {
  instanceId: string;
  pieceId: string;
  index: number;
};

type OverlayCell = {
  key: string;
  color: string;
  groupId: string;
};

type OccupiedCellEntry = OverlayCell & {
  x: number;
  y: number;
  instanceId: string;
  pieceId: string;
};

type FixedOccupiedCellEntry = OverlayCell & {
  x: number;
  y: number;
  fixedId: string;
};

type ScorePartCell = {
  x: number;
  y: number;
  color: string;
};

const props = defineProps<{
  level: PuzzleLevelDefinition;
}>();
const emit = defineEmits<{
  (e: 'solved'): void;
  (e: 'solved-change', solved: boolean): void;
}>();

const $q = useQuasar();
const isDark = computed(() => $q.dark.isActive);

const level = computed(() => props.level);
const pieceInstances = ref<PieceInstance[]>([]);
const pieceStates = ref<Record<string, PieceRuntimeState>>({});
const selectedPieceId = ref<string | null>(null);
const selectedPieceInstanceId = ref<string | null>(null);
const selectedPlacementRotation = ref(0);
const hoverCell = ref<GridCell | null>(null);
const displayMode = ref<ClueDisplayMode>('graphic');
const showHints = ref(false);
const showVictory = ref(false);
const autoSolving = ref(false);
const boardStageRef = ref<HTMLElement | null>(null);
const boardStageSize = ref({ width: 0, height: 0 });
let boardStageResizeObserver: ResizeObserver | null = null;

const pieceById = computed(() => new Map(level.value.pieces.map((piece) => [piece.id, piece])));

watch(
  level,
  (nextLevel) => {
    const shapeByPieceId = new Map<string, GridCell[]>();
    for (const piece of nextLevel.pieces) {
      shapeByPieceId.set(piece.id, normalizeShapeCells(piece.cells));
    }

    const instances: PieceInstance[] = [];
    for (const piece of nextLevel.pieces) {
      const count = Math.max(0, piece.count ?? 1);
      for (let i = 0; i < count; i += 1) {
        instances.push({
          instanceId: `${piece.id}#${i + 1}`,
          pieceId: piece.id,
          index: i + 1,
        });
      }
    }
    pieceInstances.value = instances;
    pieceStates.value = Object.fromEntries(
      instances.map((inst) => {
        const baseShape = shapeByPieceId.get(inst.pieceId) ?? [];
        return [
          inst.instanceId,
          {
            rotation: 0,
            anchor: null,
            shape: cloneShapeCells(baseShape),
          } as PieceRuntimeState,
        ];
      }),
    );
    selectedPieceId.value = nextLevel.pieces[0]?.id ?? null;
    selectedPieceInstanceId.value = selectedPieceId.value
      ? findFirstAvailableInstanceId(selectedPieceId.value)
      : null;
    selectedPlacementRotation.value = 0;
    hoverCell.value = null;
  },
  { immediate: true, deep: true },
);

const blockedSet = computed(() => {
  const set = new Set<string>();
  for (const cell of level.value.blocked) set.add(toKey(cell.x, cell.y));
  return set;
});

const hintSet = computed(() => {
  const set = new Set<string>();
  for (const cell of level.value.hintCells ?? []) set.add(toKey(cell.x, cell.y));
  return set;
});

const hintCells = computed<OverlayCell[]>(() => {
  const colorByKey = level.value.hintColors ?? {};
  return (level.value.hintCells ?? []).map((cell) => {
    const key = toKey(cell.x, cell.y);
    const color = colorByKey[key]?.trim() || '#9ddb22';
    return {
      key,
      color,
      groupId: color,
    };
  });
});

const hintScoreCells = computed<ScorePartCell[]>(() => {
  const colorByKey = level.value.hintColors ?? {};
  return (level.value.hintCells ?? []).map((cell) => {
    const key = toKey(cell.x, cell.y);
    return {
      x: cell.x,
      y: cell.y,
      color: normalizeColorKey(colorByKey[key]?.trim() || '#9ddb22'),
    };
  });
});

const blockedKeys = computed(() => Array.from(blockedSet.value));
const hintKeys = computed(() => Array.from(hintSet.value));

const colorWeightByColor = computed(() => {
  const map = new Map<string, number>();

  for (const piece of level.value.pieces) {
    const color = piece.color.trim();
    if (color && !map.has(color)) map.set(color, 1);
  }
  for (const fixed of level.value.fixedPlacements ?? []) {
    const color = fixed.color.trim();
    if (color && !map.has(color)) map.set(color, 1);
  }

  for (const [color, rawWeight] of Object.entries(level.value.colorWeights ?? {})) {
    const safeColor = color.trim();
    if (!safeColor) continue;
    const weight = Number(rawWeight);
    if (!Number.isFinite(weight) || weight < 0) continue;
    map.set(safeColor, weight);
  }

  return map;
});

const colorWeightEntries = computed(() =>
  Array.from(colorWeightByColor.value.entries()).map(([color, weight]) => ({ color, weight })),
);

const selectedPieceName = computed(() => {
  if (!selectedPieceId.value) return null;
  const piece = pieceById.value.get(selectedPieceId.value);
  if (!piece) return null;
  const remaining = remainingCountByPieceId.value.get(piece.id) ?? 0;
  const total = totalCountByPieceId.value.get(piece.id) ?? 0;
  return `${piece.name} (${remaining}/${total})`;
});

const fixedPlacements = computed<PuzzleFixedPlacementDefinition[]>(
  () => level.value.fixedPlacements ?? [],
);

const fixedOccupiedCellEntries = computed<FixedOccupiedCellEntry[]>(() => {
  const entries: FixedOccupiedCellEntry[] = [];
  for (const fixed of fixedPlacements.value) {
    const relCells = getFixedPlacementCells(fixed);
    if (!relCells.length) continue;
    const color = fixed.color?.trim() || '#9ddb22';
    for (const rel of relCells) {
      const x = fixed.anchor.x + rel.x;
      const y = fixed.anchor.y + rel.y;
      entries.push({
        key: toKey(x, y),
        x,
        y,
        color,
        groupId: `fixed-${fixed.id}`,
        fixedId: fixed.id,
      });
    }
  }
  return entries;
});

const movableOccupiedCellEntries = computed<OccupiedCellEntry[]>(() => {
  const entries: OccupiedCellEntry[] = [];

  for (const inst of pieceInstances.value) {
    const state = pieceStates.value[inst.instanceId];
    if (!state?.anchor) continue;
    const piece = pieceById.value.get(inst.pieceId);
    if (!piece) continue;

    const relCells = getTransformedCells(inst.instanceId, state.rotation);
    for (const rel of relCells) {
      const x = state.anchor.x + rel.x;
      const y = state.anchor.y + rel.y;
      entries.push({
        key: toKey(x, y),
        x,
        y,
        color: piece.color,
        groupId: inst.instanceId,
        instanceId: inst.instanceId,
        pieceId: inst.pieceId,
      });
    }
  }

  return entries;
});

const movableOccupiedMap = computed(
  () => new Map(movableOccupiedCellEntries.value.map((cell) => [cell.key, cell.instanceId])),
);
const fixedOccupiedMap = computed(
  () => new Map(fixedOccupiedCellEntries.value.map((cell) => [cell.key, cell.fixedId])),
);
const boardOccupiedCellEntries = computed<Array<OccupiedCellEntry | FixedOccupiedCellEntry>>(() => [
  ...fixedOccupiedCellEntries.value,
  ...movableOccupiedCellEntries.value,
]);
const fixedOccupiedKeys = computed(() => fixedOccupiedCellEntries.value.map((cell) => cell.key));
const occupiedKeys = computed(() => boardOccupiedCellEntries.value.map((cell) => cell.key));
const occupiedCells = computed<OverlayCell[]>(() =>
  boardOccupiedCellEntries.value.map((cell) => ({
    key: cell.key,
    color: cell.color,
    groupId: cell.groupId,
  })),
);

const rowFilled = computed(() => {
  const counts = Array.from({ length: level.value.rows }, () => 0);
  for (const cell of boardOccupiedCellEntries.value) {
    if (cell.y >= 0 && cell.y < level.value.rows) {
      counts[cell.y] = (counts[cell.y] ?? 0) + getColorScore(cell.color);
    }
  }
  return counts;
});

const rowTargetParts = computed<PuzzleScorePart[][]>(() =>
  buildAxisScoreParts(level.value.rows, hintScoreCells.value, 'row'),
);
const rowFilledParts = computed<PuzzleScorePart[][]>(() =>
  buildAxisScoreParts(level.value.rows, boardOccupiedCellEntries.value, 'row'),
);

const colFilled = computed(() => {
  const counts = Array.from({ length: level.value.cols }, () => 0);
  for (const cell of boardOccupiedCellEntries.value) {
    if (cell.x >= 0 && cell.x < level.value.cols) {
      counts[cell.x] = (counts[cell.x] ?? 0) + getColorScore(cell.color);
    }
  }
  return counts;
});

const colTargetParts = computed<PuzzleScorePart[][]>(() =>
  buildAxisScoreParts(level.value.cols, hintScoreCells.value, 'col'),
);
const colFilledParts = computed<PuzzleScorePart[][]>(() =>
  buildAxisScoreParts(level.value.cols, boardOccupiedCellEntries.value, 'col'),
);

const satisfiedRowCount = computed(
  () =>
    Array.from({ length: level.value.rows }, (_, i) =>
      isAxisSatisfied(
        rowTargetParts.value[i] ?? [],
        rowFilledParts.value[i] ?? [],
        level.value.rowTargets[i] ?? 0,
        rowFilled.value[i] ?? 0,
      ),
    ).filter(Boolean).length,
);
const satisfiedColCount = computed(
  () =>
    Array.from({ length: level.value.cols }, (_, i) =>
      isAxisSatisfied(
        colTargetParts.value[i] ?? [],
        colFilledParts.value[i] ?? [],
        level.value.colTargets[i] ?? 0,
        colFilled.value[i] ?? 0,
      ),
    ).filter(Boolean).length,
);

const placedCount = computed(
  () =>
    pieceInstances.value.filter(
      (inst) => (pieceStates.value[inst.instanceId]?.anchor ?? null) !== null,
    ).length,
);
const totalPieceCount = computed(() => pieceInstances.value.length);

const totalCountByPieceId = computed(() => {
  const map = new Map<string, number>();
  for (const piece of level.value.pieces) {
    map.set(piece.id, Math.max(0, piece.count ?? 1));
  }
  return map;
});

const remainingCountByPieceId = computed(() => {
  const map = new Map<string, number>();
  for (const piece of level.value.pieces) {
    map.set(piece.id, 0);
  }
  for (const inst of pieceInstances.value) {
    const state = pieceStates.value[inst.instanceId];
    if (!state?.anchor) {
      map.set(inst.pieceId, (map.get(inst.pieceId) ?? 0) + 1);
    }
  }
  return map;
});

const pieceTypeEntries = computed(() =>
  level.value.pieces.map((piece) => {
    const remaining = remainingCountByPieceId.value.get(piece.id) ?? 0;
    const total = totalCountByPieceId.value.get(piece.id) ?? 0;
    const used = Math.max(0, total - remaining);
    const activeInstanceId = getBestAvailableInstanceId(piece.id);
    return {
      piece,
      remaining,
      total,
      used,
      rotation: 0,
      canRotate: !!activeInstanceId,
      selected: selectedPieceId.value === piece.id,
    };
  }),
);

const previewPlacement = computed(() => {
  const instanceId = getCurrentPlaceableInstanceId();
  if (!instanceId || !hoverCell.value) return null;
  const state = pieceStates.value[instanceId];
  if (!state || state.anchor) return null;
  const rotation = ((selectedPlacementRotation.value % 4) + 4) % 4;
  return {
    instanceId,
    anchor: getAnchorForHover(instanceId, hoverCell.value, rotation),
    rotation,
  };
});

const previewValid = computed(() => {
  const preview = previewPlacement.value;
  if (!preview) return true;
  return canPlace(preview.instanceId, preview.anchor, preview.rotation);
});

const previewCells = computed<OverlayCell[]>(() => {
  const preview = previewPlacement.value;
  if (!preview) return [];

  const piece = getPieceForInstance(preview.instanceId);
  const relCells = getTransformedCells(preview.instanceId, preview.rotation);
  const color = piece?.color ?? '#9ddb22';

  return relCells.map((cell) => ({
    key: toKey(preview.anchor.x + cell.x, preview.anchor.y + cell.y),
    color,
    groupId: `preview-${preview.instanceId}`,
  }));
});

const previewKeys = computed(() => previewCells.value.map((cell) => cell.key));

const focusRow = computed(() => hoverCell.value?.y ?? null);
const focusCol = computed(() => hoverCell.value?.x ?? null);

const solved = computed(() => {
  const rowOk = Array.from({ length: level.value.rows }, (_, i) =>
    isAxisSatisfied(
      rowTargetParts.value[i] ?? [],
      rowFilledParts.value[i] ?? [],
      level.value.rowTargets[i] ?? 0,
      rowFilled.value[i] ?? 0,
    ),
  ).every(Boolean);
  const colOk = Array.from({ length: level.value.cols }, (_, i) =>
    isAxisSatisfied(
      colTargetParts.value[i] ?? [],
      colFilledParts.value[i] ?? [],
      level.value.colTargets[i] ?? 0,
      colFilled.value[i] ?? 0,
    ),
  ).every(Boolean);
  return rowOk && colOk;
});

const canRotateSelected = computed(() => !!getCurrentPlaceableInstanceId());
const boardAvailableSize = computed(() => {
  const width = Math.max(220, Math.floor(boardStageSize.value.width || 0) - 6);
  const height = Math.max(220, Math.floor(boardStageSize.value.height || 0) - 6);
  const minAxis = Math.min(width, height);
  if (!Number.isFinite(minAxis) || minAxis <= 0) return 620;
  return minAxis;
});

function measureBoardStage(): void {
  const el = boardStageRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  boardStageSize.value = {
    width: Math.max(0, Math.floor(rect.width)),
    height: Math.max(0, Math.floor(rect.height)),
  };
}

function toKey(x: number, y: number): string {
  return `${x},${y}`;
}

function getColorScore(color: string): number {
  return colorWeightByColor.value.get(normalizeColorKey(color)) ?? 1;
}

function normalizeColorKey(color: string): string {
  const safe = (color || '').trim();
  return safe || '#9ddb22';
}

function buildAxisScoreParts(
  axisSize: number,
  cells: Array<Pick<ScorePartCell, 'x' | 'y' | 'color'>>,
  axis: 'row' | 'col',
): PuzzleScorePart[][] {
  const maps = Array.from({ length: axisSize }, () => new Map<string, number>());
  const orders = Array.from({ length: axisSize }, () => [] as string[]);

  for (const cell of cells) {
    const idx = axis === 'row' ? cell.y : cell.x;
    if (idx < 0 || idx >= axisSize) continue;
    const color = normalizeColorKey(cell.color);
    const map = maps[idx];
    const order = orders[idx];
    if (!map || !order) continue;
    if (!map.has(color)) order.push(color);
    map.set(color, (map.get(color) ?? 0) + getColorScore(color));
  }

  return maps.map((map, idx) =>
    (orders[idx] ?? [])
      .map((color) => ({ color, value: map.get(color) ?? 0 }))
      .filter((part) => part.value > 0),
  );
}

function isSameScore(a: number, b: number): boolean {
  return Math.abs((Number(a) || 0) - (Number(b) || 0)) < 1e-6;
}

function isAxisSatisfied(
  targetParts: PuzzleScorePart[],
  currentParts: PuzzleScorePart[],
  targetTotal: number,
  currentTotal: number,
): boolean {
  const hasExplicitParts = targetParts.length > 0;
  if (!hasExplicitParts) return isSameScore(currentTotal, targetTotal);
  return compareScoreParts(targetParts, currentParts).equal;
}

function compareScoreParts(
  targetParts: PuzzleScorePart[],
  currentParts: PuzzleScorePart[],
): { equal: boolean; overflow: boolean } {
  const targetMap = new Map<string, number>();
  const currentMap = new Map<string, number>();

  for (const part of targetParts) {
    const color = normalizeColorKey(part.color);
    targetMap.set(color, (targetMap.get(color) ?? 0) + (Number(part.value) || 0));
  }
  for (const part of currentParts) {
    const color = normalizeColorKey(part.color);
    currentMap.set(color, (currentMap.get(color) ?? 0) + (Number(part.value) || 0));
  }

  const colors = new Set([...targetMap.keys(), ...currentMap.keys()]);
  let equal = true;
  let overflow = false;
  for (const color of colors) {
    const target = targetMap.get(color) ?? 0;
    const current = currentMap.get(color) ?? 0;
    if (!isSameScore(current, target)) equal = false;
    if (current - target > 1e-6) overflow = true;
  }

  return { equal, overflow };
}

function formatScore(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  if (Math.abs(safe - Math.round(safe)) < 1e-6) return String(Math.round(safe));
  return safe.toFixed(1);
}

function getInstance(instanceId: string): PieceInstance | null {
  return pieceInstances.value.find((item) => item.instanceId === instanceId) ?? null;
}

function getPieceForInstance(instanceId: string): PuzzlePieceDefinition | null {
  const inst = getInstance(instanceId);
  if (!inst) return null;
  return pieceById.value.get(inst.pieceId) ?? null;
}

function findFirstAvailableInstanceId(pieceId: string): string | null {
  const found = pieceInstances.value.find((inst) => {
    if (inst.pieceId !== pieceId) return false;
    const state = pieceStates.value[inst.instanceId];
    return !!state && !state.anchor;
  });
  return found?.instanceId ?? null;
}

function getBestAvailableInstanceId(pieceId: string): string | null {
  if (
    selectedPieceId.value === pieceId &&
    selectedPieceInstanceId.value &&
    getInstance(selectedPieceInstanceId.value)?.pieceId === pieceId &&
    !pieceStates.value[selectedPieceInstanceId.value]?.anchor
  ) {
    return selectedPieceInstanceId.value;
  }
  return findFirstAvailableInstanceId(pieceId);
}

function getCurrentPlaceableInstanceId(): string | null {
  if (!selectedPieceId.value) return null;
  const best = getBestAvailableInstanceId(selectedPieceId.value);
  if (selectedPieceInstanceId.value !== best) {
    selectedPieceInstanceId.value = best;
    if (best) {
      const state = pieceStates.value[best];
      selectedPlacementRotation.value = state ? ((state.rotation % 4) + 4) % 4 : 0;
    } else {
      selectedPlacementRotation.value = 0;
    }
  }
  return best;
}

function rotateCells(cells: GridCell[], rotation: number): GridCell[] {
  const normRotation = ((rotation % 4) + 4) % 4;
  const rotated = cells.map((cell) => {
    if (normRotation === 0) return { x: cell.x, y: cell.y };
    if (normRotation === 1) return { x: cell.y, y: -cell.x };
    if (normRotation === 2) return { x: -cell.x, y: -cell.y };
    return { x: -cell.y, y: cell.x };
  });
  const minX = Math.min(...rotated.map((cell) => cell.x));
  const minY = Math.min(...rotated.map((cell) => cell.y));
  return rotated.map((cell) => ({ x: cell.x - minX, y: cell.y - minY }));
}

function cloneShapeCells(cells: GridCell[]): GridCell[] {
  return cells.map((cell) => ({ x: cell.x, y: cell.y }));
}

function normalizeShapeCells(cells: GridCell[]): GridCell[] {
  if (!cells.length) return [];
  const minX = Math.min(...cells.map((cell) => cell.x));
  const minY = Math.min(...cells.map((cell) => cell.y));
  return cells.map((cell) => ({ x: cell.x - minX, y: cell.y - minY }));
}

function getDefaultShapeForPiece(pieceId: string): GridCell[] {
  const piece = pieceById.value.get(pieceId);
  if (!piece) return [];
  return normalizeShapeCells(piece.cells);
}

function getTransformedCells(instanceId: string, rotation: number): GridCell[] {
  const state = pieceStates.value[instanceId];
  if (!state?.shape?.length) return [];
  return rotateCells(state.shape, rotation);
}

function getFixedPlacementCells(fixed: PuzzleFixedPlacementDefinition): GridCell[] {
  if (!fixed.cells?.length) return [];
  const base = normalizeShapeCells(fixed.cells);
  const rotation = (((fixed.rotation ?? 0) % 4) + 4) % 4;
  return rotateCells(base, rotation);
}

function getAnchorForHover(instanceId: string, hover: GridCell, rotation: number): GridCell {
  const relCells = getTransformedCells(instanceId, rotation);
  if (!relCells.length) return { ...hover };

  // 计算几何中心
  const centerX = relCells.reduce((sum, cell) => sum + cell.x, 0) / relCells.length;
  const centerY = relCells.reduce((sum, cell) => sum + cell.y, 0) / relCells.length;

  // 找到距离几何中心最近的格子
  let closestCell: GridCell | undefined;
  let minDist = Number.POSITIVE_INFINITY;
  for (const cell of relCells) {
    const dx = cell.x - centerX;
    const dy = cell.y - centerY;
    const dist = dx * dx + dy * dy;
    if (dist < minDist) {
      minDist = dist;
      closestCell = cell;
    }
  }

  // 如果找不到合适的格子，使用第一个
  if (!closestCell) closestCell = relCells[0];

  // 鼠标对准最近的格子，所以anchor需要偏移
  return {
    x: hover.x - (closestCell?.x ?? 0),
    y: hover.y - (closestCell?.y ?? 0),
  };
}

function buildOccupiedMap(excludeInstanceId?: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const fixedCell of fixedOccupiedCellEntries.value) {
    map.set(fixedCell.key, `fixed:${fixedCell.fixedId}`);
  }
  for (const inst of pieceInstances.value) {
    if (excludeInstanceId && inst.instanceId === excludeInstanceId) continue;
    const state = pieceStates.value[inst.instanceId];
    if (!state?.anchor) continue;
    const relCells = getTransformedCells(inst.instanceId, state.rotation);
    for (const rel of relCells) {
      map.set(toKey(state.anchor.x + rel.x, state.anchor.y + rel.y), inst.instanceId);
    }
  }
  return map;
}

function canPlace(instanceId: string, anchor: GridCell, rotation: number): boolean {
  const relCells = getTransformedCells(instanceId, rotation);
  if (!relCells.length) return false;
  const others = buildOccupiedMap(instanceId);
  for (const rel of relCells) {
    const x = anchor.x + rel.x;
    const y = anchor.y + rel.y;
    if (x < 0 || x >= level.value.cols || y < 0 || y >= level.value.rows) return false;
    const key = toKey(x, y);
    if (blockedSet.value.has(key)) return false;
    if (others.has(key)) return false;
  }
  return true;
}

function placePiece(instanceId: string, anchor: GridCell, rotation: number): boolean {
  const state = pieceStates.value[instanceId];
  if (!state || state.anchor) return false;
  const safeRotation = ((rotation % 4) + 4) % 4;
  if (!canPlace(instanceId, anchor, safeRotation)) return false;
  pieceStates.value = {
    ...pieceStates.value,
    [instanceId]: {
      ...state,
      rotation: safeRotation,
      anchor: { ...anchor },
    },
  };
  return true;
}

function pickupPiece(instanceId: string): void {
  const state = pieceStates.value[instanceId];
  const inst = getInstance(instanceId);
  if (!state || !inst || !state.anchor) return;
  const currentRotation = ((state.rotation % 4) + 4) % 4;
  pieceStates.value = {
    ...pieceStates.value,
    [instanceId]: {
      ...state,
      anchor: null,
    },
  };
  selectedPieceId.value = inst.pieceId;
  selectedPieceInstanceId.value = instanceId;
  selectedPlacementRotation.value = currentRotation;
}

function selectPieceType(pieceId: string): void {
  selectedPieceId.value = pieceId;
  const nextInstanceId = findFirstAvailableInstanceId(pieceId);
  selectedPieceInstanceId.value = nextInstanceId;
  if (nextInstanceId) {
    const state = pieceStates.value[nextInstanceId];
    selectedPlacementRotation.value = state ? ((state.rotation % 4) + 4) % 4 : 0;
  } else {
    selectedPlacementRotation.value = 0;
  }
}

function rotatePieceType(pieceId: string): void {
  if (selectedPieceId.value !== pieceId) {
    selectedPieceId.value = pieceId;
    const nextInstanceId = findFirstAvailableInstanceId(pieceId);
    selectedPieceInstanceId.value = nextInstanceId;
    if (nextInstanceId) {
      const state = pieceStates.value[nextInstanceId];
      selectedPlacementRotation.value = state ? ((state.rotation % 4) + 4) % 4 : 0;
    } else {
      selectedPlacementRotation.value = 0;
    }
  }
  const instanceId = getCurrentPlaceableInstanceId();
  if (!instanceId) return;
  selectedPlacementRotation.value = (selectedPlacementRotation.value + 1) % 4;
}

function rotateSelectedPiece(): void {
  if (!selectedPieceId.value) return;
  rotatePieceType(selectedPieceId.value);
}

function onCellHover(cell: GridCell): void {
  hoverCell.value = cell;
}

function cancelSelection(): void {
  selectedPieceId.value = null;
  selectedPieceInstanceId.value = null;
}

function onCellClick(cell: GridCell): void {
  const cellKey = toKey(cell.x, cell.y);
  const movableOccupant = movableOccupiedMap.value.get(cellKey);
  if (movableOccupant) {
    pickupPiece(movableOccupant);
    return;
  }
  if (fixedOccupiedMap.value.has(cellKey)) return;

  const instanceId = getCurrentPlaceableInstanceId();
  if (!instanceId) return;
  const rotation = ((selectedPlacementRotation.value % 4) + 4) % 4;

  const anchor = getAnchorForHover(instanceId, cell, rotation);
  const placed = placePiece(instanceId, anchor, rotation);
  if (placed && selectedPieceId.value) {
    selectedPieceInstanceId.value = findFirstAvailableInstanceId(selectedPieceId.value);
  }
}

function resetAll(): void {
  pieceStates.value = buildResetPieceStates();
  if (selectedPieceId.value) {
    selectedPieceInstanceId.value = findFirstAvailableInstanceId(selectedPieceId.value);
  } else {
    selectedPieceId.value = level.value.pieces[0]?.id ?? null;
    selectedPieceInstanceId.value = selectedPieceId.value
      ? findFirstAvailableInstanceId(selectedPieceId.value)
      : null;
  }
  selectedPlacementRotation.value = 0;
  hoverCell.value = null;
}

function buildResetPieceStates(): Record<string, PieceRuntimeState> {
  return Object.fromEntries(
    pieceInstances.value.map((inst) => {
      const prevState = pieceStates.value[inst.instanceId];
      const shape = prevState?.shape?.length
        ? cloneShapeCells(prevState.shape)
        : cloneShapeCells(getDefaultShapeForPiece(inst.pieceId));
      return [
        inst.instanceId,
        {
          rotation: 0,
          anchor: null,
          shape,
        } as PieceRuntimeState,
      ];
    }),
  );
}

function autoSolve(): void {
  if (autoSolving.value) return;
  autoSolving.value = true;

  try {
    const hasHints = level.value.hintCells.length > 0;
    const strictOptions = {
      exactHintCover: hasHints,
      onlyHintCells: hasHints,
      enforceHintColors: true,
      timeoutMs: 4_000,
      maxNodes: 900_000,
    };
    const relaxedOptions = {
      exactHintCover: false,
      onlyHintCells: false,
      enforceHintColors: true,
      timeoutMs: 4_000,
      maxNodes: 900_000,
    };

    let solverOptions = strictOptions;
    let result = solveLevel(level.value, strictOptions);
    if (result.status === 'no-solution' && hasHints) {
      const relaxedResult = solveLevel(level.value, relaxedOptions);
      if (relaxedResult.status !== 'no-solution') {
        result = relaxedResult;
        solverOptions = relaxedOptions;
      }
    }

    if (result.status !== 'solved' || !result.solution) {
      if (result.status === 'timeout') {
        $q.notify({ type: 'warning', message: t('autoSolveTimeout', { nodes: result.nodes }) });
        return;
      }
      if (result.status === 'node-limit') {
        $q.notify({
          type: 'warning',
          message: t('autoSolveLimitReached', { nodes: result.nodes }),
        });
        return;
      }
      $q.notify({ type: 'negative', message: t('autoSolveFailed') });
      return;
    }

    const verify = verifySolution(level.value, result.solution, {
      exactHintCover: solverOptions.exactHintCover,
      enforceHintColors: solverOptions.enforceHintColors,
    });
    if (!verify.ok) {
      const firstError = verify.errors[0] ?? t('validationFailed');
      $q.notify({ type: 'negative', message: t('autoSolveResultInvalid', { error: firstError }) });
      return;
    }

    const availableByPieceId = new Map<string, string[]>();
    for (const inst of pieceInstances.value) {
      const queue = availableByPieceId.get(inst.pieceId) ?? [];
      queue.push(inst.instanceId);
      availableByPieceId.set(inst.pieceId, queue);
    }

    const missingPieceIds = new Set<string>();
    const exhaustedPieceIds = new Set<string>();
    const nextStates = buildResetPieceStates();
    for (const solvedPlacement of result.solution) {
      const queue = availableByPieceId.get(solvedPlacement.pieceId);
      if (!queue) {
        missingPieceIds.add(solvedPlacement.pieceId);
        continue;
      }
      const instanceId = queue.shift();
      if (!instanceId) {
        exhaustedPieceIds.add(solvedPlacement.pieceId);
        continue;
      }
      const state = nextStates[instanceId];
      if (!state) {
        missingPieceIds.add(solvedPlacement.pieceId);
        continue;
      }
      nextStates[instanceId] = {
        ...state,
        rotation: ((solvedPlacement.rot % 4) + 4) % 4,
        anchor: { ...solvedPlacement.anchor },
      };
    }

    if (missingPieceIds.size > 0 || exhaustedPieceIds.size > 0) {
      const labels: string[] = [];
      if (missingPieceIds.size > 0)
        labels.push(`${t('unknownBlocks')}: ${Array.from(missingPieceIds).join(', ')}`);
      if (exhaustedPieceIds.size > 0)
        labels.push(`${t('instancesExhausted')}: ${Array.from(exhaustedPieceIds).join(', ')}`);
      $q.notify({ type: 'negative', message: t('autoSolveFailed') });
      return;
    }

    pieceStates.value = nextStates;
    if (selectedPieceId.value) {
      selectedPieceInstanceId.value = findFirstAvailableInstanceId(selectedPieceId.value);
    } else {
      selectedPieceId.value = level.value.pieces[0]?.id ?? null;
      selectedPieceInstanceId.value = selectedPieceId.value
        ? findFirstAvailableInstanceId(selectedPieceId.value)
        : null;
    }
    selectedPlacementRotation.value = 0;
    hoverCell.value = null;

    $q.notify({
      type: 'positive',
      message: t('autoSolveComplete', { count: result.solution.length, nodes: result.nodes }),
    });
  } finally {
    autoSolving.value = false;
  }
}

function onKeyDown(event: KeyboardEvent): void {
  if (isTypingTarget(event.target)) return;

  const bindings = keyBindingsStore.bindings;

  if (eventMatchesBinding(event, bindings.circuitRotate)) {
    event.preventDefault();
    rotateSelectedPiece();
    return;
  }
  if (eventMatchesBinding(event, bindings.circuitDeselect)) {
    selectedPieceId.value = null;
    selectedPieceInstanceId.value = null;
    return;
  }
  if (eventMatchesBinding(event, bindings.circuitDelete) && selectedPieceInstanceId.value) {
    event.preventDefault();
    pickupPiece(selectedPieceInstanceId.value);
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (target.isContentEditable) return true;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', measureBoardStage);
  measureBoardStage();
  if (typeof ResizeObserver !== 'undefined') {
    boardStageResizeObserver = new ResizeObserver(() => {
      measureBoardStage();
    });
    if (boardStageRef.value) boardStageResizeObserver.observe(boardStageRef.value);
  }
});
onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('resize', measureBoardStage);
  boardStageResizeObserver?.disconnect();
  boardStageResizeObserver = null;
});

watch(solved, (isSolved) => {
  emit('solved-change', isSolved);
  if (isSolved) {
    emit('solved');
    showVictory.value = true;
  }
});
</script>

<style scoped>
.circuit-game {
  --cg-panel-border: rgba(106, 133, 125, 0.35);
  --cg-board-bg: radial-gradient(
    circle at 10% 10%,
    rgba(231, 243, 239, 0.96),
    rgba(219, 233, 228, 0.98)
  );
  --cg-surface-bg: rgba(246, 251, 249, 0.94);
  --cg-muted-bg: rgba(236, 245, 242, 0.92);
  --cg-title: #29443f;
  --cg-text: #2c4a44;
  --cg-muted-text: rgba(62, 89, 83, 0.9);
  --cg-btn-bg: rgba(232, 241, 238, 0.95);
  --cg-btn-text: #2f4c46;
  --cg-btn-border: rgba(110, 139, 131, 0.45);
  --cg-btn-hover: rgba(123, 177, 97, 0.86);
  --cg-btn-active: #6f9f23;
  --cg-overlay-bg: rgba(18, 25, 24, 0.48);
  --cg-modal-bg: linear-gradient(145deg, rgba(246, 252, 248, 0.98), rgba(230, 241, 237, 0.99));
  --cg-modal-title: #3d6b14;
  --cg-modal-text: rgba(44, 66, 61, 0.92);
  --cg-victory-btn-bg: linear-gradient(145deg, rgba(167, 220, 70, 0.28), rgba(146, 199, 56, 0.2));
  --cg-victory-btn-hover-bg: linear-gradient(
    145deg,
    rgba(167, 220, 70, 0.4),
    rgba(146, 199, 56, 0.32)
  );
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 14px;
  height: clamp(320px, calc(100dvh - 170px), 920px);
  min-height: 0;
}
.circuit-game--dark {
  --cg-panel-border: rgba(151, 168, 164, 0.35);
  --cg-board-bg: radial-gradient(circle at 10% 10%, rgba(42, 18, 12, 0.36), rgba(0, 10, 14, 0.95));
  --cg-surface-bg: rgba(14, 21, 21, 0.9);
  --cg-muted-bg: rgba(18, 30, 30, 0.8);
  --cg-title: #e8ff9f;
  --cg-text: #dbebe6;
  --cg-muted-text: rgba(205, 220, 217, 0.85);
  --cg-btn-bg: rgba(26, 35, 34, 0.95);
  --cg-btn-text: #d2e1dd;
  --cg-btn-border: rgba(163, 185, 179, 0.4);
  --cg-btn-hover: rgba(198, 255, 73, 0.9);
  --cg-btn-active: #e8ff9f;
  --cg-overlay-bg: rgba(0, 10, 14, 0.85);
  --cg-modal-bg: linear-gradient(145deg, rgba(20, 35, 32, 0.98), rgba(6, 14, 12, 0.99));
  --cg-modal-title: #e8ff9f;
  --cg-modal-text: rgba(205, 220, 217, 0.9);
  --cg-victory-btn-bg: linear-gradient(145deg, rgba(198, 255, 73, 0.25), rgba(157, 219, 34, 0.18));
  --cg-victory-btn-hover-bg: linear-gradient(
    145deg,
    rgba(198, 255, 73, 0.35),
    rgba(157, 219, 34, 0.28)
  );
}

.board-section {
  background: var(--cg-board-bg);
  border: 1px solid var(--cg-panel-border);
  border-radius: 12px;
  padding: 12px;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.board-stage {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  align-items: flex-start;
}

.board-title h2 {
  margin: 0;
  color: var(--cg-title);
  font-size: 18px;
  font-weight: 700;
}

.board-title p {
  margin: 6px 0 12px;
  color: var(--cg-muted-text);
  font-size: 13px;
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  max-height: 100%;
  overflow: hidden;
}

.status-card {
  border: 1px solid var(--cg-panel-border);
  border-radius: 10px;
  background: var(--cg-surface-bg);
  padding: 10px;
  color: var(--cg-text);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.status-line {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.status-hint {
  border-radius: 8px;
  border: 1px solid var(--cg-panel-border);
  background: var(--cg-muted-bg);
  color: var(--cg-text);
  padding: 6px 8px;
  font-size: 13px;
}

.status-hint--ok {
  border-color: rgba(201, 255, 78, 0.78);
  color: var(--cg-btn-active);
  background: rgba(124, 164, 35, 0.24);
}

.weight-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.weight-title {
  font-size: 11px;
  color: var(--cg-muted-text);
}

.weight-item {
  border: 1px solid rgba(160, 183, 176, 0.4);
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.weight-color {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  border: 1px solid rgba(228, 239, 236, 0.3);
}

.display-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.display-switch--single {
  grid-template-columns: 1fr;
}

.switch-btn {
  border: 1px solid var(--cg-btn-border);
  border-radius: 6px;
  background: var(--cg-btn-bg);
  color: var(--cg-btn-text);
  font-size: 12px;
  padding: 6px 8px;
  cursor: pointer;
}

.switch-btn--active {
  border-color: var(--cg-btn-hover);
  color: var(--cg-btn-active);
  box-shadow: inset 0 0 0 1px rgba(198, 255, 73, 0.35);
}

.status-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.action-btn {
  border: 1px solid var(--cg-btn-border);
  border-radius: 6px;
  background: var(--cg-btn-bg);
  color: var(--cg-btn-text);
  font-size: 12px;
  line-height: 1;
  padding: 8px 10px;
  cursor: pointer;
}

.action-btn:hover:not(:disabled) {
  border-color: var(--cg-btn-hover);
  color: var(--cg-btn-active);
}

.action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.piece-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: auto;
  overscroll-behavior: contain;
  flex: 1;
  min-height: 0;
  padding-right: 4px;
}

.piece-type-wrap--empty {
  filter: saturate(0.75);
}

/* Victory Overlay */
.victory-overlay {
  position: fixed;
  inset: 0;
  background: var(--cg-overlay-bg);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.victory-modal {
  background: var(--cg-modal-bg);
  border: 2px solid rgba(198, 255, 73, 0.8);
  border-radius: 16px;
  padding: 32px 40px;
  text-align: center;
  box-shadow:
    0 0 40px rgba(198, 255, 73, 0.3),
    0 0 80px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  max-width: 320px;
}

.victory-icon {
  font-size: 64px;
  margin-bottom: 16px;
  animation: bounce 0.6s ease-out;
}

.victory-title {
  margin: 0 0 12px;
  color: var(--cg-modal-title);
  font-size: 28px;
  font-weight: 700;
  text-shadow: 0 0 20px rgba(198, 255, 73, 0.5);
}

.victory-message {
  margin: 0 0 24px;
  color: var(--cg-modal-text);
  font-size: 15px;
  line-height: 1.5;
}

.victory-btn {
  background: var(--cg-victory-btn-bg);
  border: 2px solid rgba(198, 255, 73, 0.8);
  border-radius: 8px;
  color: var(--cg-modal-title);
  font-size: 16px;
  font-weight: 600;
  padding: 12px 32px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.victory-btn:hover {
  background: var(--cg-victory-btn-hover-bg);
  box-shadow: 0 0 20px rgba(198, 255, 73, 0.4);
  transform: translateY(-1px);
}

.victory-btn:active {
  transform: translateY(0);
}

@keyframes bounce {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.victory-enter-active,
.victory-leave-active {
  transition: opacity 0.3s ease;
}

.victory-enter-from,
.victory-leave-to {
  opacity: 0;
}

.victory-enter-active .victory-modal {
  animation: slideUp 0.4s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(30px) scale(0.9);
    opacity: 0;
  }
  to {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

@media (max-width: 1160px) {
  .circuit-game {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
    height: auto;
  }

  .panel-section {
    overflow: visible;
  }

  .piece-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    overflow: visible;
    flex: initial;
  }
}

@media (max-width: 700px) {
  .piece-list {
    grid-template-columns: 1fr;
  }
}
</style>
