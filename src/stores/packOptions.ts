import { defineStore } from 'pinia';
import { ref } from 'vue';

export type SharedPackOption = {
  label: string;
  value: string;
};

export const usePackOptionsStore = defineStore('packOptions', () => {
  const options = ref<SharedPackOption[]>([]);

  function setOptions(next: SharedPackOption[]) {
    options.value = [...next];
  }

  return {
    options,
    setOptions,
  };
});
