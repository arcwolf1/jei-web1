<template>
  <div
    class="column items-center justify-center full-width"
    :class="[
      overlay ? 'window-height fixed-top' : 'q-pa-xl',
      isDark ? 'bg-dark text-white' : 'bg-white text-dark',
    ]"
    :style="overlay ? 'z-index: 2000' : ''"
  >
    <q-btn
      v-if="overlay"
      flat
      round
      icon="settings"
      size="lg"
      class="absolute-top-right q-ma-lg"
      :color="isDark ? 'white' : 'grey-8'"
      @click="$emit('open-settings')"
    />
    <img
      :src="appPath('/icons/icon.svg')"
      :style="overlay ? 'width: 120px; height: 120px' : 'width: 80px; height: 80px'"
      class="q-mb-lg"
    />
    <div v-if="overlay" class="text-h5 text-weight-bold q-mb-md">{{ packLabel }}</div>

    <template v-if="progress">
      <div class="text-subtitle1 q-mb-md text-primary">{{ progress.message }}</div>
      <q-linear-progress
        :value="progress.percent"
        size="6px"
        color="primary"
        :track-color="isDark ? 'grey-8' : 'grey-3'"
        rounded
        style="width: 300px; max-width: 80vw"
      />
      <div class="text-caption q-mt-sm" :class="isDark ? 'text-grey-5' : 'text-grey-7'">
        {{ Math.round(progress.percent * 100) }}%
      </div>
    </template>
    <div v-else class="row items-center q-gutter-sm">
      <q-spinner size="30px" color="primary" />
      <div class="text-h6">{{ t('loading') }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { LoadProgress } from 'src/jei/pack/loader';
import { appPath } from 'src/utils/app-path';

defineProps<{
  overlay?: boolean;
  packLabel?: string;
  progress?: LoadProgress | null;
}>();

defineEmits<{
  (e: 'open-settings'): void;
}>();

const $q = useQuasar();
const { t } = useI18n();
const isDark = computed(() => $q.dark.isActive);
</script>
