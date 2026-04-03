<template>
  <div :class="['level-editor', isDark ? 'level-editor--dark' : 'level-editor--light']">
    <section class="editor-card">
      <h3>{{ t('puzzleLevelEditor') }}</h3>
      <div class="editor-grid">
        <label class="editor-field"
          ><span>id</span><input v-model.trim="levelId" type="text"
        /></label>
        <label class="editor-field"
          ><span>name</span><input v-model.trim="levelName" type="text"
        /></label>
        <label class="editor-field"
          ><span>rows</span><input v-model.number="rows" type="number" min="1" max="24"
        /></label>
        <label class="editor-field"
          ><span>cols</span><input v-model.number="cols" type="number" min="1" max="24"
        /></label>
      </div>

      <div class="tool-row">
        <span class="tool-label">{{ t('tool') }}</span>
        <button
          type="button"
          class="editor-btn"
          :class="{ 'editor-btn--active': boardTool === 'place' }"
          @click="boardTool = 'place'"
        >
          {{ t('place') }}
        </button>
        <button
          type="button"
          class="editor-btn"
          :class="{ 'editor-btn--active': boardTool === 'fixed' }"
          @click="boardTool = 'fixed'"
        >
          {{ t('fixedBlock') }}
        </button>
        <button
          type="button"
          class="editor-btn"
          :class="{ 'editor-btn--active': boardTool === 'blocked' }"
          @click="boardTool = 'blocked'"
        >
          {{ t('disable') }}
        </button>
        <button
          type="button"
          class="editor-btn"
          :class="{ 'editor-btn--active': boardTool === 'hint' }"
          @click="boardTool = 'hint'"
        >
          {{ t('hint') }}
        </button>
        <button
          type="button"
          class="editor-btn"
          :class="{ 'editor-btn--active': boardTool === 'paint' }"
          @click="boardTool = 'paint'"
        >
          {{ t('paint') }}
        </button>
        <button
          type="button"
          class="editor-btn"
          :class="{ 'editor-btn--active': boardTool === 'erase' }"
          @click="boardTool = 'erase'"
        >
          {{ t('erase') }}
        </button>
        <button
          type="button"
          class="editor-btn"
          :disabled="!selectedPieceUid"
          @click="rotateSelectedPlacePiece"
        >
          {{ t('rotate') }}(R)
        </button>
        <button type="button" class="editor-btn" @click="generateHintsFromPlacements">
          {{ t('generateHintFromPlacement') }}
        </button>
        <button type="button" class="editor-btn" @click="clearHints">{{ t('clearHints') }}</button>
        <button type="button" class="editor-btn" @click="clearPlacements">
          {{ t('clearPlacements') }}
        </button>
      </div>

      <div class="palette-panel">
        <div class="palette-swatches">
          <button
            v-for="swatch in presetPalette"
            :key="swatch"
            type="button"
            class="palette-swatch"
            :class="{ 'palette-swatch--active': selectedPaintColor === swatch }"
            :style="{ backgroundColor: swatch }"
            @click="selectPaletteColor(swatch)"
          />
        </div>
        <div class="palette-custom-row">
          <input
            v-model.trim="paletteColorInput"
            type="text"
            class="palette-input"
            placeholder="#9ddb22"
          />
          <button type="button" class="editor-btn" @click="applyPaletteInput">
            {{ t('applyColor') }}
          </button>
          <span class="palette-preview" :style="{ backgroundColor: selectedPaintColor }" />
        </div>
        <div v-if="paletteError" class="palette-error">{{ paletteError }}</div>
      </div>

      <CircuitPuzzleBoard
        :rows="rows"
        :cols="cols"
        :blocked-keys="blockedKeys"
        :locked-keys="fixedOccupiedKeys"
        :hint-keys="finalHintKeys"
        :hint-cells="hintOverlayCells"
        :show-hints="true"
        :occupied-keys="placedOccupiedKeys"
        :occupied-cells="placedOccupiedCells"
        :preview-keys="editorPreviewKeys"
        :preview-cells="editorPreviewCells"
        :preview-valid="editorPreviewValid"
        :row-targets="computedRowTargets"
        :row-filled="placedRowScores"
        :row-target-parts="rowTargetParts"
        :row-filled-parts="rowFilledParts"
        :col-targets="computedColTargets"
        :col-filled="placedColScores"
        :col-target-parts="colTargetParts"
        :col-filled-parts="colFilledParts"
        :selected-piece-name="selectedPlacePieceName"
        :focus-row="editorFocusRow"
        :focus-col="editorFocusCol"
        display-mode="graphic"
        @cell-click="onBoardCellClick"
        @cell-hover="onBoardCellHover"
        @board-leave="boardHover = null"
        @cancel-selection="onBoardCancelSelection"
      />

      <div class="summary-row">
        <span>{{ t('hintCellCount') }}: {{ finalHintKeys.length }}</span>
        <span>{{ t('disabledCellCount') }}: {{ blockedKeys.length }}</span>
        <span>{{ t('fixedBlockCellCount') }}: {{ fixedOccupiedKeys.length }}</span>
        <span>{{ t('targetTotalScore') }}: {{ formatScore(totalTargetScore) }}</span>
        <label class="toggle-field"
          ><input v-model="keepUnusedPieces" type="checkbox" /><span>{{
            t('exportKeepUnusedPieces')
          }}</span></label
        >
      </div>
    </section>

    <section class="editor-card">
      <h3>{{ t('pieceShapeCanvas') }}</h3>
      <div class="shape-json-layout">
        <div class="shape-pane">
          <div v-if="activeShapePiece" class="shape-title">
            {{ t('currentEditing') }}: {{ activeShapePiece.name }} ({{ activeShapePiece.id }})
          </div>
          <div v-else class="shape-title">{{ t('noPieceSelected') }}</div>
          <p class="shape-tip">
            {{ t('canvasSimplified', { size: pieceCanvasSize }) }}
          </p>

          <CircuitPuzzleShapeCanvas
            :rows="pieceCanvasSize"
            :cols="pieceCanvasSize"
            :filled-keys="activeShapeKeys"
            :fill-color="activeShapeColor"
            :hover-key="shapeHoverKey"
            :cell-size="28"
            @cell-click="onShapeCellClick"
            @cell-hover="onShapeCellHover"
            @board-leave="shapeHover = null"
          />

          <div class="editor-actions">
            <button
              type="button"
              class="editor-btn"
              :disabled="!activeShapePiece"
              @click="normalizeActiveShape"
            >
              归一化到左上
            </button>
          </div>
        </div>

        <div class="shape-right-pane">
          <details class="json-panel">
            <summary class="json-panel-summary">关卡 JSON</summary>
            <div class="json-panel-body">
              <p class="editor-tip">
                支持字段：<code>board.hintCells</code>、<code>board.hintColors</code>、<code>board.blocked</code>、<code>board.fixedPlacements</code>、<code>pieces[].count</code>、<code>scoring.colorWeights</code>。
              </p>
              <label class="editor-field"
                ><span>JSON Preview</span><textarea :value="jsonPreview" rows="14" readonly />
              </label>
              <label class="editor-field"
                ><span>Import JSON</span><textarea v-model="importJsonText" rows="12" />
              </label>

              <div class="editor-actions">
                <button type="button" class="editor-btn" @click="fillImportWithCurrentJson">
                  填入当前 JSON
                </button>
                <button
                  type="button"
                  class="editor-btn editor-btn--primary"
                  @click="applyImportJson"
                >
                  从 JSON 覆盖编辑器
                </button>
              </div>
            </div>
          </details>

          <div class="score-panel">
            <h3>颜色分值</h3>
            <div class="color-weight-grid">
              <label
                v-for="entry in colorWeightEntries"
                :key="entry.color"
                class="editor-field color-weight-item"
              >
                <span
                  ><i class="color-chip" :style="{ backgroundColor: entry.color }" />{{
                    entry.color
                  }}</span
                >
                <input
                  :value="entry.weight"
                  type="number"
                  min="0"
                  step="0.1"
                  @input="
                    setColorWeight(entry.color, Number(($event.target as HTMLInputElement).value))
                  "
                />
              </label>
            </div>
          </div>

          <div class="editor-actions">
            <button type="button" class="editor-btn" @click="restoreFromCurrent">
              从当前关卡重载
            </button>
            <button type="button" class="editor-btn" @click="resetAsBlank">清空为新模板</button>
            <button type="button" class="editor-btn" @click="autoSolveLevel">自动解题</button>
            <button type="button" class="editor-btn" @click="generateShareLink">
              生成分享链接
            </button>
            <button type="button" class="editor-btn" @click="openAdvancedShare">高级共享</button>
            <button type="button" class="editor-btn editor-btn--primary" @click="applyToGame">
              应用到试玩
            </button>
          </div>
          <label v-if="shareUrlText" class="editor-field">
            <span>最近生成的分享链接</span>
            <textarea :value="shareUrlText" rows="2" readonly />
          </label>

          <div v-if="buildErrors.length" class="editor-errors">
            <div v-for="(err, i) in buildErrors" :key="`err-${i}`">{{ err }}</div>
          </div>
        </div>
      </div>

      <div v-if="importErrors.length" class="editor-errors">
        <div v-for="(err, i) in importErrors" :key="`import-${i}`">{{ err }}</div>
      </div>
    </section>

    <CircuitPuzzlePiecePanel
      :pieces="pieces"
      :selected-piece-uid="selectedPieceUid"
      :remaining-count-by-uid="remainingCountByUid"
      :used-count-by-uid="usedCountByUid"
      :piece-list-rotation-by-uid="pieceListRotationByUid"
      :favorite-pieces="favoritePieces"
      :piece-panel-state="piecePanelState"
      :piece-panel-style="piecePanelStyle"
      :piece-panel-min-style="piecePanelMinStyle"
      :piece-panel-split-ratio="piecePanelSplitRatio"
      :to-piece-definition="toPieceDefinition"
      :to-favorite-definition="toFavoriteDefinition"
      @add-piece="addPiece"
      @set-docked="setPiecePanelDocked"
      @minimize="minimizePiecePanel"
      @restore="restorePiecePanel"
      @select-piece="selectPiece"
      @select-piece-shape="selectPieceForShape"
      @rotate-piece-shape="rotatePieceShape"
      @clear-piece-cells="clearPieceCells"
      @favorite-piece="addFavoritePiece"
      @import-favorite="importFavoritePiece"
      @remove-favorite="removeFavoritePiece"
      @update-piece-panel-split-ratio="setPiecePanelSplitRatio"
      @remove-piece="removePiece"
      @rotate-piece-in-palette="rotatePieceInPalette"
      @head-pointer-down="onPiecePanelHeadPointerDown"
      @resize-start="startPiecePanelResize"
    />
  </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import CircuitPuzzleBoard from './CircuitPuzzleBoard.vue';
import CircuitPuzzlePiecePanel from './CircuitPuzzlePiecePanel.vue';
import CircuitPuzzleShapeCanvas from './CircuitPuzzleShapeCanvas.vue';
import { useSettingsStore } from 'src/stores/settings';
import { useKeyBindingsStore, eventMatchesBinding } from 'src/stores/keybindings';
import { storage } from 'src/utils/storage';
import { appPath } from 'src/utils/app-path';
import { solveLevel, verifySolution } from './auto-solver';
import { cloneLevel } from './defaultLevel';

const { t } = useI18n();

