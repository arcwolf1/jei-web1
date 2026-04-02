<template>
  <div class="ww__table-wrap">
    <table class="ww__table" :class="{ 'ww__table--wide': wide }">
      <thead>
        <tr>
          <th v-for="col in columns" :key="col.key">
            <slot :name="`header-${col.key}`" :column="col">{{ col.label }}</slot>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in rows" :key="i">
          <td v-for="col in columns" :key="col.key">
            <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">
              {{ cellText(row[col.key]) }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { formatScalar } from '../utils';

defineProps<{
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, unknown>>;
  wide?: boolean;
}>();

function cellText(value: unknown): string {
  if (value === undefined || value === null) return '-';
  if (typeof value === 'string') return value;
  return formatScalar(value);
}
</script>
