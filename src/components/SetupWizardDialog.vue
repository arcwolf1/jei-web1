<template>
  <q-dialog persistent :model-value="visible" @update:model-value="onDialogModelUpdate">
    <q-card class="setup-wizard">
      <q-card-section class="setup-wizard__hero">
        <div class="text-overline">JEI Web</div>
        <div class="text-h5 q-mt-xs">{{ t('setupWizardTitle') }}</div>
        <div class="text-body2 q-mt-sm">{{ t('setupWizardWelcomeBody') }}</div>
      </q-card-section>

      <q-separator />

      <q-stepper v-model="step" flat animated color="primary" class="setup-wizard__stepper">
        <q-step name="intent" :title="t('setupWizardIntentTitle')" icon="explore">
          <div class="text-subtitle2">{{ t('setupWizardWelcomeTitle') }}</div>
          <div class="text-body2 text-grey-7 q-mt-sm">{{ t('setupWizardIntentBody') }}</div>

          <div class="setup-wizard__intent-grid q-mt-md">
            <q-card
              v-for="option in intentOptions"
              :key="option.value"
              flat
              bordered
              class="setup-wizard__intent-card"
              :class="{ 'setup-wizard__intent-card--active': intent === option.value }"
              @click="selectIntent(option.value)"
            >
              <q-card-section>
                <div class="row items-center q-gutter-sm">
                  <q-icon :name="option.icon" color="primary" size="24px" />
                  <div class="text-subtitle1 text-weight-medium">{{ option.label }}</div>
                </div>
                <div class="text-body2 text-grey-7 q-mt-sm">{{ option.description }}</div>
              </q-card-section>
            </q-card>
          </div>

          <q-banner rounded dense class="bg-grey-2 text-grey-8 q-mt-md">
            {{ intentPreviewText }}
          </q-banner>

          <q-select
            class="q-mt-md"
            dense
            outlined
            emit-value
            map-options
            :label="t('setupWizardDataPackLabel')"
            :options="packOptions"
            :model-value="selectedPack"
            @update:model-value="onPackChange"
          />

          <div v-if="packAutoSelectionHint" class="text-caption text-primary q-mt-sm">
            {{ packAutoSelectionHint }}
          </div>

          <div class="text-body2 text-grey-7 q-mt-sm">{{ selectedPackDescription }}</div>

          <q-banner rounded class="bg-blue-1 text-blue-10 q-mt-md">
            {{ t('setupWizardDataSourceThanks') }}
          </q-banner>
        </q-step>

        <q-step name="plugins" :title="t('setupWizardPluginsTitle')" icon="extension">
          <div class="text-subtitle2">{{ t('setupWizardPluginsTitle') }}</div>
          <div class="text-body2 text-grey-7 q-mt-sm">{{ t('setupWizardPluginsBody') }}</div>

          <q-list bordered separator class="rounded-borders q-mt-md overflow-hidden">
            <q-item v-for="plugin in plugins" :key="plugin.id" class="q-py-sm">
              <q-item-section>
                <div class="row items-center q-gutter-sm">
                  <q-item-label class="text-weight-medium">{{ plugin.name }}</q-item-label>
                  <q-chip
                    v-if="plugin.recommendedFor.includes(intent)"
                    dense
                    color="primary"
                    text-color="white"
                  >
                    {{ t('setupWizardPluginRecommended') }}
                  </q-chip>
                </div>
                <q-item-label caption class="q-mt-xs">{{ plugin.description }}</q-item-label>
                <q-item-label
                  v-if="plugin.id === 'bilibili-wiki'"
                  caption
                  class="q-mt-xs text-orange-8"
                >
                  {{ t('setupWizardBilibiliNote') }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  :model-value="pluginEnabledById[plugin.id] ?? false"
                  @update:model-value="setPluginEnabled(plugin.id, !!$event)"
                />
              </q-item-section>
            </q-item>
          </q-list>
        </q-step>

        <q-step name="behavior" :title="t('setupWizardBehaviorTitle')" icon="tune">
          <div class="text-subtitle2">{{ t('setupWizardBehaviorTitle') }}</div>
          <div class="text-body2 text-grey-7 q-mt-sm">{{ t('setupWizardBehaviorBody') }}</div>

          <div class="q-gutter-y-md q-mt-md">
            <q-select
              dense
              outlined
              emit-value
              map-options
              :label="t('setupWizardDefaultOpenTab')"
              :options="defaultTabOptions"
              :model-value="itemClickDefaultTab"
              @update:model-value="itemClickDefaultTab = $event as ItemClickDefaultTab"
            />

            <q-option-group
              :model-value="favoritesOpensNewStack ? 'new-stack' : 'current-stack'"
              type="radio"
              color="primary"
              :options="favoritesModeOptions"
              @update:model-value="onFavoritesModeChange"
            />

            <q-select
              dense
              outlined
              emit-value
              map-options
              :label="t('setupWizardUiStyleLabel')"
              :options="uiStyleOptions"
              :model-value="uiStyle"
              @update:model-value="uiStyle = ($event as SetupWizardUiStyle) ?? 'modern'"
            />
            <div class="text-caption text-grey-7">{{ uiStyleDescription }}</div>

            <q-toggle
              :label="t('setupWizardMobileBehavior')"
              :model-value="mobileItemClickOpensDetail"
              @update:model-value="mobileItemClickOpensDetail = !!$event"
            />

            <q-separator spaced />

            <div class="text-subtitle2">{{ t('sectionHover') }}</div>
            <q-toggle
              :label="t('hoverTooltipAllowMouseEnter')"
              :model-value="hoverTooltipAllowMouseEnter"
              @update:model-value="hoverTooltipAllowMouseEnter = !!$event"
            />
            <q-toggle
              :label="t('hoverTooltipShowDescription')"
              :model-value="hoverTooltipShowDescription"
              @update:model-value="hoverTooltipShowDescription = !!$event"
            />
            <q-toggle
              :label="t('hoverTooltipShowSourceLine')"
              :model-value="hoverTooltipShowSourceLine"
              @update:model-value="hoverTooltipShowSourceLine = !!$event"
            />

            <div class="q-mt-sm">
              <div class="text-caption text-grey-7 q-mb-sm">
                {{ t('setupWizardHoverPreviewHint') }}
              </div>
              <stack-tooltip-card
                :title="previewTitle"
                :id-line="previewIdLine"
                :meta-line="''"
                :nbt-line="''"
                :max-height-px="280"
                :detail-groups="[]"
                :detail-descriptions="[]"
                :rarity-entries="[]"
                :namespace-lines="[]"
                :tags-line="''"
                :source-line="previewSourceLine"
                :description="previewDescription"
                :namespace="previewNamespace"
              />
            </div>
          </div>
        </q-step>
      </q-stepper>

      <q-separator />

      <q-card-actions align="between" class="q-pa-md">
        <q-btn flat color="grey-7" :label="t('setupWizardSkip')" @click="handleSkip" />

        <div class="row q-gutter-sm">
          <q-btn
            flat
            color="primary"
            :disable="step === 'intent'"
            :label="t('setupWizardBack')"
            @click="goBack"
          />
          <q-btn
            v-if="step !== 'behavior'"
            unelevated
            color="primary"
            :label="t('setupWizardNext')"
            @click="goNext"
          />
          <q-btn
            v-else
            unelevated
            color="primary"
            :label="t('setupWizardFinish')"
            @click="handleFinish"
          />
        </div>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ItemClickDefaultTab } from 'src/stores/settings';