const keyBindingsStore = useKeyBindingsStore();
import {
  buildAxisScoreParts,
  cellsForShape,
  cloneShapeCells,
  formatScore,
  getPlacementAnchorFromPointer,
  keyOf,
  normalizeHexColor,
  normalizeShapeCells,
  parseKey,
  rotateCells,
  sumScoreParts,
  uniqueKeys,
} from './editor-utils';
import { levelToJson } from './levelFormat';
import {
  multiPuzzleToJson,
  multiPuzzleToSingleLevel,
  parsePuzzleJsonDocument,
  type PuzzleMultiLevelDefinition,
} from './multi-level-format';
import { collectType2BlockIds, parseType2BlockJson } from './type2-format';
import { buildSharePayload, getShareValue, resolveShareMode } from './url-share-options';
import { encodeMultiLevelForUrlV3 } from './url-format-v3';
import type {
  GridCell,
  PuzzleLevelDefinition,
  PuzzlePieceDefinition,
  PuzzleScorePart,
} from './types';

type BoardTool = 'place' | 'fixed' | 'blocked' | 'hint' | 'paint' | 'erase';
type PieceForm = {
  uid: string;
  id: string;
  name: string;
  color: string;
  count: number;
  cells: string[];
};
type FavoritePiece = {
  key: string;
  id: string;
  name: string;
  color: string;
  count: number;
  cells: string[];
  readonly?: boolean;
  source?: 'user' | 'type2';
};
type Placement = {
  placementId: string;
  pieceUid: string;
  anchor: GridCell;
  rotation: number;
  shape: GridCell[];
  color?: string;
};
type OverlayCell = { key: string; color: string; groupId: string };
type ScorePartCell = { x: number; y: number; color: string };
type PiecePanelState = {
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  docked: boolean;
};
type PiecePanelDragSession = {
  mode: 'move' | 'resize';
  pointerId: number;
  startX: number;
  startY: number;
  startLeft: number;
  startTop: number;
  startWidth: number;
  startHeight: number;
};

const PIECE_PANEL_MIN_WIDTH = 340;
const PIECE_PANEL_MIN_HEIGHT = 280;
const FAVORITE_STORAGE_KEY = 'jei.circuitPuzzle.favoritePieces.v1';
const BUILTIN_TYPE2_FAVORITE_PREFIX = 'builtin-type2:';
const PIECE_PANEL_DEFAULT: PiecePanelState = {
  x: 16,
  y: 120,
  width: 420,
  height: 620,
  minimized: false,
  docked: false,
};
const PIECE_PANEL_EDGE_GAP = 8;

const props = defineProps<{
  level: PuzzleLevelDefinition;
  multiPuzzle?: PuzzleMultiLevelDefinition | null;
  activeStageIndex?: number;
}>();
const emit = defineEmits<{
  (e: 'update:level', level: PuzzleLevelDefinition): void;
  (
    e: 'import:multi-puzzle',
    payload: { puzzle: PuzzleMultiLevelDefinition; stageIndex: number },
  ): void;
}>();
const $q = useQuasar();
const isDark = computed(() => $q.dark.isActive);
const route = useRoute();
const router = useRouter();
const settingsStore = useSettingsStore();

const levelId = ref('');
const levelName = ref('');
const rows = ref(6);
const cols = ref(6);
const blockedKeys = ref<string[]>([]);
const manualHintColorByKey = ref<Record<string, string>>({});
const manualHintGroupByKey = ref<Record<string, string>>({});
const boardTool = ref<BoardTool>('place');
const selectedPaintColor = ref('#9ddb22');
const paletteColorInput = ref('#9ddb22');
const paletteError = ref('');
const keepUnusedPieces = ref(true);

const pieces = ref<PieceForm[]>([]);
const selectedPieceUid = ref<string | null>(null);
const shapePieceUid = ref<string | null>(null);
const selectedPlacementRotation = ref(0);
const pieceListRotationByUid = ref<Record<string, number>>({});
const colorWeights = ref<Record<string, number>>({});
const userFavoritePieces = ref<FavoritePiece[]>([]);
const builtinType2FavoritePieces = ref<FavoritePiece[]>([]);
const favoritePieces = computed<FavoritePiece[]>(() => [
  ...userFavoritePieces.value,
  ...builtinType2FavoritePieces.value,
]);

const placements = ref<Placement[]>([]);
const fixedColorByKey = ref<Record<string, string>>({});
const boardHover = ref<GridCell | null>(null);
const shapeHover = ref<GridCell | null>(null);
const buildErrors = ref<string[]>([]);
const importErrors = ref<string[]>([]);
const importJsonText = ref('');
const shareUrlText = ref('');
const piecePanelState = ref<PiecePanelState>(
  sanitizePiecePanelState(settingsStore.circuitEditorPiecePanel),
);
const piecePanelSplitRatio = ref(
  clampNumber(
    typeof settingsStore.circuitEditorPiecePanelSplitRatio === 'number'
      ? settingsStore.circuitEditorPiecePanelSplitRatio
      : 0.5,
    0.2,
    0.8,
  ),
);
const piecePanelDrag = ref<PiecePanelDragSession | null>(null);
const DRAFT_SYNC_DELAY_MS = 180;
let draftSyncTimer: ReturnType<typeof setTimeout> | null = null;
let suppressDraftSync = false;
let pendingSelfDraftSignature: string | null = null;

const pieceCanvasSize = 6;
const presetPalette = [
  '#9ddb22',
  '#89d817',
  '#b7f227',
  '#8fd31d',
  '#52b8ff',
  '#46d2b1',
  '#ffbc4d',
  '#ff7777',
];
const pieceByUid = computed(() => new Map(pieces.value.map((p) => [p.uid, p])));
const usedCountByUid = computed(() => {
  const map = new Map<string, number>();
  for (const p of pieces.value) map.set(p.uid, 0);
  for (const place of placements.value) map.set(place.pieceUid, (map.get(place.pieceUid) ?? 0) + 1);
  return map;
});
const remainingCountByUid = computed(() => {
  const map = new Map<string, number>();
  for (const p of pieces.value) {
    const total = Math.max(0, Math.floor(Number(p.count) || 0));
    const used = usedCountByUid.value.get(p.uid) ?? 0;
    map.set(p.uid, Math.max(0, total - used));
  }
  return map;
});

const placementCellMap = computed(() => {
  const map = new Map<string, string>();
  for (const place of placements.value) {
    const keys = cellsForPlacement(place.pieceUid, place.anchor, place.rotation, place.shape);
    for (const key of keys) map.set(key, place.placementId);
  }
  return map;
});
const fixedCellMap = computed(() => {
  const map = new Map<string, string>();
  for (const key of Object.keys(fixedColorByKey.value)) {
    if (!inBoard(key)) continue;
    map.set(key, key);
  }
  return map;
});
const placementById = computed(() => new Map(placements.value.map((p) => [p.placementId, p])));
const movableOccupiedCells = computed<OverlayCell[]>(() => {
  const out: OverlayCell[] = [];
  for (const place of placements.value) {
    const piece = pieceByUid.value.get(place.pieceUid);
    if (!piece) continue;
    const color = normalizeHexColor(place.color ?? piece.color) ?? '#9ddb22';
    const keys = cellsForPlacement(place.pieceUid, place.anchor, place.rotation, place.shape);
    for (const key of keys) out.push({ key, color, groupId: place.placementId });
  }
  return out;
});
const fixedOccupiedCells = computed<OverlayCell[]>(() => {
  const out: OverlayCell[] = [];
  for (const [key, rawColor] of Object.entries(fixedColorByKey.value)) {
    if (!inBoard(key)) continue;
    const color = normalizeHexColor(rawColor) ?? '#9ddb22';
    out.push({ key, color, groupId: `fixed-${key}` });
  }
  return out;
});
const fixedOccupiedKeys = computed(() => fixedOccupiedCells.value.map((cell) => cell.key));
const placedOccupiedCells = computed<OverlayCell[]>(() => [
  ...fixedOccupiedCells.value,
  ...movableOccupiedCells.value,
]);
const placedOccupiedKeys = computed(() => placedOccupiedCells.value.map((cell) => cell.key));

const finalHintMetaMap = computed(() => {
  const out = new Map<string, { color: string; groupId: string }>();
  const blocked = new Set(blockedKeys.value);
  for (const [key, rawColor] of Object.entries(manualHintColorByKey.value)) {
    if (!inBoard(key) || blocked.has(key)) continue;
    const color = normalizeHexColor(rawColor) ?? '#9ddb22';
    const groupId = manualHintGroupByKey.value[key]?.trim() || color;
    out.set(key, { color, groupId });
  }
  return out;
});
const finalHintKeys = computed(() => Array.from(finalHintMetaMap.value.keys()));
const hintOverlayCells = computed<OverlayCell[]>(() =>
  Array.from(finalHintMetaMap.value.entries()).map(([key, meta]) => ({
    key,
    color: meta.color,
    groupId: meta.groupId,
  })),
);

const pieceColors = computed(() =>
  Array.from(
    new Set(
      pieces.value.map((p) => normalizeHexColor(p.color) ?? '').filter((c): c is string => !!c),
    ),
  ),
);
const hintColors = computed(() =>
  Array.from(
    new Set(
      Object.values(manualHintColorByKey.value)
        .map((c) => normalizeHexColor(c) ?? '')
        .filter((c): c is string => !!c),
    ),
  ),
);
const fixedColors = computed(() =>
  Array.from(
    new Set(
      Object.values(fixedColorByKey.value)
        .map((color) => normalizeHexColor(color) ?? '')
        .filter((c): c is string => !!c),
    ),
  ),
);
const scoringColors = computed(() =>
  Array.from(new Set([...pieceColors.value, ...hintColors.value, ...fixedColors.value])),
);
const colorWeightEntries = computed(() =>
  scoringColors.value.map((color) => ({ color, weight: getScoreForColor(color) })),
);

const hintScoreCells = computed<ScorePartCell[]>(() =>
  Array.from(finalHintMetaMap.value.entries()).map(([key, meta]) => {
    const { x, y } = parseKey(key);
    return { x, y, color: meta.color };
  }),
);
const placedScoreCells = computed<ScorePartCell[]>(() =>
  placedOccupiedCells.value.map((cell) => {
    const { x, y } = parseKey(cell.key);
    return { x, y, color: cell.color };
  }),
);
const rowTargetParts = computed<PuzzleScorePart[][]>(() =>
  buildAxisScoreParts(rows.value, hintScoreCells.value, 'row', getScoreForColor),
);
const colTargetParts = computed<PuzzleScorePart[][]>(() =>
  buildAxisScoreParts(cols.value, hintScoreCells.value, 'col', getScoreForColor),
);
const rowFilledParts = computed<PuzzleScorePart[][]>(() =>
  buildAxisScoreParts(rows.value, placedScoreCells.value, 'row', getScoreForColor),
);
const colFilledParts = computed<PuzzleScorePart[][]>(() =>
  buildAxisScoreParts(cols.value, placedScoreCells.value, 'col', getScoreForColor),
);
const placedRowScores = computed(() => rowFilledParts.value.map(sumScoreParts));
const placedColScores = computed(() => colFilledParts.value.map(sumScoreParts));

