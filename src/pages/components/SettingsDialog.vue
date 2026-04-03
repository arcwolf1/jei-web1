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
          <div class="settings-scroll">
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
                    <q-input
                      type="number"
                      :min="2"
                      :label="t('favoritesPageSizeMin')"
                      dense
                      outlined
                      :model-value="favoritePageSizeMin"
                      @update:model-value="
                        $emit('update:favorites-page-size-min', Number($event) || 2)
                      "
                    />
                    <q-input
                      type="number"
                      :min="2"
                      :label="t('favoritesPageSizeMax')"
                      dense
                      outlined
                      :model-value="favoritePageSizeMax"
                      @update:model-value="
                        $emit('update:favorites-page-size-max', Number($event) || 2)
                      "
                    />
                    <q-btn
                      flat
                      dense
                      color="primary"
                      :label="t('favoritesPageSizeResetDefaults')"
                      @click="$emit('reset:favorites-page-size-bounds')"
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
                    <q-select
                      dense
                      outlined
                      emit-value
                      map-options
                      :label="t('itemClickDefaultTab')"
                      :options="[
                        { label: t('tabsRecipes'), value: 'recipes' },
                        { label: t('tabsUses'), value: 'uses' },
                        { label: t('tabsWiki'), value: 'wiki' },
                        { label: t('tabsIcon'), value: 'icon' },
                        { label: t('tabsPlanner'), value: 'planner' },
                      ]"
                      :model-value="itemClickDefaultTab"
                      @update:model-value="
                        $emit(
                          'update:item-click-default-tab',
                          ($event as 'recipes' | 'uses' | 'wiki' | 'icon' | 'planner') ?? 'recipes',
                        )
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
                      :label="t('persistHistoryRecords')"
                      :model-value="persistHistoryRecords"
                      @update:model-value="$emit('update:persist-history-records', !!$event)"
                    />
                    <q-toggle
                      :label="t('mobileItemClickOpensDetail')"
                      :model-value="mobileItemClickOpensDetail"
                      @update:model-value="$emit('update:mobile-item-click-opens-detail', !!$event)"
                    />
                    <div>
                      <q-btn
                        flat
                        dense
                        color="primary"
                        :label="t('openSetupWizard')"
                        @click="$emit('open:setup-wizard')"
                      />
                      <div class="text-caption text-grey-7 q-mt-xs">
                        {{ t('setupWizardOpenHint') }}
                      </div>
                    </div>
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
                    <div class="q-gutter-y-sm q-pt-xs">
                      <div class="text-caption text-grey-7">
                        导出当前聚合包里已合并和未合并候选的同名物品 lite
                        元数据，便于编写/校对聚合规则。
                      </div>
                      <q-btn
                        outline
                        color="primary"
                        icon="content_copy"
                        label="复制聚合合并分析 JSON"
                        class="full-width"
                        :disable="!aggregateExportAvailable"
                        :loading="aggregateExportLoading"
                        @click="$emit('copy:aggregate-merge-report')"
                      />
                      <q-btn
                        outline
                        color="secondary"
                        icon="download"
                        label="导出聚合合并分析 JSON"
                        class="full-width"
                        :disable="!aggregateExportAvailable"
                        :loading="aggregateExportLoading"
                        @click="$emit('download:aggregate-merge-report')"
                      />
                      <div v-if="!aggregateExportAvailable" class="text-caption text-grey-7">
                        当前数据包不是聚合包，无法导出该分析信息。
                      </div>
                    </div>
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

              <q-card v-if="showSection('hover')" flat bordered>
                <q-card-section>
                  <div class="text-subtitle2 q-mb-sm">{{ t('sectionHover') }}</div>
                  <div class="text-caption text-grey-7 q-mb-md">
                    {{
                      t('hoverTooltipTemporaryShortcutHint', {
                        key: hoverTooltipInteractBindingText,
                      })
                    }}
                  </div>
                  <div class="text-caption text-grey-7 q-mb-xs">
                    {{ t('hoverTooltipInteractionGroup') }}
                  </div>
                  <div class="q-gutter-y-sm q-mb-md">
                    <q-toggle
                      :label="t('hoverTooltipAllowMouseEnter')"
                      :model-value="hoverTooltipAllowMouseEnter"
                      @update:model-value="
                        $emit('update:hover-tooltip-allow-mouse-enter', !!$event)
                      "
                    />
                  </div>
                  <div class="text-caption text-grey-7 q-mb-xs">
                    {{ t('hoverTooltipContentGroup') }}
                  </div>
                  <div class="q-gutter-y-sm">
                    <q-toggle
                      :label="t('hoverTooltipShowTitle')"
                      :model-value="hoverTooltipDisplay.title"
                      @update:model-value="emitHoverTooltipDisplaySetting('title', !!$event)"
                    />
                    <q-toggle
                      :label="t('hoverTooltipShowIdLine')"
                      :model-value="hoverTooltipDisplay.idLine"
                      @update:model-value="emitHoverTooltipDisplaySetting('idLine', !!$event)"
                    />
                    <q-toggle
                      :label="t('hoverTooltipShowMetaLine')"
                      :model-value="hoverTooltipDisplay.metaLine"
                      @update:model-value="emitHoverTooltipDisplaySetting('metaLine', !!$event)"
                    />
                    <q-toggle
                      :label="t('hoverTooltipShowNbtLine')"
                      :model-value="hoverTooltipDisplay.nbtLine"
                      @update:model-value="emitHoverTooltipDisplaySetting('nbtLine', !!$event)"
                    />
                    <q-toggle
                      :label="t('hoverTooltipShowRarity')"
                      :model-value="hoverTooltipDisplay.rarity"
                      @update:model-value="emitHoverTooltipDisplaySetting('rarity', !!$event)"
                    />
                    <q-toggle
                      :label="t('hoverTooltipShowDetailIds')"
                      :model-value="hoverTooltipDisplay.detailIds"
                      @update:model-value="emitHoverTooltipDisplaySetting('detailIds', !!$event)"
                    />
                    <q-toggle
                      :label="t('hoverTooltipShowDetailTags')"
                      :model-value="hoverTooltipDisplay.detailTags"
                      @update:model-value="emitHoverTooltipDisplaySetting('detailTags', !!$event)"
                    />
                    <q-toggle
                      :label="t('hoverTooltipShowDetailSources')"
                      :model-value="hoverTooltipDisplay.detailSources"
                      @update:model-value="
                        emitHoverTooltipDisplaySetting('detailSources', !!$event)
                      "
                    />
                    <q-toggle
                      :label="t('hoverTooltipShowDetailInfo')"
                      :model-value="hoverTooltipDisplay.detailInfo"
                      @update:model-value="emitHoverTooltipDisplaySetting('detailInfo', !!$event)"
                    />
                    <q-toggle
                      :label="t('hoverTooltipShowDetailWiki')"
                      :model-value="hoverTooltipDisplay.detailWiki"
                      @update:model-value="emitHoverTooltipDisplaySetting('detailWiki', !!$event)"
                    />
                    <q-toggle
                      :label="t('hoverTooltipShowDetailDescriptions')"
                      :model-value="hoverTooltipDisplay.detailDescriptions"
                      @update:model-value="
                        emitHoverTooltipDisplaySetting('detailDescriptions', !!$event)
                      "
                    />
                    <q-toggle
                      :label="t('hoverTooltipShowNamespaceLines')"
                      :model-value="hoverTooltipDisplay.namespaceLines"
                      @update:model-value="
                        emitHoverTooltipDisplaySetting('namespaceLines', !!$event)
                      "
                    />
                    <q-toggle
                      :label="t('hoverTooltipShowTagsLine')"
                      :model-value="hoverTooltipDisplay.tagsLine"
                      @update:model-value="emitHoverTooltipDisplaySetting('tagsLine', !!$event)"
                    />
                    <q-toggle
                      :label="t('hoverTooltipShowSourceLine')"
                      :model-value="hoverTooltipDisplay.sourceLine"
                      @update:model-value="emitHoverTooltipDisplaySetting('sourceLine', !!$event)"
                    />
                    <q-toggle
                      :label="t('hoverTooltipShowDescription')"
                      :model-value="hoverTooltipDisplay.description"
                      @update:model-value="emitHoverTooltipDisplaySetting('description', !!$event)"
                    />
                    <q-toggle
                      :label="t('hoverTooltipShowNamespace')"
                      :model-value="hoverTooltipDisplay.namespace"
                      @update:model-value="emitHoverTooltipDisplaySetting('namespace', !!$event)"
                    />
                  </div>
                  <div class="text-caption text-grey-7 q-mt-lg q-mb-xs">
                    {{ t('hoverTooltipPreviewGroup') }}
                  </div>
                  <div class="hover-preview-grid">
                    <div class="hover-preview-panel">
                      <div class="hover-preview-label">{{ t('hoverTooltipPreviewStandard') }}</div>
                      <stack-tooltip-card
                        :title="previewStandardTitle"
                        :id-line="previewStandardIdLine"
                        :meta-line="previewStandardMetaLine"
                        :nbt-line="previewStandardNbtLine"
                        :max-height-px="360"
                        :detail-groups="[]"
                        :detail-descriptions="[]"
                        :rarity-entries="previewStandardRarityEntries"
                        :namespace-lines="[]"
                        :tags-line="previewStandardTagsLine"
                        :source-line="previewStandardSourceLine"
                        :description="previewStandardDescription"
                        :namespace="previewStandardNamespace"
                      />
                    </div>
                    <div class="hover-preview-panel">
                      <div class="hover-preview-label">{{ t('hoverTooltipPreviewAggregate') }}</div>
                      <stack-tooltip-card
                        :title="previewAggregateTitle"
                        :id-line="previewAggregateIdLine"
                        :meta-line="previewAggregateMetaLine"
                        :nbt-line="previewAggregateNbtLine"
                        :max-height-px="360"
                        :detail-groups="previewAggregateDetailGroups"
                        :detail-descriptions="previewAggregateDetailDescriptions"
                        :rarity-entries="previewAggregateRarityEntries"
                        :namespace-lines="previewAggregateNamespaceLines"
                        :tags-line="''"
                        :source-line="''"
                        :description="''"
                        :namespace="''"
                      />
                    </div>
                  </div>
                </q-card-section>
              </q-card>

              <q-card v-if="showSection('appearance')" flat bordered>
                <q-card-section>
                  <div class="text-subtitle2 q-mb-sm">{{ t('sectionAppearance') }}</div>
                  <div class="q-gutter-y-sm">
                    <q-select
                      dense
                      outlined
                      emit-value
                      map-options
                      :label="t('darkMode')"
                      :options="[
                        { label: t('auto'), value: 'auto' },
                        { label: t('light'), value: 'light' },
                        { label: t('dark'), value: 'dark' },
                      ]"
                      :model-value="darkMode"
                      @update:model-value="
                        $emit('update:dark-mode', ($event as 'auto' | 'light' | 'dark') ?? 'auto')
                      "
                    />
                    <q-select
                      dense
                      outlined
                      emit-value
                      map-options
                      :label="t('itemListIconDisplayMode')"
                      :options="[
                        { label: t('iconDisplayModeModern'), value: 'modern' },
                        { label: t('iconDisplayModeJeiClassic'), value: 'jei_classic' },
                      ]"
                      :model-value="itemListIconDisplayMode"
                      @update:model-value="
                        $emit(
                          'update:item-list-icon-display-mode',
                          ($event as 'modern' | 'jei_classic') ?? 'modern',
                        )
                      "
                    />
                    <q-select
                      dense
                      outlined
                      emit-value
                      map-options
                      :label="t('favoritesIconDisplayMode')"
                      :options="[
                        { label: t('iconDisplayModeModern'), value: 'modern' },
                        { label: t('iconDisplayModeJeiClassic'), value: 'jei_classic' },
                      ]"
                      :model-value="favoritesIconDisplayMode"
                      @update:model-value="
                        $emit(
                          'update:favorites-icon-display-mode',
                          ($event as 'modern' | 'jei_classic') ?? 'modern',
                        )
                      "
                    />
                    <q-toggle
                      :label="t('itemIconLoadingAnimation')"
                      :model-value="itemIconLoadingAnimation"
                      @update:model-value="$emit('update:item-icon-loading-animation', !!$event)"
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
                            v-if="
                              mirror.isCurrentUsed ??
                              (!!activePackMirrorUrl && mirror.url === activePackMirrorUrl)
                            "
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

              <div v-if="showSection('i18n')">
                <I18nSettingsPanel
                  :items="i18nItems"
                  :current-language="language"
                  @update:language="$emit('update:language', $event)"
                />
              </div>
            </div>
          </div>
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
import type { ItemDef } from 'src/jei/types';
import type {
  DarkMode,
  HoverTooltipDisplayKey,
  HoverTooltipDisplaySettings,
  ItemClickDefaultTab,
  ItemIconDisplayMode,
  Language,
} from 'src/stores/settings';
import I18nSettingsPanel from './I18nSettingsPanel.vue';
import StackTooltipCard from 'src/jei/components/StackTooltipCard.vue';

