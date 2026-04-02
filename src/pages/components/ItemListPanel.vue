<template>
  <q-card
    v-show="!isMobile || mobileTab === 'list'"
    flat
    bordered
    class="jei-panel jei-list column no-wrap"
    :style="{ width: isMobile ? '100%' : '420px', minWidth: isMobile ? 'auto' : '420px' }"
  >
    <div class="jei-list__head col-auto">
      <div class="text-subtitle2">{{ t('itemList') }}</div>
      <div class="jei-list__head-center text-caption text-grey-7">
        <span>{{ t('totalItems', { count: totalCount }) }}</span>
        <span>{{ t('itemsPerPage', { size: pageSize }) }}</span>
      </div>
      <div class="text-caption">pack: {{ packId }}</div>
    </div>

    <div ref="listScrollEl" class="jei-list__scroll col" @wheel="$emit('wheel', $event)">
      <div
        ref="listGridEl"
        :class="['jei-grid', { 'jei-grid--classic': iconDisplayMode === 'jei_classic' }]"
      >
        <div v-if="firstPagedItem" ref="sampleCellEl">
          <q-card
            :key="firstPagedItem.keyHash"
            flat
            :bordered="iconDisplayMode !== 'jei_classic'"
            :class="[
              'jei-grid__cell cursor-pointer',
              { 'jei-grid__cell--classic': iconDisplayMode === 'jei_classic' },
            ]"
            v-touch-hold:600="
              (evt: unknown) => $emit('touch-hold', evt, firstPagedItem?.keyHash ?? '')
            "
            @contextmenu.prevent="$emit('context-menu', $event, firstPagedItem?.keyHash ?? '')"
            @mouseenter="
              $emit('update:hovered-key-hash', firstPagedItem.keyHash);
              $emit('update:hovered-source', 'list');
            "
            @mouseleave="
              $emit('update:hovered-key-hash', null);
              $emit('update:hovered-source', 'none');
            "
            @click="$emit('item-click', firstPagedItem.keyHash)"
          >
            <q-btn
              flat
              round
              :dense="!isMobile"
              :size="isMobile ? 'md' : 'sm'"
              :icon="isFavorite(firstPagedItem.keyHash) ? 'star' : 'star_outline'"
              :color="isFavorite(firstPagedItem.keyHash) ? 'amber' : 'grey-6'"
              :class="[
                'jei-grid__fav',
                { 'jei-grid__fav--classic': iconDisplayMode === 'jei_classic' },
              ]"
              @click.stop="$emit('toggle-favorite', firstPagedItem.keyHash)"
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
                  id: firstPagedItem.def.key.id,
                  amount: 1,
                  ...(firstPagedItem.def.key.meta !== undefined
                    ? { meta: firstPagedItem.def.key.meta }
                    : {}),
                  ...(firstPagedItem.def.key.nbt !== undefined
                    ? { nbt: firstPagedItem.def.key.nbt }
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
          v-for="it in restPagedItems"
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
            $emit('update:hovered-source', 'list');
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
            :icon="isFavorite(it.keyHash) ? 'star' : 'star_outline'"
            :color="isFavorite(it.keyHash) ? 'amber' : 'grey-6'"
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
    </div>

    <div class="jei-list__pager col-auto">
      <div class="jei-list__pager-pagination">
        <q-pagination
          :model-value="page"
          @update:model-value="$emit('update:page', $event)"
          :max="pageCount"
          max-pages="7"
          boundary-numbers
          direction-links
          dense
        />
      </div>
    </div>

    <div ref="historyEl" class="jei-list__history col-auto">
      <div class="jei-list__history-title">{{ t('history') }}</div>
      <div :class="['jei-grid', { 'jei-grid--classic': iconDisplayMode === 'jei_classic' }]">
        <template
          v-for="(it, idx) in paddedHistoryItems"
          :key="it ? it.keyHash : `placeholder-${idx}`"
        >
          <q-card
            v-if="it"
            flat
            :bordered="iconDisplayMode !== 'jei_classic'"
            :class="[
              'jei-grid__cell cursor-pointer',
              { 'jei-grid__cell--classic': iconDisplayMode === 'jei_classic' },
            ]"
            v-touch-hold:600="(evt: unknown) => $emit('touch-hold', evt, it.keyHash)"
            @contextmenu.prevent="$emit('context-menu', $event, it.keyHash)"
            @mouseenter="$emit('update:hovered-key-hash', it.keyHash)"
            @mouseleave="$emit('update:hovered-key-hash', null)"
            @click="$emit('item-click', it.keyHash)"
          >
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
          <div
            v-else
            class="jei-grid__cell placeholder"
            :style="{ height: measuredCellHeight + 'px' }"
          ></div>
        </template>
      </div>
    </div>
  </q-card>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ItemDef } from 'src/jei/types';
import StackView from 'src/jei/components/StackView.vue';
import type { ItemIconDisplayMode } from 'src/stores/settings';

const { t } = useI18n();

const props = defineProps<{
  isMobile: boolean;
  mobileTab: string;
  packId: string;
  firstPagedItem: { keyHash: string; def: ItemDef } | null;
  restPagedItems: Array<{ keyHash: string; def: ItemDef }>;
  paddedHistoryItems: Array<{ keyHash: string; def: ItemDef } | null>;
  page: number;
  pageSize: number;
  pageCount: number;
  totalCount: number;
  measuredCellHeight: number;
  itemDefsByKeyHash: Record<string, ItemDef>;
  favorites: Set<string>;
  iconDisplayMode: ItemIconDisplayMode;
}>();

defineEmits<{
  'update:hovered-key-hash': [value: string | null];
  'update:hovered-source': [source: 'list' | 'favorites' | 'none'];
  'update:page': [value: number];
  'item-click': [keyHash: string];
  'toggle-favorite': [keyHash: string];
  'context-menu': [evt: Event, keyHash: string];
  'touch-hold': [evt: unknown, keyHash: string];
  wheel: [evt: WheelEvent];
}>();

function isFavorite(keyHash: string) {
  return props.favorites.has(keyHash);
}

const listScrollEl = ref<HTMLElement | null>(null);
const listGridEl = ref<HTMLElement | null>(null);
const sampleCellEl = ref<HTMLElement | null>(null);
const historyEl = ref<HTMLElement | null>(null);

defineExpose({
  listScrollEl,
  listGridEl,
  sampleCellEl,
  historyEl,
});
</script>

<style scoped>
.jei-list {
  height: 100%;
  min-height: 0;
}

.jei-list__head {
  padding: 12px;
  display: flex;
  align-items: center;
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

.jei-panel {
  flex: 0 0 auto;
  box-sizing: border-box;
  border-left: 1px solid rgba(0, 0, 0, 0.08);
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

.jei-collapsed-trigger--right {
  right: 0;
  border-radius: 4px 0 0 4px;
}

.jei-debug .jei-list__scroll {
  overflow: auto;
}

.jei-history-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.jei-history-grid__cell {
  padding: 8px;
}

.jei-list__history {
  padding: 10px;
  background: #f3f4f6;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.jei-list__history-title {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
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

.jei-grid--classic .jei-grid__cell.placeholder {
  border: none;
  background: transparent;
}
</style>
