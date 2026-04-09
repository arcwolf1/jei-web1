<template>
  <div class="planner">
    <q-card flat bordered class="planner__card q-pa-md">
      <div :class="['planner__toolbar', 'planner__toolbar--header']">
        <div class="text-subtitle2 planner__toolbar-title">{{ t('lineSelection') }}</div>
        <q-btn
          dense
          outline
          icon="restart_alt"
          :label="isMobilePlanner ? undefined : t('redesign')"
          class="planner__header-action"
          @click="resetPlanner"
        >
          <q-tooltip v-if="isMobilePlanner">{{ t('redesign') }}</q-tooltip>
        </q-btn>
        <q-btn
          dense
          outline
          icon="save"
          :label="isMobilePlanner ? undefined : t('saveLine')"
          :disable="!!decisions.length"
          class="planner__header-action"
          @click="openSaveDialog"
        >
          <q-tooltip v-if="isMobilePlanner">{{ t('saveLine') }}</q-tooltip>
        </q-btn>
        <q-btn-dropdown
          dense
          outline
          icon="share"
          :label="isMobilePlanner ? undefined : t('share')"
          :disable="!!decisions.length"
          class="planner__header-action"
        >
          <q-tooltip v-if="isMobilePlanner">{{ t('share') }}</q-tooltip>
          <q-list dense style="min-width: 180px">
            <q-item clickable v-close-popup @click="shareAsUrl">
              <q-item-section avatar><q-icon name="link" /></q-item-section>
              <q-item-section>{{ t('copyShareLink') }}</q-item-section>
            </q-item>
            <q-item clickable v-close-popup @click="copyShareJson">
              <q-item-section avatar><q-icon name="data_object" /></q-item-section>
              <q-item-section>{{ t('copyJson') }}</q-item-section>
            </q-item>
            <q-item clickable v-close-popup @click="shareByJsonUrl">
              <q-item-section avatar><q-icon name="link" /></q-item-section>
              <q-item-section>{{ t('shareWithJsonUrl') }}</q-item-section>
            </q-item>
            <q-item clickable v-close-popup @click="importShareJson">
              <q-item-section avatar><q-icon name="upload_file" /></q-item-section>
              <q-item-section>{{ t('importJson') }}</q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>
        <q-toggle
          v-model="useProductRecovery"
          dense
          :label="t('useProductRecovery')"
          class="planner__toolbar-toggle"
        />
        <q-space class="planner__toolbar-spacer" />
        <q-badge v-if="decisions.length" color="warning"
          >{{ t('pendingChoices') }}{{ decisions.length }}</q-badge
        >
        <q-badge v-else color="positive">{{ t('completed') }}</q-badge>
      </div>

      <div v-if="decisions.length" class="column q-gutter-md q-mt-md">
        <div v-for="d in decisions" :key="decisionKey(d)" class="planner__decision">
          <div v-if="d.kind === 'item_recipe'" class="column q-gutter-sm">
            <div class="text-caption text-grey-8">
              {{ itemName(d.itemKey) }}{{ t('chooseSynthesisMethod2') }}
            </div>
            <q-select
              dense
              filled
              emit-value
              map-options
              :options="recipeOptionsForDecision(d)"
              :model-value="selectedRecipeIdByItemKeyHash.get(d.itemKeyHash) ?? null"
              @update:model-value="(v) => setRecipeChoice(d.itemKeyHash, v as string)"
            >
              <template #option="scope">
                <q-item v-bind="scope.itemProps" class="planner__recipe-option">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <div v-if="scope.opt.inputs?.length" class="planner__recipe-option-inputs">
                      <stack-view
                        v-for="(s, i) in scope.opt.inputs.slice(0, 8)"
                        :key="`${scope.opt.value}:${i}`"
                        :content="s"
                        :item-defs-by-key-hash="itemDefsByKeyHash"
                        variant="slot"
                        :show-name="false"
                        :show-subtitle="false"
                        @item-mouseenter="emit('item-mouseenter', $event)"
                        @item-mouseleave="emit('item-mouseleave')"
                      />
                      <div
                        v-if="scope.opt.inputs.length > 8"
                        class="planner__recipe-option-more text-caption text-grey-6"
                      >
                        +{{ scope.opt.inputs.length - 8 }}
                      </div>
                    </div>
                  </q-item-section>
                  <q-item-section side>
                    <div class="text-caption text-grey-6">{{ scope.opt.value }}</div>
                  </q-item-section>

                  <q-tooltip max-width="720px">
                    <q-card
                      v-if="scope.opt.recipe && scope.opt.recipeType"
                      flat
                      bordered
                      class="q-pa-sm"
                    >
                      <recipe-viewer
                        :recipe="scope.opt.recipe"
                        :recipe-type="scope.opt.recipeType"
                        :item-defs-by-key-hash="itemDefsByKeyHash"
                        @item-click="emit('item-click', $event)"
                        @item-mouseenter="emit('item-mouseenter', $event)"
                        @item-mouseleave="emit('item-mouseleave')"
                      />
                    </q-card>
                    <div v-else class="text-caption">{{ t('noRecipeDetails') }}</div>
                  </q-tooltip>
                </q-item>
              </template>
            </q-select>
            <q-card
              v-if="selectedRecipeIdByItemKeyHash.get(d.itemKeyHash)"
              flat
              bordered
              class="q-pa-md"
            >
              <recipe-viewer
                :recipe="index.recipesById.get(selectedRecipeIdByItemKeyHash.get(d.itemKeyHash)!)!"
                :recipe-type="
                  index.recipeTypesByKey.get(
                    index.recipesById.get(selectedRecipeIdByItemKeyHash.get(d.itemKeyHash)!)!.type,
                  )!
                "
                :item-defs-by-key-hash="itemDefsByKeyHash"
                @item-click="emit('item-click', $event)"
                @item-mouseenter="emit('item-mouseenter', $event)"
                @item-mouseleave="emit('item-mouseleave')"
              />
            </q-card>
          </div>

          <div v-else class="column q-gutter-sm">
            <div class="row items-center q-gutter-sm">
              <div class="text-caption text-grey-8">
                tag {{ getTagDisplayName(d.tagId) }} - {{ t('chooseSpecificItem') }}
              </div>
              <q-badge v-if="!d.candidateItemIds.length" color="negative">{{
                t('noOptions')
              }}</q-badge>
            </div>
            <q-select
              dense
              filled
              emit-value
              map-options
              :options="tagItemOptions(d)"
              :model-value="selectedItemIdByTagId.get(d.tagId) ?? null"
              @update:model-value="(v) => setTagChoice(d.tagId, v as string)"
            />
          </div>
        </div>
      </div>

      <div v-else class="q-mt-md">
        <q-tabs
          v-model="activeTab"
          dense
          :outside-arrows="!isMobilePlanner"
          :mobile-arrows="isMobilePlanner"
          :inline-label="!isMobilePlanner"
          class="planner__tabs"
        >
          <q-tab name="tree" :label="treeTabLabel" />
          <q-tab name="graph" :label="graphTabLabel" />
          <q-tab name="line" :label="lineTabLabel" />
          <q-tab name="quant" :label="quantTabLabel" />
          <q-tab name="calc" :label="calcTabLabel" />
        </q-tabs>
        <q-separator />

        <div v-if="activeTab === 'tree'" class="q-mt-md">
          <div :class="['planner__toolbar', 'planner__toolbar--view']">
            <div class="text-caption text-grey-8">{{ t('targetOutput') }}</div>
            <q-input
              dense
              filled
              type="number"
              style="width: 120px"
              class="planner__target-amount"
              :model-value="targetAmount"
              @update:model-value="(v) => (targetAmount = Number(v))"
            />
            <q-select
              dense
              filled
              emit-value
              map-options
              popup-content-class="planner__select-menu"
              style="min-width: 100px"
              class="planner__target-unit"
              :options="unitOptions"
              :model-value="targetUnit"
              @update:model-value="(v) => (targetUnit = v as (typeof unitOptions)[number]['value'])"
            />
            <q-btn-group outline class="planner__preset-group">
              <q-btn
                dense
                no-caps
                size="md"
                label="HS"
                :disable="!canApplyHalfRatePreset"
                @click="applyTargetRatePreset('half')"
              />
              <q-btn
                dense
                no-caps
                size="md"
                label="FS"
                :disable="!canApplyFullRatePreset"
                @click="applyTargetRatePreset('full')"
              />
            </q-btn-group>
            <q-space class="planner__toolbar-spacer" />
            <q-btn-toggle
              v-model="treeDisplayMode"
              dense
              outline
              class="planner__mode-toggle"
              toggle-color="primary"
              :options="[
                { label: t('displayModeList'), value: 'list' },
                { label: t('displayModeCompact'), value: 'compact' },
              ]"
            />
          </div>
          <div v-if="treeResult" class="q-mt-md">
            <div v-if="treeDisplayMode === 'list'" class="planner__tree-table">
              <div class="planner__tree-table-header">
                <div class="planner__tree-col planner__tree-col--tree">
                  {{ t('treeStructure') }}
                </div>
                <div class="planner__tree-col planner__tree-col--rate text-right">
                  {{ rateColumnLabel }}
                </div>
                <div class="planner__tree-col planner__tree-col--belts text-right">
                  {{ t('conveyorBelt') }}
                </div>
                <div class="planner__tree-col planner__tree-col--machines text-right">
                  {{ t('equipment') }}
                </div>
                <div class="planner__tree-col planner__tree-col--power text-right">
                  {{ t('power') }}
                </div>
              </div>
              <div
                v-for="row in treeListRows"
                :key="row.node.nodeId"
                class="planner__tree-table-row"
              >
                <div class="planner__tree-col planner__tree-col--tree">
                  <div class="planner__links">
                    <template v-if="row.connect.length">
                      <div
                        v-for="(trail, i) in row.connect"
                        :key="i"
                        class="planner__connect"
                        :class="{
                          'planner__connect--trail': trail,
                          'planner__connect--last': i === row.connect.length - 1,
                        }"
                      ></div>
                    </template>
                    <div class="planner__tree-toggle">
                      <q-btn
                        v-if="row.node.kind === 'item' && row.node.children.length"
                        flat
                        dense
                        round
                        size="sm"
                        :icon="collapsed.has(row.node.nodeId) ? 'chevron_right' : 'expand_more'"
                        @click="toggleCollapsed(row.node.nodeId)"
                      />
                      <div v-else style="width: 28px"></div>
                    </div>
                    <div class="planner__tree-icon">
                      <stack-view
                        v-if="row.node.kind === 'item'"
                        :content="{ kind: 'item', id: row.node.itemKey.id, amount: 1 }"
                        :item-defs-by-key-hash="itemDefsByKeyHash"
                        variant="slot"
                        :show-name="false"
                        :show-subtitle="false"
                        @item-click="emit('item-click', $event)"
                        @item-mouseenter="emit('item-mouseenter', $event)"
                        @item-mouseleave="emit('item-mouseleave')"
                      />
                      <stack-view
                        v-else
                        :content="
                          row.node.unit
                            ? { kind: 'fluid', id: row.node.id, amount: 1, unit: row.node.unit }
                            : { kind: 'fluid', id: row.node.id, amount: 1 }
                        "
                        :item-defs-by-key-hash="itemDefsByKeyHash"
                        variant="slot"
                        :show-name="false"
                        :show-subtitle="false"
                        @item-mouseenter="emit('item-mouseenter', $event)"
                        @item-mouseleave="emit('item-mouseleave')"
                      />
                    </div>
                    <div class="planner__tree-name">
                      <div class="planner__tree-name-main">
                        {{ row.node.kind === 'item' ? itemName(row.node.itemKey) : row.node.id }}
                      </div>
                      <div class="planner__tree-name-sub text-caption text-grey-7">
                        {{ formatAmount(nodeDisplayAmount(row.node)) }}
                      </div>
                      <div
                        v-if="row.node.kind === 'item' && row.node.recovery"
                        class="planner__tree-name-sub text-caption text-positive"
                      >
                        {{ recoverySourceText(row.node) }}
                      </div>
                      <div
                        v-if="
                          row.node.kind === 'item' &&
                          (recoveryProducedByNodeId.get(row.node.nodeId)?.length ?? 0) > 0
                        "
                        class="planner__tree-name-sub text-caption text-teal-8"
                      >
                        {{ t('recoveryOutput') }}：{{ recoveryProducedText(row.node.nodeId) }}
                      </div>
                    </div>
                    <q-badge
                      v-if="row.node.kind === 'item' && row.node.recovery"
                      color="teal"
                      class="q-ml-sm"
                    >
                      recovery
                    </q-badge>
                    <q-badge
                      v-if="
                        row.node.kind === 'item' &&
                        (recoveryProducedByNodeId.get(row.node.nodeId)?.length ?? 0) > 0
                      "
                      color="teal-6"
                      class="q-ml-sm"
                    >
                      {{ t('recoveryOutput') }}
                      <q-tooltip>{{ recoveryProducedText(row.node.nodeId) }}</q-tooltip>
                    </q-badge>
                    <q-badge
                      v-if="row.node.kind === 'item' && row.node.cycle"
                      :color="row.node.cycleSeed ? 'positive' : 'negative'"
                      class="q-ml-sm"
                    >
                      {{ row.node.cycleSeed ? 'cycle seed' : 'cycle' }}
                    </q-badge>
                  </div>
                </div>
                <div class="planner__tree-col planner__tree-col--rate text-right monospace">
                  {{ formatAmount(nodeDisplayRate(row.node)) }}
                </div>
                <div class="planner__tree-col planner__tree-col--belts text-right monospace">
                  {{ nodeBeltsText(row.node) }}
                </div>
                <div class="planner__tree-col planner__tree-col--machines text-right">
                  <div class="planner__machines-cell">
                    <template v-if="row.node.kind === 'item' && row.node.machineItemId">
                      <stack-view
                        :content="{ kind: 'item', id: row.node.machineItemId, amount: 1 }"
                        :item-defs-by-key-hash="itemDefsByKeyHash"
                        variant="slot"
                        :show-name="false"
                        :show-subtitle="false"
                        @item-mouseenter="emit('item-mouseenter', $event)"
                        @item-mouseleave="emit('item-mouseleave')"
                      />
                      <div class="planner__machines-text monospace">
                        {{ nodeMachinesText(row.node) }}
                      </div>
                    </template>
                  </div>
                </div>
                <div class="planner__tree-col planner__tree-col--power text-right monospace">
                  {{ nodePowerText(row.node) }}
                </div>
              </div>
              <div v-if="enhancedTreeResult?.totals" class="planner__tree-table-footer">
                <div class="planner__tree-footer-row">
                  <div class="planner__tree-footer-label">{{ t('total') }}</div>
                  <div class="planner__tree-footer-values">
                    <span class="monospace">{{ t('powerUsage') }} {{ totalPower }} kW</span>
                    <span class="monospace"
                      >{{ t('pollution') }} {{ totalPollution }}{{ t('pollutionPerMinute') }}</span
                    >
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="column q-gutter-xs">
              <div v-for="row in treeRows" :key="row.node.nodeId" class="planner__tree-row">
                <div class="planner__tree-indent" :style="{ width: `${row.depth * 18}px` }"></div>
                <q-btn
                  v-if="row.node.kind === 'item' && row.node.children.length"
                  flat
                  dense
                  round
                  size="sm"
                  :icon="collapsed.has(row.node.nodeId) ? 'chevron_right' : 'expand_more'"
                  @click="toggleCollapsed(row.node.nodeId)"
                />
                <div v-else style="width: 28px"></div>
                <div class="planner__tree-content">
                  <stack-view
                    v-if="row.node.kind === 'item'"
                    :content="{
                      kind: 'item',
                      id: row.node.itemKey.id,
                      amount: formatAmount(row.node.amount),
                    }"
                    :item-defs-by-key-hash="itemDefsByKeyHash"
                    :show-subtitle="true"
                    @item-click="emit('item-click', $event)"
                    @item-mouseenter="emit('item-mouseenter', $event)"
                    @item-mouseleave="emit('item-mouseleave')"
                  />
                  <q-btn
                    v-if="row.node.kind === 'item' && row.node.machineItemId"
                    flat
                    dense
                    class="q-ml-xs"
                    style="padding: 0"
                  >
                    <stack-view
                      :content="{ kind: 'item', id: row.node.machineItemId, amount: 1 }"
                      :item-defs-by-key-hash="itemDefsByKeyHash"
                      variant="slot"
                      :show-name="false"
                      :show-subtitle="false"
                      @item-mouseenter="emit('item-mouseenter', $event)"
                      @item-mouseleave="emit('item-mouseleave')"
                    />
                    <q-tooltip>{{
                      row.node.machineName ?? row.node.recipeTypeKeyUsed ?? row.node.machineItemId
                    }}</q-tooltip>
                  </q-btn>
                  <stack-view
                    v-else-if="row.node.kind === 'fluid'"
                    :content="
                      row.node.unit
                        ? {
                            kind: 'fluid',
                            id: row.node.id,
                            amount: formatAmount(row.node.amount),
                            unit: row.node.unit,
                          }
                        : {
                            kind: 'fluid',
                            id: row.node.id,
                            amount: formatAmount(row.node.amount),
                          }
                    "
                    :item-defs-by-key-hash="itemDefsByKeyHash"
                    :show-subtitle="true"
                    @item-mouseenter="emit('item-mouseenter', $event)"
                    @item-mouseleave="emit('item-mouseleave')"
                  />
                  <q-badge
                    v-if="row.node.kind === 'item' && row.node.recovery"
                    color="teal"
                    class="q-ml-sm"
                  >
                    recovery
                    <q-tooltip>{{ recoverySourceText(row.node) }}</q-tooltip>
                  </q-badge>
                  <q-badge
                    v-if="
                      row.node.kind === 'item' &&
                      (recoveryProducedByNodeId.get(row.node.nodeId)?.length ?? 0) > 0
                    "
                    color="teal-6"
                    class="q-ml-sm"
                  >
                    {{ t('recoveryOutput') }}
                    <q-tooltip>{{ recoveryProducedText(row.node.nodeId) }}</q-tooltip>
                  </q-badge>
                  <q-badge
                    v-if="row.node.kind === 'item' && row.node.cycle"
                    :color="row.node.cycleSeed ? 'positive' : 'negative'"
                    class="q-ml-sm"
                  >
                    {{ row.node.cycleSeed ? 'cycle seed' : 'cycle' }}
                  </q-badge>
                  <template
                    v-if="
                      row.node.kind === 'item' && enhancedTreeResult && enhancedTreeResult.totals
                    "
                  >
                    <template v-if="'perMinute' in row.node && row.node.perMinute !== undefined">
                      <q-badge v-if="row.node.perMinute > 0" color="primary" class="q-ml-sm">
                        {{ formatAmount(row.node.perMinute) }}/min
                      </q-badge>
                    </template>
                    <template
                      v-if="
                        'machines' in row.node &&
                        row.node.machines !== undefined &&
                        row.node.machines > 0
                      "
                    >
                      <q-badge color="accent" class="q-ml-sm">
                        {{ formatAmount(row.node.machines) }} {{ t('machines') }}
                      </q-badge>
                    </template>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="activeTab === 'graph'" class="q-mt-md">
          <div :class="['planner__pagefull', { 'planner__pagefull--active': graphPageFull }]">
            <div :class="['planner__toolbar', 'planner__toolbar--view']">
              <div class="text-caption text-grey-8">{{ t('targetOutput') }}</div>
              <q-input
                dense
                filled
                type="number"
                style="width: 160px"
                class="planner__target-amount"
                :model-value="targetAmount"
                @update:model-value="(v) => (targetAmount = Number(v))"
              />
              <q-select
                dense
                filled
                emit-value
                map-options
                popup-content-class="planner__select-menu"
                style="min-width: 100px"
                class="planner__target-unit"
                :options="unitOptions"
                :model-value="targetUnit"
                @update:model-value="
                  (v) => (targetUnit = v as (typeof unitOptions)[number]['value'])
                "
              />
              <q-btn-group outline class="planner__preset-group">
                <q-btn
                  dense
                  no-caps
                  size="md"
                  label="HS"
                  :disable="!canApplyHalfRatePreset"
                  @click="applyTargetRatePreset('half')"
                />
                <q-btn
                  dense
                  no-caps
                  size="md"
                  label="FS"
                  :disable="!canApplyFullRatePreset"
                  @click="applyTargetRatePreset('full')"
                />
              </q-btn-group>
              <q-toggle
                v-model="graphShowFluids"
                dense
                :label="t('showFluids')"
                class="planner__toolbar-toggle"
              />
              <q-toggle
                v-model="graphMergeRawMaterials"
                dense
                :label="t('mergeRawMaterials')"
                class="planner__toolbar-toggle"
              />
              <q-space class="planner__toolbar-spacer" />
              <q-btn
                flat
                dense
                round
                :icon="graphPageFull ? 'close_fullscreen' : 'fit_screen'"
                class="planner__view-action"
                @click="graphPageFull = !graphPageFull"
              >
                <q-tooltip>{{
                  graphPageFull ? t('exitPageFullscreen') : t('pageFullscreen')
                }}</q-tooltip>
              </q-btn>
              <q-btn
                flat
                dense
                round
                :icon="graphFullscreen ? 'fullscreen_exit' : 'fullscreen'"
                class="planner__view-action"
                @click="toggleGraphFullscreen"
              >
                <q-tooltip>{{ graphFullscreen ? t('exitFullscreen') : t('fullscreen') }}</q-tooltip>
              </q-btn>
            </div>
            <div
              v-if="treeResult"
              class="q-mt-md planner__flow"
              :class="{ 'planner__flow--fullscreen': graphFullscreen }"
              ref="graphFlowWrapEl"
            >
              <VueFlow
                id="planner-flow"
                :nodes="flowNodesStyled"
                :edges="flowEdgesStyled"
                :nodes-draggable="true"
                :nodes-connectable="false"
                :elements-selectable="true"
                :zoom-on-double-click="false"
                :min-zoom="0.2"
                :max-zoom="2"
                :pan-on-drag="true"
                no-pan-class-name="nopan"
                no-drag-class-name="nodrag"
                @node-click="(evt) => (selectedGraphNodeId = evt.node.id)"
                @node-drag-start="(evt) => (selectedGraphNodeId = evt.node.id)"
                @node-drag-stop="onGraphNodeDragStop"
                @pane-click="() => (selectedGraphNodeId = null)"
              >
                <Background :gap="20" :pattern-color="flowBackgroundPatternColor" />
                <Controls />
                <MiniMap />
                <template #node-itemNode="p">
                  <div
                    class="planner__flow-node"
                    :class="{
                      'planner__flow-node--selected': selectedGraphNodeId === p.id,
                      'planner__flow-node--recovery': p.data.recovery,
                    }"
                    @click.stop="selectedGraphNodeId = p.id"
                  >
                    <div
                      class="planner__flow-node-icon cursor-pointer nodrag nopan"
                      @click="emit('item-click', p.data.itemKey)"
                    >
                      <stack-view
                        class="nodrag nopan"
                        :content="{
                          kind: 'item',
                          id: p.data.itemKey.id,
                          amount: 1,
                          ...(p.data.itemKey.meta !== undefined
                            ? { meta: p.data.itemKey.meta }
                            : {}),
                          ...(p.data.itemKey.nbt !== undefined ? { nbt: p.data.itemKey.nbt } : {}),
                        }"
                        :item-defs-by-key-hash="itemDefsByKeyHash"
                        variant="slot"
                        :show-name="false"
                        :show-subtitle="false"
                        @item-mouseenter="emit('item-mouseenter', $event)"
                        @item-mouseleave="emit('item-mouseleave')"
                      />
                    </div>
                    <div
                      class="planner__flow-node-text nopan"
                      @click.stop="selectedGraphNodeId = p.id"
                    >
                      <div class="planner__flow-node-title">{{ p.data.title }}</div>
                      <div class="planner__flow-node-sub">
                        {{ p.data.subtitle }}
                        <q-badge v-if="p.data.machineCount" color="accent" class="q-ml-xs">
                          x{{ p.data.machineCount }}
                        </q-badge>
                        <q-badge v-if="p.data.recovery" color="teal" class="q-ml-xs">
                          recovery
                          <q-tooltip v-if="p.data.recoverySource">{{
                            p.data.recoverySource
                          }}</q-tooltip>
                        </q-badge>
                        <q-badge
                          v-if="p.data.cycle"
                          :color="p.data.cycleSeed ? 'positive' : 'negative'"
                          class="q-ml-xs"
                        >
                          {{ p.data.cycleSeed ? 'cycle seed' : 'cycle' }}
                        </q-badge>
                      </div>
                    </div>
                    <div
                      v-if="p.data.machineItemId"
                      class="planner__flow-node-machine nodrag nopan"
                      @click.stop="selectedGraphNodeId = p.id"
                    >
                      <stack-view
                        class="nodrag nopan"
                        :content="{ kind: 'item', id: p.data.machineItemId, amount: 1 }"
                        :item-defs-by-key-hash="itemDefsByKeyHash"
                        variant="slot"
                        :show-name="false"
                        :show-subtitle="false"
                        @item-mouseenter="emit('item-mouseenter', $event)"
                        @item-mouseleave="emit('item-mouseleave')"
                      />
                      <q-tooltip>{{ p.data.machineName ?? p.data.machineItemId }}</q-tooltip>
                    </div>
                  </div>
                </template>
                <template #node-fluidNode="p">
                  <div
                    class="planner__flow-node planner__flow-node--fluid"
                    :class="{ 'planner__flow-node--selected': selectedGraphNodeId === p.id }"
                    @click.stop="selectedGraphNodeId = p.id"
                  >
                    <div
                      class="planner__flow-node-text nopan"
                      @click.stop="selectedGraphNodeId = p.id"
                    >
                      <div class="planner__flow-node-title">{{ p.data.title }}</div>
                      <div class="planner__flow-node-sub">{{ p.data.subtitle }}</div>
                    </div>
                  </div>
                </template>
              </VueFlow>
            </div>
          </div>
        </div>

        <div v-else-if="activeTab === 'line'" class="q-mt-md">
          <div :class="['planner__pagefull', { 'planner__pagefull--active': linePageFull }]">
            <div :class="['planner__toolbar', 'planner__toolbar--view']">
              <div class="text-caption text-grey-8">{{ t('targetOutput') }}</div>
              <q-input
                dense
                filled
                type="number"
                style="width: 160px"
                class="planner__target-amount"
                :model-value="targetAmount"
                @update:model-value="(v) => (targetAmount = Number(v))"
              />
              <q-select
                dense
                filled
                emit-value
                map-options
                popup-content-class="planner__select-menu"
                style="min-width: 100px"
                class="planner__target-unit"
                :options="unitOptions"
                :model-value="targetUnit"
                @update:model-value="
                  (v) => (targetUnit = v as (typeof unitOptions)[number]['value'])
                "
              />
              <q-btn-group outline class="planner__preset-group">
                <q-btn
                  dense
                  no-caps
                  size="md"
                  label="HS"
                  :disable="!canApplyHalfRatePreset"
                  @click="applyTargetRatePreset('half')"
                />
                <q-btn
                  dense
                  no-caps
                  size="md"
                  label="FS"
                  :disable="!canApplyFullRatePreset"
                  @click="applyTargetRatePreset('full')"
                />
              </q-btn-group>
              <q-toggle
                v-model="lineCollapseIntermediate"
                dense
                :label="t('hideIntermediate')"
                class="planner__toolbar-toggle"
              />
              <q-toggle
                v-model="lineWidthByRate"
                dense
                :label="t('lineWidthByRate')"
                class="planner__toolbar-toggle"
              />
              <q-toggle
                :model-value="settingsStore.lineIntermediateColoring"
                dense
                :label="t('intermediateColoring')"
                class="planner__toolbar-toggle"
                @update:model-value="settingsStore.setLineIntermediateColoring(!!$event)"
              />
              <q-toggle
                v-if="
                  selectedLineItemData &&
                  !selectedLineItemData.isRoot &&
                  !selectedLineItemData.recovery
                "
                :model-value="selectedLineItemForcedRaw"
                dense
                color="warning"
                :label="t('treatAsRawMaterial')"
                class="planner__toolbar-toggle"
                @update:model-value="(v) => setSelectedLineItemForcedRaw(!!v)"
              />
              <q-btn
                v-if="lineWidthByRate"
                dense
                flat
                no-caps
                icon="tune"
                :label="t('lineWidthEditCurve')"
                class="planner__header-action"
                @click="lineWidthCurveDialogOpen = true"
              />
              <q-btn-toggle
                dense
                outlined
                no-caps
                class="planner__renderer-toggle"
                toggle-color="primary"
                :model-value="settingsStore.productionLineRenderer"
                :options="[
                  { label: 'VueFlow', value: 'vue_flow' },
                  { label: 'G6', value: 'g6' },
                ]"
                @update:model-value="
                  settingsStore.setProductionLineRenderer(
                    ($event as 'vue_flow' | 'g6') ?? 'vue_flow',
                  )
                "
              />
              <q-space class="planner__toolbar-spacer" />
              <q-btn
                flat
                dense
                round
                :icon="linePageFull ? 'close_fullscreen' : 'fit_screen'"
                class="planner__view-action"
                @click="linePageFull = !linePageFull"
              >
                <q-tooltip>{{
                  linePageFull ? t('exitPageFullscreen') : t('pageFullscreen')
                }}</q-tooltip>
              </q-btn>
              <q-btn
                flat
                dense
                round
                :icon="lineFullscreen ? 'fullscreen_exit' : 'fullscreen'"
                class="planner__view-action"
                @click="toggleLineFullscreen"
              >
                <q-tooltip>{{ lineFullscreen ? t('exitFullscreen') : t('fullscreen') }}</q-tooltip>
              </q-btn>
            </div>
            <div
              v-if="treeResult"
              class="q-mt-md planner__flow"
              :class="{ 'planner__flow--fullscreen': lineFullscreen }"
              ref="lineFlowWrapEl"
            >
              <line-flow-view
                flow-id="planner-line-flow"
                :renderer="settingsStore.productionLineRenderer"
                :nodes="lineFlowNodes"
                :edges="lineFlowEdgesStyled"
                :selected-node-id="selectedLineNodeId"
                :item-defs-by-key-hash="itemDefsByKeyHash"
                :flow-background-pattern-color="flowBackgroundPatternColor"
                :line-width-scale="settingsStore.productionLineG6Scale"
                @update:selected-node-id="selectedLineNodeId = $event"
                @node-drag-stop="onLineNodeDragStop"
                @item-click="emit('item-click', $event)"
                @item-mouseenter="emit('item-mouseenter', $event)"
                @item-mouseleave="emit('item-mouseleave')"
              />
            </div>
          </div>
        </div>

        <div v-else-if="activeTab === 'quant'" class="q-mt-md">
          <div :class="['planner__pagefull', { 'planner__pagefull--active': quantPageFull }]">
            <div :class="['planner__toolbar', 'planner__toolbar--view']">
              <div class="text-caption text-grey-8">{{ t('targetOutput') }}</div>
              <q-input
                dense
                filled
                type="number"
                style="width: 160px"
                class="planner__target-amount"
                :model-value="targetAmount"
                @update:model-value="(v) => (targetAmount = Number(v))"
              />
              <q-select
                dense
                filled
                emit-value
                map-options
                popup-content-class="planner__select-menu"
                style="min-width: 100px"
                class="planner__target-unit"
                :options="unitOptions"
                :model-value="targetUnit"
                @update:model-value="
                  (v) => (targetUnit = v as (typeof unitOptions)[number]['value'])
                "
              />
              <q-btn-group outline class="planner__preset-group">
                <q-btn
                  dense
                  no-caps
                  size="md"
                  label="HS"
                  :disable="!canApplyHalfRatePreset"
                  @click="applyTargetRatePreset('half')"
                />
                <q-btn
                  dense
                  no-caps
                  size="md"
                  label="FS"
                  :disable="!canApplyFullRatePreset"
                  @click="applyTargetRatePreset('full')"
                />
              </q-btn-group>
              <q-toggle
                v-model="quantShowFluids"
                dense
                :label="t('showFluids')"
                class="planner__toolbar-toggle"
              />
              <q-toggle
                v-model="quantWidthByRate"
                dense
                :label="t('lineWidthByRate')"
                class="planner__toolbar-toggle"
              />
              <q-btn-toggle
                dense
                outlined
                no-caps
                class="planner__renderer-toggle"
                toggle-color="primary"
                :model-value="settingsStore.quantFlowRenderer"
                :options="[
                  { label: t('nodeGraph'), value: 'nodes' },
                  { label: t('sankeyGraph'), value: 'sankey' },
                ]"
                @update:model-value="
                  settingsStore.setQuantFlowRenderer(($event as 'nodes' | 'sankey') ?? 'nodes')
                "
              />
              <q-space class="planner__toolbar-spacer" />
              <q-btn
                flat
                dense
                round
                :icon="quantPageFull ? 'close_fullscreen' : 'fit_screen'"
                class="planner__view-action"
                @click="quantPageFull = !quantPageFull"
              >
                <q-tooltip>{{
                  quantPageFull ? t('exitPageFullscreen') : t('pageFullscreen')
                }}</q-tooltip>
              </q-btn>
              <q-btn
                flat
                dense
                round
                :icon="quantFullscreen ? 'fullscreen_exit' : 'fullscreen'"
                class="planner__view-action"
                @click="toggleQuantFullscreen"
              >
                <q-tooltip>{{ quantFullscreen ? t('exitFullscreen') : t('fullscreen') }}</q-tooltip>
              </q-btn>
            </div>
            <div
              v-if="treeResult && quantModel.nodes.length"
              class="q-mt-md planner__flow"
              :class="{ 'planner__flow--fullscreen': quantFullscreen }"
              ref="quantFlowWrapEl"
            >
              <quant-flow-view
                :mode="settingsStore.quantFlowRenderer"
                :model="quantModel"
                :node-positions="nodePositionMapToRecord(quantNodePositions)"
                :item-defs-by-key-hash="itemDefsByKeyHash"
                :display-unit="targetUnit"
                :width-by-rate="quantWidthByRate"
                :belt-speed="beltSpeed"
                :line-width-curve-config="lineWidthCurveConfig"
                :line-width-scale="settingsStore.quantLineWidthScale"
                :machine-count-decimals="settingsStore.machineCountDecimals"
                @node-drag-stop="onQuantNodeDragStop"
                @item-click="emit('item-click', $event)"
                @item-mouseenter="emit('item-mouseenter', $event)"
                @item-mouseleave="emit('item-mouseleave')"
              />
            </div>
            <div v-else-if="treeResult" class="q-mt-md text-center text-grey q-pa-lg">
              {{ t('noNodes') }}
            </div>
          </div>
        </div>

        <div v-else class="q-mt-md">
          <div :class="['planner__toolbar', 'planner__toolbar--view']">
            <div class="text-caption text-grey-8">{{ t('targetOutput') }}</div>
            <q-input
              dense
              filled
              type="number"
              style="width: 120px"
              class="planner__target-amount"
              :model-value="targetAmount"
              @update:model-value="(v) => (targetAmount = Number(v))"
            />
            <q-select
              dense
              filled
              emit-value
              map-options
              popup-content-class="planner__select-menu"
              style="min-width: 100px"
              class="planner__target-unit"
              :options="unitOptions"
              :model-value="targetUnit"
              @update:model-value="(v) => (targetUnit = v as (typeof unitOptions)[number]['value'])"
            />
            <q-btn-group outline class="planner__preset-group">
              <q-btn
                dense
                no-caps
                size="md"
                label="HS"
                :disable="!canApplyHalfRatePreset"
                @click="applyTargetRatePreset('half')"
              />
              <q-btn
                dense
                no-caps
                size="md"
                label="FS"
                :disable="!canApplyFullRatePreset"
                @click="applyTargetRatePreset('full')"
              />
            </q-btn-group>
          </div>
          <div v-if="treeResult" class="q-mt-md">
            <div class="text-caption text-grey-8 q-mb-sm">{{ t('requiredMaterials') }}</div>
            <q-table
              flat
              bordered
              dense
              row-key="id"
              :rows="leafRowsWithRates"
              :columns="leafColumnsWithRates"
              :pagination="{ rowsPerPage: 0 }"
              hide-bottom
            >
              <template #body-cell-name="props">
                <q-td :props="props">
                  <div class="row items-center q-gutter-sm">
                    <stack-view
                      v-if="props.row.itemId"
                      :content="{ kind: 'item', id: props.row.itemId, amount: 1 }"
                      :item-defs-by-key-hash="itemDefsByKeyHash"
                      variant="slot"
                      :show-name="false"
                      :show-subtitle="false"
                      @item-click="emit('item-click', $event)"
                      @item-mouseenter="emit('item-mouseenter', $event)"
                      @item-mouseleave="emit('item-mouseleave')"
                    />
                    <span>{{ props.row.name }}</span>
                  </div>
                </q-td>
              </template>
            </q-table>
            <div v-if="forcedRawRowsWithRates.length" class="q-mt-md">
              <div class="text-caption text-grey-8 q-mb-sm">{{ t('rawMaterialList') }}</div>
              <q-table
                flat
                bordered
                dense
                row-key="keyHash"
                :rows="forcedRawRowsWithRates"
                :columns="forcedRawColumnsWithRates"
                :pagination="{ rowsPerPage: 0 }"
                hide-bottom
              >
                <template #body-cell-name="props">
                  <q-td :props="props">
                    <div class="row items-center q-gutter-sm">
                      <stack-view
                        :content="{
                          kind: 'item',
                          id: props.row.itemKey.id,
                          amount: 1,
                          ...(props.row.itemKey.meta !== undefined
                            ? { meta: props.row.itemKey.meta }
                            : {}),
                          ...(props.row.itemKey.nbt !== undefined
                            ? { nbt: props.row.itemKey.nbt }
                            : {}),
                        }"
                        :item-defs-by-key-hash="itemDefsByKeyHash"
                        variant="slot"
                        :show-name="false"
                        :show-subtitle="false"
                        @item-click="emit('item-click', $event)"
                        @item-mouseenter="emit('item-mouseenter', $event)"
                        @item-mouseleave="emit('item-mouseleave')"
                      />
                      <span>{{ props.row.name }}</span>
                    </div>
                  </q-td>
                </template>
                <template #body-cell-action="props">
                  <q-td :props="props" class="text-right">
                    <q-btn
                      dense
                      outline
                      no-caps
                      size="sm"
                      color="warning"
                      icon="undo"
                      :label="t('cancelRawMaterial')"
                      @click="setForcedRawByKeyHash(props.row.keyHash, false)"
                    />
                  </q-td>
                </template>
              </q-table>
            </div>
            <div v-if="intermediateRowsWithRates.length" class="q-mt-md">
              <div class="text-caption text-grey-8 q-mb-sm">
                {{ t('intermediateProductionCount') }}
              </div>
              <q-table
                flat
                bordered
                dense
                row-key="id"
                :rows="intermediateRowsWithRates"
                :columns="intermediateColumnsWithRates"
                :pagination="{ rowsPerPage: 0 }"
                hide-bottom
              >
                <template #body-cell-name="props">
                  <q-td :props="props">
                    <div class="row items-center q-gutter-sm">
                      <stack-view
                        v-if="props.row.itemId"
                        :content="{ kind: 'item', id: props.row.itemId, amount: 1 }"
                        :item-defs-by-key-hash="itemDefsByKeyHash"
                        variant="slot"
                        :show-name="false"
                        :show-subtitle="false"
                        @item-click="emit('item-click', $event)"
                        @item-mouseenter="emit('item-mouseenter', $event)"
                        @item-mouseleave="emit('item-mouseleave')"
                      />
                      <span>{{ props.row.name }}</span>
                    </div>
                  </q-td>
                </template>
                <template #body-cell-action="props">
                  <q-td :props="props" class="text-right">
                    <q-btn
                      dense
                      outline
                      no-caps
                      size="sm"
                      :color="props.row.forcedRaw ? 'warning' : 'primary'"
                      :icon="props.row.forcedRaw ? 'undo' : 'inventory_2'"
                      :label="props.row.forcedRaw ? t('cancelRawMaterial') : t('setAsRawMaterial')"
                      @click="setForcedRawForItemId(props.row.itemId, !props.row.forcedRaw)"
                    />
                  </q-td>
                </template>
              </q-table>
            </div>
            <div v-if="machineRows.length" class="q-mt-md">
              <div class="text-caption text-grey-8 q-mb-sm">{{ t('requiredMachines') }}</div>
              <q-table
                flat
                bordered
                dense
                row-key="id"
                :rows="machineRows"
                :columns="machineColumns"
                :pagination="{ rowsPerPage: 0 }"
                hide-bottom
              >
                <template #body-cell-name="props">
                  <q-td :props="props">
                    <div class="row items-center q-gutter-sm">
                      <stack-view
                        :content="{ kind: 'item', id: props.row.id, amount: 1 }"
                        :item-defs-by-key-hash="itemDefsByKeyHash"
                        variant="slot"
                        :show-name="false"
                        :show-subtitle="false"
                        @item-click="emit('item-click', $event)"
                        @item-mouseenter="emit('item-mouseenter', $event)"
                        @item-mouseleave="emit('item-mouseleave')"
                      />
                      <span>{{ props.row.name }}</span>
                    </div>
                  </q-td>
                </template>
              </q-table>
            </div>
            <div v-if="catalystRows.length" class="q-mt-md">
              <div class="text-caption text-grey-8 q-mb-sm">
                {{ t('catalystInfo') }}
              </div>
              <q-table
                flat
                bordered
                dense
                row-key="id"
                :rows="catalystRows"
                :columns="leafColumns"
                :pagination="{ rowsPerPage: 0 }"
                hide-bottom
              >
                <template #body-cell-name="props">
                  <q-td :props="props">
                    <div class="row items-center q-gutter-sm">
                      <stack-view
                        v-if="props.row.itemId"
                        :content="{ kind: 'item', id: props.row.itemId, amount: 1 }"
                        :item-defs-by-key-hash="itemDefsByKeyHash"
                        variant="slot"
                        :show-name="false"
                        :show-subtitle="false"
                        @item-click="emit('item-click', $event)"
                        @item-mouseenter="emit('item-mouseenter', $event)"
                        @item-mouseleave="emit('item-mouseleave')"
                      />
                      <span>{{ props.row.name }}</span>
                    </div>
                  </q-td>
                </template>
              </q-table>
            </div>
            <div v-if="enhancedTreeResult?.totals" class="q-mt-md">
              <div class="text-caption text-grey-8 q-mb-sm">{{ t('totalConsumption') }}</div>
              <div class="row q-gutter-md">
                <div class="col">
                  <div class="text-caption text-grey-7">{{ t('powerUsage') }}</div>
                  <div class="text-body2">{{ totalPower }} kW</div>
                </div>
                <div class="col">
                  <div class="text-caption text-grey-7">{{ t('pollution') }}</div>
                  <div class="text-body2">{{ totalPollution }}{{ t('pollutionPerMinute') }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <q-dialog v-model="saveDialogOpen">
        <q-card style="min-width: 420px">
          <q-card-section class="row items-center q-gutter-sm">
            <div class="text-subtitle2">{{ t('saveSynthesisLine') }}</div>
            <q-space />
            <q-btn flat round icon="close" v-close-popup />
          </q-card-section>
          <q-card-section>
            <q-input
              dense
              filled
              :label="t('lineName')"
              :model-value="saveName"
              @update:model-value="(v) => (saveName = String(v ?? ''))"
            />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat :label="t('cancel')" color="grey-7" v-close-popup />
            <q-btn
              unelevated
              :label="t('save')"
              color="primary"
              :disable="!saveName.trim()"
              @click="confirmSave"
            />
          </q-card-actions>
        </q-card>
      </q-dialog>

      <line-width-curve-editor
        :open="lineWidthCurveDialogOpen"
        :model-value="lineWidthCurveConfig"
        @update:open="(v) => (lineWidthCurveDialogOpen = v)"
        @update:model-value="(v) => (lineWidthCurveConfig = v)"
      />
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { Dark, useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import type { ItemDef, ItemId, ItemKey, PackData, Stack } from 'src/jei/types';
import type { JeiIndex } from 'src/jei/indexing/buildIndex';
import { itemKeyHash } from 'src/jei/indexing/key';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { VueFlow, type Edge, type Node, MarkerType } from '@vue-flow/core';
import { MiniMap } from '@vue-flow/minimap';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';
import '@vue-flow/minimap/dist/style.css';
import RecipeViewer from './RecipeViewer.vue';
import StackView from './StackView.vue';
import LineWidthCurveEditor from './LineWidthCurveEditor.vue';
import QuantFlowView from './QuantFlowView.vue';
import LineFlowView from './LineFlowView.vue';
import { buildProductionLineModel } from 'src/jei/planner/productionLine';
import { buildQuantFlowModel } from 'src/jei/planner/quantFlow';
import {
  convertAmountPerMinuteToUnitValue,
  evaluateLineWidthCurve,
  type LineWidthCurveConfig,
} from 'src/jei/planner/lineWidthCurve';
import type {
  AdvancedPlannerViewState,
  PlannerInitialState,
  PlannerLiveState,
  PlannerNodePosition,
  PlannerSavePayload,
  PlannerTargetUnit,
} from 'src/jei/planner/plannerUi';
import {
  createPlannerShareData,
  parsePlannerShareJson,
  stringifyPlannerShareJson,
} from 'src/jei/planner/plannerShare';
import { DEFAULT_BELT_SPEED } from 'src/jei/planner/units';
import {
  autoPlanSelections,
  buildRequirementTree,
  buildEnhancedRequirementTree,
  computePlannerDecisions,
  extractRecipeStacks,
  type PlannerDecision,
  type RequirementNode,
  type EnhancedRequirementNode,
} from 'src/jei/planner/planner';
import { useKeyBindingsStore, keyBindingToString, type KeyAction } from 'src/stores/keybindings';
import { useSettingsStore } from 'src/stores/settings';

const { t } = useI18n();
const keyBindingsStore = useKeyBindingsStore();
const settingsStore = useSettingsStore();

const props = defineProps<{
  pack: PackData;
  index: JeiIndex;
  rootItemKey: ItemKey;
  itemDefsByKeyHash: Record<string, ItemDef>;
  getTagDisplayName: (tagId: string) => string;
  initialState?: PlannerInitialState | null;
  initialTab?: 'tree' | 'graph' | 'line' | 'calc' | 'quant' | null;
}>();

const beltSpeed = computed(() => {
  const items = props.pack?.items ?? [];
  const beltItem = items.find((item) =>
    Boolean(
      item.tags?.includes('belt') && (item as ItemDef & { belt?: { speed?: number } }).belt?.speed,
    ),
  );
  const speed = (beltItem as ItemDef & { belt?: { speed?: number } })?.belt?.speed;
  return Number.isFinite(speed) && (speed ?? 0) > 0 ? Number(speed) : DEFAULT_BELT_SPEED;
});

const emit = defineEmits<{
  (e: 'item-click', itemKey: ItemKey): void;
  (e: 'save-plan', payload: PlannerSavePayload): void;
  (e: 'share-plan', payload: PlannerSavePayload): void;
  (e: 'share-plan-json-url', payload: PlannerSavePayload): void;
  (e: 'state-change', payload: PlannerLiveState): void;
  (e: 'item-mouseenter', keyHash: string): void;
  (e: 'item-mouseleave'): void;
}>();

const selectedRecipeIdByItemKeyHash = ref<Map<string, string>>(new Map());
const selectedItemIdByTagId = ref<Map<string, ItemId>>(new Map());

const getTagDisplayName = (tagId: string): string => props.getTagDisplayName(tagId);

function labelWithShortcut(label: string, action: KeyAction) {
  return `${label} (${keyBindingToString(keyBindingsStore.getBinding(action))})`;
}

const $q = useQuasar();
const isMobilePlanner = computed(() => $q.screen.lt.md);
const treeTabLabel = computed(() =>
  isMobilePlanner.value ? t('treeStructure') : labelWithShortcut(t('treeStructure'), 'plannerTree'),
);
const graphTabLabel = computed(() =>
  isMobilePlanner.value ? t('nodeGraph') : labelWithShortcut(t('nodeGraph'), 'plannerGraph'),
);
const lineTabLabel = computed(() =>
  isMobilePlanner.value
    ? t('productionLine')
    : labelWithShortcut(t('productionLine'), 'plannerLine'),
);
const calcTabLabel = computed(() =>
  isMobilePlanner.value ? t('calculator') : labelWithShortcut(t('calculator'), 'plannerCalc'),
);
const quantTabLabel = computed(() =>
  isMobilePlanner.value
    ? t('quantificationView')
    : labelWithShortcut(t('quantificationView'), 'plannerQuant'),
);
const VALID_TARGET_UNITS = new Set<PlannerTargetUnit>([
  'items',
  'per_second',
  'per_minute',
  'per_hour',
]);

const activeTab = ref<'tree' | 'graph' | 'line' | 'calc' | 'quant'>('tree');
const targetAmount = ref(1);
const targetUnit = ref<'items' | 'per_second' | 'per_minute' | 'per_hour'>('per_minute');
const treeDisplayMode = ref<'list' | 'compact'>('list');
const collapsed = ref<Set<string>>(new Set());
const lineCollapseIntermediate = ref(true);
const lineWidthByRate = computed({
  get: () => settingsStore.lineWidthByRate,
  set: (v: boolean) => settingsStore.setLineWidthByRate(v),
});
const quantWidthByRate = ref(true);
const lineWidthCurveDialogOpen = ref(false);
const lineWidthCurveConfig = computed({
  get: () => settingsStore.lineWidthCurveConfig,
  set: (v: LineWidthCurveConfig) => settingsStore.setLineWidthCurveConfig(v),
});
const forcedRawItemKeyHashes = ref<Set<string>>(new Set());
const useProductRecovery = ref(false);
const hasManualSelectionOverride = ref(false);
const graphPageFull = ref(false);
const linePageFull = ref(false);
const quantPageFull = ref(false);
const graphShowFluids = ref(true);
const graphMergeRawMaterials = ref(false);

const selectedGraphNodeId = ref<string | null>(null);
const graphNodePositions = ref(new Map<string, { x: number; y: number }>());
const selectedLineNodeId = ref<string | null>(null);
const lineNodePositions = ref(new Map<string, { x: number; y: number }>());
const quantNodePositions = ref(new Map<string, { x: number; y: number }>());
const quantShowFluids = ref(true);

const graphFullscreen = ref(false);
const lineFullscreen = ref(false);
const quantFullscreen = ref(false);
const graphFlowWrapEl = ref<HTMLElement | null>(null);
const lineFlowWrapEl = ref<HTMLElement | null>(null);
const quantFlowWrapEl = ref<HTMLElement | null>(null);

const targetRatePresets = computed(() => {
  const preset = props.pack?.manifest?.planner?.targetRatePresets;
  const halfCandidate = Number(preset?.halfPerMinute);
  const fullCandidate = Number(preset?.fullPerMinute);
  return {
    halfPerMinute: Number.isFinite(halfCandidate) && halfCandidate > 0 ? halfCandidate : null,
    fullPerMinute: Number.isFinite(fullCandidate) && fullCandidate > 0 ? fullCandidate : null,
  };
});

const canApplyHalfRatePreset = computed(() => targetRatePresets.value.halfPerMinute !== null);
const canApplyFullRatePreset = computed(() => targetRatePresets.value.fullPerMinute !== null);

watch(
  isMobilePlanner,
  (mobile) => {
    if (mobile && treeDisplayMode.value === 'list') {
      treeDisplayMode.value = 'compact';
    }
  },
  { immediate: true },
);

function applyTargetRatePreset(kind: 'half' | 'full') {
  const targetValue =
    kind === 'half' ? targetRatePresets.value.halfPerMinute : targetRatePresets.value.fullPerMinute;
  if (targetValue === null) return;
  targetUnit.value = 'per_minute';
  targetAmount.value = targetValue;
}

function toggleGraphFullscreen() {
  if (!$q.fullscreen.isCapable) return;
  const el = graphFlowWrapEl.value;
  if (!el) return;
  $q.fullscreen.toggle(el).catch(() => undefined);
}

function toggleLineFullscreen() {
  if (!$q.fullscreen.isCapable) return;
  const el = lineFlowWrapEl.value;
  if (!el) return;
  $q.fullscreen.toggle(el).catch(() => undefined);
}

function toggleQuantFullscreen() {
  if (!$q.fullscreen.isCapable) return;
  const el = quantFlowWrapEl.value;
  if (!el) return;
  $q.fullscreen.toggle(el).catch(() => undefined);
}

function onLineNodeDragStop(evt: { node: Node }) {
  const next = new Map(lineNodePositions.value);
  next.set(evt.node.id, { ...evt.node.position });
  lineNodePositions.value = next;
}

function onQuantNodeDragStop(evt: { node: { id: string; position: { x: number; y: number } } }) {
  const next = new Map(quantNodePositions.value);
  next.set(evt.node.id, { ...evt.node.position });
  quantNodePositions.value = next;
}

function onGraphNodeDragStop(evt: { node: Node }) {
  const next = new Map(graphNodePositions.value);
  next.set(evt.node.id, { ...evt.node.position });
  graphNodePositions.value = next;
}

function handleFullscreenChange() {
  const activeEl = document.fullscreenElement;
  graphFullscreen.value = activeEl !== null && activeEl === graphFlowWrapEl.value;
  lineFullscreen.value = activeEl !== null && activeEl === lineFlowWrapEl.value;
  quantFullscreen.value = activeEl !== null && activeEl === quantFlowWrapEl.value;
}

onMounted(() => {
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  handleFullscreenChange();
});

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
});

