<template>
  <div class="row items-center q-gutter-sm">
    <slot />
    <q-space />
    <q-btn
      flat
      dense
      round
      :icon="pageFull ? 'close_fullscreen' : 'fit_screen'"
      @click="emit('update:page-full', !pageFull)"
    >
      <q-tooltip>{{ pageFull ? t('exitPageFullscreen') : t('pageFullscreen') }}</q-tooltip>
    </q-btn>
    <q-btn
      flat
      dense
      round
      :icon="fullscreen ? 'fullscreen_exit' : 'fullscreen'"
      @click="emit('toggle-fullscreen')"
    >
      <q-tooltip>{{ fullscreen ? t('exitFullscreen') : t('fullscreen') }}</q-tooltip>
    </q-btn>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{
  pageFull: boolean;
  fullscreen: boolean;
}>();

const emit = defineEmits<{
  'update:page-full': [value: boolean];
  'toggle-fullscreen': [];
}>();

const { t } = useI18n();
</script>
