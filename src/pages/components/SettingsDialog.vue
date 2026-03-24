<template>
  <q-dialog :model-value="open" @update:model-value="$emit('update:open', $event)">
    <q-card class="settings-shell">
      <q-card-section class="row items-center q-px-md q-py-sm">
        <div class="text-h6">{{ t('settings') }}</div>
        <q-space />
      </q-card-section>

      <q-separator />

      <q-card-section class="q-px-md q-py-sm">
        <q-input
          v-model="settingSearch"
          dense
          outlined
          clearable
          placeholder="搜索设置项（如：插件、镜像、代理）"
          prefix="搜索"
        />
      </q-card-section>

      <q-separator />

      <div class="settings-layout">
        <div class="settings-nav">
          <q-list dense padding>
            <q-item
              v-for="section in visibleSections"
              :key="section.key"
              clickable
              :active="activeSection === section.key"
              active-class="bg-primary text-white"
              @click="activeSection = section.key"
            >
              <q-item-section>
                <q-item-label>{{ section.label }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item v-if="visibleSections.length === 0">
              <q-item-section class="text-grey">没有匹配分组</q-item-section>
            </q-item>
          </q-list>
        </div>

        <q-separator vertical />

        <div class="settings-content">
          <q-scroll-area class="settings-scroll">
            <div class="q-pa-md q-gutter-y-md">
              <q-card v-if="showSection('plugins')" flat bordered>
                <q-card-section class="q-pb-sm">
                  <div class="row items-center q-gutter-sm">
                    <div class="text-subtitle2">插件管理</div>
                    <q-chip dense outline color="primary">
                      {{ pluginEnabledCount }}/{{ pluginEntries.length }} 已启用
                    </q-chip>
                    <q-space />
                    <q-btn
                      dense
                      flat
                      color="primary"
                      label="全部启用"
                      :disable="allPluginsEnabled || pluginEntries.length === 0"
                      @click="setAllPluginsEnabled(true)"
                    />
                    <q-btn
                      dense
                      flat
                      color="negative"
                      label="全部禁用"
                      :disable="allPluginsDisabled || pluginEntries.length === 0"
                      @click="setAllPluginsEnabled(false)"
                    />
                  </div>
                </q-card-section>
                <q-separator />
                <q-list dense separator>
                  <q-item v-for="plugin in pluginEntries" :key="plugin.id">
                    <q-item-section>
                      <q-item-label>{{ plugin.name }}</q-item-label>
                      <q-item-label caption>{{ plugin.id }}</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <q-toggle
                        :model-value="plugin.enabled"
                        @update:model-value="$emit('update:plugin-enabled', plugin.id, !!$event)"
                      />
                    </q-item-section>
                  </q-item>
                  <q-item v-if="pluginEntries.length === 0">
                    <q-item-section class="text-grey italic">当前没有可管理插件</q-item-section>
                  </q-item>
                </q-list>
                <q-separator />
                <q-card-section class="q-pt-sm">
                  <div class="text-caption text-grey-7 q-mb-sm">插件自定义设置</div>
                  <q-list dense separator bordered>
                    <q-item
                      v-for="section in pluginSettingSections"
                      :key="section.pluginId"
                      class="q-py-sm"
                    >
                      <q-item-section>
                        <q-item-label class="text-weight-medium">{{
                          section.pluginName
                        }}</q-item-label>
                        <div class="q-gutter-y-sm q-mt-sm">
                          <div
                            v-for="setting in section.settings"
                            :key="`${section.pluginId}:${setting.key}`"
                          >
                            <q-toggle
                              v-if="setting.type === 'boolean'"
                              :label="setting.label"
                              :model-value="Boolean(setting.value)"
                              @update:model-value="
                                emitPluginSetting(section.pluginId, setting.key, !!$event)
                              "
                            />
                            <q-input
                              v-else-if="setting.type === 'text'"
                              dense
                              outlined
                              :label="setting.label"
                              :model-value="String(setting.value ?? '')"
                              :placeholder="setting.placeholder || setting.description || ''"
                              @update:model-value="
                                emitPluginSetting(
                                  section.pluginId,
                                  setting.key,
                                  String($event ?? ''),
                                )
                              "
                            />
                            <q-input
                              v-else-if="setting.type === 'number'"
                              dense
                              outlined
                              type="number"
                              :label="setting.label"
                              :min="setting.min"
                              :max="setting.max"
                              :step="setting.step"
                              :model-value="Number(setting.value)"
                              @update:model-value="
                                emitPluginSetting(
                                  section.pluginId,
                                  setting.key,
                                  Number($event ?? 0),
                                )
                              "
                            />
                            <q-select
                              v-else
                              dense
                              outlined
                              emit-value
                              map-options
                              :label="setting.label"
                              :options="setting.options"
                              :model-value="String(setting.value ?? '')"
                              @update:model-value="
                                emitPluginSetting(
                                  section.pluginId,
                                  setting.key,
                                  String($event ?? ''),
                                )
                              "
                            />
                            <div
                              v-if="setting.description"
                              class="text-caption text-grey-7 q-mt-xs"
                            >
                              {{ setting.description }}
                            </div>
                          </div>
                        </div>
                      </q-item-section>
                    </q-item>
                    <q-item v-if="pluginSettingSections.length === 0">
                      <q-item-section class="text-grey italic">暂无插件自定义设置</q-item-section>
                    </q-item>
                  </q-list>
                </q-card-section>
              </q-card>

              <q-card v-if="showSection('general')" flat bordered>
                <q-card-section>
                  <div class="text-subtitle2 q-mb-sm">基础设置</div>
                  <div class="q-gutter-y-sm">
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
                      @update:model-value="
                        $emit('update:recipe-view-mode', $event as 'dialog' | 'panel')
                      "
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
                      :label="t('refreshPackCache')"
                      color="warning"
                      class="full-width"
                      @click="$emit('refresh-pack-cache')"
                    />
                    <q-toggle
                      :label="t('showLoadingOverlay')"
                      :model-value="showLoadingOverlay"
                      @update:model-value="$emit('update:show-loading-overlay', !!$event)"
                    />
                    <q-input
                      dense
                      outlined
                      type="number"
                      :min="0.1"
                      :step="0.1"
                      label="量化图G6缩放因子"
                      :model-value="quantLineWidthScale"
                      @update:model-value="
                        $emit('update:quant-line-width-scale', Number($event) || 1)
                      "
                    />
                    <q-input
                      dense
                      outlined
                      type="number"
                      :min="0.1"
                      :step="0.1"
                      label="生产线G6缩放因子"
                      :model-value="productionLineG6Scale"
                      @update:model-value="
                        $emit('update:production-line-g6-scale', Number($event) || 1)
                      "
                    />
                    <q-input
                      dense
                      outlined
                      type="number"
                      :min="0"
                      :max="4"
                      :step="1"
                      label="机器数量小数位（0=取整）"
                      :model-value="machineCountDecimals"
                      @update:model-value="
                        $emit('update:machine-count-decimals', Number($event) || 0)
                      "
                    />
                    <q-select
                      dense
                      outlined
                      emit-value
                      map-options
                      label="量化视图渲染模式"
                      :options="[
                        { label: '节点图', value: 'nodes' },
                        { label: '桑基图', value: 'sankey' },
                      ]"
                      :model-value="quantFlowRenderer"
                      @update:model-value="
                        $emit(
                          'update:quant-flow-renderer',
                          ($event as 'nodes' | 'sankey') ?? 'nodes',
                        )
                      "
                    />
                    <q-select
                      dense
                      outlined
                      emit-value
                      map-options
                      label="生产线渲染器"
                      :options="[
                        { label: 'VueFlow', value: 'vue_flow' },
                        { label: 'G6', value: 'g6' },
                      ]"
                      :model-value="productionLineRenderer"
                      @update:model-value="
                        $emit(
                          'update:production-line-renderer',
                          ($event as 'vue_flow' | 'g6') ?? 'vue_flow',
                        )
                      "
                    />
                    <q-toggle
                      label="中间产物着色（生产线）"
                      :model-value="lineIntermediateColoring"
                      @update:model-value="$emit('update:line-intermediate-coloring', !!$event)"
                    />
                  </div>
                </q-card-section>
              </q-card>

              <q-card v-if="showSection('keybindings')" flat bordered>
                <q-card-section>
                  <div class="text-subtitle2 q-mb-sm">{{ t('keybindings') }}</div>
                  <q-list bordered separator class="q-mb-md">
                    <q-expansion-item
                      v-for="group in keybindingGroups"
                      :key="group.id"
                      :label="group.label"
                      group="keybindings-inline"
                      default-opened
                    >
                      <q-list separator>
                        <q-item v-for="action in group.actions" :key="action.id">
                          <q-item-section>
                            <q-item-label>{{ action.label }}</q-item-label>
                            <q-item-label v-if="action.description" caption>{{
                              action.description
                            }}</q-item-label>
                          </q-item-section>
                          <q-item-section side>
                            <q-btn
                              :label="keyBindingText(action.binding)"
                              :color="recordingAction === action.id ? 'negative' : 'primary'"
                              :outline="recordingAction !== action.id"
                              @click="startKeybindingRecord(action.id)"
                            >
                              <q-tooltip v-if="recordingAction === action.id">
                                {{ t('pressKeyToBind') }}
                              </q-tooltip>
                            </q-btn>
                          </q-item-section>
                        </q-item>
                      </q-list>
                    </q-expansion-item>
                    <q-item v-if="keybindingGroups.length === 0">
                      <q-item-section class="text-grey italic">暂无快捷键配置</q-item-section>
                    </q-item>
                  </q-list>
                  <q-btn
                    color="warning"
                    outline
                    class="full-width"
                    :label="t('resetToDefaults')"
                    @click="$emit('reset:keybindings')"
                  />
                </q-card-section>
              </q-card>

              <q-card v-if="showSection('data')" flat bordered>
                <q-card-section>
                  <div class="text-subtitle2 q-mb-sm">{{ t('customDataSources') }}</div>
                  <q-list dense bordered separator class="q-mb-md">
                    <q-item v-for="source in customPackSources" :key="source.packId">
                      <q-item-section>
                        <q-item-label>{{ source.label || source.packId }}</q-item-label>
                        <q-item-label caption>{{ source.url }}</q-item-label>
                        <q-item-label caption class="text-grey-7"
                          >ID: {{ source.packId }}</q-item-label
                        >
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
                      <q-item-section class="text-grey italic">{{
                        t('noCustomSources')
                      }}</q-item-section>
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
                </q-card-section>
              </q-card>

              <q-card v-if="showSection('mirror')" flat bordered>
                <q-card-section>
                  <div class="text-subtitle2 q-mb-sm">{{ t('packMirrorRoutingTitle') }}</div>
                  <div class="q-gutter-y-sm">
                    <q-toggle
                      :label="t('packMirrorUseDev')"
                      :model-value="useDevPackMirrors"
                      @update:model-value="$emit('update:use-dev-pack-mirrors', !!$event)"
                    />
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
                          label: `${m.sourceLabel ? `[${m.sourceLabel}] ` : ''}${m.url} (${formatLatency(m.latencyMs)})`,
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
                      class="full-width"
                      @click="$emit('refresh-mirror-latency')"
                    />
                    <q-list dense bordered separator>
                      <q-item
                        v-for="mirror in packMirrors"
                        :key="`${mirror.sourcePackId || ''}::${mirror.url}`"
                      >
                        <q-item-section>
                          <q-item-label>{{ mirror.url }}</q-item-label>
                          <q-item-label v-if="mirror.sourceLabel" caption>
                            来源: {{ mirror.sourceLabel }} ({{ mirror.sourcePackId || '-' }})
                          </q-item-label>
                          <q-item-label caption>
                            {{ t('packMirrorLatencyLabel') }}: {{ formatLatency(mirror.latencyMs) }}
                          </q-item-label>
                        </q-item-section>
                        <q-item-section side>
                          <q-chip v-if="mirror.isDev" dense outline color="warning">
                            {{ t('packMirrorDevBadge') }}
                          </q-chip>
                          <q-chip
                            v-if="activePackMirrorUrl && mirror.url === activePackMirrorUrl"
                            dense
                            color="primary"
                            text-color="white"
                          >
                            {{ t('packMirrorCurrentUsed') }}
                          </q-chip>
                        </q-item-section>
                      </q-item>
                      <q-item v-if="packMirrors.length === 0">
                        <q-item-section class="text-grey italic">{{
                          t('packMirrorNoMirrors')
                        }}</q-item-section>
                      </q-item>
                    </q-list>
                  </div>
                </q-card-section>
              </q-card>

              <q-card v-if="showSection('proxy')" flat bordered>
                <q-card-section>
                  <div class="text-subtitle2 q-mb-sm">{{ t('packImageProxyTitle') }}</div>
                  <div class="q-gutter-y-sm">
                    <q-toggle
                      :label="t('packImageProxyUsePackProvided')"
                      :model-value="packImageProxyUsePackProvided"
                      @update:model-value="
                        $emit('update:pack-image-proxy-use-pack-provided', !!$event)
                      "
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
                      @update:model-value="
                        $emit('update:pack-image-proxy-dev-url', String($event ?? ''))
                      "
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
                      @update:model-value="
                        $emit('update:pack-image-proxy-manual-url', String($event ?? ''))
                      "
                    />
                    <q-input
                      dense
                      outlined
                      debounce="250"
                      :label="t('packImageProxyAccessToken')"
                      type="password"
                      :model-value="packImageProxyAccessToken"
                      @update:model-value="
                        $emit('update:pack-image-proxy-access-token', String($event ?? ''))
                      "
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
                  </div>
                </q-card-section>
              </q-card>
            </div>
          </q-scroll-area>
        </div>
      </div>

      <q-separator />

      <q-card-actions align="right">
        <q-btn flat :label="t('close')" color="primary" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { KeyAction, KeyBinding } from 'src/stores/keybindings';

