<template>
  <div class="ww__grid ww__info-grid">
    <div v-for="entry in entries" :key="entry.label" class="ww__card">
      <div class="ww__label">{{ entry.label }}</div>
      <div class="ww__value" :class="{ 'ww__value--mono': entry.mono }">
        {{ entry.value ?? '-' }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  entries: Array<{ label: string; value: unknown; mono?: boolean }>;
}>();
</script>

<style scoped>
.ww__info-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: stretch;
}

.ww__info-grid > .ww__card {
  flex: 0 0 calc((100% - 4rem) / 5);
  min-width: 0;
  min-height: 110px;
  display: flex;
  flex-direction: column;
}

.ww__info-grid > .ww__card .ww__label {
  flex: 0 0 auto;
}

.ww__info-grid > .ww__card .ww__value {
  flex: 1 1 auto;
  overflow-wrap: anywhere;
  word-break: break-word;
}

@media (max-width: 1500px) {
  .ww__info-grid > .ww__card {
    flex-basis: calc((100% - 3rem) / 4);
  }
}

@media (max-width: 1100px) {
  .ww__info-grid > .ww__card {
    flex-basis: calc((100% - 2rem) / 3);
  }
}

@media (max-width: 780px) {
  .ww__info-grid > .ww__card {
    flex-basis: calc((100% - 1rem) / 2);
  }
}

@media (max-width: 520px) {
  .ww__info-grid > .ww__card {
    flex-basis: 100%;
  }
}
</style>