// Unit options for the dropdown
const unitOptions = [
  { label: t('itemUnit'), value: 'items' },
  { label: t('itemsPerSecond'), value: 'per_second' },
  { label: t('itemsPerMinute'), value: 'per_minute' },
  { label: t('itemsPerHour'), value: 'per_hour' },
] as const;

function mapToRecord<V extends string>(m: Map<string, V>): Record<string, V> {
  return Object.fromEntries(m.entries()) as Record<string, V>;
}

function nodePositionMapToRecord(
  value: Map<string, PlannerNodePosition>,
): Record<string, PlannerNodePosition> {
  const out: Record<string, PlannerNodePosition> = {};
  value.forEach((pos, id) => {
    const x = Number(pos?.x);
    const y = Number(pos?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    out[id] = { x, y };
  });
  return out;
}

function recordToNodePositionMap(
  value: Record<string, PlannerNodePosition> | undefined,
): Map<string, PlannerNodePosition> {
  const out = new Map<string, PlannerNodePosition>();
  if (!value || typeof value !== 'object') return out;
  Object.entries(value).forEach(([id, pos]) => {
    const x = Number(pos?.x);
    const y = Number(pos?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    out.set(id, { x, y });
  });
  return out;
}

function buildSavedViewState(): AdvancedPlannerViewState {
  return {
    activeTab: activeTab.value,
    line: {
      collapseIntermediate: lineCollapseIntermediate.value,
      selectedNodeId: selectedLineNodeId.value,
      nodePositions: nodePositionMapToRecord(lineNodePositions.value),
    },
    quant: {
      showFluids: quantShowFluids.value,
      widthByRate: quantWidthByRate.value,
      nodePositions: nodePositionMapToRecord(quantNodePositions.value),
    },
  };
}

function applySavedViewState(viewState: AdvancedPlannerViewState | undefined): void {
  const activeTabValue = viewState?.activeTab;
  if (
    activeTabValue === 'tree' ||
    activeTabValue === 'graph' ||
    activeTabValue === 'line' ||
    activeTabValue === 'calc' ||
    activeTabValue === 'quant'
  ) {
    activeTab.value = activeTabValue;
  }

  const lineView = viewState?.line;
  if (typeof lineView?.collapseIntermediate === 'boolean') {
    lineCollapseIntermediate.value = lineView.collapseIntermediate;
  }
  selectedLineNodeId.value =
    typeof lineView?.selectedNodeId === 'string' ? lineView.selectedNodeId : null;
  lineNodePositions.value = recordToNodePositionMap(lineView?.nodePositions);

  const quantView = viewState?.quant;
  if (typeof quantView?.showFluids === 'boolean') {
    quantShowFluids.value = quantView.showFluids;
  }
  if (typeof quantView?.widthByRate === 'boolean') {
    quantWidthByRate.value = quantView.widthByRate;
  }
  quantNodePositions.value = recordToNodePositionMap(quantView?.nodePositions);
}

function isPlannerTargetUnit(value: unknown): value is PlannerTargetUnit {
  return typeof value === 'string' && VALID_TARGET_UNITS.has(value as PlannerTargetUnit);
}

async function copyText(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  window.prompt('请复制以下内容', text);
}

function buildCurrentPlanPayload(
  name = `${itemName(props.rootItemKey)} ${t('savedLines')}`,
): PlannerSavePayload {
  return {
    name,
    rootItemKey: props.rootItemKey,
    targetAmount: targetAmount.value,
    targetUnit: targetUnit.value,
    useProductRecovery: useProductRecovery.value,
    selectedRecipeIdByItemKeyHash: mapToRecord(selectedRecipeIdByItemKeyHash.value),
    selectedItemIdByTagId: mapToRecord(selectedItemIdByTagId.value as Map<string, ItemId>),
    forcedRawItemKeyHashes: Array.from(forcedRawItemKeyHashes.value),
    viewState: buildSavedViewState(),
  };
}

function loadSharedPlan(payload: PlannerSavePayload): void {
  selectedRecipeIdByItemKeyHash.value = new Map(
    Object.entries(payload.selectedRecipeIdByItemKeyHash ?? {}),
  );
  selectedItemIdByTagId.value = new Map(Object.entries(payload.selectedItemIdByTagId ?? {}));
  targetAmount.value = Number(payload.targetAmount) || 1;
  targetUnit.value = isPlannerTargetUnit(payload.targetUnit) ? payload.targetUnit : 'per_minute';
  useProductRecovery.value = payload.useProductRecovery === true;
  hasManualSelectionOverride.value = true;
  activeTab.value = 'tree';
  treeDisplayMode.value = 'list';
  collapsed.value = new Set();
  forcedRawItemKeyHashes.value = new Set(payload.forcedRawItemKeyHashes ?? []);
  applySavedViewState(payload.viewState);
  emitLiveState();
}

function shareAsUrl(): void {
  emit('share-plan', buildCurrentPlanPayload());
}

function shareByJsonUrl(): void {
  emit('share-plan-json-url', buildCurrentPlanPayload());
}

function copyShareJson(): void {
  const share = createPlannerShareData(props.pack.manifest.packId, buildCurrentPlanPayload());
  void copyText(stringifyPlannerShareJson(share))
    .then(() => {
      $q.notify({ type: 'positive', message: t('lineJsonCopied') });
    })
    .catch(() => {
      $q.notify({ type: 'negative', message: t('copyLineJsonFailed') });
    });
}

function importShareJson(): void {
  $q.dialog({
    title: t('importLineJsonTitle'),
    message: t('importLineJsonMessage'),
    prompt: {
      model: '',
      type: 'textarea',
    },
    cancel: true,
    ok: { label: t('import') },
  }).onOk((text: unknown) => {
    try {
      const share = parsePlannerShareJson(typeof text === 'string' ? text : '');
      if (share.packId !== props.pack.manifest.packId) {
        $q.notify({ type: 'negative', message: t('sharePackMismatch', { packId: share.packId }) });
        return;
      }
      if (share.plan.kind === 'advanced') {
        $q.notify({ type: 'negative', message: t('notAdvancedPlannerShare') });
        return;
      }
      loadSharedPlan(share.plan);
      $q.notify({ type: 'positive', message: t('lineJsonImported') });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      $q.notify({ type: 'negative', message });
    }
  });
}

function emitLiveState() {
  emit('state-change', {
    targetAmount: targetAmount.value,
    targetUnit: targetUnit.value,
    useProductRecovery: useProductRecovery.value,
    selectedRecipeIdByItemKeyHash: mapToRecord(selectedRecipeIdByItemKeyHash.value),
    selectedItemIdByTagId: mapToRecord(selectedItemIdByTagId.value as Map<string, ItemId>),
    forcedRawItemKeyHashes: Array.from(forcedRawItemKeyHashes.value),
    viewState: buildSavedViewState(),
  });
}

function applyInitialState() {
  const st = props.initialState;
  if (st) {
    selectedRecipeIdByItemKeyHash.value = new Map(
      Object.entries(st.selectedRecipeIdByItemKeyHash ?? {}),
    );
    selectedItemIdByTagId.value = new Map(Object.entries(st.selectedItemIdByTagId ?? {}));
    targetAmount.value = Number(st.targetAmount) || 1;
    targetUnit.value = isPlannerTargetUnit(st.targetUnit) ? st.targetUnit : 'per_minute';
    useProductRecovery.value = st.useProductRecovery === true;
    hasManualSelectionOverride.value = !st.loadKey.startsWith('auto:');
    activeTab.value = props.initialTab ?? 'tree';
    treeDisplayMode.value = 'list';
    collapsed.value = new Set();
    forcedRawItemKeyHashes.value = new Set(st.forcedRawItemKeyHashes ?? []);
    applySavedViewState(st.viewState);
    emitLiveState();
    return;
  }
  selectedRecipeIdByItemKeyHash.value = new Map();
  selectedItemIdByTagId.value = new Map();
  targetAmount.value = 1;
  targetUnit.value = 'per_minute';
  useProductRecovery.value = false;
  hasManualSelectionOverride.value = false;
  activeTab.value = props.initialTab ?? 'tree';
  treeDisplayMode.value = 'list';
  collapsed.value = new Set();
  forcedRawItemKeyHashes.value = new Set();
  selectedLineNodeId.value = null;
  lineNodePositions.value = new Map();
  quantNodePositions.value = new Map();
  emitLiveState();
}

watch(
  () => props.initialTab ?? null,
  (t) => {
    if (!t) return;
    activeTab.value = t;
  },
);

watch(
  () => [itemKeyHash(props.rootItemKey), props.initialState?.loadKey ?? ''] as const,
  () => applyInitialState(),
  { immediate: true },
);

watch(targetAmount, () => emitLiveState());
watch(targetUnit, () => emitLiveState());
watch(useProductRecovery, () => {
  if (!hasManualSelectionOverride.value) {
    const auto = autoPlanSelections({
      pack: props.pack,
      index: props.index,
      rootItemKey: props.rootItemKey,
      useProductRecovery: useProductRecovery.value,
    });
    selectedRecipeIdByItemKeyHash.value = new Map(
      Object.entries(auto.selectedRecipeIdByItemKeyHash),
    );
    selectedItemIdByTagId.value = new Map(Object.entries(auto.selectedItemIdByTagId));
  }
  emitLiveState();
});

const decisions = computed(() =>
  computePlannerDecisions({
    pack: props.pack,
    index: props.index,
    rootItemKey: props.rootItemKey,
    selectedRecipeIdByItemKeyHash: selectedRecipeIdByItemKeyHash.value,
    selectedItemIdByTagId: selectedItemIdByTagId.value,
    forcedRawItemKeyHashes: forcedRawItemKeyHashes.value,
  }),
);

const treeResult = computed(() => {
  if (decisions.value.length) return null;
  return buildRequirementTree({
    pack: props.pack,
    index: props.index,
    rootItemKey: props.rootItemKey,
    targetAmount: targetAmount.value,
    targetUnit: targetUnit.value,
    selectedRecipeIdByItemKeyHash: selectedRecipeIdByItemKeyHash.value,
    selectedItemIdByTagId: selectedItemIdByTagId.value,
    useProductRecovery: useProductRecovery.value,
    forcedRawItemKeyHashes: forcedRawItemKeyHashes.value,
  });
});

// Enhanced tree result with rate information
const enhancedTreeResult = computed(() => {
  if (decisions.value.length) return null;
  return buildEnhancedRequirementTree({
    pack: props.pack,
    index: props.index,
    rootItemKey: props.rootItemKey,
    targetAmount: targetAmount.value,
    selectedRecipeIdByItemKeyHash: selectedRecipeIdByItemKeyHash.value,
    selectedItemIdByTagId: selectedItemIdByTagId.value,
    useProductRecovery: useProductRecovery.value,
    forcedRawItemKeyHashes: forcedRawItemKeyHashes.value,
    targetUnit: targetUnit.value,
  });
});

function decisionKey(d: PlannerDecision) {
  if (d.kind === 'item_recipe') return `item:${d.itemKeyHash}`;
  return `tag:${d.tagId}`;
}

function itemName(key: ItemKey) {
  const def = props.itemDefsByKeyHash[itemKeyHash(key)];
  return def?.name ?? key.id;
}

function itemColorOfDef(def?: ItemDef): string | null {
  const fromDef = (def as { color?: string } | undefined)?.color?.trim();
  if (fromDef) return fromDef;
  const fromRarity = def?.rarity?.color?.trim();
  if (fromRarity) return fromRarity;
  const fromSprite = def?.iconSprite?.color?.trim();
  if (fromSprite) return fromSprite;
  return null;
}

function recoverySourceText(node: {
  recovery?: boolean;
  recoverySourceItemKey?: ItemKey;
  recoverySourceRecipeId?: string;
  recoverySourceRecipeTypeKey?: string;
}): string {
  if (!node.recovery) return '';
  const sourceItem = node.recoverySourceItemKey ? itemName(node.recoverySourceItemKey) : '';
  const sourceRecipe = node.recoverySourceRecipeTypeKey ?? node.recoverySourceRecipeId ?? '';
  if (sourceItem && sourceRecipe)
    return t('recoveredFrom', { source: `${sourceItem} (${sourceRecipe})` });
  if (sourceItem) return t('recoveredFrom', { source: sourceItem });
  if (sourceRecipe) return t('recoveredFrom', { source: sourceRecipe });
  return t('recovery');
}

function isForcedRawKey(key: ItemKey): boolean {
  return forcedRawItemKeyHashes.value.has(itemKeyHash(key));
}

function setForcedRawForKey(key: ItemKey, forced: boolean): void {
  const keyHash = itemKeyHash(key);
  const rootHash = itemKeyHash(props.rootItemKey);
  if (keyHash === rootHash) return;
  const next = new Set(forcedRawItemKeyHashes.value);
  if (forced) next.add(keyHash);
  else next.delete(keyHash);
  forcedRawItemKeyHashes.value = next;
}

function setForcedRawByKeyHash(keyHash: string, forced: boolean): void {
  const rootHash = itemKeyHash(props.rootItemKey);
  if (keyHash === rootHash) return;
  const next = new Set(forcedRawItemKeyHashes.value);
  if (forced) next.add(keyHash);
  else next.delete(keyHash);
  forcedRawItemKeyHashes.value = next;
}

function setForcedRawForItemId(itemId: string, forced: boolean): void {
  if (itemId === props.rootItemKey.id) return;
  if (forced) {
    setForcedRawForKey({ id: itemId }, true);
    return;
  }
  const next = new Set(forcedRawItemKeyHashes.value);
  Array.from(next).forEach((hash) => {
    const def = props.itemDefsByKeyHash[hash];
    const defId = def?.key?.id;
    if (defId === itemId || (!def && hash === itemKeyHash({ id: itemId }))) {
      next.delete(hash);
    }
  });
  next.delete(itemKeyHash({ id: itemId }));
  forcedRawItemKeyHashes.value = next;
}

function recipeOptionsForDecision(d: Extract<PlannerDecision, { kind: 'item_recipe' }>) {
  return d.recipeOptions.map((recipeId) => {
    const r = props.index.recipesById.get(recipeId);
    const recipeType = r ? props.index.recipeTypesByKey.get(r.type) : undefined;
    const label = r ? `${recipeType?.displayName ?? r.type}` : recipeId;
    const inputs: Stack[] = r ? extractRecipeStacks(r, recipeType).inputs : [];
    return { label, value: recipeId, inputs, recipe: r, recipeType };
  });
}

function tagItemOptions(d: Extract<PlannerDecision, { kind: 'tag_item' }>) {
  return d.candidateItemIds
    .map((itemId) => {
      const keyHashes = props.index.itemKeyHashesByItemId.get(itemId) ?? [];
      const keyHash = keyHashes[0];
      const def = keyHash ? props.itemDefsByKeyHash[keyHash] : undefined;
      const label = def?.name ? `${def.name} (${itemId})` : itemId;
      return { label, value: itemId };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

function setRecipeChoice(itemKeyHash: string, recipeId: string) {
  const next = new Map(selectedRecipeIdByItemKeyHash.value);
  next.set(itemKeyHash, recipeId);
  selectedRecipeIdByItemKeyHash.value = next;
  hasManualSelectionOverride.value = true;
  emitLiveState();
}

function setTagChoice(tagId: string, itemId: ItemId) {
  const next = new Map(selectedItemIdByTagId.value);
  next.set(tagId, itemId);
  selectedItemIdByTagId.value = next;
  hasManualSelectionOverride.value = true;
  emitLiveState();
}

function resetPlanner() {
  selectedRecipeIdByItemKeyHash.value = new Map();
  selectedItemIdByTagId.value = new Map();
  forcedRawItemKeyHashes.value = new Set();
  useProductRecovery.value = false;
  hasManualSelectionOverride.value = false;
  targetAmount.value = 1;
  targetUnit.value = 'per_minute';
  activeTab.value = 'tree';
  treeDisplayMode.value = 'list';
  collapsed.value = new Set();
  selectedLineNodeId.value = null;
  lineNodePositions.value = new Map();
  quantNodePositions.value = new Map();
  emitLiveState();
}

const saveDialogOpen = ref(false);
const saveName = ref('');

function openSaveDialog() {
  const base = itemName(props.rootItemKey);
  saveName.value = `${base} ${t('savedLines')}`;
  saveDialogOpen.value = true;
}

function confirmSave() {
  const payload = buildCurrentPlanPayload(saveName.value.trim());
  emit('save-plan', payload);
  saveDialogOpen.value = false;
}

function toggleCollapsed(nodeId: string) {
  const next = new Set(collapsed.value);
  if (next.has(nodeId)) next.delete(nodeId);
  else next.add(nodeId);
  collapsed.value = next;
}

type TreeRow = { node: RequirementNode | EnhancedRequirementNode; depth: number };

const treeRows = computed<TreeRow[]>(() => {
  const result = enhancedTreeResult.value || treeResult.value;
  if (!result) return [];
  const rows: TreeRow[] = [];

  const walk = (node: RequirementNode, depth: number) => {
    rows.push({ node, depth });
    if (node.kind !== 'item') return;
    if (collapsed.value.has(node.nodeId)) return;
    node.children.forEach((c) => walk(c, depth + 1));
  };

  walk(result.root as unknown as RequirementNode, 0);
  return rows;
});

type TreeListRow = {
  node: RequirementNode | EnhancedRequirementNode;
  connect: boolean[];
};

const treeListRows = computed<TreeListRow[]>(() => {
  const result = enhancedTreeResult.value || treeResult.value;
  if (!result) return [];
  const rows: TreeListRow[] = [];

  const walk = (node: RequirementNode, connect: boolean[]) => {
    rows.push({ node, connect });
    if (node.kind !== 'item') return;
    if (collapsed.value.has(node.nodeId)) return;
    node.children.forEach((c, idx) => walk(c, [...connect, idx !== node.children.length - 1]));
  };

  walk(result.root as unknown as RequirementNode, []);
  return rows;
});

const recoveryProducedByNodeId = computed(() => {
  const result = enhancedTreeResult.value || treeResult.value;
  const out = new Map<string, Array<{ itemKey: ItemKey; amount: number }>>();
  if (!result) return out;

  const byNodeAndItem = new Map<string, Map<string, { itemKey: ItemKey; amount: number }>>();
  const walk = (node: RequirementNode) => {
    if (node.kind !== 'item') return;
    if (node.recovery && node.recoverySourceNodeId) {
      const sourceNodeId = node.recoverySourceNodeId;
      const itemHash = itemKeyHash(node.itemKey);
      const bucket =
        byNodeAndItem.get(sourceNodeId) ?? new Map<string, { itemKey: ItemKey; amount: number }>();
      const prev = bucket.get(itemHash);
      if (prev) prev.amount += finiteOr(node.amount, 0);
      else bucket.set(itemHash, { itemKey: node.itemKey, amount: finiteOr(node.amount, 0) });
      byNodeAndItem.set(sourceNodeId, bucket);
    }
    node.children.forEach((c) => walk(c));
  };

  walk(result.root as unknown as RequirementNode);
  byNodeAndItem.forEach((bucket, nodeId) => {
    out.set(nodeId, Array.from(bucket.values()));
  });
  return out;
});

function recoveryProducedText(nodeId: string): string {
  const entries = recoveryProducedByNodeId.value.get(nodeId) ?? [];
  if (!entries.length) return '';
  return entries
    .map((entry) => `${itemName(entry.itemKey)} x${formatAmount(entry.amount)}`)
    .join('、');
}

const rateColumnLabel = computed(() => {
  if (targetUnit.value === 'items') return t('itemCount');
  if (targetUnit.value === 'per_second') return t('itemsPerSecond');
  if (targetUnit.value === 'per_hour') return t('itemsPerHour');
  return t('itemsPerMinute');
});

function finiteOr(n: unknown, fallback: number): number {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function nodeDisplayAmount(node: RequirementNode | EnhancedRequirementNode): number {
  return finiteOr(node.amount, 0);
}

function nodeDisplayRate(node: RequirementNode | EnhancedRequirementNode): number {
  const amount = nodeDisplayAmount(node);
  if (targetUnit.value === 'items') return amount;
  if (targetUnit.value === 'per_second') return amount / 60;
  if (targetUnit.value === 'per_hour') return amount * 60;
  return amount;
}

function displayRateFromAmount(amount: number): number {
  if (targetUnit.value === 'items') return amount;
  if (targetUnit.value === 'per_second') return amount / 60;
  if (targetUnit.value === 'per_hour') return amount * 60;
  return amount;
}

function unitSuffix() {
  if (targetUnit.value === 'per_second') return '/s';
  if (targetUnit.value === 'per_hour') return '/h';
  if (targetUnit.value === 'per_minute') return '/min';
  return '';
}

const LINE_EDGE_BASE_STROKE_WIDTH = 2;

function lineEdgeBaseWidthFromRate(amountPerMinute: number): number {
  if (!lineWidthByRate.value) return LINE_EDGE_BASE_STROKE_WIDTH;
  const cfg = lineWidthCurveConfig.value;
  const unitValue = convertAmountPerMinuteToUnitValue(
    finiteOr(amountPerMinute, 0),
    beltSpeed.value,
    cfg.unit,
  );
  return evaluateLineWidthCurve(unitValue, cfg);
}

function lineEdgeStrokeWidth(
  edge: Edge,
  emphasis: 'normal' | 'toRoot' | 'connected' | 'path' | 'fromLeaf',
): number {
  const base = finiteOr(
    (edge.style as { strokeWidth?: number } | undefined)?.strokeWidth,
    LINE_EDGE_BASE_STROKE_WIDTH,
  );
  if (emphasis === 'connected') return base + 1;
  if (emphasis === 'path') return base + 0.7;
  if (emphasis === 'toRoot') return base + 0.5;
  if (emphasis === 'fromLeaf') return base + 0.3;
  return base;
}

function formatMachineCountForDisplay(value: unknown): number {
  const v = finiteOr(value, 0);
  if (!Number.isFinite(v) || v <= 0) return 0;
  const decimals = Math.max(
    0,
    Math.min(4, Math.floor(finiteOr(settingsStore.machineCountDecimals, 0))),
  );
  if (decimals === 0) return Math.round(v);
  const factor = 10 ** decimals;
  return Math.round(v * factor) / factor;
}

function nodeBeltsText(node: RequirementNode | EnhancedRequirementNode): string {
  if (targetUnit.value === 'items') return '';
  if (node.kind !== 'item') return '';
  const perSecond = nodeDisplayAmount(node) / 60;
  const belts = perSecond / beltSpeed.value;
  if (!Number.isFinite(belts) || belts <= 0) return '';
  if (belts < 0.1) return '<0.1';
  return String(formatAmount(belts));
}

function nodeMachinesText(node: RequirementNode | EnhancedRequirementNode): string {
  if (node.kind !== 'item') return '';
  const meta = node as unknown as { machineCount?: unknown; machines?: unknown };
  const machineCount = finiteOr(meta.machineCount, 0);
  if (Number.isFinite(machineCount) && machineCount > 0) return String(Math.round(machineCount));
  const machines = finiteOr(meta.machines, 0);
  if (!Number.isFinite(machines) || machines <= 0) return '';
  return String(Math.ceil(machines - 1e-9));
}

function nodePowerText(node: RequirementNode | EnhancedRequirementNode): string {
  if (node.kind !== 'item') return '';
  const power = finiteOr((node as EnhancedRequirementNode & { kind: 'item' }).power, 0);
  if (!Number.isFinite(power) || power <= 0) return '';
  return `${formatAmount(power)} kW`;
}

function formatAmount(n: number) {
  if (!Number.isFinite(n)) return 0;
  const rounded = Math.round(n * 1000) / 1000;
  return rounded;
}

type FlowItemData = {
  itemKey: ItemKey;
  title: string;
  subtitle: string;
  cycle: boolean;
  cycleSeed: boolean;
  recovery?: boolean;
  recoverySource?: string;
  machineItemId?: string;
  machineName?: string;
  machineCount?: number;
};
type FlowFluidData = {
  title: string;
  subtitle: string;
};

type FlowItemNode = Omit<Extract<RequirementNode, { kind: 'item' }>, 'children'> & {
  children: FlowNode[];
} & Partial<Extract<EnhancedRequirementNode, { kind: 'item' }>>;

type FlowFluidNode = Extract<RequirementNode, { kind: 'fluid' }> &
  Partial<Extract<EnhancedRequirementNode, { kind: 'fluid' }>>;

type FlowNode = FlowItemNode | FlowFluidNode;

const flow = computed(() => {
  const result = enhancedTreeResult.value || treeResult.value;
  if (!result) return { nodes: [] as Node[], edges: [] as Edge[] };

  const root = result.root as unknown as FlowNode;

  const nodeW = 260;
  const nodeH = 56;
  const gapX = 28;
  const gapY = 40;
  const pad = 18;

  const nodes: Node[] = [];
  const layouts: Array<{ node: FlowNode; depth: number; x: number }> = [];
  const xById = new Map<string, number>();
  let nextX = 0;

  const layout = (node: FlowNode, depth: number): number => {
    if (xById.has(node.nodeId)) return xById.get(node.nodeId)!;

    let x: number;
    if (node.kind !== 'item' || node.children.length === 0) {
      x = nextX;
      nextX += 1;
    } else if (node.children.length === 1) {
      x = layout(node.children[0]!, depth + 1);
    } else {
      const childXs = node.children
        .map((c: FlowNode) => layout(c, depth + 1))
        .sort((a: number, b: number) => a - b);
      x = (childXs[0]! + childXs[childXs.length - 1]!) / 2;
    }

    xById.set(node.nodeId, x);
    layouts.push({ node, depth, x });
    return x;
  };

  layout(root, 0);
  layouts.sort((a, b) => a.depth - b.depth || a.x - b.x);

  layouts.forEach(({ node, depth, x }) => {
    const px = pad + x * (nodeW + gapX);
    const py = pad + depth * (nodeH + gapY);
    if (node.kind === 'item') {
      const machineCount = finiteOr(node.machineCount, 0);
      const unitSuffix =
        targetUnit.value === 'per_second'
          ? '/s'
          : targetUnit.value === 'per_hour'
            ? '/h'
            : targetUnit.value === 'per_minute'
              ? '/min'
              : '';
      const subtitle = unitSuffix
        ? `${formatAmount(nodeDisplayRate(node))}${unitSuffix}`
        : `${formatAmount(nodeDisplayAmount(node))}`;
      const recoverySource = node.recovery ? recoverySourceText(node) : '';
      nodes.push({
        id: node.nodeId,
        type: 'itemNode',
        position: { x: px, y: py },
        draggable: false,
        selectable: false,
        data: {
          itemKey: node.itemKey,
          title: itemName(node.itemKey),
          subtitle,
          cycle: node.cycle,
          cycleSeed: !!node.cycleSeed,
          ...(node.recovery ? { recovery: true, recoverySource } : {}),
          ...(node.machineItemId ? { machineItemId: node.machineItemId } : {}),
          ...(node.machineName ? { machineName: node.machineName } : {}),
          ...(machineCount > 0 ? { machineCount } : {}),
        } satisfies FlowItemData,
      });
    } else {
      nodes.push({
        id: node.nodeId,
        type: 'fluidNode',
        position: { x: px, y: py },
        draggable: false,
        selectable: false,
        data: {
          title: node.id,
          subtitle: `${formatAmount(node.amount)}${node.unit ?? ''}`,
        } satisfies FlowFluidData,
      });
    }
  });

  const recoverySourceKey = (recipeId: string, sourceItemKey: ItemKey, recipeTypeKey?: string) =>
    `${recipeId}|${itemKeyHash(sourceItemKey)}|${recipeTypeKey ?? ''}`;
  const sourceNodeIdsByRecoveryKey = new Map<string, string[]>();
  const collectRecoverySources = (node: FlowNode) => {
    if (node.kind !== 'item') return;
    if (!node.recovery && node.recipeIdUsed) {
      const key = recoverySourceKey(node.recipeIdUsed, node.itemKey, node.recipeTypeKeyUsed);
      const bucket = sourceNodeIdsByRecoveryKey.get(key) ?? [];
      bucket.push(node.nodeId);
      sourceNodeIdsByRecoveryKey.set(key, bucket);
    }
    node.children.forEach((child) => {
      if (child.kind === 'item') collectRecoverySources(child);
    });
  };
  collectRecoverySources(root);

  const edges: Edge[] = [];
  const recoveryEdgeKeys = new Set<string>();
  const walkEdges = (node: FlowNode) => {
    if (node.kind !== 'item') return;
    node.children.forEach((c: FlowNode, idx: number) => {
      // 过滤掉不可见的流体节点
      if (c.kind === 'fluid' && !graphShowFluids.value) return;
      edges.push({
        id: `${node.nodeId}->${c.nodeId}:${idx}`,
        source: node.nodeId,
        target: c.nodeId,
        zIndex: 2000,
        type: 'smoothstep',
      });
      if (c.kind === 'item' && c.recovery && c.recoverySourceRecipeId && c.recoverySourceItemKey) {
        const key = recoverySourceKey(
          c.recoverySourceRecipeId,
          c.recoverySourceItemKey,
          c.recoverySourceRecipeTypeKey,
        );
        const sourceCandidates = sourceNodeIdsByRecoveryKey.get(key) ?? [];
        const sourceNodeId = sourceCandidates.find((id) => id !== node.nodeId);
        if (sourceNodeId && sourceNodeId !== c.nodeId) {
          const recoveryEdgeKey = `${sourceNodeId}->${c.nodeId}`;
          if (!recoveryEdgeKeys.has(recoveryEdgeKey)) {
            recoveryEdgeKeys.add(recoveryEdgeKey);
            edges.push({
              id: `recovery:${recoveryEdgeKey}`,
              source: sourceNodeId,
              target: c.nodeId,
              zIndex: 1999,
              type: 'smoothstep',
              animated: true,
              style: {
                stroke: '#26a69a',
                strokeDasharray: '6 4',
              },
              label: 'recovery',
              labelBgPadding: [4, 2],
              labelBgBorderRadius: 4,
            });
          }
        }
      }
      walkEdges(c);
    });
  };
  walkEdges(root);

  // 合并原材料逻辑
  if (graphMergeRawMaterials.value) {
    const rawMaterialsMap = new Map<string, { nodes: FlowNode[]; totalAmount: number }>();
    const rawMaterialNodeIds = new Set<string>();

    const collectRawMaterials = (node: FlowNode) => {
      if (node.kind !== 'item') return;
      const visibleChildren = node.children.filter(
        (c: FlowNode) => c.kind !== 'fluid' || graphShowFluids.value,
      );
      const isRaw = visibleChildren.length === 0;

      if (isRaw) {
        const key = itemKeyHash(node.itemKey);
        rawMaterialNodeIds.add(node.nodeId);

        if (!rawMaterialsMap.has(key)) {
          rawMaterialsMap.set(key, { nodes: [], totalAmount: 0 });
        }
        const entry = rawMaterialsMap.get(key)!;
        entry.nodes.push(node);
        entry.totalAmount += nodeDisplayAmount(node);
      } else {
        visibleChildren.forEach((c: FlowNode) => collectRawMaterials(c));
      }
    };

    collectRawMaterials(root);

    // 创建合并后的节点并更新边
    const mergedNodeIdMap = new Map<string, string>();
    rawMaterialsMap.forEach((entry, key) => {
      const firstNode = entry.nodes[0]!;
      const mergedId = `merged:${key}`;

      // 为所有相同的原材料节点创建映射
      entry.nodes.forEach((n) => mergedNodeIdMap.set(n.nodeId, mergedId));

      // 替换第一个节点为合并节点
      const nodeIndex = nodes.findIndex((n) => n.id === firstNode.nodeId);
      if (nodeIndex !== -1) {
        const unitSuffix =
          targetUnit.value === 'per_second'
            ? '/s'
            : targetUnit.value === 'per_hour'
              ? '/h'
              : targetUnit.value === 'per_minute'
                ? '/min'
                : '';
        const subtitle = unitSuffix
          ? `${formatAmount(entry.totalAmount)}${unitSuffix}`
          : `${formatAmount(entry.totalAmount)}`;

        nodes[nodeIndex] = {
          ...nodes[nodeIndex]!,
          id: mergedId,
          data: {
            ...(nodes[nodeIndex]!.data as FlowItemData),
            subtitle,
          },
        };
      }

      // 移除其他重复的节点
      for (let i = 1; i < entry.nodes.length; i++) {
        const idx = nodes.findIndex((n) => n.id === entry.nodes[i]!.nodeId);
        if (idx !== -1) {
          nodes.splice(idx, 1);
        }
      }
    });

    // 更新边以指向合并后的节点
    edges.forEach((edge) => {
      if (mergedNodeIdMap.has(edge.target)) {
        edge.target = mergedNodeIdMap.get(edge.target)!;
      }
    });

    // 移除重复的边
    const uniqueEdges = new Map<string, Edge>();
    edges.forEach((edge) => {
      const key = `${edge.source}->${edge.target}`;
      if (!uniqueEdges.has(key)) {
        uniqueEdges.set(key, { ...edge, id: key });
      }
    });
    edges.length = 0;
    edges.push(...uniqueEdges.values());
  }

  return { nodes, edges };
});

const flowNodesStyled = computed(() => {
  return flow.value.nodes.map((node) => {
    const saved = graphNodePositions.value.get(node.id);
    return {
      ...node,
      draggable: true,
      selectable: true,
      ...(saved ? { position: saved } : {}),
    };
  });
});

const flowEdgesStyled = computed(() => {
  const selectedId = selectedGraphNodeId.value;
  if (!selectedId) {
    return flow.value.edges.map((edge) => ({
      ...edge,
      ...(edge.style !== undefined ? { style: edge.style } : {}),
      ...(edge.zIndex !== undefined ? { zIndex: edge.zIndex } : {}),
    }));
  }

  const outEdgesBySource = new Map<string, Edge[]>();
  const inEdgesByTarget = new Map<string, Edge[]>();
  flow.value.edges.forEach((edge) => {
    if (!outEdgesBySource.has(edge.source)) outEdgesBySource.set(edge.source, []);
    if (!inEdgesByTarget.has(edge.target)) inEdgesByTarget.set(edge.target, []);
    outEdgesBySource.get(edge.source)!.push(edge);
    inEdgesByTarget.get(edge.target)!.push(edge);
  });

  const downstreamEdgeIds = new Set<string>();
  const upstreamEdgeIds = new Set<string>();

  const walkDownstream = (start: string) => {
    const visited = new Set<string>();
    const queue = [start];
    visited.add(start);
    while (queue.length) {
      const cur = queue.shift()!;
      (outEdgesBySource.get(cur) ?? []).forEach((edge) => {
        downstreamEdgeIds.add(edge.id);
        if (!visited.has(edge.target)) {
          visited.add(edge.target);
          queue.push(edge.target);
        }
      });
    }
  };

  const walkUpstream = (start: string) => {
    const visited = new Set<string>();
    const queue = [start];
    visited.add(start);
    while (queue.length) {
      const cur = queue.shift()!;
      (inEdgesByTarget.get(cur) ?? []).forEach((edge) => {
        upstreamEdgeIds.add(edge.id);
        if (!visited.has(edge.source)) {
          visited.add(edge.source);
          queue.push(edge.source);
        }
      });
    }
  };

  walkDownstream(selectedId);
  walkUpstream(selectedId);

  return flow.value.edges.map((edge) => {
    const connected = edge.source === selectedId || edge.target === selectedId;
    const inPath = downstreamEdgeIds.has(edge.id) || upstreamEdgeIds.has(edge.id);
    const style = connected
      ? { ...(edge.style ?? {}), stroke: 'var(--q-primary)', strokeWidth: 3, opacity: 1 }
      : inPath
        ? { ...(edge.style ?? {}), stroke: 'var(--q-secondary)', strokeWidth: 2.5, opacity: 0.9 }
        : { ...(edge.style ?? {}), opacity: 0.2 };
    const result: Edge = {
      ...edge,
      style,
    };
    if (connected) {
      result.zIndex = 3000;
    } else if (inPath) {
      result.zIndex = 2500;
    } else if (edge.zIndex !== undefined) {
      result.zIndex = edge.zIndex;
    }
    return result;
  });
});

type LineFlowItemData = {
  itemKey: ItemKey;
  title: string;
  subtitle: string;
  isRoot: boolean;
  isSurplus?: boolean;
  forcedRaw: boolean;
  recovery?: boolean;
  recoverySource?: string;
  inPorts: number;
  outPorts: number;
};
type LineFlowMachineData = {
  title: string;
  subtitle: string;
  machineItemId?: string;
  machineCount?: number;
  outputItemKeys: ItemKey[];
  outputDetails?: {
    key: ItemKey;
    demanded: number;
    machineCountOwn: number;
    surplusRate: number;
    outputName?: string;
    demandedText: string;
    usedText?: string;
    producedText?: string;
    surplusText?: string;
  }[];
  inPorts: number;
  outPorts: number;
};
type LineFlowFluidData = {
  title: string;
  subtitle: string;
  inPorts: number;
  outPorts: number;
};
type LineFlowEdgeData = {
  kind: 'item' | 'fluid';
  itemKey?: ItemKey;
  fluidId?: string;
  recovery?: boolean;
  surplus?: boolean;
};

const lineFlow = computed(() => {
  const result = enhancedTreeResult.value || treeResult.value;
  if (!result) return { nodes: [] as Node[], edges: [] as Edge[] };

  const model = buildProductionLineModel({
    root: result.root as unknown as RequirementNode,
    rootItemKey: props.rootItemKey,
    includeCycleSeeds: targetUnit.value === 'items',
    collapseIntermediateItems: lineCollapseIntermediate.value,
  });

  const titleById = new Map<string, string>();
  const nodes: Node[] = model.nodes.map((n) => {
    if (n.kind === 'item') {
      const base = `${formatAmount(displayRateFromAmount(n.amount))}${unitSuffix()}`;
      const seed =
        targetUnit.value === 'items' && n.seedAmount && n.seedAmount > 0
          ? ` (seed ${formatAmount(n.seedAmount)})`
          : '';
      const subtitle = n.isSurplus ? `${t('redundancy')} +${base}` : `${base}${seed}`;
      const title = itemName(n.itemKey);
      const recoverySource = n.recovery ? recoverySourceText(n) : '';
      titleById.set(n.nodeId, title);
      return {
        id: n.nodeId,
        type: 'lineItemNode',
        position: { x: 0, y: 0 },
        draggable: false,
        selectable: false,
        data: {
          itemKey: n.itemKey,
          title,
          subtitle,
          isRoot: !!n.isRoot,
          ...(n.isSurplus ? { isSurplus: true } : {}),
          forcedRaw: !n.isSurplus && !n.recovery && isForcedRawKey(n.itemKey),
          ...(n.recovery ? { recovery: true, recoverySource } : {}),
          inPorts: 0,
          outPorts: 0,
        } satisfies LineFlowItemData,
      };
    }
    if (n.kind === 'fluid') {
      const subtitle = `${formatAmount(displayRateFromAmount(n.amount))}${unitSuffix()}${n.unit ?? ''}`;
      titleById.set(n.nodeId, n.id);
      return {
        id: n.nodeId,
        type: 'lineFluidNode',
        position: { x: 0, y: 0 },
        draggable: false,
        selectable: false,
        data: {
          title: n.id,
          subtitle,
          inPorts: 0,
          outPorts: 0,
        } satisfies LineFlowFluidData,
      };
    }

    const title = n.machineName ?? n.recipeTypeKey ?? n.recipeId;
    const primaryOut = n.outputItemKeys[0];
    const outName = primaryOut ? itemName(primaryOut) : title;
    const outputDetails = n.outputDetails ?? [];
    const totalProduced = outputDetails.reduce(
      (acc, d) => acc + d.demanded + Math.max(0, d.surplusRate),
      0,
    );
    const totalUsed = outputDetails.reduce((acc, d) => acc + d.demanded, 0);
    const subtitle =
      outputDetails.length > 0
        ? `${t('totalProduced')} ${formatAmount(displayRateFromAmount(totalProduced))}${unitSuffix()} / ${t('totalUsed')} ${formatAmount(displayRateFromAmount(totalUsed))}${unitSuffix()}`
        : `${outName} ${formatAmount(displayRateFromAmount(n.amount))}${unitSuffix()}`;
    titleById.set(n.nodeId, title);
    return {
      id: n.nodeId,
      type: 'lineMachineNode',
      position: { x: 0, y: 0 },
      draggable: false,
      selectable: false,
      data: {
        title,
        subtitle,
        ...(n.machineItemId ? { machineItemId: n.machineItemId } : {}),
        ...(n.machineCount !== undefined
          ? (() => {
              const machineCount = formatMachineCountForDisplay(n.machineCount);
              return machineCount > 0 ? { machineCount } : {};
            })()
          : {}),
        outputItemKeys: n.outputItemKeys,
        ...(n.outputDetails
          ? {
              outputDetails: n.outputDetails.map((d) => ({
                ...d,
                outputName: itemName(d.key),
                demandedText: `${formatAmount(displayRateFromAmount(d.demanded))}${unitSuffix()}`,
                usedText: `${formatAmount(displayRateFromAmount(d.demanded))}${unitSuffix()}`,
                producedText: `${formatAmount(displayRateFromAmount(d.demanded + Math.max(0, d.surplusRate)))}${unitSuffix()}`,
                ...(d.surplusRate > 1e-9
                  ? {
                      surplusText: `${formatAmount(displayRateFromAmount(d.surplusRate))}${unitSuffix()}`,
                    }
                  : {}),
              })),
            }
          : {}),
        inPorts: 0,
        outPorts: 0,
      } satisfies LineFlowMachineData,
    };
  });

  const edges: Edge[] = model.edges.map((e) => {
    const recovery = e.kind === 'item' && e.recovery;
    const surplus = e.kind === 'item' && e.surplus;
    const label = `${formatAmount(displayRateFromAmount(e.amount))}${unitSuffix()}${recovery ? ' ♻' : surplus ? ' □' : ''}`;
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      zIndex: 2000,
      type: 'default',
      curvature: 0.35,
      label,
      labelBgPadding: [6, 3],
      labelBgBorderRadius: 6,
      style: {
        strokeWidth: lineEdgeBaseWidthFromRate(e.amount),
        ...(recovery ? { stroke: '#26a69a', strokeDasharray: '6 4' } : {}),
        ...(surplus ? { stroke: '#f59e0b', strokeDasharray: '6 4', opacity: 0.75 } : {}),
      },
      data: {
        kind: e.kind,
        ...(e.kind === 'item' ? { itemKey: e.itemKey } : { fluidId: e.fluidId }),
        ...(recovery ? { recovery: true } : {}),
        ...(surplus ? { surplus: true } : {}),
      } satisfies LineFlowEdgeData,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 10,
        height: 10,
        markerUnits: 'userSpaceOnUse',
        strokeWidth: 1.5,
      },
    };
  });

  const inEdgesByTarget = new Map<string, Edge[]>();
  const outEdgesBySource = new Map<string, Edge[]>();
  nodes.forEach((n) => {
    inEdgesByTarget.set(n.id, []);
    outEdgesBySource.set(n.id, []);
  });
  edges.forEach((e) => {
    (outEdgesBySource.get(e.source) ?? []).push(e);
    (inEdgesByTarget.get(e.target) ?? []).push(e);
  });

  const MAX_PORTS = 10;
  nodes.forEach((n) => {
    const inList = inEdgesByTarget.get(n.id) ?? [];
    const outList = outEdgesBySource.get(n.id) ?? [];
    const inPorts = inList.length ? Math.min(MAX_PORTS, Math.max(1, inList.length)) : 0;
    const outPorts = outList.length ? Math.min(MAX_PORTS, Math.max(1, outList.length)) : 0;
    (n.data as LineFlowItemData | LineFlowMachineData | LineFlowFluidData).inPorts = inPorts;
    (n.data as LineFlowItemData | LineFlowMachineData | LineFlowFluidData).outPorts = outPorts;
  });

  const nodeW = 320;
  const nodeH = 64;
  const gapX = 60;
  const gapY = 34;
  const pad = 18;

  const ids = nodes.map((n) => n.id);
  const kindById = new Map<string, 'item' | 'fluid' | 'machine'>();
  nodes.forEach((n) => {
    if (n.type === 'lineMachineNode') kindById.set(n.id, 'machine');
    else if (n.type === 'lineFluidNode') kindById.set(n.id, 'fluid');
    else kindById.set(n.id, 'item');
  });

  const out = new Map<string, string[]>();
  const inp = new Map<string, string[]>();
  ids.forEach((id) => {
    out.set(id, []);
    inp.set(id, []);
  });
  edges.forEach((e) => {
    (out.get(e.source) ?? []).push(e.target);
    (inp.get(e.target) ?? []).push(e.source);
  });

  const tarjanIndex = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const st: string[] = [];
  let idx = 0;
  const comps: string[][] = [];

  const strongconnect = (v: string) => {
    tarjanIndex.set(v, idx);
    low.set(v, idx);
    idx += 1;
    st.push(v);
    onStack.add(v);

    (out.get(v) ?? []).forEach((w) => {
      if (!tarjanIndex.has(w)) {
        strongconnect(w);
        low.set(v, Math.min(low.get(v) ?? 0, low.get(w) ?? 0));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v) ?? 0, tarjanIndex.get(w) ?? 0));
      }
    });

    if ((low.get(v) ?? 0) === (tarjanIndex.get(v) ?? 0)) {
      const comp: string[] = [];
      while (st.length) {
        const w = st.pop()!;
        onStack.delete(w);
        comp.push(w);
        if (w === v) break;
      }
      comps.push(comp);
    }
  };

  ids.forEach((id) => {
    if (!tarjanIndex.has(id)) strongconnect(id);
  });

  const compById = new Map<string, number>();
  comps.forEach((c, i) => c.forEach((id) => compById.set(id, i)));
  const hasSelfLoop = new Set<number>();
  edges.forEach((e) => {
    const cs = compById.get(e.source);
    const ct = compById.get(e.target);
    if (cs !== undefined && ct !== undefined && cs === ct && e.source === e.target)
      hasSelfLoop.add(cs);
  });
  const cycleCompIds = new Set<number>();
  comps.forEach((c, i) => {
    if (c.length > 1) cycleCompIds.add(i);
    else if (hasSelfLoop.has(i)) cycleCompIds.add(i);
  });
  const cycleNodeIds = new Set<string>();
  cycleCompIds.forEach((cid) => comps[cid]!.forEach((id) => cycleNodeIds.add(id)));

  const mainIds = ids.filter((id) => !cycleNodeIds.has(id));

  const mainOut = new Map<string, string[]>();
  const mainInp = new Map<string, string[]>();
  mainIds.forEach((id) => {
    mainOut.set(id, []);
    mainInp.set(id, []);
  });
  edges.forEach((e) => {
    if (!mainOut.has(e.source) || !mainInp.has(e.target)) return;
    (mainOut.get(e.source) ?? []).push(e.target);
    (mainInp.get(e.target) ?? []).push(e.source);
  });

  const indeg = new Map<string, number>();
  mainIds.forEach((id) => indeg.set(id, (mainInp.get(id) ?? []).length));
  const queue = mainIds
    .filter((id) => (indeg.get(id) ?? 0) === 0)
    .sort((a, b) => (titleById.get(a) ?? a).localeCompare(titleById.get(b) ?? b));

  const topo: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    topo.push(id);
    (mainOut.get(id) ?? []).forEach((to) => {
      indeg.set(to, (indeg.get(to) ?? 0) - 1);
      if ((indeg.get(to) ?? 0) === 0) {
        queue.push(to);
        queue.sort((a, b) => (titleById.get(a) ?? a).localeCompare(titleById.get(b) ?? b));
      }
    });
  }
  const topoSet = new Set(topo);
  mainIds.forEach((id) => {
    if (!topoSet.has(id)) topo.push(id);
  });

  const layerById = new Map<string, number>();
  topo.forEach((id) => layerById.set(id, 0));
  topo.forEach((id) => {
    const base = layerById.get(id) ?? 0;
    (mainOut.get(id) ?? []).forEach((to) => {
      const prev = layerById.get(to) ?? 0;
      if (base + 1 > prev) layerById.set(to, base + 1);
    });
  });

  const maxLayer = Math.max(0, ...mainIds.map((id) => layerById.get(id) ?? 0));
  const idsByLayer = new Map<number, string[]>();
  for (let l = 0; l <= maxLayer; l += 1) idsByLayer.set(l, []);
  mainIds.forEach((id) => {
    const l = layerById.get(id) ?? 0;
    (idsByLayer.get(l) ?? []).push(id);
  });

  idsByLayer.forEach((list) =>
    list.sort((a, b) => (titleById.get(a) ?? a).localeCompare(titleById.get(b) ?? b)),
  );

  const orderIndex = new Map<string, number>();
  const refreshOrderIndex = () => {
    idsByLayer.forEach((list) => list.forEach((id, idx) => orderIndex.set(id, idx)));
  };
  refreshOrderIndex();

  const bary = (neighbors: string[]) => {
    if (!neighbors.length) return Number.POSITIVE_INFINITY;
    let sum = 0;
    let cnt = 0;
    neighbors.forEach((n) => {
      const v = orderIndex.get(n);
      if (v === undefined) return;
      sum += v;
      cnt += 1;
    });
    return cnt ? sum / cnt : Number.POSITIVE_INFINITY;
  };

  const stableSortBy = (list: string[], scoreFn: (id: string) => number) => {
    const withScore = list.map((id, idx) => ({ id, idx, s: scoreFn(id) }));
    withScore.sort((a, b) => a.s - b.s || a.idx - b.idx);
    return withScore.map((v) => v.id);
  };

  for (let pass = 0; pass < 4; pass += 1) {
    for (let l = 1; l <= maxLayer; l += 1) {
      const list = idsByLayer.get(l) ?? [];
      idsByLayer.set(
        l,
        stableSortBy(list, (id) => bary(mainInp.get(id) ?? [])),
      );
      refreshOrderIndex();
    }
    for (let l = maxLayer - 1; l >= 0; l -= 1) {
      const list = idsByLayer.get(l) ?? [];
      idsByLayer.set(
        l,
        stableSortBy(list, (id) => bary(mainOut.get(id) ?? [])),
      );
      refreshOrderIndex();
    }
  }

  const xById = new Map<string, number>();
  const X_GAP = 40;
  const minX = pad;
  ids.forEach((id) => xById.set(id, minX));
  const predsForX = new Map<string, string[]>();
  ids.forEach((id) => predsForX.set(id, []));
  edges.forEach((e) => {
    if (!mainIds.includes(e.source) || !mainIds.includes(e.target)) return;
    const ls = layerById.get(e.source) ?? 0;
    const lt = layerById.get(e.target) ?? 0;
    if (ls < lt) (predsForX.get(e.target) ?? []).push(e.source);
  });
  const mainTopo = topo.filter((id) => !cycleNodeIds.has(id));
  for (let iter = 0; iter < 2; iter += 1) {
    mainTopo.forEach((id) => {
      const preds = predsForX.get(id) ?? [];
      if (!preds.length) return;
      const maxPredX = Math.max(...preds.map((p) => xById.get(p) ?? minX));
      const next = Math.max(minX, maxPredX + nodeW + X_GAP);
      xById.set(id, next);
    });
  }

  nodes.forEach((n) => {
    if (cycleNodeIds.has(n.id)) return;
    const l = layerById.get(n.id) ?? 0;
    const list = idsByLayer.get(l) ?? [];
    const idx = list.indexOf(n.id);
    n.position = {
      x: xById.get(n.id) ?? pad + l * (nodeW + gapX),
      y: pad + idx * (nodeH + gapY),
    };
  });

  const nodeById = new Map(nodes.map((n) => [n.id, n] as const));

  const relaxYByLayer = (passes: number) => {
    const minGap = nodeH + gapY;
    for (let pass = 0; pass < passes; pass += 1) {
      idsByLayer.forEach((list) => {
        const desired = list.map((id) => {
          const neighbors = [...(mainInp.get(id) ?? []), ...(mainOut.get(id) ?? [])].filter(
            (nId) => !cycleNodeIds.has(nId),
          );
          const avgY = neighbors.length
            ? neighbors.reduce((s, nId) => s + (nodeById.get(nId)?.position.y ?? 0), 0) /
              neighbors.length
            : (nodeById.get(id)?.position.y ?? pad);
          return { id, desired: avgY };
        });

        desired.sort((a, b) => a.desired - b.desired);

        let y = pad;
        desired.forEach((d) => {
          const n = nodeById.get(d.id);
          if (!n) return;
          y = Math.max(y, d.desired);
          n.position.y = y;
          y += minGap;
        });
      });
    }
  };

  relaxYByLayer(2);

  const cycleComponents = Array.from(cycleCompIds.values())
    .map((cid) => comps[cid]!)
    .filter((c) => c.length);

  const outWithin = new Map<string, string[]>();
  cycleNodeIds.forEach((id) => outWithin.set(id, []));
  edges.forEach((e) => {
    if (!cycleNodeIds.has(e.source) || !cycleNodeIds.has(e.target)) return;
    (outWithin.get(e.source) ?? []).push(e.target);
  });

  const occupied: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];

  const intersects = (
    a: { x0: number; y0: number; x1: number; y1: number },
    b: { x0: number; y0: number; x1: number; y1: number },
  ) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

  let fallbackY = pad;
  const leftLaneX = pad - (nodeW + 140);
  const cycleWithConsumerY = cycleComponents.map((comp) => {
    const compSet = new Set(comp);
    const consumerCenters: Array<{ x: number; y: number }> = [];
    edges.forEach((e) => {
      if (!compSet.has(e.source) || compSet.has(e.target)) return;
      const t = nodeById.get(e.target);
      if (!t) return;
      if (cycleNodeIds.has(t.id)) return;
      consumerCenters.push({
        x: t.position.x + nodeW / 2,
        y: t.position.y + nodeH / 2,
      });
    });
    const avgY = consumerCenters.length
      ? consumerCenters.reduce((s, p) => s + p.y, 0) / consumerCenters.length
      : null;
    return { comp, avgY };
  });

  cycleWithConsumerY
    .sort((a, b) => {
      if (a.avgY === null && b.avgY === null) return a.comp.length - b.comp.length;
      if (a.avgY === null) return 1;
      if (b.avgY === null) return -1;
      return a.avgY - b.avgY;
    })
    .forEach(({ comp, avgY }) => {
      const compSet = new Set(comp);
      const start = comp
        .slice()
        .sort((a, b) => (titleById.get(a) ?? a).localeCompare(titleById.get(b) ?? b))[0]!;
      const order: string[] = [];
      const seen = new Set<string>();
      let cur: string | null = start;
      while (cur && !seen.has(cur) && order.length < comp.length) {
        order.push(cur);
        seen.add(cur);
        const nexts: string[] = (outWithin.get(cur) ?? []).filter(
          (t: string) => compSet.has(t) && !seen.has(t),
        );
        cur = nexts.length ? nexts[0]! : null;
      }
      comp.forEach((id) => {
        if (!seen.has(id)) order.push(id);
      });

      const r = Math.max(160, order.length * 24);

      const centerX = leftLaneX;
      let centerY = avgY ?? fallbackY + r + nodeH / 2;

      const ringBox = (cx: number, cy: number) => ({
        x0: cx - r,
        y0: cy - r,
        x1: cx + r + nodeW,
        y1: cy + r + nodeH,
      });

      let box = ringBox(centerX, centerY);
      for (let tries = 0; tries < 80; tries += 1) {
        const hit = occupied.find((b) => intersects(box, b));
        if (!hit) break;
        centerY = hit.y1 + 30 + r + nodeH / 2;
        box = ringBox(centerX, centerY);
      }
      occupied.push(box);
      order.forEach((id, i) => {
        const n = nodeById.get(id);
        if (!n) return;
        const t = (i / order.length) * Math.PI * 2;
        n.position = {
          x: centerX + Math.cos(t) * r,
          y: centerY + Math.sin(t) * r,
        };
      });

      if (avgY === null) fallbackY = box.y1 + 90;
    });
  const saved = lineNodePositions.value;
  if (saved.size) {
    nodes.forEach((n) => {
      const pos = saved.get(n.id);
      if (pos) n.position = { ...pos };
    });
  }

  const posById = new Map(nodes.map((n) => [n.id, n.position] as const));
  nodes.forEach((n) => {
    const nx = posById.get(n.id)?.x ?? 0;
    const inList = (inEdgesByTarget.get(n.id) ?? []).slice().sort((a, b) => {
      const ay = posById.get(a.source)?.y ?? 0;
      const by = posById.get(b.source)?.y ?? 0;
      if (ay !== by) return ay - by;
      const ax = posById.get(a.source)?.x ?? 0;
      const bx = posById.get(b.source)?.x ?? 0;
      return Math.abs(bx - nx) - Math.abs(ax - nx);
    });
    const outList = (outEdgesBySource.get(n.id) ?? []).slice().sort((a, b) => {
      const ay = posById.get(a.target)?.y ?? 0;
      const by = posById.get(b.target)?.y ?? 0;
      if (ay !== by) return ay - by;
      const ax = posById.get(a.target)?.x ?? 0;
      const bx = posById.get(b.target)?.x ?? 0;
      return Math.abs(bx - nx) - Math.abs(ax - nx);
    });
    inList.forEach((e, idx) => {
      e.targetHandle = `t${idx % MAX_PORTS}`;
    });
    outList.forEach((e, idx) => {
      e.sourceHandle = `s${idx % MAX_PORTS}`;
    });
  });

  return { nodes, edges };
});