const { t } = useI18n();

type SectionKey = 'plugins' | 'general' | 'keybindings' | 'data' | 'mirror' | 'proxy';

const sectionDefs: Array<{ key: SectionKey; label: string; keywords: string[] }> = [
  { key: 'plugins', label: '插件管理', keywords: ['插件', 'plugin', '扩展', 'tab'] },
  { key: 'general', label: '基础设置', keywords: ['基础', '显示', '调试', '快捷键', '历史'] },
  { key: 'keybindings', label: '快捷键', keywords: ['快捷键', '键位', 'keybinding', 'hotkey'] },
  { key: 'data', label: '数据源', keywords: ['数据源', 'source', 'pack', '地址'] },
  { key: 'mirror', label: '镜像路由', keywords: ['镜像', 'mirror', '延迟', '测速', 'dev'] },
  { key: 'proxy', label: '图片代理', keywords: ['代理', 'proxy', 'token', '图片'] },
];

const props = defineProps<{
  open: boolean;
  historyLimit: number;
  debugLayout: boolean;
  debugNavPanel: boolean;
  showLoadingOverlay: boolean;
  quantLineWidthScale: number;
  productionLineG6Scale: number;
  machineCountDecimals: number;
  lineIntermediateColoring: boolean;
  productionLineRenderer: 'vue_flow' | 'g6';
  quantFlowRenderer: 'nodes' | 'sankey';
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
  pluginEntries: Array<{ id: string; name: string; enabled: boolean }>;
  pluginSettingSections: Array<{
    pluginId: string;
    pluginName: string;
    settings: Array<{
      key: string;
      label: string;
      description?: string;
      type: 'boolean' | 'text' | 'number' | 'select';
      value: string | number | boolean;
      placeholder?: string;
      min?: number;
      max?: number;
      step?: number;
      options?: Array<{ label: string; value: string }>;
    }>;
  }>;
  keybindingGroups: Array<{
    id: string;
    label: string;
    actions: Array<{
      id: KeyAction;
      label: string;
      description: string;
      binding: KeyBinding;
    }>;
  }>;
  customPackSources: Array<{ packId: string; url: string; label?: string }>;
  useDevPackMirrors: boolean;
  packMirrors: Array<{
    url: string;
    latencyMs: number | null;
    sourcePackId?: string;
    sourceLabel?: string;
    isDev?: boolean;
  }>;
  activePackMirrorUrl: string;
  packMirrorSelectionMode: 'auto' | 'manual';
  packManualMirror: string;
  mirrorLatencyLoading: boolean;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  'update:history-limit': [value: number];
  'update:debug-layout': [value: boolean];
  'update:debug-nav-panel': [value: boolean];
  'update:show-loading-overlay': [value: boolean];
  'update:quant-line-width-scale': [value: number];
  'update:production-line-g6-scale': [value: number];
  'update:machine-count-decimals': [value: number];
  'update:line-intermediate-coloring': [value: boolean];
  'update:production-line-renderer': [value: 'vue_flow' | 'g6'];
  'update:quant-flow-renderer': [value: 'nodes' | 'sankey'];
  'update:recipe-view-mode': [value: 'dialog' | 'panel'];
  'update:recipe-slot-show-name': [value: boolean];
  'update:favorites-open-stack': [value: boolean];
  'update:detect-pc-disable-mobile': [value: boolean];
  'update:keybinding': [action: KeyAction, binding: KeyBinding];
  'reset:keybindings': [];
  'update:pack-image-proxy-use-pack-provided': [value: boolean];
  'update:pack-image-proxy-use-manual': [value: boolean];
  'update:pack-image-proxy-use-dev': [value: boolean];
  'update:pack-image-proxy-manual-url': [value: string];
  'update:pack-image-proxy-dev-url': [value: string];
  'update:pack-image-proxy-access-token': [value: string];
  'update:pack-image-proxy-anonymous-token': [value: string];
  'update:pack-image-proxy-framework-token': [value: string];
  'update:plugin-enabled': [pluginId: string, enabled: boolean];
  'update:plugin-setting': [pluginId: string, key: string, value: string | number | boolean];
  'add-custom-source': [source: { packId: string; url: string; label?: string }];
  'remove-custom-source': [packId: string];
  'refresh-pack-cache': [];
  'update:use-dev-pack-mirrors': [value: boolean];
  'update:pack-mirror-selection-mode': [value: 'auto' | 'manual'];
  'update:pack-manual-mirror': [value: string];
  'refresh-mirror-latency': [];
}>();