import StackTooltipCard from 'src/jei/components/StackTooltipCard.vue';

type SetupWizardIntent = 'wiki' | 'recipes' | 'planner';
type SetupWizardStep = 'intent' | 'plugins' | 'behavior';
type SetupWizardUiStyle = 'modern' | 'jei_classic';

interface SetupWizardPluginEntry {
  id: string;
  name: string;
  enabled: boolean;
  description: string;
  recommendedFor: SetupWizardIntent[];
}

interface SetupWizardPackEntry {
  value: string;
  label: string;
  description: string;
  recommendedFor: SetupWizardIntent[];
}

interface SetupWizardResult {
  intent: SetupWizardIntent;
  selectedPack: string;
  itemClickDefaultTab: ItemClickDefaultTab;
  favoritesOpensNewStack: boolean;
  uiStyle: SetupWizardUiStyle;
  mobileItemClickOpensDetail: boolean;
  hoverTooltipAllowMouseEnter: boolean;
  hoverTooltipShowDescription: boolean;
  hoverTooltipShowSourceLine: boolean;
  pluginEnabledById: Record<string, boolean>;
}

const props = defineProps<{
  visible: boolean;
  plugins: SetupWizardPluginEntry[];
  packs: SetupWizardPackEntry[];
  initialIntent: SetupWizardIntent;
  initialSelectedPack: string;
  initialItemClickDefaultTab: ItemClickDefaultTab;
  initialFavoritesOpensNewStack: boolean;
  initialUiStyle: SetupWizardUiStyle;
  initialMobileItemClickOpensDetail: boolean;
  initialHoverTooltipAllowMouseEnter: boolean;
  initialHoverTooltipShowDescription: boolean;
  initialHoverTooltipShowSourceLine: boolean;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  finish: [payload: SetupWizardResult];
  skip: [];
}>();

const { t } = useI18n();