const computedRowTargets = computed(() => {
  const counts = Array.from({ length: rows.value }, () => 0);
  for (const [key, meta] of finalHintMetaMap.value.entries()) {
    const { y } = parseKey(key);
    if (y >= 0 && y < rows.value) counts[y] = (counts[y] ?? 0) + getScoreForColor(meta.color);
  }
  return counts;
});
const computedColTargets = computed(() => {
  const counts = Array.from({ length: cols.value }, () => 0);
  for (const [key, meta] of finalHintMetaMap.value.entries()) {
    const { x } = parseKey(key);
    if (x >= 0 && x < cols.value) counts[x] = (counts[x] ?? 0) + getScoreForColor(meta.color);
  }
  return counts;
});
const totalTargetScore = computed(() =>
  Array.from(finalHintMetaMap.value.values()).reduce(
    (acc, meta) => acc + getScoreForColor(meta.color),
    0,
  ),
);

const selectedPlacePieceName = computed(() => {
  if (boardTool.value === 'fixed') return `固定块画笔 (${selectedPaintColor.value})`;
  if (!selectedPieceUid.value) return null;
  const piece = pieceByUid.value.get(selectedPieceUid.value);
  if (!piece) return null;
  return `${piece.name} (剩余 ${remainingCountByUid.value.get(piece.uid) ?? 0}/${Math.max(0, piece.count)})`;
});

const editorPreview = computed(() => {
  if (!boardHover.value) return null;
  if (boardTool.value === 'fixed') {
    const key = keyOf(boardHover.value.x, boardHover.value.y);
    return {
      keys: [key],
      valid: inBoard(key) && !blockedKeys.value.includes(key),
      color: selectedPaintColor.value,
      groupId: 'fixed-brush',
    };
  }
  if (boardTool.value !== 'place' || !selectedPieceUid.value) return null;
  if ((remainingCountByUid.value.get(selectedPieceUid.value) ?? 0) <= 0) return null;
  const rotation = ((selectedPlacementRotation.value % 4) + 4) % 4;
  const piece = pieceByUid.value.get(selectedPieceUid.value);
  const shape = getPieceCells(selectedPieceUid.value);
  const anchor = getPlacementAnchorFromPointer(shape, boardHover.value, rotation);
  return {
    keys: cellsForShape(anchor, rotation, shape),
    valid: canPlace(selectedPieceUid.value, anchor, rotation, undefined, shape),
    color: normalizeHexColor(piece?.color ?? '') ?? '#9ddb22',
    groupId: selectedPieceUid.value,
  };
});
const editorPreviewKeys = computed(() => editorPreview.value?.keys ?? []);
const editorPreviewCells = computed<OverlayCell[]>(() =>
  (editorPreview.value?.keys ?? []).map((key) => ({
    key,
    color: editorPreview.value?.color ?? '#9ddb22',
    groupId: `preview-${editorPreview.value?.groupId ?? 'piece'}`,
  })),
);
const editorPreviewValid = computed(() => editorPreview.value?.valid ?? true);
const editorFocusRow = computed(() => boardHover.value?.y ?? null);
const editorFocusCol = computed(() => boardHover.value?.x ?? null);

const activeShapePiece = computed(() =>
  shapePieceUid.value ? (pieceByUid.value.get(shapePieceUid.value) ?? null) : null,
);
const activeShapeKeys = computed(() => activeShapePiece.value?.cells ?? []);
const activeShapeColor = computed(
  () => normalizeHexColor(activeShapePiece.value?.color ?? '') ?? '#9ddb22',
);
const shapeHoverKey = computed(() =>
  shapeHover.value ? keyOf(shapeHover.value.x, shapeHover.value.y) : null,
);
const piecePanelStyle = computed(() => ({
  left: `${Math.round(piecePanelState.value.x)}px`,
  top: `${Math.round(piecePanelState.value.y)}px`,
  width: `${Math.round(piecePanelState.value.width)}px`,
  height: `${Math.round(piecePanelState.value.height)}px`,
}));
const piecePanelMinStyle = computed(() => ({
  left: `${Math.round(piecePanelState.value.x)}px`,
  top: `${Math.round(piecePanelState.value.y)}px`,
}));

function clampNumber(value: number, min: number, max: number): number {
  if (min > max) return min;
  return Math.min(max, Math.max(min, value));
}
async function safeStorageGet(key: string): Promise<string> {
  try {
    const value = storage.isUsingJEIStorage()
      ? await storage.getItem(key)
      : localStorage.getItem(key);
    return String(value ?? '');
  } catch {
    return '';
  }
}
function safeStorageSetOrRemove(key: string, value: string): void {
  try {
    if (storage.isUsingJEIStorage()) {
      if (value) void storage.setItem(key, value);
      else void storage.removeItem(key);
    } else {
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    }
  } catch {
    return;
  }
}
function buildFavoriteKey(input: Omit<FavoritePiece, 'key'>): string {
  return JSON.stringify({
    id: input.id,
    name: input.name,
    color: input.color,
    count: input.count,
    cells: [...input.cells].sort((a, b) => a.localeCompare(b)),
  });
}
function normalizeFavoritePiece(raw: FavoritePiece): FavoritePiece {
  const id = String(raw.id ?? '').trim() || 'piece';
  const name = String(raw.name ?? '').trim() || id;
  const color = normalizeHexColor(String(raw.color ?? '')) ?? '#9ddb22';
  const count = Math.max(0, Math.floor(Number(raw.count) || 0));
  const cells = Array.isArray(raw.cells)
    ? raw.cells.map((cell) => String(cell)).filter((cell) => cell.includes(','))
    : [];
  const sortedCells = uniqueKeys(cells).sort((a, b) => a.localeCompare(b));
  const key = buildFavoriteKey({ id, name, color, count, cells: sortedCells });
  return { key, id, name, color, count, cells: sortedCells, source: 'user' };
}
async function loadFavoritePieces(): Promise<FavoritePiece[]> {
  const raw = await safeStorageGet(FAVORITE_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as
      | { version?: number; pieces?: FavoritePiece[] }
      | FavoritePiece[];
    const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed.pieces) ? parsed.pieces : [];
    return list
      .filter((item): item is FavoritePiece => !!item && typeof item === 'object')
      .map((item) => normalizeFavoritePiece(item));
  } catch {
    return [];
  }
}
function persistFavoritePieces(next: FavoritePiece[]): void {
  const payload = JSON.stringify({
    version: 1,
    pieces: next,
  });
  safeStorageSetOrRemove(FAVORITE_STORAGE_KEY, payload);
}
async function loadBuiltinType2FavoritePieces(): Promise<FavoritePiece[]> {
  try {
    const listResp = await fetch(
      appPath('/circuit-puzzle-levels/file_type2/minigame_puzzle.json'),
      {
        headers: { Accept: 'application/json' },
      },
    );
    if (!listResp.ok) return [];
    const puzzleRaw = (await listResp.json()) as unknown;
    const blockIds = collectType2BlockIds(puzzleRaw).sort((a, b) => a.localeCompare(b));
    if (!blockIds.length) return [];

    const favorites = await Promise.all(
      blockIds.map(async (blockId): Promise<FavoritePiece | null> => {
        try {
          const blockResp = await fetch(
            appPath(`/circuit-puzzle-levels/file_type2/blocks/${encodeURIComponent(blockId)}.json`),
            { headers: { Accept: 'application/json' } },
          );
          if (!blockResp.ok) return null;
          const blockRaw = (await blockResp.json()) as unknown;
          const parsed = parseType2BlockJson(blockRaw);
          if (!parsed.cells) return null;
          const cells = uniqueKeys(parsed.cells.map((cell) => keyOf(cell.x, cell.y))).sort((a, b) =>
            a.localeCompare(b),
          );
          if (!cells.length) return null;
          return {
            key: `${BUILTIN_TYPE2_FAVORITE_PREFIX}${blockId}`,
            id: blockId,
            name: blockId,
            color: '#9ddb22',
            count: 1,
            cells,
            readonly: true,
            source: 'type2',
          };
        } catch {
          return null;
        }
      }),
    );

    return favorites.filter((item): item is FavoritePiece => !!item);
  } catch {
    return [];
  }
}
function sanitizePiecePanelState(raw: unknown): PiecePanelState {
  if (!raw || typeof raw !== 'object') return { ...PIECE_PANEL_DEFAULT };
  const maybe = raw as Partial<PiecePanelState>;
  const x =
    typeof maybe.x === 'number' && Number.isFinite(maybe.x) ? maybe.x : PIECE_PANEL_DEFAULT.x;
  const y =
    typeof maybe.y === 'number' && Number.isFinite(maybe.y) ? maybe.y : PIECE_PANEL_DEFAULT.y;
  const width =
    typeof maybe.width === 'number' && Number.isFinite(maybe.width)
      ? maybe.width
      : PIECE_PANEL_DEFAULT.width;
  const height =
    typeof maybe.height === 'number' && Number.isFinite(maybe.height)
      ? maybe.height
      : PIECE_PANEL_DEFAULT.height;
  const minimized =
    typeof maybe.minimized === 'boolean' ? maybe.minimized : PIECE_PANEL_DEFAULT.minimized;
  const docked = typeof maybe.docked === 'boolean' ? maybe.docked : PIECE_PANEL_DEFAULT.docked;
  return { x, y, width, height, minimized, docked };
}
function persistPiecePanelState(): void {
  settingsStore.setCircuitEditorPiecePanel({
    x: piecePanelState.value.x,
    y: piecePanelState.value.y,
    width: piecePanelState.value.width,
    height: piecePanelState.value.height,
    minimized: piecePanelState.value.minimized,
    docked: piecePanelState.value.docked,
  });
}
function setPiecePanelSplitRatio(value: number): void {
  const next = clampNumber(value, 0.2, 0.8);
  piecePanelSplitRatio.value = next;
  settingsStore.setCircuitEditorPiecePanelSplitRatio(next);
}
function clampPiecePanelState(): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxWidth = Math.max(PIECE_PANEL_MIN_WIDTH, vw - PIECE_PANEL_EDGE_GAP * 2);
  const maxHeight = Math.max(PIECE_PANEL_MIN_HEIGHT, vh - PIECE_PANEL_EDGE_GAP * 2);
  const width = clampNumber(piecePanelState.value.width, PIECE_PANEL_MIN_WIDTH, maxWidth);
  const height = clampNumber(piecePanelState.value.height, PIECE_PANEL_MIN_HEIGHT, maxHeight);
  const x = clampNumber(
    piecePanelState.value.x,
    PIECE_PANEL_EDGE_GAP,
    Math.max(PIECE_PANEL_EDGE_GAP, vw - width - PIECE_PANEL_EDGE_GAP),
  );
  const y = clampNumber(
    piecePanelState.value.y,
    PIECE_PANEL_EDGE_GAP,
    Math.max(PIECE_PANEL_EDGE_GAP, vh - height - PIECE_PANEL_EDGE_GAP),
  );
  piecePanelState.value = { ...piecePanelState.value, x, y, width, height };
}
function onPiecePanelPointerMove(event: PointerEvent): void {
  const drag = piecePanelDrag.value;
  if (!drag || drag.pointerId !== event.pointerId) return;
  const dx = event.clientX - drag.startX;
  const dy = event.clientY - drag.startY;
  if (drag.mode === 'move') {
    piecePanelState.value = {
      ...piecePanelState.value,
      x: drag.startLeft + dx,
      y: drag.startTop + dy,
    };
  } else {
    piecePanelState.value = {
      ...piecePanelState.value,
      width: drag.startWidth + dx,
      height: drag.startHeight + dy,
    };
  }
  clampPiecePanelState();
}
function stopPiecePanelInteraction(shouldPersist: boolean): void {
  piecePanelDrag.value = null;
  window.removeEventListener('pointermove', onPiecePanelPointerMove);
  window.removeEventListener('pointerup', onPiecePanelPointerUp);
  window.removeEventListener('pointercancel', onPiecePanelPointerUp);
  if (shouldPersist) persistPiecePanelState();
}
function onPiecePanelPointerUp(event: PointerEvent): void {
  const drag = piecePanelDrag.value;
  if (!drag || drag.pointerId !== event.pointerId) return;
  stopPiecePanelInteraction(true);
}
function onPiecePanelHeadPointerDown(event: PointerEvent): void {
  if (event.button !== 0) return;
  const target = event.target;
  if (target instanceof HTMLElement) {
    const interactive = target.closest('button, input, textarea, select, a, [role="button"]');
    if (interactive) return;
  }
  startPiecePanelMove(event);
}
function startPiecePanelMove(event: PointerEvent): void {
  if (piecePanelState.value.minimized) return;
  event.preventDefault();
  piecePanelDrag.value = {
    mode: 'move',
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startLeft: piecePanelState.value.x,
    startTop: piecePanelState.value.y,
    startWidth: piecePanelState.value.width,
    startHeight: piecePanelState.value.height,
  };
  window.addEventListener('pointermove', onPiecePanelPointerMove);
  window.addEventListener('pointerup', onPiecePanelPointerUp);
  window.addEventListener('pointercancel', onPiecePanelPointerUp);
}
function startPiecePanelResize(event: PointerEvent): void {
  if (piecePanelState.value.minimized) return;
  event.preventDefault();
  piecePanelDrag.value = {
    mode: 'resize',
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startLeft: piecePanelState.value.x,
    startTop: piecePanelState.value.y,
    startWidth: piecePanelState.value.width,
    startHeight: piecePanelState.value.height,
  };
  window.addEventListener('pointermove', onPiecePanelPointerMove);
  window.addEventListener('pointerup', onPiecePanelPointerUp);
  window.addEventListener('pointercancel', onPiecePanelPointerUp);
}
function minimizePiecePanel(): void {
  if (piecePanelState.value.docked) return;
  piecePanelState.value = { ...piecePanelState.value, minimized: true };
  persistPiecePanelState();
}
function restorePiecePanel(): void {
  if (piecePanelState.value.docked) return;
  piecePanelState.value = { ...piecePanelState.value, minimized: false };
  clampPiecePanelState();
  persistPiecePanelState();
}
function setPiecePanelDocked(docked: boolean): void {
  piecePanelState.value = {
    ...piecePanelState.value,
    docked,
    minimized: docked ? false : piecePanelState.value.minimized,
  };
  if (!docked) clampPiecePanelState();
  persistPiecePanelState();
}
function onViewportResize(): void {
  clampPiecePanelState();
  persistPiecePanelState();
}

