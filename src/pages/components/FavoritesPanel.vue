<template>
  <q-card
    v-show="!isMobile || mobileTab === 'fav'"
    flat
    bordered
    :class="['jei-fav column no-wrap', { 'jei-fav--collapsed': collapsed }]"
  >
    <!-- 折叠状态下的展开按钮 -->
    <div
      v-if="collapsed"
      class="jei-collapsed-trigger jei-collapsed-trigger--left"
      @click="$emit('update:collapsed', false)"
    >
      <q-icon name="chevron_right" size="16px" />
    </div>

    <!-- 展开状态下的内容 -->
    <template v-if="!collapsed">
      <div class="jei-list__head col-auto row items-center q-gutter-sm">
        <div class="text-subtitle2">{{ t('favorites') }}</div>
        <div class="jei-list__head-center text-caption text-grey-7">
          <span>{{ t('totalItems', { count: favoriteItems.length }) }}</span>
          <span>{{ t('itemsPerPage', { size: favoritePageSize }) }}</span>
        </div>
        <q-space />
        <q-btn
          flat
          dense
          round
          icon="chevron_left"
          size="sm"
          @click="$emit('update:collapsed', true)"
        >
          <q-tooltip>{{ t('collapse') }}</q-tooltip>
        </q-btn>
      </div>

      <div ref="listScrollEl" class="jei-list__scroll col" @wheel="onFavoritesWheel">
        <div v-if="savedPlans.length" ref="savedPlansEl" class="jei-plans">
          <div class="jei-plans__head text-caption text-grey-8">{{ t('savedLines') }}</div>
          <q-list dense class="jei-plans__list">
            <q-item
              v-for="p in savedPlans"
              :key="p.id"
              clickable
              class="jei-plans__item"
              @click="$emit('open-plan', p)"
            >
              <q-item-section avatar>
                <stack-view
                  :content="{
                    kind: 'item',
                    id: p.rootItemKey.id,
                    amount: 1,
                    ...(p.rootItemKey.meta !== undefined ? { meta: p.rootItemKey.meta } : {}),
                    ...(p.rootItemKey.nbt !== undefined ? { nbt: p.rootItemKey.nbt } : {}),
                  }"
                  :item-defs-by-key-hash="itemDefsByKeyHash"
                  variant="slot"
                  :show-name="false"
                  :show-subtitle="false"
                  :show-amount="false"
                  :lazy-visual="true"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label lines="1">{{ p.name }}</q-item-label>
                <q-item-label caption lines="1">{{ p.rootItemKey.id }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn
                  flat
                  round
                  dense
                  icon="delete"
                  color="grey-7"
                  @click.stop="$emit('delete-plan', p.id)"
                />
              </q-item-section>
            </q-item>
          </q-list>
          <q-separator class="q-my-sm" />
        </div>
        <div
          v-if="favoriteItems.length"
          ref="listGridEl"
          :class="['jei-grid', { 'jei-grid--classic': iconDisplayMode === 'jei_classic' }]"
        >
          <div v-if="firstPagedFavoriteItem" ref="sampleCellEl">
            <q-card
              :key="firstPagedFavoriteItem.keyHash"
              flat
              :bordered="iconDisplayMode !== 'jei_classic'"
              :class="[
                'jei-grid__cell cursor-pointer',
                { 'jei-grid__cell--classic': iconDisplayMode === 'jei_classic' },
              ]"
              v-touch-hold:600="
                (evt: unknown) => $emit('touch-hold', evt, firstPagedFavoriteItem?.keyHash ?? '')
              "
              @contextmenu.prevent="
                $emit('context-menu', $event, firstPagedFavoriteItem?.keyHash ?? '')
              "
              @mouseenter="
                $emit('update:hovered-key-hash', firstPagedFavoriteItem?.keyHash ?? null);
                $emit('update:hovered-source', 'favorites');
              "
              @mouseleave="
                $emit('update:hovered-key-hash', null);
                $emit('update:hovered-source', 'none');
              "
              @click="$emit('item-click', firstPagedFavoriteItem?.keyHash ?? '')"
            >
              <q-btn
                flat
                round
                :dense="!isMobile"
                :size="isMobile ? 'md' : 'sm'"
                icon="star"
                color="amber"
                :class="[
                  'jei-grid__fav',
                  { 'jei-grid__fav--classic': iconDisplayMode === 'jei_classic' },
                ]"
                @click.stop="$emit('toggle-favorite', firstPagedFavoriteItem?.keyHash ?? '')"
                @mousedown.stop
                @touchstart.stop
                style="z-index: 1"
              />
              <div
                class="jei-grid__cell-body"
                :class="{ 'jei-grid__cell-body--classic': iconDisplayMode === 'jei_classic' }"
              >
                <stack-view
                  :content="{
                    kind: 'item',
                    id: firstPagedFavoriteItem?.def.key.id ?? '',
                    amount: 1,
                    ...(firstPagedFavoriteItem?.def.key.meta !== undefined
                      ? { meta: firstPagedFavoriteItem?.def.key.meta }
                      : {}),
                    ...(firstPagedFavoriteItem?.def.key.nbt !== undefined
                      ? { nbt: firstPagedFavoriteItem?.def.key.nbt }
                      : {}),
                  }"
                  :item-defs-by-key-hash="itemDefsByKeyHash"
                  :icon-display-mode="iconDisplayMode"
                  :show-amount="false"
                  :lazy-visual="true"
                />
              </div>
            </q-card>
          </div>

          <q-card
            v-for="it in restPagedFavoriteItems"
            :key="it.keyHash"
            flat
            :bordered="iconDisplayMode !== 'jei_classic'"
            :class="[
              'jei-grid__cell cursor-pointer',
              { 'jei-grid__cell--classic': iconDisplayMode === 'jei_classic' },
            ]"
            v-touch-hold:600="(evt: unknown) => $emit('touch-hold', evt, it.keyHash)"
            @contextmenu.prevent="$emit('context-menu', $event, it.keyHash)"
            @mouseenter="
              $emit('update:hovered-key-hash', it.keyHash);
              $emit('update:hovered-source', 'favorites');
            "
            @mouseleave="
              $emit('update:hovered-key-hash', null);
              $emit('update:hovered-source', 'none');
            "
            @click="$emit('item-click', it.keyHash)"
          >
            <q-btn
              flat
              round
              :dense="!isMobile"
              :size="isMobile ? 'md' : 'sm'"
              icon="star"
              color="amber"
              :class="[
                'jei-grid__fav',
                { 'jei-grid__fav--classic': iconDisplayMode === 'jei_classic' },
              ]"
              @click.stop="$emit('toggle-favorite', it.keyHash)"
              @mousedown.stop
              @touchstart.stop
              style="z-index: 1"
            />
            <div
              class="jei-grid__cell-body"
              :class="{ 'jei-grid__cell-body--classic': iconDisplayMode === 'jei_classic' }"
            >
              <stack-view
                :content="{
                  kind: 'item',
                  id: it.def.key.id,
                  amount: 1,
                  ...(it.def.key.meta !== undefined ? { meta: it.def.key.meta } : {}),
                  ...(it.def.key.nbt !== undefined ? { nbt: it.def.key.nbt } : {}),
                }"
                :item-defs-by-key-hash="itemDefsByKeyHash"
                :icon-display-mode="iconDisplayMode"
                :show-amount="false"
                :lazy-visual="true"
              />
            </div>
          </q-card>
        </div>
        <div v-else class="text-caption text-grey-7">{{ t('noFavorites') }}</div>
      </div>

      <div v-if="favoriteItems.length" class="jei-list__pager col-auto">
        <div class="jei-list__pager-pagination">
          <q-pagination
            :model-value="favoritePage"
            @update:model-value="favoritePage = $event"
            :max="favoritePageCount"
            max-pages="7"
            boundary-numbers
            direction-links
            dense
          />
        </div>
      </div>
    </template>
  </q-card>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import type { ItemDef, ItemKey } from 'src/jei/types';
