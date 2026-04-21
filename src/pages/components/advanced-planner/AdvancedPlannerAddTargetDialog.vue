<template>
  <q-dialog :model-value="open" @update:model-value="emit('update:open', !!$event)">
    <q-card class="advanced-planner-add-target-dialog">
      <q-card-section class="row items-center q-gutter-sm">
        <div class="text-subtitle2">{{ t('addProduct') }}</div>
        <q-space />
        <q-btn flat round dense icon="close" @click="emit('update:open', false)" />
      </q-card-section>
      <q-separator />
      <q-card-section class="q-gutter-md">
        <q-input
          :model-value="searchText"
          dense
          filled
          clearable
          autofocus
          :label="t('itemName')"
          :placeholder="t('itemNamePlaceholder')"
          @update:model-value="searchText = String($event ?? '')"
        />

        <q-scroll-area style="height: 420px">
          <q-list bordered separator class="rounded-borders">
            <q-item
              v-for="item in filteredItems"
              :key="item.keyHash"
              clickable
              :disable="item.disabled"
              @click="selectItem(item)"
            >
              <q-item-section avatar>
                <stack-view
                  :content="{
                    kind: 'item',
                    id: item.item.key.id,
                    amount: 1,
                    ...(item.item.key.meta !== undefined ? { meta: item.item.key.meta } : {}),
                    ...(item.item.key.nbt !== undefined ? { nbt: item.item.key.nbt } : {}),
                  }"
                  :item-defs-by-key-hash="itemDefsByKeyHash"
                  variant="slot"
                  :show-name="false"
                  :show-subtitle="false"
                  :show-amount="false"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ item.item.name }}</q-item-label>
                <q-item-label caption>{{ item.item.key.id }}</q-item-label>
              </q-item-section>
              <q-item-section v-if="item.disabled" side class="text-caption text-grey-6">
                {{ t('completed') }}
              </q-item-section>
            </q-item>
            <q-item v-if="filteredItems.length === 0">
              <q-item-section class="text-caption text-grey-6">
                {{ t('selectItem') }}
              </q-item-section>
            </q-item>
          </q-list>
        </q-scroll-area>
      </q-card-section>
      <q-separator />
      <q-card-actions align="right">
        <q-btn flat :label="t('cancel')" @click="emit('update:open', false)" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import StackView from 'src/jei/components/StackView.vue';
import type { ItemDef, ItemKey } from 'src/jei/types';

type PickerItem = {
  item: ItemDef;
  keyHash: string;
  disabled: boolean;
};

const props = defineProps<{
  open: boolean;
  itemDefsByKeyHash: Record<string, ItemDef>;
  existingTargetHashes: string[];
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  'select-item': [payload: { itemKey: ItemKey; itemName: string }];
}>();

const { t } = useI18n();
const searchText = ref('');

const pickerItems = computed<PickerItem[]>(() => {
  const existing = new Set(props.existingTargetHashes);
  return Object.entries(props.itemDefsByKeyHash)
    .map(([keyHash, item]) => ({
      item,
      keyHash,
      disabled: existing.has(keyHash),
    }))
    .sort((a, b) => a.item.name.localeCompare(b.item.name));
});

const filteredItems = computed(() => {
  const query = searchText.value.trim().toLowerCase();
  const tokens = query.split(/\s+/).filter(Boolean);
  const items = tokens.length
    ? pickerItems.value.filter(({ item, keyHash }) => {
        const haystack = `${item.name} ${item.key.id} ${keyHash}`.toLowerCase();
        return tokens.every((token) => haystack.includes(token));
      })
    : pickerItems.value;
  return items.slice(0, 100);
});

watch(
  () => props.open,
  (open) => {
    if (!open) searchText.value = '';
  },
);

const selectItem = (item: PickerItem) => {
  if (item.disabled) return;
  emit('select-item', { itemKey: item.item.key, itemName: item.item.name });
  emit('update:open', false);
  searchText.value = '';
};
</script>

<style scoped>
.advanced-planner-add-target-dialog {
  width: min(720px, 92vw);
  max-width: 92vw;
}
</style>