const lineFlowNodes = computed(() => lineFlow.value.nodes.map((n) => ({ ...n, draggable: true })));
const selectedLineItemData = computed<LineFlowItemData | null>(() => {
  const selectedId = selectedLineNodeId.value;
  if (!selectedId) return null;
  const node = lineFlowNodes.value.find((n) => n.id === selectedId && n.type === 'lineItemNode');
  if (!node) return null;
  return node.data as LineFlowItemData;
});
const selectedLineItemForcedRaw = computed(() => {
  const node = selectedLineItemData.value;
  if (!node) return false;
  return isForcedRawKey(node.itemKey);
});
function setSelectedLineItemForcedRaw(forced: boolean) {
  const node = selectedLineItemData.value;
  if (!node || node.isRoot) return;
  setForcedRawForKey(node.itemKey, forced);
}
const lineFlowEdges = computed(() => lineFlow.value.edges);
function lineEdgeBaseStroke(edge: Edge): string | null {
  const data = (edge.data ?? {}) as Partial<LineFlowEdgeData>;
  if (data.kind === 'fluid') return '#0ea5e9';
  if (data.kind === 'item' && data.itemKey) {
    const color = itemColorOfDef(props.itemDefsByKeyHash[itemKeyHash(data.itemKey)]);
    if (color) return color;
  }
  return null;
}
const lineFlowEdgesStyled = computed(() => {
  const selectedId = selectedLineNodeId.value;
  const edges = lineFlowEdges.value;
  const nodes = lineFlowNodes.value;
  if (!selectedId) {
    return edges.map((edge) => ({
      ...edge,
      style: {
        ...(edge.style ?? {}),
        ...(settingsStore.lineIntermediateColoring
          ? (() => {
              const stroke = lineEdgeBaseStroke(edge);
              return stroke ? { stroke } : {};
            })()
          : {}),
        strokeWidth: lineEdgeStrokeWidth(edge, 'normal'),
      },
      ...(edge.zIndex !== undefined ? { zIndex: edge.zIndex } : {}),
    }));
  }

  const outEdgesBySource = new Map<string, Edge[]>();
  const inEdgesByTarget = new Map<string, Edge[]>();
  edges.forEach((edge) => {
    if (!outEdgesBySource.has(edge.source)) outEdgesBySource.set(edge.source, []);
    if (!inEdgesByTarget.has(edge.target)) inEdgesByTarget.set(edge.target, []);
    outEdgesBySource.get(edge.source)!.push(edge);
    inEdgesByTarget.get(edge.target)!.push(edge);
  });

  const downstreamEdgeIds = new Set<string>();
  const upstreamEdgeIds = new Set<string>();
  const downstreamNodeIds = new Set<string>();

  const walkDownstream = (start: string) => {
    const visited = new Set<string>();
    const queue = [start];
    visited.add(start);
    downstreamNodeIds.add(start);
    while (queue.length) {
      const cur = queue.shift()!;
      (outEdgesBySource.get(cur) ?? []).forEach((edge) => {
        downstreamEdgeIds.add(edge.id);
        if (!visited.has(edge.target)) {
          visited.add(edge.target);
          downstreamNodeIds.add(edge.target);
          queue.push(edge.target);
        }
      });
    }
  };

  const walkUpstream = (start: string) => {
    const visited = new Set<string>();
    const queue = [start];
    visited.add(start);
    while (queue.length) {
      const cur = queue.shift()!;
      (inEdgesByTarget.get(cur) ?? []).forEach((edge) => {
        upstreamEdgeIds.add(edge.id);
        if (!visited.has(edge.source)) {
          visited.add(edge.source);
          queue.push(edge.source);
        }
      });
    }
  };

  walkDownstream(selectedId);
  walkUpstream(selectedId);

  const rootItemIds = new Set(
    nodes
      .filter((n) => n.type === 'lineItemNode' && (n.data as LineFlowItemData).isRoot)
      .map((n) => n.id),
  );
  const itemIds = new Set(nodes.filter((n) => n.type === 'lineItemNode').map((n) => n.id));
  const incomingFromMachine = new Set<string>();
  edges.forEach((e) => {
    if (e.source.startsWith('m:') && itemIds.has(e.target)) incomingFromMachine.add(e.target);
  });
  const leafItemIds = new Set(Array.from(itemIds).filter((id) => !incomingFromMachine.has(id)));

  return edges.map((edge) => {
    const connected = edge.source === selectedId || edge.target === selectedId;
    const inPath = downstreamEdgeIds.has(edge.id) || upstreamEdgeIds.has(edge.id);
    const toRoot = rootItemIds.has(edge.target) && downstreamNodeIds.has(edge.target);
    const fromLeaf = leafItemIds.has(edge.source);

    const style = toRoot
      ? {
          ...(edge.style ?? {}),
          stroke: '#7e57c2',
          strokeWidth: lineEdgeStrokeWidth(edge, 'toRoot'),
          opacity: 0.95,
        }
      : connected
        ? {
            ...(edge.style ?? {}),
            stroke: 'var(--q-primary)',
            strokeWidth: lineEdgeStrokeWidth(edge, 'connected'),
            opacity: 1,
          }
        : inPath
          ? {
              ...(edge.style ?? {}),
              stroke: 'var(--q-secondary)',
              strokeWidth: lineEdgeStrokeWidth(edge, 'path'),
              opacity: 0.9,
            }
          : fromLeaf
            ? {
                ...(edge.style ?? {}),
                stroke: '#f9a825',
                strokeWidth: lineEdgeStrokeWidth(edge, 'fromLeaf'),
                opacity: 0.85,
              }
            : {
                ...(edge.style ?? {}),
                strokeWidth: lineEdgeStrokeWidth(edge, 'normal'),
                opacity: 0.2,
              };

    return {
      ...edge,
      style,
      ...(edge.zIndex !== undefined ? { zIndex: edge.zIndex } : {}),
    };
  });
});