import StackView from 'src/jei/components/StackView.vue';
import { useI18n } from 'vue-i18n';
import type { ItemIconDisplayMode } from 'src/stores/settings';

const { t } = useI18n();

type SavedPlan = {
  id: string;
  name: string;
  rootItemKey: ItemKey;
  rootKeyHash: string;
  targetAmount: number;
  selectedRecipeIdByItemKeyHash: Record<string, string>;
  selectedItemIdByTagId: Record<string, string>;
  createdAt: number;
};

const props = defineProps<{
  isMobile: boolean;
  mobileTab: string;
  collapsed: boolean;
  savedPlans: SavedPlan[];
  favoriteItems: Array<{ keyHash: string; def: ItemDef }>;
  favoritePageSizeMin: number;
  favoritePageSizeMax: number;
  itemDefsByKeyHash: Record<string, ItemDef>;
  iconDisplayMode: ItemIconDisplayMode;
}>();

const favoritePage = ref(1);
const favoritePageSize = ref(24);
const measuredCellHeight = ref(84);
const gridGap = 8;
const CLASSIC_GRID_MIN_CELL_WIDTH = 52;
const MODERN_GRID_COLUMNS = 2;

const listScrollEl = ref<HTMLElement | null>(null);
const savedPlansEl = ref<HTMLElement | null>(null);
const listGridEl = ref<HTMLElement | null>(null);
const sampleCellEl = ref<HTMLElement | null>(null);
const gridColumns = computed(() => {
  if (props.iconDisplayMode !== 'jei_classic') return MODERN_GRID_COLUMNS;
  const gridWidth = listGridEl.value?.clientWidth ?? listScrollEl.value?.clientWidth ?? 0;
  if (!gridWidth) return 4;
  return Math.max(1, Math.floor((gridWidth + 6) / (CLASSIC_GRID_MIN_CELL_WIDTH + 6)));
});
const favoritePageSizeMin = computed(() => {
  const n = Number(props.favoritePageSizeMin);
  if (!Number.isFinite(n)) return gridColumns.value;
  return Math.max(gridColumns.value, Math.floor(n));
});
const favoritePageSizeMax = computed(() => {
  const n = Number(props.favoritePageSizeMax);
  if (!Number.isFinite(n)) return 999;
  return Math.max(favoritePageSizeMin.value, Math.floor(n));
});

