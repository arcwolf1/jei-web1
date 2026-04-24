<template>
  <q-card v-if="pendingDecisions.length" flat bordered class="q-pa-md q-mt-md">
    <div class="row items-center q-gutter-sm q-mb-md">
      <div class="text-subtitle2">{{ t('recipeSelection') }}</div>
      <q-space />
      <q-badge color="warning">{{ t('pendingChoices') }}{{ pendingDecisions.length }}</q-badge>
    </div>

    <div class="column q-gutter-md">
      <div v-for="decision in pendingDecisions" :key="decisionKey(decision)" class="decision-card">
        <q-card v-if="decision.kind === 'item_recipe'" flat bordered class="q-pa-md">
          <div class="text-caption text-weight-medium q-mb-sm">
            {{ itemName(decision.itemKey) }} - {{ t('chooseSynthesisMethod') }}
          </div>
          <q-select
            dense
            filled
            emit-value
            map-options
            :options="recipeOptionsForDecision(decision)"
            :model-value="getSelectedRecipe(decision.itemKeyHash)"
            @update:model-value="
              emit('set-recipe-choice', {
                itemKeyHash: decision.itemKeyHash,
                recipeId: $event as string,
              })
            "
          >
            <template #option="scope">
              <q-item v-bind="scope.itemProps" class="planner__recipe-option">
                <q-item-section>
                  <q-item-label>{{ scope.opt.label }}</q-item-label>
                  <div v-if="scope.opt.inputs?.length" class="planner__recipe-option-inputs">
                    <stack-view
                      v-for="(stack, index) in scope.opt.inputs.slice(0, 8)"
                      :key="`${scope.opt.value}:${index}`"
                      :content="stack"
                      :item-defs-by-key-hash="itemDefsByKeyHash"
                      variant="slot"
                      :show-name="false"
                      :show-subtitle="false"
                      @item-click="emit('item-click', $event)"
                      @item-mouseenter="emit('item-mouseenter', $event)"
                      @item-mouseleave="emit('item-mouseleave')"
                    />
                    <div
                      v-if="scope.opt.inputs.length > 8"
                      class="planner__recipe-option-more text-caption text-grey-6"
                    >
                      +{{ scope.opt.inputs.length - 8 }}
                    </div>
                  </div>
                </q-item-section>
                <q-item-section side>
                  <div class="text-caption text-grey-6">{{ scope.opt.value }}</div>
                </q-item-section>

                <q-tooltip max-width="720px">
                  <q-card
                    v-if="scope.opt.recipe && scope.opt.recipeType"
                    flat
                    bordered
                    class="q-pa-sm"
                  >
                    <recipe-viewer
                      :recipe="scope.opt.recipe"
                      :recipe-type="scope.opt.recipeType"
                      :item-defs-by-key-hash="itemDefsByKeyHash"
                      @item-click="emit('item-click', $event)"
                      @item-mouseenter="emit('item-mouseenter', $event)"
                      @item-mouseleave="emit('item-mouseleave')"
                    />
                  </q-card>
                  <div v-else class="text-caption">{{ t('noRecipeDetails') }}</div>
                </q-tooltip>
              </q-item>
            </template>
          </q-select>
        </q-card>

        <q-card v-else-if="decision.kind === 'tag_item'" flat bordered class="q-pa-md">
          <div class="text-caption text-weight-medium q-mb-sm">
            {{ t('tagSelection') }} {{ getTagDisplayName(decision.tagId) }} -
            {{ t('chooseSpecificItem') }}
          </div>
          <q-select
            dense
            filled
            emit-value
            map-options
            :options="tagItemOptions(decision)"
            :model-value="getSelectedTag(decision.tagId)"
            @update:model-value="
              emit('set-tag-choice', { tagId: decision.tagId, itemId: $event as string })
            "
          />
        </q-card>
      </div>
    </div>
  </q-card>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { ItemDef, ItemId, ItemKey, Recipe, RecipeTypeDef, Stack } from 'src/jei/types';
import type { PlannerDecision } from 'src/jei/planner/planner';
import RecipeViewer from 'src/jei/components/RecipeViewer.vue';
import StackView from 'src/jei/components/StackView.vue';

type RecipeDecisionOption = {
  label: string;
  value: string;
  inputs: Stack[];
  recipe: Recipe | undefined;
  recipeType: RecipeTypeDef | undefined;
};

defineProps<{
  pendingDecisions: PlannerDecision[];
  itemDefsByKeyHash: Record<string, ItemDef>;
  itemName: (itemKey: ItemKey) => string;
  getTagDisplayName: (tagId: string) => string;
  recipeOptionsForDecision: (
    decision: Extract<PlannerDecision, { kind: 'item_recipe' }>,
  ) => RecipeDecisionOption[];
  getSelectedRecipe: (itemKeyHash: string) => string | null;
  getSelectedTag: (tagId: string) => string | null;
  tagItemOptions: (decision: Extract<PlannerDecision, { kind: 'tag_item' }>) => Array<{
    label: string;
    value: ItemId;
  }>;
}>();

const emit = defineEmits<{
  'set-recipe-choice': [payload: { itemKeyHash: string; recipeId: string }];
  'set-tag-choice': [payload: { tagId: string; itemId: string }];
  'item-click': [itemKey: ItemKey];
  'item-mouseenter': [keyHash: string];
  'item-mouseleave': [];
}>();

const { t } = useI18n();

const decisionKey = (decision: PlannerDecision): string => {
  return decision.kind === 'item_recipe'
    ? `recipe:${decision.itemKeyHash}`
    : `tag:${decision.tagId}`;
};
</script>