function getLevelSignature(level: PuzzleLevelDefinition): string {
  return JSON.stringify(levelToJson(level));
}

function emitDraftUpdate(): void {
  if (suppressDraftSync) return;
  const draftLevel = buildPreviewLevelFromForm();
  pendingSelfDraftSignature = getLevelSignature(draftLevel);
  emit('update:level', cloneLevel(draftLevel));
}

function scheduleDraftUpdate(): void {
  if (suppressDraftSync) return;
  if (draftSyncTimer) clearTimeout(draftSyncTimer);
  draftSyncTimer = setTimeout(() => {
    draftSyncTimer = null;
    emitDraftUpdate();
  }, DRAFT_SYNC_DELAY_MS);
}

function flushDraftUpdate(): void {
  if (draftSyncTimer) {
    clearTimeout(draftSyncTimer);
    draftSyncTimer = null;
  }
  emitDraftUpdate();
}

defineExpose({
  flushDraftUpdate,
});

watch(
  () => props.level,
  (level) => {
    if (pendingSelfDraftSignature) {
      const incomingSignature = getLevelSignature(level);
      if (incomingSignature === pendingSelfDraftSignature) {
        pendingSelfDraftSignature = null;
        return;
      }
      pendingSelfDraftSignature = null;
    }
    loadFormFromLevel(level);
  },
  { immediate: true, deep: true },
);
watch([rows, cols], ([rRaw, cRaw]) => {
  const r = Math.max(1, Number(rRaw) || 1);
  const c = Math.max(1, Number(cRaw) || 1);
  rows.value = r;
  cols.value = c;
  blockedKeys.value = blockedKeys.value.filter((key) => inBoard(key, r, c));
  pruneHintMaps(r, c);
  pruneFixedMap(r, c);
  prunePlacements();
});
watch(
  pieces,
  () => {
    const nextListRotation: Record<string, number> = {};
    for (const piece of pieces.value) {
      const rotation = pieceListRotationByUid.value[piece.uid];
      nextListRotation[piece.uid] =
        typeof rotation === 'number' && Number.isFinite(rotation) ? ((rotation % 4) + 4) % 4 : 0;
    }
    pieceListRotationByUid.value = nextListRotation;

    if (selectedPieceUid.value && !pieceByUid.value.has(selectedPieceUid.value)) {
      selectedPieceUid.value = pieces.value[0]?.uid ?? null;
      selectedPlacementRotation.value = 0;
    }
    if (shapePieceUid.value && !pieceByUid.value.has(shapePieceUid.value))
      shapePieceUid.value = pieces.value[0]?.uid ?? null;
    prunePlacements();
  },
  { deep: true },
);
watch(
  scoringColors,
  (colors) => {
    const next: Record<string, number> = {};
    for (const color of colors) {
      const current = Number(colorWeights.value[color]);
      next[color] = Number.isFinite(current) && current >= 0 ? current : 1;
    }
    colorWeights.value = next;
  },
  { immediate: true },
);
watch(
  [
    levelId,
    levelName,
    rows,
    cols,
    blockedKeys,
    manualHintColorByKey,
    manualHintGroupByKey,
    pieces,
    colorWeights,
    placements,
    fixedColorByKey,
  ],
  () => {
    scheduleDraftUpdate();
  },
  { deep: true },
);
function inBoard(key: string, r = rows.value, c = cols.value): boolean {
  const { x, y } = parseKey(key);
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < c && y >= 0 && y < r;
}
function selectPaletteColor(color: string): void {
  const normalized = normalizeHexColor(color);
  if (!normalized) return;
  selectedPaintColor.value = normalized;
  paletteColorInput.value = normalized;
  paletteError.value = '';
}
function applyPaletteInput(): void {
  const normalized = normalizeHexColor(paletteColorInput.value);
  if (!normalized) {
    paletteError.value = '颜色格式无效，请输入 #RGB 或 #RRGGBB';
    return;
  }
  selectedPaintColor.value = normalized;
  paletteColorInput.value = normalized;
  paletteError.value = '';
}
function getScoreForColor(color: string): number {
  const normalized = normalizeHexColor(color);
  if (!normalized) return 1;
  const raw = Number(colorWeights.value[normalized]);
  if (!Number.isFinite(raw) || raw < 0) return 1;
  return raw;
}
function setColorWeight(color: string, value: number): void {
  const normalized = normalizeHexColor(color);
  if (!normalized) return;
  colorWeights.value = {
    ...colorWeights.value,
    [normalized]: Number.isFinite(value) && value >= 0 ? value : 0,
  };
}
function toPieceDefinition(piece: PieceForm): PuzzlePieceDefinition {
  return {
    id: piece.id.trim() || piece.uid,
    name: piece.name.trim() || piece.uid,
    color: normalizeHexColor(piece.color) ?? '#9ddb22',
    count: Math.max(0, Math.floor(Number(piece.count) || 0)),
    cells: getPieceCells(piece.uid),
  };
}
function getPieceCells(pieceUid: string): GridCell[] {
  const piece = pieceByUid.value.get(pieceUid);
  if (!piece) return [];
  const coords = piece.cells
    .map(parseKey)
    .filter(
      (cell) => cell.x >= 0 && cell.y >= 0 && cell.x < pieceCanvasSize && cell.y < pieceCanvasSize,
    );
  if (!coords.length) return [];
  const minX = Math.min(...coords.map((cell) => cell.x));
  const minY = Math.min(...coords.map((cell) => cell.y));
  return coords.map((cell) => ({ x: cell.x - minX, y: cell.y - minY }));
}
function toFavoriteDefinition(favorite: FavoritePiece): PuzzlePieceDefinition {
  return {
    id: favorite.id,
    name: favorite.name,
    color: normalizeHexColor(favorite.color) ?? '#9ddb22',
    count: Math.max(0, Math.floor(Number(favorite.count) || 0)),
    cells: favorite.cells.map(parseKey),
  };
}
function cellsForPlacement(
  pieceUid: string,
  anchor: GridCell,
  rotation: number,
  shapeOverride?: GridCell[],
): string[] {
  const base = shapeOverride?.length ? shapeOverride : getPieceCells(pieceUid);
  return cellsForShape(anchor, rotation, base);
}
function canPlace(
  pieceUid: string,
  anchor: GridCell,
  rotation: number,
  ignorePlacementId?: string,
  shapeOverride?: GridCell[],
): boolean {
  const keys = cellsForPlacement(pieceUid, anchor, rotation, shapeOverride);
  if (!keys.length) return false;
  const blocked = new Set(blockedKeys.value);
  const occupied = placementCellMap.value;
  for (const key of keys) {
    if (!inBoard(key)) return false;
    if (blocked.has(key)) return false;
    if (fixedCellMap.value.has(key)) return false;
    const owner = occupied.get(key);
    if (owner && owner !== ignorePlacementId) return false;
  }
  return true;
}
function prunePlacements(): void {
  const next: Placement[] = [];
  const occupied = new Set<string>();
  const fixedOccupied = new Set(fixedOccupiedKeys.value);
  const used = new Map<string, number>();
  for (const place of placements.value) {
    const piece = pieceByUid.value.get(place.pieceUid);
    if (!piece) continue;
    const total = Math.max(0, Math.floor(Number(piece.count) || 0));
    const already = used.get(place.pieceUid) ?? 0;
    if (already >= total) continue;
    const keys = cellsForPlacement(place.pieceUid, place.anchor, place.rotation, place.shape);
    if (!keys.length) continue;
    let valid = true;
    for (const key of keys) {
      if (
        !inBoard(key) ||
        blockedKeys.value.includes(key) ||
        occupied.has(key) ||
        fixedOccupied.has(key)
      ) {
        valid = false;
        break;
      }
    }
    if (!valid) continue;
    next.push({
      ...place,
      shape: cloneShapeCells(place.shape),
    });
    used.set(place.pieceUid, already + 1);
    for (const key of keys) occupied.add(key);
  }
  placements.value = next;
}
function pruneFixedMap(r = rows.value, c = cols.value): void {
  const next: Record<string, string> = {};
  for (const [key, color] of Object.entries(fixedColorByKey.value)) {
    if (!inBoard(key, r, c)) continue;
    if (blockedKeys.value.includes(key)) continue;
    next[key] = normalizeHexColor(color) ?? '#9ddb22';
  }
  fixedColorByKey.value = next;
}
function pruneHintMaps(r = rows.value, c = cols.value): void {
  const nextColors: Record<string, string> = {};
  const nextGroups: Record<string, string> = {};
  for (const [key, color] of Object.entries(manualHintColorByKey.value)) {
    if (!inBoard(key, r, c)) continue;
    nextColors[key] = color;
    const group = manualHintGroupByKey.value[key];
    if (group) nextGroups[key] = group;
  }
  manualHintColorByKey.value = nextColors;
  manualHintGroupByKey.value = nextGroups;
}
function removePlacement(placementId: string): void {
  placements.value = placements.value.filter((place) => place.placementId !== placementId);
}
function setFixedColor(key: string, color: string): void {
  const normalized = normalizeHexColor(color) ?? '#9ddb22';
  fixedColorByKey.value = {
    ...fixedColorByKey.value,
    [key]: normalized,
  };
}
function removeFixedCell(key: string): void {
  const next = { ...fixedColorByKey.value };
  delete next[key];
  fixedColorByKey.value = next;
}
function pickupPlacement(placementId: string): void {
  const placement = placementById.value.get(placementId);
  if (!placement) return;
  removePlacement(placementId);
  selectedPieceUid.value = placement.pieceUid;
  selectedPlacementRotation.value = ((placement.rotation % 4) + 4) % 4;
}
function rotatePlacementInPlace(placementId: string): boolean {
  const placement = placementById.value.get(placementId);
  if (!placement) return false;
  const nextRotation = (placement.rotation + 1) % 4;
  if (
    !canPlace(
      placement.pieceUid,
      placement.anchor,
      nextRotation,
      placement.placementId,
      placement.shape,
    )
  ) {
    return false;
  }
  placements.value = placements.value.map((item) =>
    item.placementId === placementId ? { ...item, rotation: nextRotation } : item,
  );
  return true;
}
function setHintColor(key: string, color: string, groupId?: string): void {
  const normalized = normalizeHexColor(color) ?? '#9ddb22';
  manualHintColorByKey.value = { ...manualHintColorByKey.value, [key]: normalized };
  manualHintGroupByKey.value = {
    ...manualHintGroupByKey.value,
    [key]: groupId?.trim() || normalized,
  };
}
function removeHint(key: string): void {
  const nextColors = { ...manualHintColorByKey.value };
  const nextGroups = { ...manualHintGroupByKey.value };
  delete nextColors[key];
  delete nextGroups[key];
  manualHintColorByKey.value = nextColors;
  manualHintGroupByKey.value = nextGroups;
}
function fixedCellsFromPlacement(
  fixed: NonNullable<PuzzleLevelDefinition['fixedPlacements']>[number],
): string[] {
  const shape = normalizeShapeCells(fixed.cells ?? []);
  const rotation = (((fixed.rotation ?? 0) % 4) + 4) % 4;
  const rel = rotateCells(shape, rotation);
  return rel.map((cell) => keyOf(fixed.anchor.x + cell.x, fixed.anchor.y + cell.y));
}
function buildFixedPlacementsFromMap(
  r: number,
  c: number,
): NonNullable<PuzzleLevelDefinition['fixedPlacements']> {
  const entries = Object.entries(fixedColorByKey.value)
    .filter(([key]) => inBoard(key, r, c))
    .map(([key, color]) => ({ key, color: normalizeHexColor(color) ?? '#9ddb22' }));
  const byColor = new Map<string, Set<string>>();
  for (const { key, color } of entries) {
    const set = byColor.get(color) ?? new Set<string>();
    set.add(key);
    byColor.set(color, set);
  }

  const out: NonNullable<PuzzleLevelDefinition['fixedPlacements']> = [];
  let idx = 0;
  const directions: GridCell[] = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  for (const [color, cellSet] of byColor.entries()) {
    const visited = new Set<string>();
    for (const start of cellSet) {
      if (visited.has(start)) continue;
      const queue = [start];
      visited.add(start);
      const groupKeys: string[] = [];
      while (queue.length) {
        const current = queue.shift();
        if (!current) continue;
        groupKeys.push(current);
        const base = parseKey(current);
        for (const d of directions) {
          const nextKey = keyOf(base.x + d.x, base.y + d.y);
          if (!cellSet.has(nextKey) || visited.has(nextKey)) continue;
          visited.add(nextKey);
          queue.push(nextKey);
        }
      }
      const coords = groupKeys.map(parseKey);
      if (!coords.length) continue;
      const minX = Math.min(...coords.map((cell) => cell.x));
      const minY = Math.min(...coords.map((cell) => cell.y));
      idx += 1;
      out.push({
        id: `fixed_${idx}`,
        color,
        anchor: { x: minX, y: minY },
        cells: coords.map((cell) => ({ x: cell.x - minX, y: cell.y - minY })),
        rotation: 0,
      });
    }
  }

  return out;
}
function onBoardCellHover(cell: GridCell): void {
  boardHover.value = cell;
}
function onBoardCancelSelection(): void {
  if (boardTool.value !== 'place') return;
  selectedPieceUid.value = null;
}
function onBoardCellClick(cell: GridCell): void {
  const key = keyOf(cell.x, cell.y);
  const occupantPlacementId = placementCellMap.value.get(key);
  const hasFixed = key in fixedColorByKey.value;
  const hasHint = key in manualHintColorByKey.value;

  if (boardTool.value === 'place') {
    if (occupantPlacementId) {
      pickupPlacement(occupantPlacementId);
      return;
    }
    if (hasFixed) return;
    if (!selectedPieceUid.value) return;
    if ((remainingCountByUid.value.get(selectedPieceUid.value) ?? 0) <= 0) return;
    const instanceShape = getPieceCells(selectedPieceUid.value);
    if (!instanceShape.length) return;
    const rotation = ((selectedPlacementRotation.value % 4) + 4) % 4;
    const anchor = getPlacementAnchorFromPointer(instanceShape, cell, rotation);
    if (!canPlace(selectedPieceUid.value, anchor, rotation, undefined, instanceShape)) return;
    const pieceColor =
      normalizeHexColor(pieceByUid.value.get(selectedPieceUid.value)?.color ?? '') ?? '#9ddb22';
    placements.value = [
      ...placements.value,
      {
        placementId: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        pieceUid: selectedPieceUid.value,
        anchor: { ...anchor },
        rotation,
        shape: cloneShapeCells(instanceShape),
        color: pieceColor,
      },
    ];
    return;
  }

  if (boardTool.value === 'fixed') {
    if (blockedKeys.value.includes(key)) return;
    if (hasFixed) {
      removeFixedCell(key);
      return;
    }
    if (occupantPlacementId) removePlacement(occupantPlacementId);
    setFixedColor(key, selectedPaintColor.value);
    return;
  }

  if (boardTool.value === 'blocked') {
    const blocked = new Set(blockedKeys.value);
    if (blocked.has(key)) blocked.delete(key);
    else blocked.add(key);
    blockedKeys.value = Array.from(blocked);
    removeHint(key);
    if (occupantPlacementId) removePlacement(occupantPlacementId);
    if (hasFixed) removeFixedCell(key);
    pruneFixedMap();
    prunePlacements();
    return;
  }

  if (boardTool.value === 'hint') {
    if (blockedKeys.value.includes(key)) return;
    if (hasHint) removeHint(key);
    else setHintColor(key, selectedPaintColor.value, selectedPaintColor.value);
    return;
  }

  if (boardTool.value === 'paint') {
    if (occupantPlacementId) {
      const placement = placementById.value.get(occupantPlacementId);
      if (!placement) return;

      placements.value = placements.value.map((place) =>
        place.placementId === occupantPlacementId
          ? { ...place, color: selectedPaintColor.value }
          : place,
      );

      const keys = cellsForPlacement(
        placement.pieceUid,
        placement.anchor,
        placement.rotation,
        placement.shape,
      );
      const nextHintColors = { ...manualHintColorByKey.value };
      const nextHintGroups = { ...manualHintGroupByKey.value };
      let changedHint = false;
      for (const placeKey of keys) {
        if (!(placeKey in nextHintColors)) continue;
        nextHintColors[placeKey] = selectedPaintColor.value;
        nextHintGroups[placeKey] = occupantPlacementId;
        changedHint = true;
      }
      if (changedHint) {
        manualHintColorByKey.value = nextHintColors;
        manualHintGroupByKey.value = nextHintGroups;
      }

      return;
    }
    if (hasFixed) {
      setFixedColor(key, selectedPaintColor.value);
      if (hasHint) setHintColor(key, selectedPaintColor.value, manualHintGroupByKey.value[key]);
      return;
    }
    if (hasHint) setHintColor(key, selectedPaintColor.value, manualHintGroupByKey.value[key]);
    return;
  }

  if (boardTool.value === 'erase') {
    blockedKeys.value = blockedKeys.value.filter((item) => item !== key);
    removeHint(key);
    if (occupantPlacementId) removePlacement(occupantPlacementId);
    if (hasFixed) removeFixedCell(key);
  }
}