const activeSection = ref<SectionKey>('plugins');
const settingSearch = ref('');
const newSourceId = ref('');
const newSourceUrl = ref('');
const newSourceLabel = ref('');
const recordingAction = ref<KeyAction | null>(null);

const pluginEnabledCount = computed(() => props.pluginEntries.filter((it) => it.enabled).length);
const allPluginsEnabled = computed(
  () => props.pluginEntries.length > 0 && pluginEnabledCount.value === props.pluginEntries.length,
);
const allPluginsDisabled = computed(() => pluginEnabledCount.value === 0);

const visibleSections = computed(() => {
  const query = settingSearch.value.trim().toLowerCase();
  if (!query) return sectionDefs;
  return sectionDefs.filter((section) => {
    if (section.label.toLowerCase().includes(query)) return true;
    return section.keywords.some((k) => k.toLowerCase().includes(query));
  });
});

watch(
  visibleSections,
  (list) => {
    if (!list.length) return;
    if (!list.some((it) => it.key === activeSection.value)) {
      activeSection.value = list[0]!.key;
    }
  },
  { immediate: true },
);

function showSection(sectionKey: SectionKey): boolean {
  const query = settingSearch.value.trim();
  if (!query) return activeSection.value === sectionKey;
  return visibleSections.value.some((section) => section.key === sectionKey);
}

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

