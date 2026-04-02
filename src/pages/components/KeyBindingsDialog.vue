<template>
  <q-dialog :model-value="open" @update:model-value="$emit('update:open', $event)" maximized>
    <q-card>
      <q-card-section>
        <div class="text-h6">{{ t('keybindings') }}</div>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <q-list bordered separator>
          <q-expansion-item
            v-for="group in bindingGroups"
            :key="group.id"
            :label="group.label"
            group="keybindings"
            default-opened
          >
            <q-list separator>
              <q-item v-for="action in group.actions" :key="action.id">
                <q-item-section>
                  <q-item-label>{{ action.label }}</q-item-label>
                  <q-item-label caption>{{ action.description }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-btn
                    :label="keyBindingToString(store.getBinding(action.id as any))"
                    :color="recordingAction === action.id ? 'negative' : 'primary'"
                    :outline="recordingAction !== action.id"
                    @click="startRecording(action.id)"
                  >
                    <q-tooltip v-if="recordingAction === action.id">
                      {{ t('pressKeyToBind') }}
                    </q-tooltip>
                  </q-btn>
                </q-item-section>
              </q-item>
            </q-list>
          </q-expansion-item>
        </q-list>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="t('resetToDefaults')" color="warning" @click="confirmReset" />
        <q-btn flat :label="t('close')" color="primary" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useKeyBindingsStore, keyBindingToString, type KeyAction } from 'src/stores/keybindings';

const { t } = useI18n();
const store = useKeyBindingsStore();

defineProps<{
  open: boolean;
}>();

defineEmits<{
  'update:open': [value: boolean];
}>();

interface BindingAction {
  id: KeyAction;
  label: string;
  description: string;
}

interface BindingGroup {
  id: string;
  label: string;
  actions: BindingAction[];
}

const bindingGroups = computed<BindingGroup[]>(() => [
  {
    id: 'navigation',
    label: t('keybindingGroupNavigation'),
    actions: [
      { id: 'closeDialog', label: t('keybindingCloseDialog'), description: '' },
      { id: 'goBack', label: t('keybindingGoBack'), description: '' },
    ],
  },
  {
    id: 'view',
    label: t('keybindingGroupView'),
    actions: [
      { id: 'viewRecipes', label: t('keybindingViewRecipes'), description: '' },
      { id: 'viewUses', label: t('keybindingViewUses'), description: '' },
      { id: 'viewWiki', label: t('keybindingViewWiki'), description: '' },
      { id: 'viewIcon', label: t('keybindingViewIcon'), description: '' },
      { id: 'viewPlanner', label: t('keybindingViewPlanner'), description: '' },
    ],
  },
  {
    id: 'planner',
    label: t('keybindingGroupPlanner'),
    actions: [
      { id: 'plannerTree', label: t('keybindingPlannerTree'), description: '' },
      { id: 'plannerGraph', label: t('keybindingPlannerGraph'), description: '' },
      { id: 'plannerLine', label: t('keybindingPlannerLine'), description: '' },
      { id: 'plannerCalc', label: t('keybindingPlannerCalc'), description: '' },
      { id: 'plannerQuant', label: t('keybindingPlannerQuant'), description: '' },
    ],
  },
  {
    id: 'item',
    label: t('keybindingGroupItem'),
    actions: [
      { id: 'toggleFavorite', label: t('keybindingToggleFavorite'), description: '' },
      { id: 'addToAdvanced', label: t('keybindingAddToAdvanced'), description: '' },
      { id: 'hoverTooltipInteract', label: t('keybindingHoverTooltipInteract'), description: '' },
    ],
  },
  {
    id: 'circuit',
    label: t('keybindingGroupCircuit'),
    actions: [
      { id: 'circuitRotate', label: t('keybindingCircuitRotate'), description: '' },
      { id: 'circuitRun', label: t('keybindingCircuitRun'), description: '' },
      { id: 'circuitDeselect', label: t('keybindingCircuitDeselect'), description: '' },
      { id: 'circuitDelete', label: t('keybindingCircuitDelete'), description: '' },
    ],
  },
]);

const recordingAction = ref<KeyAction | null>(null);

function startRecording(actionId: KeyAction) {
  recordingAction.value = actionId;
}

function stopRecording() {
  recordingAction.value = null;
}

function handleKeyDown(event: KeyboardEvent) {
  if (recordingAction.value === null) return;

  event.preventDefault();
  event.stopPropagation();

  const binding = {
    key: event.key,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
  };

  store.setBinding(recordingAction.value, binding);
  stopRecording();
}

function handleKeyUp() {
  if (recordingAction.value !== null) {
    stopRecording();
  }
}

function confirmReset() {
  store.resetToDefaults();
}

// 监听键盘事件用于录制
window.addEventListener('keydown', handleKeyDown, true);
window.addEventListener('keyup', handleKeyUp, true);

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown, true);
  window.removeEventListener('keyup', handleKeyUp, true);
});
</script>
