<template>
  <div
    ref="rootEl"
    class="wiki-image-loader"
    :class="[variantClass, { 'is-loading': isLoading, 'has-error': hasError }]"
  >
    <img
      v-if="isVisible && !hasError && effectiveUrl"
      :src="effectiveUrl"
      :alt="alt"
      :style="imageStyle"
      class="wiki-image"
      @load="onLoad"
      @error="onError"
    />
    <div v-else-if="isVisible" class="image-error">
      <q-icon name="broken_image" size="48px" color="grey-5" />
      <div class="error-text">图片加载失败</div>
      <div class="error-url">{{ originalUrl }}</div>
      <q-btn
        v-if="!useProxy && proxyUrl"
        dense
        flat
        color="primary"
        label="使用代理重新加载"
        size="sm"
        @click="retryWithProxy"
      />
      <a v-else :href="originalUrl" target="_blank" class="open-link"> 在新标签页打开 </a>
    </div>
    <div v-if="isVisible && isLoading" class="image-loading">
      <q-spinner-dots color="primary" size="40px" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRuntimeImageUrl } from 'src/jei/pack/runtimeImage';

const props = defineProps<{
  url: string;
  alt?: string;
  maxWidth?: number;
  useProxy?: boolean;
  proxyUrl?: string;
  variant?: 'inline' | 'block';
}>();

const rootEl = ref<HTMLElement | null>(null);
const isVisible = ref(false);
let observer: IntersectionObserver | null = null;

onMounted(() => {
  if (rootEl.value) {
    observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry && entry.isIntersecting) {
        isVisible.value = true;
        observer?.disconnect();
        observer = null;
      }
    });
    observer.observe(rootEl.value);
  }
});

onBeforeUnmount(() => {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
});

const isLoading = ref(true);
const hasError = ref(false);
const triedProxy = ref(false);
const triedDirect = ref(false);
const currentUseProxy = ref(!!props.useProxy);

const originalUrl = computed(() => props.url ?? '');

const proxyUrl = computed(() => {
  const proxy = props.proxyUrl?.trim();
  if (!proxy) return '';
  return proxy.endsWith('/') ? proxy : `${proxy}/`;
});

const effectiveUrlRaw = computed(() => {
  if (!currentUseProxy.value || !proxyUrl.value || !originalUrl.value) {
    return originalUrl.value;
  }
  // 对 URL 进行编码，确保特殊字符不会破坏代理 URL
  const encodedUrl = encodeURIComponent(originalUrl.value);
  return `${proxyUrl.value}${encodedUrl}`;
});
const effectiveUrl = useRuntimeImageUrl(effectiveUrlRaw);

const imageStyle = computed(() => {
  const style: Record<string, string> = {};
  if (props.maxWidth) {
    style.maxWidth = `${props.maxWidth}px`;
  }
  return style;
});

const variantClass = computed(() => {
  return props.variant === 'inline' ? 'variant-inline' : 'variant-block';
});

function onLoad() {
  isLoading.value = false;
  hasError.value = false;
}

function onError() {
  isLoading.value = false;

  // 如果代理失败，尝试直连一次
  if (currentUseProxy.value && !triedDirect.value) {
    triedDirect.value = true;
    currentUseProxy.value = false;
    isLoading.value = true;
    return;
  }

  hasError.value = true;
}

function retryWithProxy() {
  hasError.value = false;
  isLoading.value = true;
  triedProxy.value = true;
  currentUseProxy.value = true;
}

// 当 URL 变化时重置状态
watch(
  () => props.url,
  () => {
    isLoading.value = true;
    hasError.value = false;
    triedProxy.value = false;
    triedDirect.value = false;
    currentUseProxy.value = !!props.useProxy;
  },
);

watch(
  () => props.useProxy,
  (next) => {
    currentUseProxy.value = !!next;
  },
);
</script>

<style scoped lang="scss">
.wiki-image-loader {
  position: relative;
  display: inline-block;
  text-align: center;
  width: 100%;

  &.is-loading {
    min-height: 60px;
  }

  &.has-error {
    padding: 2rem;
    // background: #fafafa;
    border: 1px dashed #e0e0e0;
    border-radius: 8px;
  }
}

.variant-block {
  margin: 1.5em 0;
}

.variant-inline {
  margin: 0;
  width: auto;
}

.wiki-image {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.image-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  // background: rgba(255, 255, 255, 0.9);
  padding: 1rem;
  border-radius: 8px;
}

.image-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  color: #999;

  .error-text {
    font-size: 0.9rem;
    color: #666;
  }

  .error-url {
    font-size: 0.75rem;
    color: #999;
    word-break: break-all;
    max-width: 100%;
    font-family: monospace;
  }

  .open-link {
    color: #1976d2;
    text-decoration: none;
    font-size: 0.85rem;

    &:hover {
      text-decoration: underline;
    }
  }
}
</style>