const { t } = useI18n();

type SectionKey =
  | 'plugins'
  | 'general'
  | 'hover'
  | 'appearance'
  | 'keybindings'
  | 'data'
  | 'mirror'
  | 'proxy'
  | 'i18n';

const sectionDefs: Array<{ key: SectionKey; label: string; keywords: string[] }> = [
  { key: 'plugins', label: t('sectionPlugins'), keywords: ['插件', 'plugin', '扩展', 'tab'] },
  {
    key: 'general',
    label: t('sectionGeneral'),
    keywords: ['基础', '显示', '调试', '历史', 'general'],
  },
  {
    key: 'hover',
    label: t('sectionHover'),
    keywords: ['hover', 'tooltip', '悬浮', '提示', '鼠标'],
  },
  {
    key: 'appearance',
    label: t('sectionAppearance'),
    keywords: ['ui', '风格', '主题', '图标', 'classic', 'modern', '外观', 'appearance'],
  },
  {
    key: 'keybindings',
    label: t('sectionKeybindings'),
    keywords: ['快捷键', '键位', 'keybinding', 'hotkey'],
  },
  { key: 'data', label: t('sectionData'), keywords: ['数据源', 'source', 'pack', '地址'] },
  { key: 'mirror', label: t('sectionMirror'), keywords: ['镜像', 'mirror', '延迟', '测速', 'dev'] },
  { key: 'proxy', label: t('sectionProxy'), keywords: ['代理', 'proxy', 'token', '图片'] },
  {
    key: 'i18n',
    label: t('sectionI18n'),
    keywords: ['i18n', '语言', 'language', '翻译', 'locale', '国际化'],
  },
];