const quantModel = computed(() => {
  const result = enhancedTreeResult.value || treeResult.value;
  if (!result) return { nodes: [], edges: [] };
  return buildQuantFlowModel({
    root: result.root as unknown as RequirementNode,
    rootItemKey: props.rootItemKey,
    includeFluids: quantShowFluids.value,
  });
});

const leafColumns = [
  { name: 'name', label: t('item'), field: 'name', align: 'left' as const },
  { name: 'amount', label: t('itemCount'), field: 'amount', align: 'right' as const },
  { name: 'id', label: 'ID', field: 'id', align: 'left' as const },
];

type LeafRow = { id: string; itemId?: string; name: string; amount: number };

const catalystRows = computed<LeafRow[]>(() => {
  const result = treeResult.value;
  if (!result) return [];
  const rows: LeafRow[] = [];
  result.catalysts.forEach((amount, itemId) => {
    const keyHashes = props.index.itemKeyHashesByItemId.get(itemId) ?? [];
    const keyHash = keyHashes[0];
    const def = keyHash ? props.itemDefsByKeyHash[keyHash] : undefined;
    rows.push({
      id: itemId,
      itemId: itemId,
      name: def?.name ?? itemId,
      amount: formatAmount(amount),
    });
  });
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
});

// Enhanced columns with rate information
const leafColumnsWithRates = [
  { name: 'name', label: t('item'), field: 'name', align: 'left' as const },
  { name: 'amount', label: t('itemCount'), field: 'amount', align: 'right' as const },
  { name: 'rate', label: t('ratePerMinute'), field: 'rate', align: 'right' as const },
  { name: 'id', label: 'ID', field: 'id', align: 'left' as const },
];