const step = ref<SetupWizardStep>('intent');
const intent = ref<SetupWizardIntent>('recipes');
const selectedPack = ref('');
const itemClickDefaultTab = ref<ItemClickDefaultTab>('recipes');
const favoritesOpensNewStack = ref(false);
const uiStyle = ref<SetupWizardUiStyle>('modern');
const mobileItemClickOpensDetail = ref(true);
const hoverTooltipAllowMouseEnter = ref(true);
const hoverTooltipShowDescription = ref(true);
const hoverTooltipShowSourceLine = ref(true);
const pluginEnabledById = ref<Record<string, boolean>>({});
const packManuallyChanged = ref(false);

const intentOptions = computed(() => [
  {
    value: 'wiki' as const,
    icon: 'menu_book',
    label: t('setupWizardIntentWiki'),
    description: t('setupWizardIntentPreviewWiki'),
  },
  {
    value: 'recipes' as const,
    icon: 'construction',
    label: t('setupWizardIntentRecipes'),
    description: t('setupWizardIntentPreviewRecipes'),
  },
  {
    value: 'planner' as const,
    icon: 'account_tree',
    label: t('setupWizardIntentPlanner'),
    description: t('setupWizardIntentPreviewPlanner'),
  },
]);

const favoritesModeOptions = computed(() => [
  {
    label: t('setupWizardFavoritesCurrent'),
    value: 'current-stack',
  },
  {
    label: t('setupWizardFavoritesNewStack'),
    value: 'new-stack',
  },
]);

const uiStyleOptions = computed(() => [
  { label: t('iconDisplayModeModern'), value: 'modern' },
  { label: t('iconDisplayModeJeiClassic'), value: 'jei_classic' },
]);

const packOptions = computed(() =>
  props.packs.map((pack) => ({ label: pack.label, value: pack.value })),
);

const defaultTabOptions = computed(() => [
  { label: t('tabsRecipes'), value: 'recipes' },
  { label: t('tabsUses'), value: 'uses' },
  { label: t('tabsWiki'), value: 'wiki' },
  {
    label: t('tabsPlanner'),
    value: 'planner',
    disable: !(pluginEnabledById.value['endfield-planner'] ?? false),
  },
]);

const selectedPackDescription = computed(
  () => props.packs.find((pack) => pack.value === selectedPack.value)?.description ?? '',
);
const selectedPackLabel = computed(
  () => props.packs.find((pack) => pack.value === selectedPack.value)?.label ?? selectedPack.value,
);
const packAutoSelectionHint = computed(() => {
  if (packManuallyChanged.value || !selectedPack.value) return '';
  return t('setupWizardAutoSelectedPackHint', { pack: selectedPackLabel.value });
});

const uiStyleDescription = computed(() =>
  uiStyle.value === 'jei_classic'
    ? t('setupWizardUiStyleClassicDesc')
    : t('setupWizardUiStyleModernDesc'),
);

const previewTitle = computed(() => t('setupWizardHoverPreviewTitle'));
const previewIdLine = computed(() => t('setupWizardHoverPreviewIdLine'));
const previewSourceLine = computed(() =>
  hoverTooltipShowSourceLine.value ? t('setupWizardHoverPreviewSourceLine') : '',
);
const previewDescription = computed(() =>
  hoverTooltipShowDescription.value ? t('setupWizardHoverPreviewDescription') : '',
);
const previewNamespace = computed(() => t('setupWizardHoverPreviewNamespace'));

const intentPreviewText = computed(() => {
  if (intent.value === 'wiki') return t('setupWizardIntentPreviewWiki');
  if (intent.value === 'planner') return t('setupWizardIntentPreviewPlanner');
  return t('setupWizardIntentPreviewRecipes');
});

function resetForm() {
  step.value = 'intent';
  intent.value = props.initialIntent;
  selectedPack.value = props.initialSelectedPack;
  itemClickDefaultTab.value = props.initialItemClickDefaultTab;
  favoritesOpensNewStack.value = props.initialFavoritesOpensNewStack;
  uiStyle.value = props.initialUiStyle;
  mobileItemClickOpensDetail.value = props.initialMobileItemClickOpensDetail;
  hoverTooltipAllowMouseEnter.value = props.initialHoverTooltipAllowMouseEnter;
  hoverTooltipShowDescription.value = props.initialHoverTooltipShowDescription;
  hoverTooltipShowSourceLine.value = props.initialHoverTooltipShowSourceLine;
  packManuallyChanged.value = false;
  pluginEnabledById.value = Object.fromEntries(
    props.plugins.map((plugin) => [plugin.id, plugin.enabled]),
  );
}