function selectPiece(uid: string): void {
  if (selectedPieceUid.value !== uid) {
    selectedPlacementRotation.value = 0;
  }
  selectedPieceUid.value = uid;
}
function selectPieceForShape(uid: string): void {
  if (selectedPieceUid.value !== uid) {
    selectedPlacementRotation.value = 0;
  }
  shapePieceUid.value = uid;
  selectedPieceUid.value = uid;
}
function rotateSelectedPlacePiece(): void {
  if (!selectedPieceUid.value) return;
  selectedPlacementRotation.value = (selectedPlacementRotation.value + 1) % 4;
}
function rotatePieceInPalette(uid: string): void {
  const current = pieceListRotationByUid.value[uid] ?? 0;
  pieceListRotationByUid.value = {
    ...pieceListRotationByUid.value,
    [uid]: (current + 1) % 4,
  };
}
function generateHintsFromPlacements(): void {
  const nextColors: Record<string, string> = {};
  const nextGroups: Record<string, string> = {};
  for (const cell of placedOccupiedCells.value) {
    nextColors[cell.key] = cell.color;
    nextGroups[cell.key] = cell.groupId;
  }
  manualHintColorByKey.value = nextColors;
  manualHintGroupByKey.value = nextGroups;
}
function clearHints(): void {
  manualHintColorByKey.value = {};
  manualHintGroupByKey.value = {};
}
function addPiece(): void {
  const uid = `piece-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  pieces.value = [
    ...pieces.value,
    {
      uid,
      id: `piece_${pieces.value.length + 1}`,
      name: `Piece ${pieces.value.length + 1}`,
      color: selectedPaintColor.value,
      count: 1,
      cells: ['0,0'],
    },
  ];
  if (!selectedPieceUid.value) selectedPieceUid.value = uid;
  if (!shapePieceUid.value) shapePieceUid.value = uid;
}
function addFavoritePiece(uid: string): void {
  const piece = pieceByUid.value.get(uid);
  if (!piece) return;
  const shape = getPieceCells(uid);
  const cells = uniqueKeys(shape.map((cell) => keyOf(cell.x, cell.y)));
  const id = piece.id.trim() || uid;
  const name = piece.name.trim() || id;
  const color = normalizeHexColor(piece.color) ?? '#9ddb22';
  const count = Math.max(0, Math.floor(Number(piece.count) || 0));
  const candidate = normalizeFavoritePiece({
    key: '',
    id,
    name,
    color,
    count,
    cells,
  });
  const next = [candidate, ...userFavoritePieces.value.filter((fav) => fav.key !== candidate.key)];
  userFavoritePieces.value = next;
  persistFavoritePieces(next);
}
function removeFavoritePiece(key: string): void {
  if (key.startsWith(BUILTIN_TYPE2_FAVORITE_PREFIX)) return;
  const next = userFavoritePieces.value.filter((fav) => fav.key !== key);
  userFavoritePieces.value = next;
  persistFavoritePieces(next);
}
function importFavoritePiece(key: string): void {
  const fav = favoritePieces.value.find((item) => item.key === key);
  if (!fav) return;
  const uid = `piece-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  pieces.value = [
    ...pieces.value,
    {
      uid,
      id: fav.id,
      name: fav.name,
      color: fav.color,
      count: fav.count,
      cells: [...fav.cells],
    },
  ];
  if (!selectedPieceUid.value) selectedPieceUid.value = uid;
  if (!shapePieceUid.value) shapePieceUid.value = uid;
}
function removePiece(index: number): void {
  const piece = pieces.value[index];
  if (!piece) return;
  pieces.value = pieces.value.filter((_, i) => i !== index);
  placements.value = placements.value.filter((placement) => placement.pieceUid !== piece.uid);
  if (selectedPieceUid.value === piece.uid) selectedPieceUid.value = pieces.value[0]?.uid ?? null;
  if (shapePieceUid.value === piece.uid) shapePieceUid.value = pieces.value[0]?.uid ?? null;
}
function rotatePieceShape(uid: string): void {
  const piece = pieceByUid.value.get(uid);
  if (!piece) return;
  const coords = getPieceCells(uid);
  if (!coords.length) return;
  const rotated = rotateCells(coords, 1);
  piece.cells = uniqueKeys(rotated.map((cell) => keyOf(cell.x, cell.y)));
  prunePlacements();
}
function clearPieceCells(uid: string): void {
  const piece = pieceByUid.value.get(uid);
  if (!piece) return;
  piece.cells = [];
  prunePlacements();
}
function normalizeActiveShape(): void {
  if (!shapePieceUid.value) return;
  const piece = pieceByUid.value.get(shapePieceUid.value);
  if (!piece || !piece.cells.length) return;
  const coords = piece.cells.map(parseKey);
  const minX = Math.min(...coords.map((cell) => cell.x));
  const minY = Math.min(...coords.map((cell) => cell.y));
  piece.cells = uniqueKeys(coords.map((cell) => keyOf(cell.x - minX, cell.y - minY)));
}
function onShapeCellHover(cell: GridCell): void {
  shapeHover.value = cell;
}
function onShapeCellClick(cell: GridCell): void {
  if (!shapePieceUid.value) return;
  const piece = pieceByUid.value.get(shapePieceUid.value);
  if (!piece) return;
  const key = keyOf(cell.x, cell.y);
  const set = new Set(piece.cells);
  if (set.has(key)) set.delete(key);
  else set.add(key);
  piece.cells = Array.from(set);
  prunePlacements();
}
function clearPlacements(): void {
  placements.value = [];
}
function newUid(seed: string): string {
  return `${seed}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function loadFormFromLevel(level: PuzzleLevelDefinition): void {
  suppressDraftSync = true;
  if (draftSyncTimer) {
    clearTimeout(draftSyncTimer);
    draftSyncTimer = null;
  }
  const source = cloneLevel(level);
  levelId.value = source.id;
  levelName.value = source.name;
  rows.value = source.rows;
  cols.value = source.cols;
  blockedKeys.value = uniqueKeys(source.blocked.map((cell) => keyOf(cell.x, cell.y)));

  const hintColors: Record<string, string> = {};
  const hintGroups: Record<string, string> = {};
  for (const cell of source.hintCells ?? []) {
    const key = keyOf(cell.x, cell.y);
    const color = normalizeHexColor(source.hintColors?.[key] ?? '') ?? '#9ddb22';
    hintColors[key] = color;
    hintGroups[key] = color;
  }
  for (const [key, rawColor] of Object.entries(source.hintColors ?? {})) {
    if (!inBoard(key, source.rows, source.cols)) continue;
    if (hintColors[key]) continue;
    const color = normalizeHexColor(rawColor) ?? '#9ddb22';
    hintColors[key] = color;
    hintGroups[key] = color;
  }
  manualHintColorByKey.value = hintColors;
  manualHintGroupByKey.value = hintGroups;

  colorWeights.value = { ...(source.colorWeights ?? {}) };
  placements.value = [];
  const fixedMap: Record<string, string> = {};
  for (const fixed of source.fixedPlacements ?? []) {
    const keys = fixedCellsFromPlacement(fixed);
    const color = normalizeHexColor(fixed.color) ?? '#9ddb22';
    for (const key of keys) {
      if (!inBoard(key, source.rows, source.cols)) continue;
      fixedMap[key] = color;
    }
  }
  fixedColorByKey.value = fixedMap;
  pieces.value = source.pieces.map((piece) => ({
    uid: newUid(piece.id),
    id: piece.id,
    name: piece.name,
    color: normalizeHexColor(piece.color) ?? '#9ddb22',
    count: Math.max(0, Math.floor(Number(piece.count) || 0)),
    cells: uniqueKeys(piece.cells.map((cell) => keyOf(cell.x, cell.y))),
  }));
  selectedPieceUid.value = pieces.value[0]?.uid ?? null;
  shapePieceUid.value = pieces.value[0]?.uid ?? null;
  selectedPlacementRotation.value = 0;
  pieceListRotationByUid.value = Object.fromEntries(pieces.value.map((piece) => [piece.uid, 0]));
  selectedPaintColor.value = pieceColors.value[0] ?? '#9ddb22';
  paletteColorInput.value = selectedPaintColor.value;
  paletteError.value = '';
  keepUnusedPieces.value = true;
  buildErrors.value = [];
  importErrors.value = [];
  shareUrlText.value = '';

  setTimeout(() => {
    suppressDraftSync = false;
  }, 0);
}

function buildLevelFromForm(options?: { includeUnusedPieces?: boolean }): {
  level: PuzzleLevelDefinition | null;
  errors: string[];
} {
  const errors: string[] = [];
  const r = Math.max(1, Number(rows.value) || 1);
  const c = Math.max(1, Number(cols.value) || 1);
  const includeUnusedPieces = options?.includeUnusedPieces ?? false;
  if (!levelId.value.trim()) errors.push('id is required');
  if (!levelName.value.trim()) errors.push('name is required');

  const blocked = uniqueKeys(blockedKeys.value)
    .filter((key) => inBoard(key, r, c))
    .map(parseKey);
  const hintEntries = Array.from(finalHintMetaMap.value.entries()).filter(([key]) =>
    inBoard(key, r, c),
  );
  const hintCells = hintEntries.map(([key]) => parseKey(key));
  const hintColors = Object.fromEntries(hintEntries.map(([key, meta]) => [key, meta.color]));

  const usedPlacementPieceUids = new Set(placements.value.map((placement) => placement.pieceUid));
  const pieceDefs: PuzzleLevelDefinition['pieces'] = [];
  const pieceIdSet = new Set<string>();

  for (let i = 0; i < pieces.value.length; i += 1) {
    const piece = pieces.value[i];
    if (!piece) continue;
    if (!keepUnusedPieces.value && !includeUnusedPieces && !usedPlacementPieceUids.has(piece.uid))
      continue;

    const id = piece.id.trim();
    const name = piece.name.trim();
    const color = normalizeHexColor(piece.color) ?? '#9ddb22';
    const count = Math.max(0, Math.floor(Number(piece.count) || 0));
    if (!id) errors.push(`piece #${i + 1} id is required`);
    if (!name) errors.push(`piece #${i + 1} name is required`);
    if (id && pieceIdSet.has(id)) errors.push(`duplicate piece id: ${id}`);
    pieceIdSet.add(id);

    const cells = getPieceCells(piece.uid);
    if (!cells.length && count > 0)
      errors.push(`piece ${id || i + 1} has count > 0 but shape is empty`);
    pieceDefs.push({ id, name, color, count, cells });
  }

  const fixedDefs = buildFixedPlacementsFromMap(r, c);

  if (!pieceDefs.length) errors.push('at least one piece is required');

  const exportColors = new Set<string>();
  for (const piece of pieceDefs) exportColors.add(piece.color);
  for (const fixed of fixedDefs) exportColors.add(fixed.color);
  for (const color of Object.values(hintColors)) exportColors.add(color);
  const normalizedWeights: Record<string, number> = {};
  for (const color of exportColors) normalizedWeights[color] = getScoreForColor(color);

  if (errors.length) return { level: null, errors };

  const level: PuzzleLevelDefinition = {
    id: levelId.value.trim(),
    name: levelName.value.trim(),
    rows: r,
    cols: c,
    blocked,
    hintCells,
    rowTargets: [...computedRowTargets.value],
    colTargets: [...computedColTargets.value],
    pieces: pieceDefs,
  };
  if (Object.keys(hintColors).length) level.hintColors = hintColors;
  if (Object.keys(normalizedWeights).length) level.colorWeights = normalizedWeights;
  if (fixedDefs.length) level.fixedPlacements = fixedDefs;
  return { level, errors: [] };
}

