<template>
  <q-dialog :model-value="open" @update:model-value="$emit('update:open', $event)">
    <q-card style="min-width: 300px">
      <q-card-section>
        <div class="text-h6">{{ t('settings') }}</div>
      </q-card-section>
      <q-card-section class="q-pt-none">
        <q-input
          type="number"
          :label="t('historyLimit')"
          dense
          outlined
          :model-value="historyLimit"
          @update:model-value="$emit('update:history-limit', Number($event) || 0)"
        />
        <q-toggle
          :label="t('debugScroll')"
          :model-value="debugLayout"
          @update:model-value="$emit('update:debug-layout', !!$event)"
        />
        <q-toggle
          :label="t('debugNavPanel')"
          :model-value="debugNavPanel"
          @update:model-value="$emit('update:debug-nav-panel', !!$event)"
        />
        <q-select
          dense
          outlined
          :label="t('recipeViewMode')"
          :options="[
            { label: t('recipeViewDialog'), value: 'dialog' },
            { label: t('recipeViewPanel'), value: 'panel' },
          ]"
          emit-value
          map-options
          :model-value="recipeViewMode"
          @update:model-value="$emit('update:recipe-view-mode', $event as 'dialog' | 'panel')"
        />
        <q-toggle
          :label="t('recipeSlotShowName')"
          :model-value="recipeSlotShowName"
          @update:model-value="$emit('update:recipe-slot-show-name', !!$event)"
        />
        <q-toggle
          :label="t('favoritesOpenStack')"
          :model-value="favoritesOpensNewStack"
          @update:model-value="$emit('update:favorites-open-stack', !!$event)"
        />
        <q-toggle
          :label="t('detectPcDisableMobile')"
          :model-value="detectPcDisableMobile"
          @update:model-value="$emit('update:detect-pc-disable-mobile', !!$event)"
        />
        <q-btn
          flat
          :label="t('keybindings')"
          color="primary"
          class="q-my-sm full-width"
          @click="$emit('open-keybindings')"
        />
        <q-btn
          flat
          :label="t('refreshPackCache')"
          color="warning"
          class="q-mb-sm full-width"
          @click="$emit('refresh-pack-cache')"
        />
        <q-separator class="q-my-sm" />

        <div class="text-subtitle2 q-mb-sm">{{ t('customDataSources') }}</div>
        <q-list dense bordered separator class="q-mb-md">
          <q-item v-for="source in customPackSources" :key="source.packId">
            <q-item-section>
              <q-item-label>{{ source.label || source.packId }}</q-item-label>
              <q-item-label caption>{{ source.url }}</q-item-label>
              <q-item-label caption class="text-grey-7">ID: {{ source.packId }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn
                flat
                round
                dense
                icon="delete"
                color="negative"
                @click="$emit('remove-custom-source', source.packId)"
              />
            </q-item-section>
          </q-item>
          <q-item v-if="customPackSources.length === 0">
            <q-item-section class="text-grey italic">{{ t('noCustomSources') }}</q-item-section>
          </q-item>
        </q-list>

        <div class="q-gutter-y-sm">
          <q-input
            v-model="newSourceId"
            dense
            outlined
            :label="t('packId')"
            placeholder="e.g. my-pack"
          />
          <q-input
            v-model="newSourceUrl"
            dense
            outlined
            :label="t('packUrl')"
            placeholder="https://..."
          />
          <q-input
            v-model="newSourceLabel"
            dense
            outlined
            :label="t('packLabel')"
            :placeholder="t('optional')"
          />
          <q-btn
            outline
            color="primary"
            :label="t('addSource')"
            class="full-width"
            :disable="!newSourceId || !newSourceUrl"
            @click="addSource"
          />
        </div>

        <q-separator class="q-my-sm" />
        <div class="text-subtitle2 q-mb-sm">{{ t('packMirrorRoutingTitle') }}</div>
        <q-select
          dense
          outlined
          emit-value
          map-options
          :label="t('packMirrorMode')"
          :options="[
            { label: t('packMirrorModeAuto'), value: 'auto' },
            { label: t('packMirrorModeManual'), value: 'manual' },
          ]"
          :model-value="packMirrorSelectionMode"
          @update:model-value="
            $emit('update:pack-mirror-selection-mode', $event as 'auto' | 'manual')
          "
        />
        <q-select
          dense
          outlined
          emit-value
          map-options
          :disable="packMirrors.length === 0 || packMirrorSelectionMode !== 'manual'"
          :label="t('packMirrorManualSelect')"
          :options="
            packMirrors.map((m) => ({
              label: `${m.url} (${formatLatency(m.latencyMs)})`,
              value: m.url,
            }))
          "
          :model-value="packManualMirror"
          @update:model-value="$emit('update:pack-manual-mirror', String($event || ''))"
        />
        <q-btn
          outline
          color="primary"
          :loading="mirrorLatencyLoading"
          :label="t('packMirrorTestLatency')"
          class="full-width q-mb-sm"
          @click="$emit('refresh-mirror-latency')"
        />
        <q-list dense bordered separator>
          <q-item v-for="mirror in packMirrors" :key="mirror.url">
            <q-item-section>
              <q-item-label>{{ mirror.url }}</q-item-label>
              <q-item-label caption>
                {{ t('packMirrorLatencyLabel') }}: {{ formatLatency(mirror.latencyMs) }}
              </q-item-label>
            </q-item-section>
          </q-item>
          <q-item v-if="packMirrors.length === 0">
            <q-item-section class="text-grey italic">{{ t('packMirrorNoMirrors') }}</q-item-section>
          </q-item>
        </q-list>

        <q-separator class="q-my-sm" />
        <div class="text-subtitle2 q-mb-sm">{{ t('packImageProxyTitle') }}</div>
        <q-toggle
          :label="t('packImageProxyUsePackProvided')"
          :model-value="packImageProxyUsePackProvided"
          @update:model-value="$emit('update:pack-image-proxy-use-pack-provided', !!$event)"
        />
        <q-input
          dense
          outlined
          readonly
          :label="t('packImageProxyPackUrl')"
          :model-value="packProxyTemplate || t('packImageProxyUnavailable')"
        />
        <q-toggle
          :label="t('packImageProxyUseDev')"
          :model-value="packImageProxyUseDev"
          @update:model-value="$emit('update:pack-image-proxy-use-dev', !!$event)"
        />
        <q-input
          dense
          outlined
          readonly
          :label="t('packImageProxyPackDevUrl')"
          :model-value="packDevProxyTemplate || t('packImageProxyUnavailable')"
        />
        <q-input
          dense
          outlined
          debounce="250"
          :label="t('packImageProxyDevUrl')"
          :model-value="packImageProxyDevUrl"
          @update:model-value="$emit('update:pack-image-proxy-dev-url', String($event ?? ''))"
        />
        <q-toggle
          :label="t('packImageProxyUseManual')"
          :model-value="packImageProxyUseManual"
          @update:model-value="$emit('update:pack-image-proxy-use-manual', !!$event)"
        />
        <q-input
          dense
          outlined
          debounce="250"
          :label="t('packImageProxyManualUrl')"
          :model-value="packImageProxyManualUrl"
          @update:model-value="$emit('update:pack-image-proxy-manual-url', String($event ?? ''))"
        />
        <q-input
          dense
          outlined
          debounce="250"
          :label="t('packImageProxyAccessToken')"
          type="password"
          :model-value="packImageProxyAccessToken"
          @update:model-value="$emit('update:pack-image-proxy-access-token', String($event ?? ''))"
        />
        <q-input
          dense
          outlined
          debounce="250"
          :label="t('packImageProxyAnonymousToken')"
          type="password"
          :model-value="packImageProxyAnonymousToken"
          @update:model-value="
            $emit('update:pack-image-proxy-anonymous-token', String($event ?? ''))
          "
        />
        <q-input
          dense
          outlined
          debounce="250"
          :label="t('packImageProxyFrameworkToken')"
          type="password"
          :model-value="packImageProxyFrameworkToken"
          @update:model-value="
            $emit('update:pack-image-proxy-framework-token', String($event ?? ''))
          "
        />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat :label="t('close')" color="primary" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineProps<{
  open: boolean;
  historyLimit: number;
  debugLayout: boolean;
  debugNavPanel: boolean;
  recipeViewMode: 'dialog' | 'panel';
  recipeSlotShowName: boolean;
  favoritesOpensNewStack: boolean;
  detectPcDisableMobile: boolean;
  packProxyTemplate: string;
  packDevProxyTemplate: string;
  packImageProxyUsePackProvided: boolean;
  packImageProxyUseManual: boolean;
  packImageProxyUseDev: boolean;
  packImageProxyManualUrl: string;
  packImageProxyDevUrl: string;
  packImageProxyAccessToken: string;
  packImageProxyAnonymousToken: string;
  packImageProxyFrameworkToken: string;
  customPackSources: Array<{ packId: string; url: string; label?: string }>;
  packMirrors: Array<{ url: string; latencyMs: number | null }>;
  packMirrorSelectionMode: 'auto' | 'manual';
  packManualMirror: string;
  mirrorLatencyLoading: boolean;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  'update:history-limit': [value: number];
  'update:debug-layout': [value: boolean];
  'update:debug-nav-panel': [value: boolean];
  'update:recipe-view-mode': [value: 'dialog' | 'panel'];
  'update:recipe-slot-show-name': [value: boolean];
  'update:favorites-open-stack': [value: boolean];
  'update:detect-pc-disable-mobile': [value: boolean];
  'open-keybindings': [];
  'update:pack-image-proxy-use-pack-provided': [value: boolean];
  'update:pack-image-proxy-use-manual': [value: boolean];
  'update:pack-image-proxy-use-dev': [value: boolean];
  'update:pack-image-proxy-manual-url': [value: string];
  'update:pack-image-proxy-dev-url': [value: string];
  'update:pack-image-proxy-access-token': [value: string];
  'update:pack-image-proxy-anonymous-token': [value: string];
  'update:pack-image-proxy-framework-token': [value: string];
  'add-custom-source': [source: { packId: string; url: string; label?: string }];
  'remove-custom-source': [packId: string];
  'refresh-pack-cache': [];
  'update:pack-mirror-selection-mode': [value: 'auto' | 'manual'];
  'update:pack-manual-mirror': [value: string];
  'refresh-mirror-latency': [];
}>();

import { ref } from 'vue';

const newSourceId = ref('');
const newSourceUrl = ref('');
const newSourceLabel = ref('');

function addSource() {
  if (!newSourceId.value || !newSourceUrl.value) return;
  emit('add-custom-source', {
    packId: newSourceId.value,
    url: newSourceUrl.value,
    label: newSourceLabel.value || undefined,
  } as { packId: string; url: string; label?: string });
  newSourceId.value = '';
  newSourceUrl.value = '';
  newSourceLabel.value = '';
}

function formatLatency(latencyMs: number | null): string {
  if (latencyMs == null) return t('packMirrorLatencyUnknown');
  return `${Math.round(latencyMs)}ms`;
}
</script>