const favoritePageCount = computed(() => {
  return Math.max(1, Math.ceil(props.favoriteItems.length / favoritePageSize.value));
});
const pagedFavoriteItems = computed(() => {
  const start = (favoritePage.value - 1) * favoritePageSize.value;
  return props.favoriteItems.slice(start, start + favoritePageSize.value);
});
const firstPagedFavoriteItem = computed(() => pagedFavoriteItems.value[0] ?? null);
const restPagedFavoriteItems = computed(() => pagedFavoriteItems.value.slice(1));
const wheelState = ref({ lastAt: 0, acc: 0 });

function wrapFavoritePage(next: number): number {
  const max = favoritePageCount.value;
  if (max <= 1) return 1;
  if (next < 1) return max;
  if (next > max) return 1;
  return next;
}

function onFavoritesWheel(e: WheelEvent): void {
  if (e.ctrlKey) return;
  const now = performance.now();
  const state = wheelState.value;
  if (now - state.lastAt > 180) state.acc = 0;
  state.lastAt = now;
  state.acc += e.deltaY;

  const threshold = 60;
  if (Math.abs(state.acc) < threshold) return;

  const dir = state.acc > 0 ? 1 : -1;
  state.acc = 0;
  favoritePage.value = wrapFavoritePage(favoritePage.value + dir);
  e.preventDefault();
}