type LeafRowWithRate = { id: string; itemId?: string; name: string; amount: number; rate: number };

const leafRowsWithRates = computed<LeafRowWithRate[]>(() => {
  const result = enhancedTreeResult.value || treeResult.value;
  if (!result) return [];
  const rows: LeafRowWithRate[] = [];
  const leafAmounts = new Map<string, number>();
  const leafRates = new Map<string, number>();

  // Walk the tree and collect leaf nodes (items with no children)
  const walkLeaves = (node: RequirementNode | EnhancedRequirementNode) => {
    if (node.kind === 'item') {
      if (node.children.length === 0) {
        // This is a leaf item
        const itemId = node.itemKey.id;
        const amount = nodeDisplayAmount(node);
        const prevAmount = leafAmounts.get(itemId) ?? 0;
        leafAmounts.set(itemId, prevAmount + amount);

        if ('perMinute' in node && node.perMinute !== undefined) {
          const prevRate = leafRates.get(itemId) ?? 0;
          leafRates.set(itemId, prevRate + node.perMinute);
        }
      } else {
        // Recurse into children
        node.children.forEach((c) => walkLeaves(c));
      }
    }
  };
  walkLeaves(result.root);

  // Convert to rows
  leafAmounts.forEach((amount, itemId) => {
    const keyHashes = props.index.itemKeyHashesByItemId.get(itemId) ?? [];
    const keyHash = keyHashes[0];
    const def = keyHash ? props.itemDefsByKeyHash[keyHash] : undefined;

    let rate = 0;
    if (targetUnit.value === 'items') {
      rate = leafRates.get(itemId) ?? 0;
    } else {
      rate = amount;
    }

    rows.push({
      id: itemId,
      itemId: itemId,
      name: def?.name ?? itemId,
      amount: formatAmount(amount),
      rate: rate > 0 ? formatAmount(rate) : 0,
    });
  });
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
});