function buildPreviewLevelFromForm(): PuzzleLevelDefinition {
  const r = Math.max(1, Number(rows.value) || 1);
  const c = Math.max(1, Number(cols.value) || 1);

  const blocked = uniqueKeys(blockedKeys.value)
    .filter((key) => inBoard(key, r, c))
    .map(parseKey);
  const hintEntries = Array.from(finalHintMetaMap.value.entries()).filter(([key]) =>
    inBoard(key, r, c),
  );
  const hintCells = hintEntries.map(([key]) => parseKey(key));
  const hintColors = Object.fromEntries(hintEntries.map(([key, meta]) => [key, meta.color]));

  const pieceDefs: PuzzleLevelDefinition['pieces'] = pieces.value.map((piece, idx) => ({
    id: piece.id.trim() || `piece_${idx + 1}`,
    name: piece.name.trim() || `Piece ${idx + 1}`,
    color: normalizeHexColor(piece.color) ?? '#9ddb22',
    count: Math.max(0, Math.floor(Number(piece.count) || 0)),
    cells: getPieceCells(piece.uid),
  }));
  const fixedDefs = buildFixedPlacementsFromMap(r, c);

  const exportColors = new Set<string>();
  for (const piece of pieceDefs) exportColors.add(piece.color);
  for (const fixed of fixedDefs) exportColors.add(fixed.color);
  for (const color of Object.values(hintColors)) exportColors.add(color);
  const normalizedWeights: Record<string, number> = {};
  for (const color of exportColors) normalizedWeights[color] = getScoreForColor(color);

  const level: PuzzleLevelDefinition = {
    id: levelId.value.trim() || 'custom-level',
    name: levelName.value.trim() || 'Custom Puzzle',
    rows: r,
    cols: c,
    blocked,
    hintCells,
    rowTargets: [...computedRowTargets.value],
    colTargets: [...computedColTargets.value],
    pieces: pieceDefs,
  };
  if (Object.keys(hintColors).length) level.hintColors = hintColors;
  if (Object.keys(normalizedWeights).length) level.colorWeights = normalizedWeights;
  if (fixedDefs.length) level.fixedPlacements = fixedDefs;
  return level;
}

const isMultiEditorContext = computed(
  () =>
    !!props.multiPuzzle &&
    Array.isArray(props.multiPuzzle.levels) &&
    props.multiPuzzle.levels.length > 0,
);
const multiEditorStageIndex = computed(() => {
  const levelCount = props.multiPuzzle?.levels.length ?? 0;
  if (levelCount <= 0) return 0;
  const raw = Number(props.activeStageIndex ?? 0);
  const safe = Number.isFinite(raw) ? Math.floor(raw) : 0;
  return Math.max(0, Math.min(levelCount - 1, safe));
});

function cloneMultiPuzzle(puzzle: PuzzleMultiLevelDefinition): PuzzleMultiLevelDefinition {
  return {
    id: puzzle.id,
    name: puzzle.name,
    mode: puzzle.mode,
    levels: puzzle.levels.map((level) => cloneLevel(level)),
  };
}