function getContentBoxHeight(el: HTMLElement): number {
  const cs = getComputedStyle(el);
  const pt = Number.parseFloat(cs.paddingTop || '0') || 0;
  const pb = Number.parseFloat(cs.paddingBottom || '0') || 0;
  return Math.max(0, el.clientHeight - pt - pb);
}

function recomputeFavoritePageSize(explicitHeight?: number): void {
  const container = listScrollEl.value;
  if (!container && typeof explicitHeight !== 'number') return;

  const sample = sampleCellEl.value;
  if (sample) {
    const h = sample.offsetHeight;
    if (h > 0) measuredCellHeight.value = h;
  }

  const contentHeight =
    typeof explicitHeight === 'number'
      ? explicitHeight
      : container
        ? getContentBoxHeight(container)
        : 0;
  const plansHeight = savedPlansEl.value ? savedPlansEl.value.offsetHeight : 0;
  const available = Math.max(0, Math.floor(contentHeight - plansHeight) - 4);
  const cell = Math.max(1, measuredCellHeight.value);

  let rows = Math.floor((available + gridGap) / (cell + gridGap));
  if (rows < 1) rows = 1;

  let used = rows * (cell + gridGap) - gridGap;
  while (rows > 1 && used > available) {
    rows -= 1;
    used = rows * (cell + gridGap) - gridGap;
  }

  const size = Math.min(
    favoritePageSizeMax.value,
    Math.max(favoritePageSizeMin.value, rows * gridColumns.value),
  );
  if (favoritePageSize.value !== size) favoritePageSize.value = size;
}

function scheduleRecomputeFavoritePageSize(): void {
  void nextTick(() => {
    requestAnimationFrame(() => {
      recomputeFavoritePageSize();
    });
  });
}

watch(
  () => props.favoriteItems.length,
  () => {
    scheduleRecomputeFavoritePageSize();
    if (favoritePage.value > favoritePageCount.value) {
      favoritePage.value = favoritePageCount.value;
    }
  },
);

watch(
  () => props.savedPlans.length,
  () => {
    scheduleRecomputeFavoritePageSize();
  },
);

watch(
  () => [props.favoritePageSizeMin, props.favoritePageSizeMax] as const,
  () => {
    scheduleRecomputeFavoritePageSize();
  },
);

watch(
  () => props.iconDisplayMode,
  () => {
    scheduleRecomputeFavoritePageSize();
  },
);

watch(
  () => [props.collapsed, props.mobileTab, props.isMobile] as const,
  () => {
    if (!props.collapsed) scheduleRecomputeFavoritePageSize();
  },
);

watch(
  () => favoritePageCount.value,
  (max) => {
    if (favoritePage.value > max) favoritePage.value = max;
  },
);

const resizeObserver = ref<ResizeObserver | null>(null);

onMounted(() => {
  resizeObserver.value = new ResizeObserver(() => {
    recomputeFavoritePageSize();
  });
  if (listScrollEl.value) resizeObserver.value.observe(listScrollEl.value);
  if (savedPlansEl.value) resizeObserver.value.observe(savedPlansEl.value);
  if (listGridEl.value) resizeObserver.value.observe(listGridEl.value);
  scheduleRecomputeFavoritePageSize();
});

watch(listScrollEl, (el, oldEl) => {
  if (!resizeObserver.value) return;
  if (oldEl) resizeObserver.value.unobserve(oldEl);
  if (el) resizeObserver.value.observe(el);
  scheduleRecomputeFavoritePageSize();
});

watch(savedPlansEl, (el, oldEl) => {
  if (!resizeObserver.value) return;
  if (oldEl) resizeObserver.value.unobserve(oldEl);
  if (el) resizeObserver.value.observe(el);
  scheduleRecomputeFavoritePageSize();
});

watch(listGridEl, (el, oldEl) => {
  if (!resizeObserver.value) return;
  if (oldEl) resizeObserver.value.unobserve(oldEl);
  if (el) resizeObserver.value.observe(el);
  scheduleRecomputeFavoritePageSize();
});

