<template>
  <q-dialog
    :model-value="visible"
    :maximized="isMobile"
    @update:model-value="emit('update:visible', $event)"
  >
    <q-card class="build-info-dialog" :class="{ 'build-info-dialog--mobile': isMobile }">
      <q-card-section class="row items-center q-px-md q-py-sm">
        <div class="text-h6">{{ title }}</div>
        <q-space />
        <q-btn flat round icon="close" @click="emit('update:visible', false)" />
      </q-card-section>

      <q-separator />

      <q-card-section class="build-info-dialog__body">
        <div class="text-caption text-grey-6 q-mb-md">{{ versionLabel }}: v{{ appVersion }}</div>
        <div class="doc-md" v-html="html"></div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useQuasar } from 'quasar';
import MarkdownIt from 'markdown-it';
import aboutMd from 'src/assets/about.generated.md?raw';

defineProps<{
  visible: boolean;
  title: string;
  versionLabel: string;
  appVersion: string;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
}>();

const $q = useQuasar();

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

const html = computed(() => md.render(aboutMd));
const isMobile = computed(() => $q.screen.lt.md);
</script>

<style scoped>
.build-info-dialog {
  width: min(960px, 92vw);
  max-width: 92vw;
  max-height: min(88vh, 920px);
  display: flex;
  flex-direction: column;
}

.build-info-dialog--mobile {
  width: 100% !important;
  max-width: none !important;
  max-height: none !important;
  height: 100% !important;
  border-radius: 0 !important;
}

.build-info-dialog__body {
  overflow: auto;
  min-height: 0;
}

.doc-md :deep(pre) {
  white-space: pre-wrap;
  word-break: break-word;
}

.doc-md :deep(h1) {
  font-size: 22px;
  line-height: 30px;
  margin: 0 0 12px;
}

.doc-md :deep(h2) {
  font-size: 18px;
  line-height: 26px;
  margin: 18px 0 10px;
}

.doc-md :deep(h3) {
  font-size: 16px;
  line-height: 24px;
  margin: 16px 0 8px;
}

.doc-md :deep(p),
.doc-md :deep(ul),
.doc-md :deep(ol) {
  margin: 8px 0;
}
</style>