function pickRecommendedPack(intentValue: SetupWizardIntent): string {
  if (intentValue === 'wiki') {
    return (
      props.packs.find((pack) => pack.value === 'aef-aggregated-full')?.value ??
      props.packs.find((pack) => pack.value === 'aef-aggregated')?.value ??
      props.packs.find((pack) => pack.value === 'aef-skland')?.value ??
      props.packs.find((pack) => pack.value === 'warfarin-next')?.value ??
      props.packs.find((pack) => pack.recommendedFor.includes('wiki'))?.value ??
      props.initialSelectedPack
    );
  }

  if (intentValue === 'planner') {
    return (
      props.packs.find((pack) => pack.value === 'aef')?.value ??
      props.packs.find((pack) => pack.value === 'aef-aggregated-full')?.value ??
      props.packs.find((pack) => pack.recommendedFor.includes('planner'))?.value ??
      props.initialSelectedPack
    );
  }

  return (
    props.packs.find((pack) => pack.value === 'aef')?.value ??
    props.packs.find((pack) => pack.value === 'aef-aggregated')?.value ??
    props.packs.find((pack) => pack.recommendedFor.includes('recipes'))?.value ??
    props.initialSelectedPack
  );
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      resetForm();
    }
  },
  { immediate: true },
);

watch(
  () => pluginEnabledById.value['endfield-planner'],
  (enabled) => {
    if (!enabled && itemClickDefaultTab.value === 'planner') {
      itemClickDefaultTab.value = 'recipes';
    }
  },
);

function applyIntentPreset(value: SetupWizardIntent) {
  intent.value = value;
  if (!packManuallyChanged.value) {
    selectedPack.value = pickRecommendedPack(value);
  }
  if (value === 'wiki') {
    itemClickDefaultTab.value = 'wiki';
    favoritesOpensNewStack.value = false;
    return;
  }
  if (value === 'planner') {
    itemClickDefaultTab.value = pluginEnabledById.value['endfield-planner'] ? 'planner' : 'recipes';
    favoritesOpensNewStack.value = true;
    return;
  }
  itemClickDefaultTab.value = 'recipes';
  favoritesOpensNewStack.value = false;
}

function selectIntent(value: SetupWizardIntent) {
  applyIntentPreset(value);
}

function setPluginEnabled(pluginId: string, enabled: boolean) {
  pluginEnabledById.value = {
    ...pluginEnabledById.value,
    [pluginId]: enabled,
  };
  if (pluginId === 'endfield-planner' && enabled && intent.value === 'planner') {
    itemClickDefaultTab.value = 'planner';
  }
}

function onPackChange(value: string | number | null) {
  selectedPack.value = String(value ?? '');
  packManuallyChanged.value = true;
}

function onFavoritesModeChange(value: string | number | null) {
  favoritesOpensNewStack.value = value === 'new-stack';
}

function goNext() {
  if (step.value === 'intent') {
    step.value = 'plugins';
    return;
  }
  if (step.value === 'plugins') {
    step.value = 'behavior';
  }
}

function goBack() {
  if (step.value === 'behavior') {
    step.value = 'plugins';
    return;
  }
  if (step.value === 'plugins') {
    step.value = 'intent';
  }
}

function handleSkip() {
  emit('skip');
}

function handleFinish() {
  emit('finish', {
    intent: intent.value,
    selectedPack: selectedPack.value,
    itemClickDefaultTab: itemClickDefaultTab.value,
    favoritesOpensNewStack: favoritesOpensNewStack.value,
    uiStyle: uiStyle.value,
    mobileItemClickOpensDetail: mobileItemClickOpensDetail.value,
    hoverTooltipAllowMouseEnter: hoverTooltipAllowMouseEnter.value,
    hoverTooltipShowDescription: hoverTooltipShowDescription.value,
    hoverTooltipShowSourceLine: hoverTooltipShowSourceLine.value,
    pluginEnabledById: { ...pluginEnabledById.value },
  });
}

function onDialogModelUpdate(value: boolean) {
  emit('update:visible', value);
}
</script>

<style scoped>
.setup-wizard {
  width: min(760px, calc(100vw - 24px));
  max-width: 100%;
}

.setup-wizard__hero {
  background: linear-gradient(135deg, #f5fbff 0%, #eef6ff 42%, #fff6e9 100%);
}

.body--dark .setup-wizard__hero {
  background: linear-gradient(
    135deg,
    rgba(24, 55, 92, 0.65) 0%,
    rgba(36, 73, 112, 0.5) 42%,
    rgba(110, 76, 21, 0.35) 100%
  );
}

.setup-wizard__stepper {
  background: transparent;
}

.setup-wizard__intent-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.setup-wizard__intent-card {
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.setup-wizard__intent-card:hover {
  border-color: rgba(25, 118, 210, 0.42);
  transform: translateY(-1px);
}

.setup-wizard__intent-card--active {
  border-color: rgb(25, 118, 210);
  box-shadow: 0 0 0 1px rgba(25, 118, 210, 0.14);
}

@media (max-width: 720px) {
  .setup-wizard__intent-grid {
    grid-template-columns: 1fr;
  }
}
</style>