onUnmounted(() => {
  if (resizeObserver.value) {
    resizeObserver.value.disconnect();
    resizeObserver.value = null;
  }
});

defineEmits<{
  'update:collapsed': [value: boolean];
  'update:hovered-key-hash': [value: string | null];
  'update:hovered-source': [source: 'list' | 'favorites' | 'none'];
  'open-plan': [plan: SavedPlan];
  'delete-plan': [id: string];
  'item-click': [keyHash: string];
  'toggle-favorite': [keyHash: string];
  'context-menu': [evt: Event, keyHash: string];
  'touch-hold': [evt: unknown, keyHash: string];
}>();
</script>

<style scoped>
.jei-panel {
  flex: 0 0 auto;
  box-sizing: border-box;
  border-right: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  padding: 12px;
  height: 100%;
  min-height: 0;
  transition: width 0.3s ease;
}

.jei-panel--collapsed {
  width: 20px !important;
  min-width: 20px !important;
  padding: 0;
}

.jei-collapsed-trigger {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: var(--q-primary);
  color: white;
  opacity: 0.6;
  transition: all 0.2s;
  z-index: 10;
}

.jei-collapsed-trigger:hover {
  opacity: 1;
  width: 24px;
}

.jei-collapsed-trigger--left {
  left: 0;
  border-radius: 0 4px 4px 0;
}

.jei-plans__head {
  padding: 2px 2px 6px 2px;
  font-weight: 600;
}

.jei-plans__list {
  padding: 0;
}

.jei-plans__item :deep(.q-item__section--avatar) {
  min-width: 38px;
}

.jei-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.jei-grid--classic {
  grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
  gap: 6px;
}

.jei-grid__cell {
  box-sizing: border-box;
  padding: 8px;
  position: relative;
}

.jei-grid__cell--classic {
  padding: 6px 4px 4px;
  min-height: 46px;
  background: transparent;
  box-shadow: none;
}

.jei-grid__fav {
  position: absolute;
  top: 4px;
  right: 4px;
}

.jei-grid__fav--classic {
  top: 0;
  right: 0;
  transform: scale(0.72);
  transform-origin: top right;
}

.jei-grid__cell-body {
  min-width: 0;
}

.jei-grid__cell-body--classic {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
}

.jei-grid__cell.placeholder {
  border: 1px dashed rgba(0, 0, 0, 0.1);
  background: rgba(0, 0, 0, 0.02);
}

.jei-fav {
  width: 320px;
  min-width: 320px;
  flex: 0 0 auto;
  height: 100%;
  min-height: 0;
  transition: width 0.3s ease;
}

.jei-fav--collapsed {
  width: 20px !important;
  min-width: 20px !important;
}

.jei-collapsed-trigger {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: var(--q-primary);
  color: white;
  opacity: 0.6;
  transition: all 0.2s;
  z-index: 10;
}

.jei-collapsed-trigger:hover {
  opacity: 1;
  width: 24px;
}

.jei-collapsed-trigger--left {
  left: 0;
  border-radius: 0 4px 4px 0;
}

.jei-list__head {
  padding: 12px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.jei-list__head-center {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-width: 0;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
}

.jei-list__head-center span {
  white-space: nowrap;
}

.jei-list__scroll {
  padding: 10px;
  overflow: hidden;
  min-height: 0;
}

.jei-list__pager {
  padding: 10px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.jei-list__pager-pagination {
  display: flex;
  justify-content: center;
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
}

.jei-list__pager-pagination :deep(.q-pagination) {
  min-width: max-content;
  flex-wrap: nowrap;
  margin: 0 auto;
}

.jei-plans__head {
  padding: 2px 2px 6px 2px;
  font-weight: 600;
}

.jei-plans__list {
  padding: 0;
}

.jei-plans__item :deep(.q-item__section--avatar) {
  min-width: 38px;
}
</style>