const props = defineProps<{
  open: boolean;
  historyLimit: number;
  favoritePageSizeMin: number;
  favoritePageSizeMax: number;
  darkMode: DarkMode;
  debugLayout: boolean;
  debugNavPanel: boolean;
  aggregateExportAvailable: boolean;
  aggregateExportLoading: boolean;
  showLoadingOverlay: boolean;
  quantLineWidthScale: number;
  productionLineG6Scale: number;
  machineCountDecimals: number;
  lineIntermediateColoring: boolean;
  productionLineRenderer: 'vue_flow' | 'g6';
  quantFlowRenderer: 'nodes' | 'sankey';
  itemListIconDisplayMode: ItemIconDisplayMode;
  favoritesIconDisplayMode: ItemIconDisplayMode;
  itemIconLoadingAnimation: boolean;
  itemClickDefaultTab: ItemClickDefaultTab;
  recipeViewMode: 'dialog' | 'panel';
  recipeSlotShowName: boolean;
  favoritesOpensNewStack: boolean;
  persistHistoryRecords: boolean;
  mobileItemClickOpensDetail: boolean;
  hoverTooltipAllowMouseEnter: boolean;
  hoverTooltipDisplay: HoverTooltipDisplaySettings;
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
    isCurrentUsed?: boolean;
  }>;
  activePackMirrorUrl: string;
  packMirrorSelectionMode: 'auto' | 'manual';
  packManualMirror: string;
  mirrorLatencyLoading: boolean;
  language: Language;
  i18nItems: ItemDef[];
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  'update:history-limit': [value: number];
  'update:favorites-page-size-min': [value: number];
  'update:favorites-page-size-max': [value: number];
  'reset:favorites-page-size-bounds': [];
  'update:dark-mode': [value: DarkMode];
  'update:debug-layout': [value: boolean];
  'update:debug-nav-panel': [value: boolean];
  'copy:aggregate-merge-report': [];
  'download:aggregate-merge-report': [];
  'update:show-loading-overlay': [value: boolean];
  'update:quant-line-width-scale': [value: number];
  'update:production-line-g6-scale': [value: number];
  'update:machine-count-decimals': [value: number];
  'update:line-intermediate-coloring': [value: boolean];
  'update:production-line-renderer': [value: 'vue_flow' | 'g6'];
  'update:quant-flow-renderer': [value: 'nodes' | 'sankey'];
  'update:item-list-icon-display-mode': [value: ItemIconDisplayMode];
  'update:favorites-icon-display-mode': [value: ItemIconDisplayMode];
  'update:item-icon-loading-animation': [value: boolean];
  'update:recipe-view-mode': [value: 'dialog' | 'panel'];
  'update:item-click-default-tab': [value: ItemClickDefaultTab];
  'update:recipe-slot-show-name': [value: boolean];
  'update:favorites-open-stack': [value: boolean];
  'update:persist-history-records': [value: boolean];
  'update:mobile-item-click-opens-detail': [value: boolean];
  'open:setup-wizard': [];
  'update:hover-tooltip-allow-mouse-enter': [value: boolean];
  'update:hover-tooltip-display-setting': [key: HoverTooltipDisplayKey, value: boolean];
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
  'update:language': [value: Language];
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
const hoverTooltipInteractBindingText = computed(() => {
  for (const group of props.keybindingGroups) {
    const action = group.actions.find((entry) => entry.id === 'hoverTooltipInteract');
    if (action) return keyBindingText(action.binding);
  }
  return '-';
});
const previewStandardTitle = computed(() => (props.hoverTooltipDisplay.title ? 'D32 钢' : ''));
const previewStandardIdLine = computed(() =>
  props.hoverTooltipDisplay.idLine ? 'ID: aef:d32_steel' : '',
);
const previewStandardMetaLine = computed(() =>
  props.hoverTooltipDisplay.metaLine ? 'Meta: 0' : '',
);
const previewStandardNbtLine = computed(() =>
  props.hoverTooltipDisplay.nbtLine ? 'NBT: {"quality":"high"}' : '',
);
const previewStandardRarityEntries = computed(() =>
  props.hoverTooltipDisplay.rarity
    ? [{ key: 'rarity', label: '6★', starsText: '★★★★★★', color: '#f4c978' }]
    : [],
);
const previewStandardTagsLine = computed(() =>
  props.hoverTooltipDisplay.tagsLine ? 'Tags: 精英材料, 高级材料' : '',
);
const previewStandardSourceLine = computed(() =>
  props.hoverTooltipDisplay.sourceLine ? 'Source: aef-aggregated-full' : '',
);
const previewStandardDescription = computed(() =>
  props.hoverTooltipDisplay.description ? '用于高级合成与角色养成的示例描述。' : '',
);
const previewStandardNamespace = computed(() =>
  props.hoverTooltipDisplay.namespace ? 'namespace: aef' : '',
);
const previewAggregateTitle = computed(() =>
  props.hoverTooltipDisplay.title ? '聚合物品预览' : '',
);
const previewAggregateIdLine = computed(() =>
  props.hoverTooltipDisplay.idLine ? 'ID: aef-aggregated.item_42' : '',
);
const previewAggregateMetaLine = computed(() =>
  props.hoverTooltipDisplay.metaLine ? 'Meta: merged' : '',
);
const previewAggregateNbtLine = computed(() =>
  props.hoverTooltipDisplay.nbtLine ? 'NBT: none' : '',
);
const previewAggregateRarityEntries = computed(() =>
  props.hoverTooltipDisplay.rarity
    ? [{ key: 'rarity', label: 'Mixed', starsText: '4★ - 6★', color: '#7dd3fc' }]
    : [],
);
const previewAggregateDetailGroups = computed(() => {
  const groups: Array<{ key: string; title: string; lines: string[] }> = [];
  if (props.hoverTooltipDisplay.detailIds) {
    groups.push({
      key: 'ids',
      title: 'IDs',
      lines: ['aef:d32_steel', 'warfarin:d32_steel'],
    });
  }
  if (props.hoverTooltipDisplay.detailTags) {
    groups.push({
      key: 'tags',
      title: 'Tags',
      lines: ['精英材料', '养成', 'Tier 4'],
    });
  }
  if (props.hoverTooltipDisplay.detailSources) {
    groups.push({
      key: 'paths',
      title: 'Paths',
      lines: ['packs/aef/items/materials/d32_steel.json'],
    });
  }
  if (props.hoverTooltipDisplay.detailInfo) {
    groups.push({
      key: 'info',
      title: 'Info',
      lines: ['Pack: aef-skland', 'Matched by aggregate rules'],
    });
  }
  if (props.hoverTooltipDisplay.detailWiki) {
    groups.push({
      key: 'wiki',
      title: 'Wiki',
      lines: ['Legacy Structured Wiki', 'Warfarin Wiki'],
    });
  }
  return groups;
});
const previewAggregateDetailDescriptions = computed(() =>
  props.hoverTooltipDisplay.detailDescriptions
    ? [
        {
          key: 'desc',
          title: 'Descriptions',
          description: '这里预览聚合来源描述、多来源备注以及补充说明的显示效果。',
        },
      ]
    : [],
);
const previewAggregateNamespaceLines = computed(() =>
  props.hoverTooltipDisplay.namespaceLines ? ['aef', 'warfarin', 'official'] : [],
);

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

function emitHoverTooltipDisplaySetting(key: HoverTooltipDisplayKey, value: boolean) {
  emit('update:hover-tooltip-display-setting', key, value);
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
  height: 80vh;
  height: 80dvh;
  max-height: calc(100vh - 32px);
  max-height: calc(100dvh - 32px);
  display: flex;
  flex-direction: column;
}

.settings-layout {
  display: grid;
  grid-template-columns: 220px 1px minmax(0, 1fr);
  flex: 1 1 auto;
  min-height: 0;
}

.settings-nav {
  background: rgba(127, 127, 127, 0.05);
  overflow: auto;
}

.settings-content {
  min-width: 0;
  min-height: 0;
}

.settings-scroll {
  height: 100%;
  overflow: auto;
}

.hover-preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
  margin-top: 8px;
}

.hover-preview-panel {
  padding: 12px;
  border: 1px solid rgba(127, 127, 127, 0.18);
  border-radius: 10px;
  background: rgba(127, 127, 127, 0.04);
}

.hover-preview-label {
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--q-primary);
}
</style>