const intermediateColumnsWithRates = [
  { name: 'name', label: t('item'), field: 'name', align: 'left' as const },
  { name: 'amount', label: t('itemCount'), field: 'amount', align: 'right' as const },
  { name: 'rate', label: t('ratePerMinute'), field: 'rate', align: 'right' as const },
  { name: 'id', label: 'ID', field: 'id', align: 'left' as const },
  { name: 'action', label: t('action'), field: 'action', align: 'right' as const },
];

type IntermediateRowWithRate = {
  id: string;
  itemId: string;
  name: string;
  amount: number;
  rate: number;
  forcedRaw: boolean;
};

const forcedRawColumnsWithRates = [
  { name: 'name', label: t('item'), field: 'name', align: 'left' as const },
  { name: 'amount', label: t('itemCount'), field: 'amount', align: 'right' as const },
  { name: 'rate', label: t('ratePerMinute'), field: 'rate', align: 'right' as const },
  { name: 'action', label: t('action'), field: 'action', align: 'right' as const },
];

type ForcedRawRowWithRate = {
  keyHash: string;
  itemKey: ItemKey;
  name: string;
  amount: number;
  rate: number;
};

const intermediateRowsWithRates = computed<IntermediateRowWithRate[]>(() => {
  const result = enhancedTreeResult.value || treeResult.value;
  if (!result) return [];
  const amounts = new Map<string, number>();
  const rates = new Map<string, number>();

  const walk = (node: RequirementNode | EnhancedRequirementNode, isRoot: boolean) => {
    if (node.kind !== 'item') return;
    const key = node.itemKey.id;
    const forcedRaw = isForcedRawKey(node.itemKey);
    const isIntermediate = !isRoot && node.children.length > 0 && !node.cycleSeed && !forcedRaw;
    if (isIntermediate) {
      amounts.set(key, (amounts.get(key) ?? 0) + nodeDisplayAmount(node));
      rates.set(key, (rates.get(key) ?? 0) + nodeDisplayRate(node));
    }
    node.children.forEach((child) => walk(child, false));
  };

  walk(result.root, true);

  const rows = Array.from(amounts.entries()).map(([itemId, amount]) => {
    const keyHashes = props.index.itemKeyHashesByItemId.get(itemId) ?? [];
    const keyHash = keyHashes[0];
    const def = keyHash ? props.itemDefsByKeyHash[keyHash] : undefined;
    return {
      id: itemId,
      itemId,
      name: def?.name ?? itemId,
      amount: formatAmount(amount),
      rate: formatAmount(rates.get(itemId) ?? 0),
      forcedRaw: isForcedRawKey({ id: itemId }),
    };
  });
  rows.sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name));
  return rows;
});