function setAllPluginsEnabled(enabled: boolean) {
  props.pluginEntries.forEach((plugin) => {
    emit('update:plugin-enabled', plugin.id, enabled);
  });
}

function emitPluginSetting(pluginId: string, key: string, value: string | number | boolean) {
  emit('update:plugin-setting', pluginId, key, value);
}

function keyBindingText(binding: KeyBinding) {
  const parts: string[] = [];
  if (binding.ctrl) parts.push('Ctrl');
  if (binding.alt) parts.push('Alt');
  if (binding.shift) parts.push('Shift');
  parts.push(binding.key.toUpperCase());
  return parts.join('+');
}

function startKeybindingRecord(actionId: KeyAction) {
  recordingAction.value = actionId;
}

function stopKeybindingRecord() {
  recordingAction.value = null;
}

function handleKeybindingRecordKeyDown(event: KeyboardEvent) {
  if (recordingAction.value === null) return;
  event.preventDefault();
  event.stopPropagation();
  emit('update:keybinding', recordingAction.value, {
    key: event.key,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
  });
  stopKeybindingRecord();
}

function handleKeybindingRecordKeyUp() {
  if (recordingAction.value !== null) {
    stopKeybindingRecord();
  }
}

window.addEventListener('keydown', handleKeybindingRecordKeyDown, true);
window.addEventListener('keyup', handleKeybindingRecordKeyUp, true);

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeybindingRecordKeyDown, true);
  window.removeEventListener('keyup', handleKeybindingRecordKeyUp, true);
});

function formatLatency(latencyMs: number | null): string {
  if (latencyMs == null) return t('packMirrorLatencyUnknown');
  return `${Math.round(latencyMs)}ms`;
}
</script>

<style scoped>
.settings-shell {
  width: min(1120px, 96vw);
  max-width: 96vw;
  min-height: 76vh;
}

.settings-layout {
  display: grid;
  grid-template-columns: 220px 1px 1fr;
  min-height: 60vh;
}

.settings-nav {
  background: rgba(127, 127, 127, 0.05);
}

.settings-content {
  min-width: 0;
}

.settings-scroll {
  height: 60vh;
}
</style>