function buildMultiPuzzleWithCurrentLevel(
  level: PuzzleLevelDefinition,
): PuzzleMultiLevelDefinition | null {
  if (!isMultiEditorContext.value || !props.multiPuzzle) return null;
  const puzzle = cloneMultiPuzzle(props.multiPuzzle);
  const levels = [...puzzle.levels];
  levels[multiEditorStageIndex.value] = cloneLevel(level);
  return {
    ...puzzle,
    levels,
  };
}

const jsonPreview = computed(() => {
  const built = buildLevelFromForm();
  if (built.level) {
    if (isMultiEditorContext.value) {
      const puzzle = buildMultiPuzzleWithCurrentLevel(built.level);
      if (puzzle) return JSON.stringify(multiPuzzleToJson(puzzle), null, 2);
    }
    return JSON.stringify(levelToJson(built.level), null, 2);
  }

  const previewLevel = buildPreviewLevelFromForm();
  const issueLines = built.errors.map((err) => `// - ${err}`).join('\n');
  if (isMultiEditorContext.value) {
    const puzzle = buildMultiPuzzleWithCurrentLevel(previewLevel);
    if (puzzle) {
      return `// 当前表单存在校验问题，以下为实时草稿 JSON\n${issueLines}\n${JSON.stringify(multiPuzzleToJson(puzzle), null, 2)}`;
    }
  }
  return `// 当前表单存在校验问题，以下为实时草稿 JSON\n${issueLines}\n${JSON.stringify(levelToJson(previewLevel), null, 2)}`;
});
function applyToGame(): void {
  const built = buildLevelFromForm();
  if (!built.level) {
    buildErrors.value = built.errors;
    return;
  }
  buildErrors.value = [];
  emit('update:level', cloneLevel(built.level));
}
function getSingleQueryValue(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return null;
}
function buildQueryFromRoute(): Record<string, string> {
  const query: Record<string, string> = {};
  for (const [key, raw] of Object.entries(route.query)) {
    const value = getSingleQueryValue(raw);
    if (value === null) continue;
    query[key] = value;
  }
  return query;
}
function buildShareUrlForEncoded(encoded: string): string {
  const query = buildQueryFromRoute();
  query.l = encoded;
  query.tab = 'editor';
  const resolved = router.resolve({ path: route.path, query });
  const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  return new URL(resolved.href, base).toString();
}
async function copyText(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  window.prompt('请复制以下内容', text);
}
function autoSolveLevel(): void {
  const built = buildLevelFromForm({ includeUnusedPieces: true });
  if (!built.level) {
    buildErrors.value = built.errors;
    $q.notify({ type: 'negative', message: '当前关卡有错误，无法自动解题。' });
    return;
  }
  buildErrors.value = [];

  const hasHints = built.level.hintCells.length > 0;
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
  let result = solveLevel(built.level, strictOptions);
  if (result.status === 'no-solution' && hasHints) {
    const relaxedResult = solveLevel(built.level, relaxedOptions);
    if (relaxedResult.status !== 'no-solution') {
      result = relaxedResult;
      solverOptions = relaxedOptions;
    }
  }

  if (result.status !== 'solved' || !result.solution) {
    if (result.status === 'timeout') {
      buildErrors.value = [`自动解题超时（已搜索 ${result.nodes} 节点）。`];
      $q.notify({ type: 'warning', message: '自动解题超时，请减少复杂度后重试。' });
      return;
    }
    if (result.status === 'node-limit') {
      buildErrors.value = [`自动解题达到节点上限（${result.nodes}）。`];
      $q.notify({ type: 'warning', message: '自动解题达到搜索上限，请调整关卡后重试。' });
      return;
    }
    buildErrors.value = ['未找到可行解，请检查提示格、颜色约束和行列目标。'];
    $q.notify({ type: 'negative', message: '未找到可行解。' });
    return;
  }

  const verify = verifySolution(built.level, result.solution, {
    exactHintCover: solverOptions.exactHintCover,
    enforceHintColors: solverOptions.enforceHintColors,
  });
  if (!verify.ok) {
    const lines = verify.errors.slice(0, 6);
    buildErrors.value = [
      '自动解题结果未通过校验：',
      ...lines,
      ...(verify.errors.length > lines.length ? ['...'] : []),
    ];
    $q.notify({ type: 'negative', message: '自动解题校验失败，请检查关卡配置。' });
    return;
  }

  const uidByPieceId = new Map<string, string>();
  for (const piece of pieces.value) {
    const id = piece.id.trim();
    if (!id || uidByPieceId.has(id)) continue;
    uidByPieceId.set(id, piece.uid);
  }

  const nextPlacements: Placement[] = [];
  const missingPieceIds = new Set<string>();
  for (let i = 0; i < result.solution.length; i += 1) {
    const solved = result.solution[i];
    if (!solved) continue;
    const pieceUid = uidByPieceId.get(solved.pieceId);
    if (!pieceUid) {
      missingPieceIds.add(solved.pieceId);
      continue;
    }
    const instanceShape = getPieceCells(pieceUid);
    if (!instanceShape.length) {
      missingPieceIds.add(`${solved.pieceId}(empty-shape)`);
      continue;
    }
    const fallbackColor =
      normalizeHexColor(pieceByUid.value.get(pieceUid)?.color ?? '') ?? '#9ddb22';
    nextPlacements.push({
      placementId: `auto-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
      pieceUid,
      anchor: { ...solved.anchor },
      rotation: ((solved.rot % 4) + 4) % 4,
      shape: cloneShapeCells(instanceShape),
      color: normalizeHexColor(solved.pieceColor) ?? fallbackColor,
    });
  }

  if (missingPieceIds.size > 0) {
    buildErrors.value = [`自动解题结果包含未知方块 id: ${Array.from(missingPieceIds).join(', ')}`];
    $q.notify({ type: 'negative', message: '自动解题失败：结果与编辑器方块不匹配。' });
    return;
  }

  placements.value = nextPlacements;
  boardTool.value = 'place';
  $q.notify({
    type: 'positive',
    message: `自动解题完成：共 ${nextPlacements.length} 个摆放（搜索 ${result.nodes} 节点）。`,
  });
}
async function generateShareLink(): Promise<void> {
  const built = buildLevelFromForm();
  if (!built.level) {
    buildErrors.value = built.errors;
    $q.notify({ type: 'negative', message: '当前关卡有错误，无法生成分享链接。' });
    return;
  }
  buildErrors.value = [];

  if (isMultiEditorContext.value) {
    const puzzle = buildMultiPuzzleWithCurrentLevel(built.level);
    if (!puzzle) {
      $q.notify({ type: 'negative', message: '多关上下文不可用，无法生成 v3 分享链接。' });
      return;
    }
    const encoded = encodeMultiLevelForUrlV3(puzzle);
    const shareUrl = buildShareUrlForEncoded(encoded);
    shareUrlText.value = shareUrl;
    await copyText(shareUrl);
    $q.notify({
      type: 'positive',
      message: `已生成并复制分享链接（v3，${encoded.length} 字符）。`,
    });
    return;
  }
  const payload = buildSharePayload(built.level);
  const mode = resolveShareMode(payload, 'auto');
  const encoded = getShareValue(payload, mode);
  const shareUrl = buildShareUrlForEncoded(encoded);
  shareUrlText.value = shareUrl;

  await copyText(shareUrl);
  $q.notify({
    type: 'positive',
    message: `已生成并复制分享链接（${mode}，${encoded.length} 字符）。`,
  });
}
function openAdvancedShare(): void {
  const built = buildLevelFromForm();
  if (!built.level) {
    buildErrors.value = built.errors;
    $q.notify({ type: 'negative', message: '当前关卡有错误，无法共享。' });
    return;
  }
  buildErrors.value = [];

  if (isMultiEditorContext.value) {
    const puzzle = buildMultiPuzzleWithCurrentLevel(built.level);
    if (!puzzle) {
      $q.notify({ type: 'negative', message: '多关上下文不可用，无法共享。' });
      return;
    }
    const encoded = encodeMultiLevelForUrlV3(puzzle);
    const multiJson = JSON.stringify(multiPuzzleToJson(puzzle));

    $q.dialog({
      title: '高级共享',
      message: '多关卡模式仅支持 v3 链接或多关 JSON',
      options: {
        type: 'radio',
        model: 'v3',
        isValid: (val: unknown) => ['v3', 'json'].includes(String(val)),
        items: [
          { label: `v3 链接（${encoded.length} 字符）`, value: 'v3' },
          { label: `复制多关 JSON（${multiJson.length} 字符）`, value: 'json' },
        ],
      },
      cancel: true,
      ok: { label: '复制' },
    }).onOk((modeValue: unknown) => {
      void (async () => {
        const useJson = String(modeValue) === 'json';
        if (useJson) {
          await copyText(multiJson);
          shareUrlText.value = '';
          $q.notify({
            type: 'positive',
            message: `多关 JSON 已复制（${multiJson.length} 字符）。`,
          });
          return;
        }

        const url = buildShareUrlForEncoded(encoded);
        shareUrlText.value = url;
        await copyText(url);
        $q.notify({ type: 'positive', message: `v3 分享链接已复制（${encoded.length} 字符）。` });
      })();
    });
    return;
  }

  const payload = buildSharePayload(built.level);
  const autoMode = resolveShareMode(payload, 'auto');
  const autoLength = payload.lengths[autoMode];

  $q.dialog({
    title: '高级共享',
    message: '选择共享格式',
    options: {
      type: 'radio',
      model: 'auto',
      isValid: (val: unknown) => ['auto', 'v2', 'v1', 'json'].includes(String(val)),
      items: [
        { label: `自动最短（当前 ${autoMode}，${autoLength} 字符）`, value: 'auto' },
        { label: `v2 链接（${payload.lengths.v2} 字符）`, value: 'v2' },
        { label: `v1 链接（${payload.lengths.v1} 字符）`, value: 'v1' },
        { label: `复制 JSON（${payload.lengths.json} 字符）`, value: 'json' },
      ],
    },
    cancel: true,
    ok: { label: '复制' },
  }).onOk((modeValue: unknown) => {
    void (async () => {
      const mode = ['auto', 'v1', 'v2', 'json'].includes(String(modeValue))
        ? (String(modeValue) as 'auto' | 'v1' | 'v2' | 'json')
        : 'auto';
      const resolvedMode = resolveShareMode(payload, mode);
      const content = getShareValue(payload, mode);

      if (resolvedMode === 'json') {
        await copyText(content);
        shareUrlText.value = '';
        $q.notify({ type: 'positive', message: `JSON 已复制（${content.length} 字符）。` });
        return;
      }

      const url = buildShareUrlForEncoded(content);
      shareUrlText.value = url;
      await copyText(url);
      $q.notify({
        type: 'positive',
        message: `分享链接已复制（${resolvedMode}，${content.length} 字符）。`,
      });
    })();
  });
}
function restoreFromCurrent(): void {
  loadFormFromLevel(props.level);
}
function resetAsBlank(): void {
  levelId.value = 'custom-level';
  levelName.value = 'Custom Puzzle';
  rows.value = 6;
  cols.value = 6;
  blockedKeys.value = [];
  manualHintColorByKey.value = {};
  manualHintGroupByKey.value = {};
  placements.value = [];
  fixedColorByKey.value = {};
  pieces.value = [
    {
      uid: newUid('piece'),
      id: 'piece_1',
      name: 'Piece 1',
      color: '#9ddb22',
      count: 1,
      cells: ['0,0'],
    },
  ];
  selectedPieceUid.value = pieces.value[0]?.uid ?? null;
  shapePieceUid.value = pieces.value[0]?.uid ?? null;
  selectedPlacementRotation.value = 0;
  pieceListRotationByUid.value = Object.fromEntries(pieces.value.map((piece) => [piece.uid, 0]));
  colorWeights.value = { '#9ddb22': 1 };
  selectedPaintColor.value = '#9ddb22';
  paletteColorInput.value = '#9ddb22';
  paletteError.value = '';
  keepUnusedPieces.value = true;
  buildErrors.value = [];
  importErrors.value = [];
  shareUrlText.value = '';
}
function fillImportWithCurrentJson(): void {
  importJsonText.value = jsonPreview.value.startsWith('//') ? '' : jsonPreview.value;
}
function applyImportJson(): void {
  importErrors.value = [];
  const raw = importJsonText.value.trim();
  if (!raw) {
    importErrors.value = ['JSON text is empty'];
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    importErrors.value = ['JSON parse failed'];
    return;
  }
  const parsedDoc = parsePuzzleJsonDocument(parsed);
  if (!parsedDoc.document) {
    importErrors.value = parsedDoc.errors;
    return;
  }
  if (parsedDoc.document.kind === 'multi') {
    const preferred = isMultiEditorContext.value ? multiEditorStageIndex.value : 0;
    const maxIdx = Math.max(0, parsedDoc.document.puzzle.levels.length - 1);
    const safeIdx = Math.max(0, Math.min(maxIdx, preferred));
    const level = multiPuzzleToSingleLevel(parsedDoc.document.puzzle, safeIdx);
    emit('import:multi-puzzle', {
      puzzle: cloneMultiPuzzle(parsedDoc.document.puzzle),
      stageIndex: safeIdx,
    });
    loadFormFromLevel(level);
    $q.notify({
      type: 'positive',
      message: `已导入多关卡 JSON（共 ${parsedDoc.document.puzzle.levels.length} 关）。`,
    });
    return;
  }
  loadFormFromLevel(parsedDoc.document.level);
}
function onEditorKeyDown(event: KeyboardEvent): void {
  if (isTypingTarget(event.target)) return;

  const bindings = keyBindingsStore.bindings;

  if (eventMatchesBinding(event, bindings.circuitRotate)) {
    event.preventDefault();
    if (boardTool.value === 'place') {
      const boardKey = boardHover.value ? keyOf(boardHover.value.x, boardHover.value.y) : null;
      const placementId = boardKey ? placementCellMap.value.get(boardKey) : null;
      if (placementId) {
        rotatePlacementInPlace(placementId);
        return;
      }
      rotateSelectedPlacePiece();
    } else if (shapePieceUid.value) rotatePieceShape(shapePieceUid.value);
    return;
  }
  if (eventMatchesBinding(event, bindings.circuitRun)) {
    event.preventDefault();
    generateHintsFromPlacements();
    return;
  }
  if (event.key === '1') boardTool.value = 'place';
  if (event.key === '2') boardTool.value = 'fixed';
  if (event.key === '3') boardTool.value = 'blocked';
  if (event.key === '4') boardTool.value = 'hint';
  if (event.key === '5') boardTool.value = 'paint';
  if (event.key === '6') boardTool.value = 'erase';
  if (eventMatchesBinding(event, bindings.circuitDeselect)) selectedPieceUid.value = null;
  if (eventMatchesBinding(event, bindings.circuitDelete)) {
    const boardKey = boardHover.value ? keyOf(boardHover.value.x, boardHover.value.y) : null;
    if (boardKey) {
      const placementId = placementCellMap.value.get(boardKey);
      if (placementId) {
        event.preventDefault();
        removePlacement(placementId);
        return;
      }
      const fixedId = fixedCellMap.value.get(boardKey);
      if (fixedId) {
        event.preventDefault();
        removeFixedCell(fixedId);
        return;
      }
      if (boardKey in manualHintColorByKey.value) {
        event.preventDefault();
        removeHint(boardKey);
        return;
      }
    }
    if (shapeHover.value && shapePieceUid.value) {
      event.preventDefault();
      const piece = pieceByUid.value.get(shapePieceUid.value);
      if (!piece) return;
      const hoverKey = keyOf(shapeHover.value.x, shapeHover.value.y);
      piece.cells = piece.cells.filter((cellKey) => cellKey !== hoverKey);
      prunePlacements();
    }
  }
}
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
onMounted(async () => {
  const [savedFavorites, builtinFavorites] = await Promise.all([
    loadFavoritePieces(),
    loadBuiltinType2FavoritePieces(),
  ]);
  userFavoritePieces.value = savedFavorites;
  builtinType2FavoritePieces.value = builtinFavorites;
  clampPiecePanelState();
  persistPiecePanelState();
  window.addEventListener('keydown', onEditorKeyDown);
  window.addEventListener('resize', onViewportResize);
});
onUnmounted(() => {
  if (draftSyncTimer) {
    clearTimeout(draftSyncTimer);
    draftSyncTimer = null;
  }
  stopPiecePanelInteraction(false);
  window.removeEventListener('keydown', onEditorKeyDown);
  window.removeEventListener('resize', onViewportResize);
});
</script>

<style scoped>
.level-editor {
  --ed-card-border: rgba(99, 126, 119, 0.35);
  --ed-card-bg: rgba(247, 252, 250, 0.94);
  --ed-title: #2a453e;
  --ed-text: #2a4741;
  --ed-muted: rgba(67, 93, 86, 0.9);
  --ed-input-bg: rgba(237, 245, 243, 0.95);
  --ed-input-border: rgba(114, 143, 136, 0.45);
  --ed-panel-bg: rgba(232, 242, 239, 0.9);
  --ed-btn-bg: rgba(235, 243, 240, 0.95);
  --ed-btn-text: #2f4d46;
  --ed-btn-border: rgba(114, 143, 136, 0.45);
  --ed-btn-hover: rgba(123, 177, 97, 0.86);
  --ed-btn-active: #6f9f23;
  --ed-danger: #b64242;
  --ed-error-border: rgba(215, 82, 82, 0.6);
  --ed-error-bg: rgba(255, 239, 239, 0.84);
  --ed-error-text: #8d2d2d;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  color: var(--ed-text);
}
.level-editor--dark {
  --ed-card-border: rgba(152, 183, 177, 0.35);
  --ed-card-bg: rgba(10, 18, 18, 0.86);
  --ed-title: #e8ff9f;
  --ed-text: #d8e8e2;
  --ed-muted: rgba(201, 215, 210, 0.85);
  --ed-input-bg: rgba(17, 29, 28, 0.95);
  --ed-input-border: rgba(155, 178, 172, 0.45);
  --ed-panel-bg: rgba(10, 20, 18, 0.65);
  --ed-btn-bg: rgba(26, 35, 34, 0.95);
  --ed-btn-text: #d2e1dd;
  --ed-btn-border: rgba(163, 185, 179, 0.4);
  --ed-btn-hover: rgba(196, 255, 53, 0.7);
  --ed-btn-active: #e8ff9f;
  --ed-danger: #ffadad;
  --ed-error-border: rgba(255, 104, 104, 0.6);
  --ed-error-bg: rgba(67, 13, 13, 0.55);
  --ed-error-text: #ffc8c8;
}
.editor-card {
  border: 1px solid var(--ed-card-border);
  border-radius: 12px;
  background: var(--ed-card-bg);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.editor-card h3 {
  margin: 0;
  color: var(--ed-title);
  font-size: 16px;
}
.editor-tip {
  margin: 0;
  font-size: 12px;
  color: var(--ed-muted);
}
.editor-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.editor-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.editor-field span {
  font-size: 12px;
  color: var(--ed-text);
}
.editor-field input,
.editor-field textarea,
.palette-input {
  border: 1px solid var(--ed-input-border);
  border-radius: 8px;
  background: var(--ed-input-bg);
  color: var(--ed-text);
  padding: 8px;
  font-size: 13px;
  font-family: 'Consolas', 'Courier New', monospace;
}
.tool-row,
.editor-actions,
.piece-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.tool-label {
  font-size: 12px;
  color: var(--ed-text);
}
.palette-panel {
  border: 1px solid var(--ed-card-border);
  border-radius: 8px;
  background: var(--ed-panel-bg);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.palette-swatches {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.palette-swatch {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: 1px solid rgba(205, 219, 214, 0.5);
  cursor: pointer;
}
.palette-swatch--active {
  box-shadow: 0 0 0 2px rgba(198, 255, 73, 0.45);
}
.palette-custom-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.palette-input {
  width: 120px;
}
.palette-preview {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: 1px solid rgba(205, 219, 214, 0.45);
}
.palette-error {
  font-size: 12px;
  color: #ffaaaa;
}
.summary-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--ed-text);
  align-items: center;
}
.toggle-field {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--ed-text);
}
.color-weight-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
}
.color-weight-item span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.color-chip {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  border: 1px solid rgba(222, 236, 231, 0.45);
  display: inline-block;
}
.shape-title {
  font-size: 13px;
  color: var(--ed-text);
}
.shape-tip {
  margin: 0;
  font-size: 12px;
  color: var(--ed-muted);
}
.shape-json-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 44%);
  gap: 12px;
  align-items: start;
}
.shape-pane {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.shape-right-pane {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.score-panel {
  border: 1px solid var(--ed-card-border);
  border-radius: 8px;
  background: var(--ed-panel-bg);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.score-panel .color-weight-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.json-panel {
  border: 1px solid var(--ed-card-border);
  border-radius: 8px;
  background: var(--ed-panel-bg);
}
.json-panel-summary {
  cursor: pointer;
  list-style: none;
  padding: 10px;
  font-size: 13px;
  color: var(--ed-title);
  user-select: none;
}
.json-panel-summary::-webkit-details-marker {
  display: none;
}
.json-panel-summary::before {
  content: '▸';
  display: inline-block;
  margin-right: 6px;
  color: var(--ed-muted);
  transition: transform 0.15s ease;
}
.json-panel[open] .json-panel-summary::before {
  transform: rotate(90deg);
}
.json-panel-body {
  padding: 0 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.editor-btn {
  border: 1px solid var(--ed-btn-border);
  border-radius: 6px;
  background: var(--ed-btn-bg);
  color: var(--ed-btn-text);
  font-size: 12px;
  line-height: 1;
  padding: 8px 10px;
  cursor: pointer;
}
.editor-btn:hover {
  border-color: var(--ed-btn-hover);
  color: var(--ed-btn-active);
}
.editor-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.editor-btn--active {
  border-color: var(--ed-btn-hover);
  color: var(--ed-btn-active);
}
.editor-btn--primary {
  border-color: var(--ed-btn-hover);
  color: var(--ed-btn-active);
}
.editor-btn--danger {
  border-color: rgba(255, 124, 124, 0.55);
  color: var(--ed-danger);
}
.editor-errors {
  border: 1px solid var(--ed-error-border);
  border-radius: 8px;
  background: var(--ed-error-bg);
  color: var(--ed-error-text);
  padding: 8px;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
@media (max-width: 1400px) {
  .level-editor {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 860px) {
  .editor-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .palette-custom-row {
    flex-wrap: wrap;
  }
  .shape-json-layout {
    grid-template-columns: 1fr;
  }
  .score-panel .color-weight-grid {
    grid-template-columns: 1fr;
  }
}
</style>