const forcedRawRowsWithRates = computed<ForcedRawRowWithRate[]>(() => {
  const result = enhancedTreeResult.value || treeResult.value;
  if (!result) return [];

  const rowsByHash = new Map<string, ForcedRawRowWithRate>();

  const walk = (node: RequirementNode | EnhancedRequirementNode) => {
    if (node.kind !== 'item') return;
    if (isForcedRawKey(node.itemKey)) {
      const hash = itemKeyHash(node.itemKey);
      const prev = rowsByHash.get(hash);
      if (prev) {
        prev.amount = formatAmount(prev.amount + nodeDisplayAmount(node));
        prev.rate = formatAmount(prev.rate + nodeDisplayRate(node));
      } else {
        const def = props.itemDefsByKeyHash[hash];
        rowsByHash.set(hash, {
          keyHash: hash,
          itemKey: node.itemKey,
          name: def?.name ?? node.itemKey.id,
          amount: formatAmount(nodeDisplayAmount(node)),
          rate: formatAmount(nodeDisplayRate(node)),
        });
      }
    }
    node.children.forEach((child) => walk(child));
  };

  walk(result.root);

  return Array.from(rowsByHash.values())
    .filter((r) => r.keyHash !== itemKeyHash(props.rootItemKey))
    .sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name));
});

// Machine columns and rows
const machineColumns = [
  { name: 'name', label: t('equipment'), field: 'name', align: 'left' as const },
  { name: 'count', label: t('itemCount'), field: 'count', align: 'right' as const },
];

type MachineRow = { id: string; name: string; count: number };

const machineRows = computed<MachineRow[]>(() => {
  const enhanced = enhancedTreeResult.value;
  if (!enhanced?.totals?.machines) return [];
  const rows: MachineRow[] = [];
  enhanced.totals.machines.forEach((count, machineId) => {
    const keyHashes = props.index.itemKeyHashesByItemId.get(machineId) ?? [];
    const keyHash = keyHashes[0];
    const def = keyHash ? props.itemDefsByKeyHash[keyHash] : undefined;
    rows.push({
      id: machineId,
      name: def?.name ?? machineId,
      count: count > 0 ? formatAmount(count) : 0,
    });
  });
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
});

// Power and pollution totals
const totalPower = computed(() => {
  const enhanced = enhancedTreeResult.value;
  if (!enhanced?.totals?.power) return '0';
  return formatAmount(enhanced.totals.power);
});

const totalPollution = computed(() => {
  const enhanced = enhancedTreeResult.value;
  if (!enhanced?.totals?.pollution) return '0';
  return formatAmount(enhanced.totals.pollution);
});

// Flow background pattern color based on dark mode
const flowBackgroundPatternColor = computed(() =>
  Dark.isActive ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.12)',
);
</script>

<style scoped>
.planner {
  width: 100%;
  min-width: 0;
  overflow-x: hidden;
}

.planner__card,
.planner__tabs,
.planner__pagefull {
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.planner__toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.planner__toolbar-title {
  min-width: 0;
}

.planner__toolbar-spacer {
  flex: 1 1 auto;
}

.planner__header-action,
.planner__view-action {
  flex: 0 0 auto;
}

.planner__toolbar > * {
  min-width: 0;
  max-width: 100%;
}

.planner__target-amount {
  flex: 0 0 120px;
}

.planner__target-unit {
  flex: 0 0 100px;
}

.planner__preset-group,
.planner__mode-toggle,
.planner__renderer-toggle {
  flex: 0 0 auto;
  max-width: 100%;
}

.planner__decision {
  border-left: 4px solid rgba(0, 0, 0, 0.08);
  padding-left: 10px;
}

.planner__recipe-option-inputs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-top: 6px;
}

.planner__recipe-option-more {
  align-self: center;
}

.monospace {
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
  font-variant-numeric: tabular-nums;
}

.planner__tree-table {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  overflow: hidden;
}

.planner__tree-table-header,
.planner__tree-table-row {
  display: flex;
  align-items: center;
}

.planner__tree-table-header {
  background: rgba(0, 0, 0, 0.04);
  font-size: 12px;
  font-weight: 600;
}

.planner__tree-table-row {
  min-height: 46px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.planner__tree-col {
  padding: 8px 10px;
  min-width: 0;
}

.planner__tree-col--tree {
  flex: 1 1 auto;
  overflow: hidden;
}

.planner__tree-col--rate {
  flex: 0 0 110px;
}

.planner__tree-col--belts {
  flex: 0 0 90px;
}

.planner__tree-col--machines {
  flex: 0 0 140px;
}

.planner__tree-col--power {
  flex: 0 0 110px;
}

.planner__links {
  display: flex;
  align-items: center;
  min-width: 0;
  height: 46px;
  overflow: hidden;
}

.planner__connect {
  position: relative;
  margin-left: 12px;
  height: 100vh;
}

.planner__connect--last,
.planner__connect--trail {
  border-left: 2px dotted rgba(0, 0, 0, 0.35);
}

.planner__connect--last:not(.planner__connect--trail) {
  margin-bottom: 50vh;
  height: 50vh;
}

.planner__connect + .planner__connect {
  margin-left: 18px;
}

.planner__tree-toggle {
  display: flex;
  align-items: center;
  width: 28px;
}

.planner__tree-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
}

.planner__tree-name {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1 1 auto;
  padding-left: 8px;
}

.planner__tree-name-main {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.planner__tree-name-sub {
  line-height: 1.1;
}

.planner__machines-cell {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}

.planner__machines-text {
  min-width: 0;
}

.planner__tree-table-footer {
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(0, 0, 0, 0.02);
}

.planner__tree-footer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
}

.planner__tree-footer-label {
  font-size: 12px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.72);
}

.planner__tree-footer-values {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.72);
}

.planner__tree-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.planner__tree-indent {
  flex: 0 0 auto;
}

.planner__tree-content {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 6px;
  flex: 1 1 auto;
}

.planner__pagefull {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.planner__pagefull--active {
  position: fixed;
  inset: 0;
  z-index: 9998;
  padding: 12px;
  background: #fff;
}

.planner__pagefull--active .planner__flow {
  flex: 1 1 auto;
  height: auto;
  min-height: 0;
}

.planner__flow {
  width: 100%;
  height: 640px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  background: #fff;
}

.planner__flow--fullscreen {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  z-index: 9999 !important;
  border-radius: 0 !important;
}

:deep(.vue-flow__edge-path) {
  stroke-linecap: round;
}

:deep(.vue-flow__node) {
  cursor: default;
}

.planner__flow-node {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.18);
  background: white;
  min-width: 220px;
  max-width: 320px;
}

.planner__flow-node--selected {
  border-color: var(--q-primary);
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.25);
}

.planner__flow-node--recovery {
  border-color: #26a69a;
  box-shadow: 0 0 0 1px rgba(38, 166, 154, 0.3);
}

.planner__flow-node--fluid {
  min-width: 180px;
}

.planner__quant-node {
  position: relative;
  width: 112px;
  min-height: 112px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.planner__quant-node--fluid {
  width: 96px;
  min-height: 96px;
}

.planner__quant-node-circle {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.22);
  background: radial-gradient(
    circle at 35% 30%,
    rgba(255, 255, 255, 0.95),
    rgba(236, 243, 255, 0.94) 60%,
    rgba(220, 232, 248, 0.92)
  );
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.planner__quant-node-circle--fluid {
  background: radial-gradient(
    circle at 35% 30%,
    rgba(222, 250, 255, 0.95),
    rgba(186, 236, 245, 0.92) 62%,
    rgba(151, 208, 219, 0.9)
  );
}

.planner__quant-fluid-symbol {
  font-size: 26px;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.58);
}

.planner__quant-node-label {
  text-align: center;
  user-select: text;
  -webkit-user-select: text;
}

.planner__quant-node-title {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
}

.planner__quant-node-sub {
  margin-top: 2px;
  font-size: 11px;
  color: rgba(0, 0, 0, 0.68);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.planner__quant-node--selected .planner__quant-node-circle {
  border-color: var(--q-primary);
  box-shadow:
    0 0 0 2px rgba(25, 118, 210, 0.25),
    0 8px 18px rgba(0, 0, 0, 0.14);
}

.planner__quant-node--recovery .planner__quant-node-circle {
  border-color: #26a69a;
}

.planner__quant-node--root .planner__quant-node-circle {
  border-color: var(--q-primary);
}

.planner__quant-handle {
  width: 1px !important;
  height: 1px !important;
  opacity: 0 !important;
  background: transparent !important;
  border: none !important;
  pointer-events: none !important;
}

.planner__handle {
  width: 10px !important;
  height: 10px !important;
  background: rgba(0, 0, 0, 0.32) !important;
  border: 1px solid rgba(255, 255, 255, 0.9) !important;
}

.planner__flow-node--machine {
  justify-content: space-between;
  gap: 10px;
}

.planner__flow-node-icon-fallback {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.06);
  color: rgba(0, 0, 0, 0.7);
  user-select: none;
}

.planner__flow-node-text {
  min-width: 0;
  flex: 1 1 auto;
  user-select: text;
  -webkit-user-select: text;
}

.planner__flow-node-title {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  user-select: text;
  -webkit-user-select: text;
}

.planner__flow-node-sub {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 4px;
  user-select: text;
  -webkit-user-select: text;
}

.planner__flow-node-machine {
  flex: 0 0 auto;
}

/* 修复全屏模式下 q-select 下拉菜单的 z-index 问题 */
:deep(.q-menu.planner__select-menu) {
  z-index: 99999 !important;
}

@media (max-width: 768px) {
  .planner :deep(.q-card.q-pa-md) {
    padding: 12px !important;
  }

  .planner :deep(.q-card),
  .planner :deep(.q-tabs),
  .planner :deep(.q-tab-panels),
  .planner :deep(.q-tab-panel),
  .planner__pagefull {
    min-width: 0;
    max-width: 100%;
  }

  .planner__toolbar {
    align-items: flex-start;
    gap: 10px 8px;
  }

  .planner__toolbar-spacer {
    display: none;
  }

  .planner__header-action,
  .planner__view-action {
    min-width: 40px;
  }

  .planner__toolbar-toggle {
    flex: 1 1 100%;
    max-width: 100%;
  }

  .planner__target-amount,
  .planner__target-unit {
    flex: 1 1 calc(50% - 4px);
    min-width: 0;
    max-width: calc(50% - 4px);
  }

  .planner__preset-group,
  .planner__mode-toggle,
  .planner__renderer-toggle {
    flex: 1 1 100%;
    min-width: 0;
    width: 100%;
  }

  .planner__preset-group :deep(.q-btn),
  .planner__mode-toggle :deep(.q-btn),
  .planner__renderer-toggle :deep(.q-btn) {
    flex: 1 1 0;
    min-width: 0;
  }

  .planner__tree-table {
    overflow-x: auto;
  }

  .planner__tree-table-header,
  .planner__tree-table-row {
    min-width: 720px;
  }

  .planner :deep(.q-tabs__content),
  .planner :deep(.q-tab__content),
  .planner :deep(.q-field__control),
  .planner :deep(.q-field__native) {
    min-width: 0;
  }

  .planner__tabs :deep(.q-tabs__content) {
    max-width: 100%;
  }

  .planner__tabs :deep(.q-tab) {
    min-width: 0;
    padding-inline: 10px;
  }

  .planner__toolbar-toggle :deep(.q-toggle__label) {
    min-width: 0;
    white-space: normal;
  }

  .planner__flow {
    height: 58vh;
  }
}
</style>
