<template>
  <div v-bind="$attrs" class="advanced-planner column no-wrap">
    <!-- 目标产物管理区 -->
    <q-card flat bordered class="q-pa-md">
      <div class="row items-center q-gutter-sm q-mb-md">
        <div class="text-subtitle2">{{ t('targetProducts') }}</div>
        <q-toggle v-model="useProductRecovery" dense :label="t('useProductRecovery')" />
        <q-space />
        <q-btn
          dense
          outline
          icon="delete_sweep"
          :label="t('clear')"
          :disable="targets.length === 0"
          @click="clearTargets"
        />
      </div>

      <!-- 目标列表 -->
      <q-list v-if="targets.length" bordered separator class="rounded-borders">
        <q-item v-for="(target, index) in targets" :key="index" class="q-pa-sm">
          <q-item-section avatar class="q-pr-sm">
            <stack-view
              v-if="target.itemKey && itemDefsByKeyHash"
              :content="{
                kind: 'item',
                id: target.itemKey.id,
                amount: target.rate,
                ...(target.itemKey.meta !== undefined ? { meta: target.itemKey.meta } : {}),
                ...(target.itemKey.nbt !== undefined ? { nbt: target.itemKey.nbt } : {}),
              }"
              :item-defs-by-key-hash="itemDefsByKeyHash"
            />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ target.itemName }}</q-item-label>
            <q-item-label caption>
              <div class="row items-center q-gutter-sm q-mt-xs">
                <!-- LP 模式下显示目标类型切换 -->
                <q-btn-toggle
                  v-if="lpMode"
                  dense
                  unelevated
                  toggle-color="deep-purple"
                  size="xs"
                  :options="objectiveTypeOptions"
                  :model-value="target.type"
                  @update:model-value="(v) => updateTargetType(index, v as ObjectiveType)"
                />
                <template v-if="target.type !== ObjectiveType.Maximize">
                  <q-input
                    dense
                    filled
                    type="number"
                    style="width: 90px"
                    :model-value="target.rate"
                    @update:model-value="(v) => updateTargetRate(index, Number(v))"
                  />
                  <q-select
                    dense
                    filled
                    emit-value
                    map-options
                    popup-content-class="planner__select-menu"
                    style="width: 110px"
                    :options="rateUnitOptions"
                    :model-value="target.unit"
                    @update:model-value="(v) => updateTargetUnit(index, v)"
                  />
                </template>
                <span v-else class="text-caption text-grey-7">{{
                  t('weightAutoMaximize', { rate: target.rate })
                }}</span>
              </div>
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn
              flat
              round
              dense
              icon="close"
              size="sm"
              color="negative"
              @click="removeTarget(index)"
            >
              <q-tooltip>{{ t('removeTarget') }}</q-tooltip>
            </q-btn>
          </q-item-section>
        </q-item>
      </q-list>

      <div v-else class="text-center q-pa-md text-grey">
        <q-icon name="info" size="md" class="q-mb-sm" />
        <div class="text-caption">{{ t('noTargets') }}</div>
        <div class="text-caption">{{ t('addTargetHint') }}</div>
      </div>

      <!-- 操作按钮 -->
      <div v-if="targets.length" class="q-mt-md row items-center q-gutter-sm">
        <q-toggle
          v-model="lpMode"
          :label="t('lpMode')"
          color="deep-purple"
          checked-icon="science"
          unchecked-icon="account_tree"
        >
          <q-tooltip>{{ t('lpModeTooltip') }}</q-tooltip>
        </q-toggle>
        <q-btn
          :color="lpMode ? 'deep-purple' : 'primary'"
          :icon="lpMode ? 'science' : 'calculate'"
          :label="t('startPlanning')"
          :disable="targets.length === 0"
          :loading="lpSolving"
          @click="startPlanning"
        />
        <q-btn
          outline
          :color="lpMode ? 'deep-purple' : 'primary'"
          icon="auto_awesome"
          :label="lpMode ? t('autoRecipePlusLP') : t('autoOptimize')"
          :disable="targets.length === 0"
          :loading="lpMode && lpSolving"
          @click="autoOptimize"
        >
          <q-tooltip>{{ lpMode ? t('autoRecipePlusLPTooltip') : t('autoOptimizeHint') }}</q-tooltip>
        </q-btn>
      </div>
    </q-card>

    <!-- 决策区域：LP 手动模式下仍需手动选配方；LP 自动优化跳过此步 -->
    <q-card
      v-if="pendingDecisions.length && (!lpMode || lpPendingAfterDecisions)"
      flat
      bordered
      class="q-pa-md q-mt-md"
    >
      <div class="row items-center q-gutter-sm q-mb-md">
        <div class="text-subtitle2">{{ t('recipeSelection') }}</div>
        <q-space />
        <q-badge color="warning">{{ t('pendingChoices') }}{{ pendingDecisions.length }}</q-badge>
      </div>

      <div class="column q-gutter-md">
        <div v-for="d in pendingDecisions" :key="decisionKey(d)" class="decision-card">
          <!-- 配方选择 -->
          <q-card v-if="d.kind === 'item_recipe'" flat bordered class="q-pa-md">
            <div class="text-caption text-weight-medium q-mb-sm">
              {{ itemName(d.itemKey) }} - {{ t('chooseSynthesisMethod') }}
            </div>
            <q-select
              dense
              filled
              emit-value
              map-options
              :options="recipeOptionsForDecision(d)"
              :model-value="getSelectedRecipe(d.itemKeyHash)"
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
                      />
                    </q-card>
                    <div v-else class="text-caption">{{ t('noRecipeDetails') }}</div>
                  </q-tooltip>
                </q-item>
              </template>
            </q-select>
          </q-card>

          <!-- 标签物品选择 -->
          <q-card v-else-if="d.kind === 'tag_item'" flat bordered class="q-pa-md">
            <div class="text-caption text-weight-medium q-mb-sm">
              {{ t('tagSelection') }} {{ getTagDisplayName(d.tagId) }} -
              {{ t('chooseSpecificItem') }}
            </div>
            <q-select
              dense
              filled
              emit-value
              map-options
              :options="tagItemOptions(d)"
              :model-value="getSelectedTag(d.tagId)"
              @update:model-value="(v) => setTagChoice(d.tagId, v as string)"
            />
          </q-card>
        </div>
      </div>
    </q-card>

    <!-- 结果展示区 -->
    <q-card
      v-if="planningComplete && mergedTree"
      flat
      bordered
      class="q-pa-md q-mt-md advanced-planner__results"
    >
      <div class="row items-center q-mb-md">
        <div class="text-subtitle2">{{ t('multiTargetPlanning') }}</div>
        <q-space />
        <q-btn
          dense
          outline
          icon="save"
          :label="t('savePlan')"
          :disable="pendingDecisions.length > 0"
          @click="openSaveDialog"
        />
        <q-btn-dropdown
          dense
          outline
          icon="share"
          :label="t('share')"
          :disable="pendingDecisions.length > 0"
        >
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
        <q-chip dense color="primary" text-color="white">
          {{ targets.length }} {{ t('targetCount') }}
        </q-chip>
      </div>

      <!-- 目标概览 -->
      <q-list dense bordered class="rounded-borders q-mb-md">
        <q-item-label header>{{ t('targetOverview') }}</q-item-label>
        <q-item v-for="(target, idx) in targets" :key="idx">
          <q-item-section avatar>
            <stack-view
              v-if="target.itemKey && itemDefsByKeyHash"
              :content="{
                kind: 'item',
                id: target.itemKey.id,
                amount: target.rate,
                ...(target.itemKey.meta !== undefined ? { meta: target.itemKey.meta } : {}),
                ...(target.itemKey.nbt !== undefined ? { nbt: target.itemKey.nbt } : {}),
              }"
              :item-defs-by-key-hash="itemDefsByKeyHash"
            />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ target.itemName }}</q-item-label>
            <q-item-label caption
              >{{ target.rate }} {{ getRateUnitLabel(target.unit) }}</q-item-label
            >
          </q-item-section>
        </q-item>
      </q-list>

      <q-tabs v-model="activeTab" dense outside-arrows mobile-arrows inline-label>
        <q-tab name="summary" :label="t('resourceSummary')" />
        <q-tab name="tree" :label="t('synthesisTree')" />
        <q-tab name="graph" :label="t('nodeGraph')" />
        <q-tab name="line" :label="t('productionLine')" />
        <q-tab name="quant" :label="t('quantificationView')" />
        <q-tab name="calc" :label="t('calculator')" />
        <q-tab v-if="lpMode && lpResult" name="lp_raw" :label="t('lpRawData')" />
      </q-tabs>
      <q-separator class="q-my-md" />

      <q-tab-panels v-model="activeTab" animated keep-alive class="advanced-planner-panels">
        <!-- 资源汇总视图 - 显示融合后的总需求 -->
        <q-tab-panel name="summary" class="q-pa-none">
          <div class="column q-gutter-md">
            <q-card flat bordered class="q-pa-md">
              <div class="text-subtitle2 q-mb-md">
                {{ t('rawMaterialRequirements', { count: rawItemTotals.size }) }}
              </div>
              <q-list dense bordered separator class="rounded-borders">
                <q-item v-for="[itemId, amount] in rawItemEntries" :key="itemId">
                  <q-item-section avatar>
                    <stack-view
                      :content="{ kind: 'item', id: itemId, amount }"
                      :item-defs-by-key-hash="itemDefsByKeyHash"
                    />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ getItemName(itemId) }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-item-label caption
                      >{{ amount.toFixed(2) }} {{ t('perMinute') }}</q-item-label
                    >
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card>

            <q-card v-if="rawFluidEntries.length" flat bordered class="q-pa-md">
              <div class="text-subtitle2 q-mb-md">
                {{ t('rawMaterialFluidRequirements', { count: rawFluidTotals.size }) }}
              </div>
              <q-list dense bordered separator class="rounded-borders">
                <q-item v-for="[fluidId, amount] in rawFluidEntries" :key="fluidId">
                  <q-item-section avatar>
                    <stack-view
                      :content="{ kind: 'fluid', id: fluidId, amount }"
                      :item-defs-by-key-hash="itemDefsByKeyHash"
                    />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ fluidId }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-item-label caption
                      >{{ amount.toFixed(2) }} {{ t('perMinute') }}</q-item-label
                    >
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card>

            <q-card v-if="mergedTree.catalysts.size > 0" flat bordered class="q-pa-md">
              <div class="text-subtitle2 q-mb-md">
                {{ t('catalystRequirements', { count: mergedTree.catalysts.size }) }}
              </div>
              <q-list dense bordered separator class="rounded-borders">
                <q-item
                  v-for="[itemId, amount] in Array.from(mergedTree.catalysts.entries())"
                  :key="itemId"
                >
                  <q-item-section avatar>
                    <stack-view
                      :content="{ kind: 'item', id: itemId, amount }"
                      :item-defs-by-key-hash="itemDefsByKeyHash"
                    />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ getItemName(itemId) }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-item-label caption>{{ amount }} {{ t('itemUnit') }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card>

            <q-card v-if="cycleSeedEntries.length" flat bordered class="q-pa-md">
              <div class="text-subtitle2 q-mb-md">
                {{ t('cycleSeedAnalysis', { count: cycleSeedEntries.length }) }}
              </div>
              <q-list dense bordered separator class="rounded-borders">
                <q-item v-for="seed in cycleSeedEntries" :key="seed.nodeId">
                  <q-item-section avatar>
                    <stack-view
                      :content="{ kind: 'item', id: seed.itemKey.id, amount: seed.seedAmount }"
                      :item-defs-by-key-hash="itemDefsByKeyHash"
                    />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ itemName(seed.itemKey) }}</q-item-label>
                    <q-item-label caption>
                      {{ t('need') }} {{ formatAmount(seed.amountNeeded) }} {{ t('perMinute') }}
                    </q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-item-label caption>
                      {{ t('seeds') }} {{ formatAmount(seed.seedAmount) }}
                    </q-item-label>
                    <q-item-label caption v-if="seed.cycleFactor">
                      {{ t('growthFactor') }} {{ formatAmount(seed.cycleFactor) }}
                    </q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card>
          </div>
        </q-tab-panel>

        <!-- 合成树视图 - 显示层级结构 -->
        <q-tab-panel name="tree" class="q-pa-none">
          <div class="column q-gutter-md">
            <div class="row items-center q-gutter-sm">
              <div class="text-caption text-grey-8">{{ t('displayUnit') }}</div>
              <q-select
                dense
                filled
                emit-value
                map-options
                popup-content-class="planner__select-menu"
                style="min-width: 120px"
                :options="rateUnitOptions"
                :model-value="treeDisplayUnit"
                @update:model-value="(v) => (treeDisplayUnit = v)"
              />
              <q-space />
              <q-btn-toggle
                v-model="treeDisplayMode"
                dense
                outline
                toggle-color="primary"
                :options="[
                  { label: t('displayModeList'), value: 'list' },
                  { label: t('displayModeCompact'), value: 'compact' },
                ]"
              />
            </div>

            <div v-if="mergedTree" class="q-mt-md">
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
                        amount: nodeDisplayRate(row.node),
                      }"
                      :item-defs-by-key-hash="itemDefsByKeyHash"
                    />
                    <stack-view
                      v-else
                      :content="
                        row.node.unit
                          ? {
                              kind: 'fluid',
                              id: row.node.id,
                              amount: nodeDisplayRate(row.node),
                              unit: row.node.unit,
                            }
                          : { kind: 'fluid', id: row.node.id, amount: nodeDisplayRate(row.node) }
                      "
                      :item-defs-by-key-hash="itemDefsByKeyHash"
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
                  </div>
                </div>
              </div>
            </div>
          </div>
        </q-tab-panel>

        <!-- 节点图视图 -->
        <q-tab-panel name="graph" class="q-pa-none">
          <div :class="['planner__pagefull', { 'planner__pagefull--active': graphPageFull }]">
            <div class="row items-center q-gutter-sm">
              <div class="text-caption text-grey-8">{{ t('displayUnit') }}</div>
              <q-select
                dense
                filled
                emit-value
                map-options
                popup-content-class="planner__select-menu"
                style="min-width: 120px"
                :options="rateUnitOptions"
                :model-value="graphDisplayUnit"
                @update:model-value="(v) => (graphDisplayUnit = v)"
              />
              <q-toggle v-model="graphShowFluids" dense :label="t('showFluids')" />
              <q-toggle v-model="graphMergeRawMaterials" dense :label="t('mergeRawMaterials')" />
              <q-space />
              <q-btn
                flat
                dense
                round
                :icon="graphPageFull ? 'close_fullscreen' : 'fit_screen'"
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
                @click="toggleGraphFullscreen"
              >
                <q-tooltip>{{ graphFullscreen ? t('exitFullscreen') : t('fullscreen') }}</q-tooltip>
              </q-btn>
            </div>
            <div
              v-if="graphFlowNodes.length"
              class="planner__graph"
              :class="{ 'planner__flow--fullscreen': graphFullscreen }"
              ref="graphFlowWrapEl"
            >
              <VueFlow
                :nodes="graphFlowNodesStyled"
                :edges="graphFlowEdgesStyled"
                :nodes-draggable="true"
                :nodes-connectable="false"
                :elements-selectable="true"
                :zoom-on-double-click="false"
                :min-zoom="0.3"
                :max-zoom="2"
                :pan-on-drag="true"
                no-pan-class-name="nopan"
                no-drag-class-name="nodrag"
                @node-click="(evt) => (selectedGraphNodeId = evt.node.id)"
                @node-drag-start="(evt) => (selectedGraphNodeId = evt.node.id)"
                @node-drag-stop="onGraphNodeDragStop"
                @pane-click="() => (selectedGraphNodeId = null)"
              >
                <Background :gap="20" />
                <Controls />
                <MiniMap />
                <template #node-graphItemNode="p">
                  <div
                    class="planner__flow-node nopan"
                    :class="{
                      'planner__flow-node--selected': selectedGraphNodeId === p.id,
                      'planner__flow-node--recovery': p.data.recovery,
                    }"
                  >
                    <div class="planner__flow-node-icon">
                      <stack-view
                        :content="{
                          kind: 'item',
                          id: p.data.itemKey?.id ?? '__multi_target__',
                          amount: 1,
                          ...(p.data.itemKey?.meta !== undefined
                            ? { meta: p.data.itemKey.meta }
                            : {}),
                          ...(p.data.itemKey?.nbt !== undefined ? { nbt: p.data.itemKey.nbt } : {}),
                        }"
                        :item-defs-by-key-hash="itemDefsByKeyHash"
                        variant="slot"
                        :show-name="false"
                        :show-subtitle="false"
                      />
                    </div>
                    <div class="planner__flow-node-text">
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
                    <div v-if="p.data.machineItemId" class="planner__flow-node-machine">
                      <stack-view
                        :content="{ kind: 'item', id: p.data.machineItemId, amount: 1 }"
                        :item-defs-by-key-hash="itemDefsByKeyHash"
                        variant="slot"
                        :show-name="false"
                        :show-subtitle="false"
                      />
                    </div>
                  </div>
                </template>
                <template #node-graphFluidNode="p">
                  <div
                    class="planner__flow-node planner__flow-node--fluid nopan"
                    :class="{ 'planner__flow-node--selected': selectedGraphNodeId === p.id }"
                  >
                    <div class="planner__flow-node-text">
                      <div class="planner__flow-node-title">{{ p.data.title }}</div>
                      <div class="planner__flow-node-sub">{{ p.data.subtitle }}</div>
                    </div>
                  </div>
                </template>
              </VueFlow>
            </div>
            <div v-else class="text-center text-grey q-pa-lg">{{ t('noNodes') }}</div>
          </div>
        </q-tab-panel>

        <!-- 生产线视图 -->
        <q-tab-panel name="line" class="q-pa-none">
          <div :class="['planner__pagefull', { 'planner__pagefull--active': linePageFull }]">
            <div class="row items-center q-gutter-sm">
              <div class="text-caption text-grey-8">{{ t('displayUnit') }}</div>
              <q-select
                dense
                filled
                emit-value
                map-options
                popup-content-class="planner__select-menu"
                style="min-width: 120px"
                :options="rateUnitOptions"
                :model-value="lineDisplayUnit"
                @update:model-value="(v) => (lineDisplayUnit = v)"
              />
              <q-toggle v-model="lineCollapseIntermediate" dense :label="t('hideIntermediate')" />
              <q-toggle v-model="lineIncludeCycleSeeds" dense :label="t('showCycleSeeds')" />
              <q-toggle v-model="lineWidthByRate" dense :label="t('lineWidthByRate')" />
              <q-toggle
                :model-value="settingsStore.lineIntermediateColoring"
                dense
                :label="t('intermediateColoring')"
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
                @update:model-value="(v) => setSelectedLineItemForcedRaw(!!v)"
              />
              <q-btn
                v-if="lineWidthByRate"
                dense
                flat
                no-caps
                icon="tune"
                :label="t('lineWidthEditCurve')"
                @click="lineWidthCurveDialogOpen = true"
              />
              <q-btn-toggle
                dense
                outlined
                no-caps
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
              <q-space />
              <q-btn
                flat
                dense
                round
                :icon="linePageFull ? 'close_fullscreen' : 'fit_screen'"
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
                @click="toggleLineFullscreen"
              >
                <q-tooltip>{{ lineFullscreen ? t('exitFullscreen') : t('fullscreen') }}</q-tooltip>
              </q-btn>
            </div>
            <div
              v-if="lineFlowNodes.length"
              class="planner__flow"
              :class="{ 'planner__flow--fullscreen': lineFullscreen }"
              ref="lineFlowWrapEl"
            >
              <line-flow-view
                flow-id="advanced-planner-line-flow"
                :renderer="settingsStore.productionLineRenderer"
                :nodes="lineFlowNodes"
                :edges="lineFlowEdgesStyled"
                :selected-node-id="selectedLineNodeId"
                :item-defs-by-key-hash="itemDefsByKeyHash"
                :flow-background-pattern-color="flowBackgroundPatternColor"
                :line-width-scale="settingsStore.productionLineG6Scale"
                @update:selected-node-id="selectedLineNodeId = $event"
                @node-drag-stop="onLineNodeDragStop"
              />
            </div>
            <div v-else class="text-center text-grey q-pa-lg">{{ t('noNodes') }}</div>
          </div>
        </q-tab-panel>

        <q-tab-panel name="quant" class="q-pa-none">
          <div :class="['planner__pagefull', { 'planner__pagefull--active': quantPageFull }]">
            <div class="row items-center q-gutter-sm">
              <div class="text-caption text-grey-8">{{ t('displayUnit') }}</div>
              <q-select
                dense
                filled
                emit-value
                map-options
                popup-content-class="planner__select-menu"
                style="min-width: 120px"
                :options="rateUnitOptions"
                :model-value="quantDisplayUnit"
                @update:model-value="(v) => (quantDisplayUnit = v)"
              />
              <q-toggle v-model="quantShowFluids" dense :label="t('showFluids')" />
              <q-toggle v-model="quantWidthByRate" dense :label="t('lineWidthByRate')" />
              <q-btn-toggle
                dense
                outlined
                no-caps
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
              <q-space />
              <q-btn
                flat
                dense
                round
                :icon="quantPageFull ? 'close_fullscreen' : 'fit_screen'"
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
                @click="toggleQuantFullscreen"
              >
                <q-tooltip>{{ quantFullscreen ? t('exitFullscreen') : t('fullscreen') }}</q-tooltip>
              </q-btn>
            </div>
            <div
              v-if="quantModel.nodes.length"
              class="planner__flow"
              :class="{ 'planner__flow--fullscreen': quantFullscreen }"
              ref="quantFlowWrapEl"
            >
              <quant-flow-view
                :mode="settingsStore.quantFlowRenderer"
                :model="quantModel"
                :node-positions="nodePositionMapToRecord(quantNodePositions)"
                :item-defs-by-key-hash="itemDefsByKeyHash"
                :display-unit="quantDisplayUnit"
                :width-by-rate="quantWidthByRate"
                :belt-speed="beltSpeed"
                :line-width-curve-config="lineWidthCurveConfig"
                :line-width-scale="settingsStore.quantLineWidthScale"
                :machine-count-decimals="settingsStore.machineCountDecimals"
                @node-drag-stop="onQuantNodeDragStop"
              />
            </div>
            <div v-else class="text-center text-grey q-pa-lg">{{ t('noNodes') }}</div>
          </div>
        </q-tab-panel>

        <!-- 计算器视图 -->
        <q-tab-panel name="calc" class="q-pa-none">
          <div class="column q-gutter-md">
            <div class="row items-center q-gutter-sm">
              <div class="text-caption text-grey-8">{{ t('displayUnit') }}</div>
              <q-select
                dense
                filled
                emit-value
                map-options
                popup-content-class="planner__select-menu"
                style="min-width: 120px"
                :options="rateUnitOptions"
                :model-value="calcDisplayUnit"
                @update:model-value="(v) => (calcDisplayUnit = v)"
              />
            </div>

            <div class="row q-col-gutter-md">
              <div class="col-12 col-md-4">
                <q-card flat bordered class="q-pa-md">
                  <div class="text-subtitle2">{{ t('totalPower') }}</div>
                  <div class="text-h6">{{ formatAmount(calcTotals?.power ?? 0) }} kW</div>
                  <div class="text-caption text-grey-7">
                    {{ t('pollutionPerMin', { amount: formatAmount(calcTotals?.pollution ?? 0) }) }}
                  </div>
                </q-card>
              </div>
              <div class="col-12 col-md-4">
                <q-card flat bordered class="q-pa-md">
                  <div class="text-subtitle2">{{ t('totalEquipment') }}</div>
                  <div class="text-h6">{{ formatAmount(calcMachineTotal) }}</div>
                  <div class="text-caption text-grey-7">
                    {{ calcMachineRows.length }} {{ t('machineTypes') }}
                  </div>
                </q-card>
              </div>
              <div class="col-12 col-md-4">
                <q-card flat bordered class="q-pa-md">
                  <div class="text-subtitle2">{{ t('outputTypes') }}</div>
                  <div class="text-h6">{{ calcItemRows.length }}</div>
                  <div class="text-caption text-grey-7">{{ t('summaryByNode') }}</div>
                </q-card>
              </div>
            </div>

            <q-card flat bordered class="q-pa-md">
              <div class="text-subtitle2 q-mb-md">{{ t('equipmentRequirements') }}</div>
              <q-table
                dense
                flat
                :rows="calcMachineRows"
                :columns="calcMachineColumns"
                row-key="id"
                :rows-per-page-options="[0]"
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
                      />
                      <span>{{ props.row.name }}</span>
                    </div>
                  </q-td>
                </template>
                <template #body-cell-count="props">
                  <q-td :props="props" class="text-right">
                    {{ formatAmount(props.row.count) }}
                  </q-td>
                </template>
              </q-table>
            </q-card>

            <q-card flat bordered class="q-pa-md">
              <div class="text-subtitle2 q-mb-md">{{ t('intermediateProductionCount') }}</div>
              <q-table
                dense
                flat
                :rows="calcIntermediateRows"
                :columns="calcIntermediateColumns"
                row-key="id"
                :rows-per-page-options="[0]"
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
                      />
                      <span>{{ props.row.name }}</span>
                    </div>
                  </q-td>
                </template>
                <template #body-cell-amount="props">
                  <q-td :props="props" class="text-right">
                    {{ formatAmount(props.row.amount) }}
                  </q-td>
                </template>
                <template #body-cell-rate="props">
                  <q-td :props="props" class="text-right">
                    {{ formatAmount(props.row.rate) }}
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
                      @click="setForcedRawForItemId(props.row.id, !props.row.forcedRaw)"
                    />
                  </q-td>
                </template>
              </q-table>
            </q-card>

            <q-card v-if="calcForcedRawRows.length" flat bordered class="q-pa-md">
              <div class="text-subtitle2 q-mb-md">{{ t('rawMaterialList') }}</div>
              <q-table
                dense
                flat
                :rows="calcForcedRawRows"
                :columns="calcForcedRawColumns"
                row-key="keyHash"
                :rows-per-page-options="[0]"
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
                      />
                      <span>{{ props.row.name }}</span>
                    </div>
                  </q-td>
                </template>
                <template #body-cell-amount="props">
                  <q-td :props="props" class="text-right">
                    {{ formatAmount(props.row.amount) }}
                  </q-td>
                </template>
                <template #body-cell-rate="props">
                  <q-td :props="props" class="text-right">
                    {{ formatAmount(props.row.rate) }}
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
            </q-card>

            <q-card flat bordered class="q-pa-md">
              <div class="text-subtitle2 q-mb-md">{{ t('outputRate') }}</div>
              <q-table
                dense
                flat
                :rows="calcItemRows"
                :columns="calcItemColumns"
                row-key="id"
                :rows-per-page-options="[0]"
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
                      />
                      <span>{{ props.row.name }}</span>
                    </div>
                  </q-td>
                </template>
                <template #body-cell-rate="props">
                  <q-td :props="props" class="text-right">
                    {{ formatAmount(props.row.rate) }}
                  </q-td>
                </template>
              </q-table>
            </q-card>
          </div>
        </q-tab-panel>

        <!-- LP 原始数据视图 -->
        <q-tab-panel v-if="lpMode && lpResult" name="lp_raw" class="q-pa-none">
          <div class="column q-gutter-md">
            <q-card flat bordered class="q-pa-md">
              <div class="text-subtitle2 q-mb-sm">
                {{ t('lpSolutionResult') }}
                <q-badge color="deep-purple" class="q-ml-sm"
                  >{{ lpResult.steps.filter((s) => s.recipeId).length }}
                  {{ t('recipes2') }}</q-badge
                >
              </div>
              <q-table
                dense
                flat
                :rows="lpRawRows"
                :columns="lpRawColumns"
                row-key="id"
                :rows-per-page-options="[0]"
              >
                <template #body-cell-name="props">
                  <q-td :props="props">
                    <div class="row items-center q-gutter-xs">
                      <stack-view
                        v-if="props.row.itemId"
                        :content="{ kind: 'item', id: props.row.itemId, amount: 1 }"
                        :item-defs-by-key-hash="itemDefsByKeyHash"
                        variant="slot"
                        :show-name="false"
                        :show-subtitle="false"
                      />
                      <span>{{ props.row.name }}</span>
                      <q-badge v-if="!props.row.recipeId" color="grey" :label="t('rawMaterial')" />
                    </div>
                  </q-td>
                </template>
                <template #body-cell-surplus="props">
                  <q-td :props="props" class="text-right">
                    <span :class="props.row.surplus > 0 ? 'text-orange-7' : ''">
                      {{ props.row.surplus > 0 ? props.row.surplus.toFixed(4) : '-' }}
                    </span>
                  </q-td>
                </template>
              </q-table>
            </q-card>
          </div>
        </q-tab-panel>
      </q-tab-panels>
    </q-card>

    <div v-else-if="!targets.length" class="col column items-center justify-center text-grey">
      <q-icon name="lightbulb" size="64px" class="q-mb-md" />
      <div class="text-h6">{{ t('advancedPlanner') }}</div>
      <div class="text-caption q-mt-sm">{{ t('addTargetToStart') }}</div>
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
    @update:model-value="(v) => settingsStore.setLineWidthCurveConfig(v)"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

// The template has multiple root nodes (main div + q-dialog + line-width-curve-editor),
// so class/style passed by the parent cannot be automatically inherited.
// Disable auto-inheritance and let the root <div> inherit via v-bind="$attrs".
defineOptions({ inheritAttrs: false });
import { Dark, useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import type { ItemKey, ItemDef, ItemId, PackData, Stack } from 'src/jei/types';
import type { JeiIndex } from 'src/jei/indexing/buildIndex';
import { itemKeyHash } from 'src/jei/indexing/key';
import {
  getTagDisplayName as getTagDisplayNameFromDef,
  resolveTagDef,
} from 'src/jei/i18n-resolver';
import { DEFAULT_BELT_SPEED } from 'src/jei/planner/units';
import {
  type PlannerDecision,
  type RequirementNode,
  type EnhancedBuildTreeResult,
  type EnhancedRequirementNode,
  autoPlanSelections,
  computePlannerDecisions,
  extractRecipeStacks,
  buildEnhancedRequirementTree,
} from 'src/jei/planner/planner';
import { ObjectiveType } from 'src/jei/planner/types';
import type { ObjectiveState, ObjectiveUnit, PlannerResult } from 'src/jei/planner/types';
import { solveAdvanced } from 'src/jei/planner/advancedPlanner';
import { normalizeRecipe } from 'src/jei/planner/recipeAdapter';
import { rational } from 'src/jei/planner/rational';
import StackView from 'src/jei/components/StackView.vue';
import RecipeViewer from 'src/jei/components/RecipeViewer.vue';
import LineWidthCurveEditor from 'src/jei/components/LineWidthCurveEditor.vue';
import QuantFlowView from 'src/jei/components/QuantFlowView.vue';
import LineFlowView from 'src/jei/components/LineFlowView.vue';
import { buildProductionLineModel } from 'src/jei/planner/productionLine';
import { buildQuantFlowModel } from 'src/jei/planner/quantFlow';
import {
  convertAmountPerMinuteToUnitValue,
  evaluateLineWidthCurve,
  type LineWidthCurveConfig,
} from 'src/jei/planner/lineWidthCurve';
import type {
  AdvancedPlannerTab,
  AdvancedPlannerViewState,
  PlannerLiveState,
  PlannerNodePosition,
  PlannerRateDisplayUnit,
  PlannerSavePayload,
  PlannerTargetUnit,
} from 'src/jei/planner/plannerUi';
import {
  createPlannerShareData,
  parsePlannerShareJson,
  stringifyPlannerShareJson,
} from 'src/jei/planner/plannerShare';
import { useSettingsStore } from 'src/stores/settings';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { VueFlow, type Edge, type Node, MarkerType } from '@vue-flow/core';
import { MiniMap } from '@vue-flow/minimap';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';
import '@vue-flow/minimap/dist/style.css';

const { t } = useI18n();
const settingsStore = useSettingsStore();

interface Target {
  itemKey: ItemKey;
  itemName: string;
  rate: number;
  unit: 'per_second' | 'per_minute' | 'per_hour';
  /** LP 目标类型：产出/投入/最大化/限制 */
  type: ObjectiveType;
}

interface Props {
  pack?: PackData | null;
  index?: JeiIndex | null;
  itemDefsByKeyHash?: Record<string, ItemDef>;
}

const props = withDefaults(defineProps<Props>(), {
  pack: null,
  index: null,
  itemDefsByKeyHash: () => ({}),
});

function getTagDisplayName(tagId: string): string {
  const tagDef = resolveTagDef(
    tagId,
    props.pack?.tags?.item,
    props.pack?.manifest.gameId ?? undefined,
  );
  return getTagDisplayNameFromDef(tagId, tagDef, settingsStore.language);
}

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
  'save-plan': [payload: PlannerSavePayload];
  'share-plan': [payload: PlannerSavePayload];
  'share-plan-json-url': [payload: PlannerSavePayload];
  'state-change': [state: PlannerLiveState];
}>();

const $q = useQuasar();

const targets = ref<Target[]>([]);
/** LP 优化模式开关：开启后调用 solveAdvanced() 代替树形递归 */
const lpMode = ref(false);
/** LP 手动模式：等待用户解决决策后再触发求解 */
const lpPendingAfterDecisions = ref(false);
/** LP 求解结果（仅在 lpMode 下有效） */
const lpResult = ref<PlannerResult | null>(null);
const lpSolving = ref(false);
const activeTab = ref<'summary' | 'tree' | 'graph' | 'line' | 'quant' | 'calc'>('summary');
const allDecisions = ref<PlannerDecision[]>([]);
const selectedRecipeIdByItemKeyHash = ref<Map<string, string>>(new Map());
const selectedItemIdByTagId = ref<Map<string, ItemId>>(new Map());
const planningStarted = ref(false);
const mergedTree = ref<EnhancedBuildTreeResult | null>(null);
const mergedRootItemKey = ref<ItemKey | null>(null);

const rateUnitOptions = computed(() => [
  { label: t('rateUnitPerSecond'), value: 'per_second' },
  { label: t('rateUnitPerMinute'), value: 'per_minute' },
  { label: t('rateUnitPerHour'), value: 'per_hour' },
]);

const objectiveTypeOptions = computed(() => [
  { label: t('objectiveTypeOutput'), value: ObjectiveType.Output },
  { label: t('objectiveTypeInput'), value: ObjectiveType.Input },
  { label: t('objectiveTypeMaximize'), value: ObjectiveType.Maximize },
  { label: t('objectiveTypeLimit'), value: ObjectiveType.Limit },
]);

const treeDisplayMode = ref<'list' | 'compact'>('list');
const treeDisplayUnit = ref<'per_second' | 'per_minute' | 'per_hour'>('per_minute');
const collapsed = ref<Set<string>>(new Set());
const graphDisplayUnit = ref<'per_second' | 'per_minute' | 'per_hour'>('per_minute');
const graphShowFluids = ref(true);
const graphMergeRawMaterials = ref(false);
const selectedGraphNodeId = ref<string | null>(null);
const graphNodePositions = ref(new Map<string, { x: number; y: number }>());
const lineDisplayUnit = ref<'per_second' | 'per_minute' | 'per_hour'>('per_minute');
const lineCollapseIntermediate = ref(true);
const lineIncludeCycleSeeds = ref(true);
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
const quantDisplayUnit = ref<'per_second' | 'per_minute' | 'per_hour'>('per_minute');
const quantShowFluids = ref(true);
const forcedRawItemKeyHashes = ref<Set<string>>(new Set());
const useProductRecovery = ref(false);
const selectedLineNodeId = ref<string | null>(null);
const lineNodePositions = ref(new Map<string, { x: number; y: number }>());
const quantNodePositions = ref(new Map<string, { x: number; y: number }>());
const calcDisplayUnit = ref<'per_second' | 'per_minute' | 'per_hour'>('per_minute');

const graphPageFull = ref(false);
const linePageFull = ref(false);
const quantPageFull = ref(false);
const graphFullscreen = ref(false);
const lineFullscreen = ref(false);
const quantFullscreen = ref(false);
const graphFlowWrapEl = ref<HTMLElement | null>(null);
const lineFlowWrapEl = ref<HTMLElement | null>(null);
const quantFlowWrapEl = ref<HTMLElement | null>(null);

const saveDialogOpen = ref(false);
const saveName = ref('');

const VALID_ADVANCED_PLANNER_TABS = new Set<AdvancedPlannerTab>([
  'summary',
  'tree',
  'graph',
  'line',
  'quant',
  'calc',
]);

const VALID_RATE_DISPLAY_UNITS = new Set<PlannerRateDisplayUnit>([
  'per_second',
  'per_minute',
  'per_hour',
]);
const VALID_TARGET_UNITS = new Set<PlannerTargetUnit>([
  'items',
  'per_second',
  'per_minute',
  'per_hour',
]);

const pendingDecisions = computed(() => allDecisions.value);

function nodePositionMapToRecord(
  value: Map<string, PlannerNodePosition>,
): Record<string, PlannerNodePosition> {
  const out: Record<string, PlannerNodePosition> = {};
  value.forEach((pos, id) => {
    const x = finiteOr(pos?.x, Number.NaN);
    const y = finiteOr(pos?.y, Number.NaN);
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
    const x = finiteOr(pos?.x, Number.NaN);
    const y = finiteOr(pos?.y, Number.NaN);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    out.set(id, { x, y });
  });
  return out;
}

function isRateDisplayUnit(value: unknown): value is PlannerRateDisplayUnit {
  return typeof value === 'string' && VALID_RATE_DISPLAY_UNITS.has(value as PlannerRateDisplayUnit);
}

function isAdvancedPlannerTab(value: unknown): value is AdvancedPlannerTab {
  return typeof value === 'string' && VALID_ADVANCED_PLANNER_TABS.has(value as AdvancedPlannerTab);
}

function isPlannerTargetUnit(value: unknown): value is PlannerTargetUnit {
  return typeof value === 'string' && VALID_TARGET_UNITS.has(value as PlannerTargetUnit);
}

async function copyText(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  window.prompt(t('copyPrompt'), text);
}

function buildCurrentPlanPayload(
  name = `${targets.value[0]?.itemName ?? t('multiTargetPlanning2')} ${t('savedLines')}`,
): PlannerSavePayload | null {
  if (!targets.value.length) return null;
  return {
    name,
    rootItemKey: targets.value[0]!.itemKey,
    targetAmount: targets.value[0]!.rate,
    ...(isPlannerTargetUnit(targets.value[0]!.unit) ? { targetUnit: targets.value[0]!.unit } : {}),
    useProductRecovery: useProductRecovery.value,
    selectedRecipeIdByItemKeyHash: mapToRecord(selectedRecipeIdByItemKeyHash.value),
    selectedItemIdByTagId: mapToRecord(selectedItemIdByTagId.value),
    kind: 'advanced',
    forcedRawItemKeyHashes: Array.from(forcedRawItemKeyHashes.value),
    viewState: buildSavedViewState(),
    targets: targets.value.map((t) => ({
      itemKey: t.itemKey,
      itemName: t.itemName,
      value: t.rate,
      rate: t.rate,
      unit: t.unit as ObjectiveUnit,
      type: t.type,
    })),
  };
}

function shareAsUrl(): void {
  const payload = buildCurrentPlanPayload();
  if (!payload) return;
  emit('share-plan', payload);
}

function shareByJsonUrl(): void {
  const payload = buildCurrentPlanPayload();
  if (!payload) return;
  emit('share-plan-json-url', payload);
}

function copyShareJson(): void {
  const payload = buildCurrentPlanPayload();
  if (!payload || !props.pack) return;
  const share = createPlannerShareData(props.pack.manifest.packId, payload);
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
      if (!props.pack || share.packId !== props.pack.manifest.packId) {
        $q.notify({ type: 'negative', message: t('sharePackMismatch', { packId: share.packId }) });
        return;
      }
      if (share.plan.kind !== 'advanced' || !share.plan.targets?.length) {
        $q.notify({ type: 'negative', message: t('notAdvancedPlannerShare') });
        return;
      }
      loadSavedPlan(share.plan);
      $q.notify({ type: 'positive', message: t('lineJsonImported') });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      $q.notify({ type: 'negative', message });
    }
  });
}

function buildSavedViewState(): AdvancedPlannerViewState {
  return {
    activeTab: activeTab.value,
    line: {
      displayUnit: lineDisplayUnit.value,
      collapseIntermediate: lineCollapseIntermediate.value,
      includeCycleSeeds: lineIncludeCycleSeeds.value,
      selectedNodeId: selectedLineNodeId.value,
      nodePositions: nodePositionMapToRecord(lineNodePositions.value),
    },
    quant: {
      displayUnit: quantDisplayUnit.value,
      showFluids: quantShowFluids.value,
      widthByRate: quantWidthByRate.value,
      nodePositions: nodePositionMapToRecord(quantNodePositions.value),
    },
    calc: {
      displayUnit: calcDisplayUnit.value,
    },
  };
}

function applySavedViewState(viewState: AdvancedPlannerViewState | undefined): void {
  if (isAdvancedPlannerTab(viewState?.activeTab)) {
    activeTab.value = viewState.activeTab;
  }

  const lineView = viewState?.line;
  if (isRateDisplayUnit(lineView?.displayUnit)) {
    lineDisplayUnit.value = lineView.displayUnit;
  }
  if (typeof lineView?.collapseIntermediate === 'boolean') {
    lineCollapseIntermediate.value = lineView.collapseIntermediate;
  }
  if (typeof lineView?.includeCycleSeeds === 'boolean') {
    lineIncludeCycleSeeds.value = lineView.includeCycleSeeds;
  }
  selectedLineNodeId.value =
    typeof lineView?.selectedNodeId === 'string' ? lineView.selectedNodeId : null;
  lineNodePositions.value = recordToNodePositionMap(lineView?.nodePositions);

  const quantView = viewState?.quant;
  if (isRateDisplayUnit(quantView?.displayUnit)) {
    quantDisplayUnit.value = quantView.displayUnit;
  }
  if (typeof quantView?.showFluids === 'boolean') {
    quantShowFluids.value = quantView.showFluids;
  }
  if (typeof quantView?.widthByRate === 'boolean') {
    quantWidthByRate.value = quantView.widthByRate;
  }
  quantNodePositions.value = recordToNodePositionMap(quantView?.nodePositions);

  const calcView = viewState?.calc;
  if (isRateDisplayUnit(calcView?.displayUnit)) {
    calcDisplayUnit.value = calcView.displayUnit;
  }
}

const rawItemTotals = computed(() => {
  const totals = new Map<ItemId, number>();
  if (!mergedTree.value) return totals;

  // Pre-pass: find the maximum machineCount for each recipeId across the entire merged tree.
  // For multi-output recipes, different targets may compute different rates; only the
  // highest-rate (binding) occurrence should contribute raw-material consumption.
  const maxMachineCountByRecipe = new Map<string, number>();
  const prepass = (node: RequirementNode): void => {
    if (node.kind !== 'item') return;
    const n = node as RequirementNode & {
      recipeIdUsed?: string;
      machineCount?: number;
      cycle?: boolean;
      recovery?: boolean;
    };
    if (n.recipeIdUsed && !n.cycle && !n.recovery) {
      const mc = n.machineCount ?? 0;
      const existing = maxMachineCountByRecipe.get(n.recipeIdUsed) ?? 0;
      if (mc > existing) maxMachineCountByRecipe.set(n.recipeIdUsed, mc);
    }
    node.children.forEach(prepass);
  };
  prepass(mergedTree.value.root);

  // Main walk: for each recipe, skip lower-rate occurrences and only count the max-rate one.
  const seenRecipeIds = new Set<string>();
  const walk = (node: RequirementNode) => {
    if (node.kind === 'fluid') return;
    if (node.kind === 'item') {
      const isLeaf = node.children.length === 0;
      if (isLeaf && !node.cycleSeed) {
        const prev = totals.get(node.itemKey.id) ?? 0;
        totals.set(node.itemKey.id, prev + (node.amount ?? 0));
      }
      if (!isLeaf) {
        const n = node as RequirementNode & {
          recipeIdUsed?: string;
          machineCount?: number;
          cycle?: boolean;
          recovery?: boolean;
        };
        if (n.recipeIdUsed && !n.cycle && !n.recovery) {
          const mc = n.machineCount ?? 0;
          const maxMc = maxMachineCountByRecipe.get(n.recipeIdUsed) ?? 0;
          if (mc < maxMc - 1e-9) return; // not the highest-rate occurrence — skip
          if (seenRecipeIds.has(n.recipeIdUsed)) return; // max already counted
          seenRecipeIds.add(n.recipeIdUsed);
        }
        node.children.forEach(walk);
      }
    }
  };

  walk(mergedTree.value.root);
  return totals;
});

const rawFluidTotals = computed(() => {
  const totals = new Map<string, number>();
  if (!mergedTree.value) return totals;

  // Same pre-pass as rawItemTotals: find max machineCount per recipeId.
  const maxMachineCountByRecipe = new Map<string, number>();
  const prepass = (node: RequirementNode): void => {
    if (node.kind !== 'item') return;
    const n = node as RequirementNode & {
      recipeIdUsed?: string;
      machineCount?: number;
      cycle?: boolean;
      recovery?: boolean;
    };
    if (n.recipeIdUsed && !n.cycle && !n.recovery) {
      const mc = n.machineCount ?? 0;
      const existing = maxMachineCountByRecipe.get(n.recipeIdUsed) ?? 0;
      if (mc > existing) maxMachineCountByRecipe.set(n.recipeIdUsed, mc);
    }
    node.children.forEach(prepass);
  };
  prepass(mergedTree.value.root);

  const seenRecipeIds = new Set<string>();
  const walk = (node: RequirementNode) => {
    if (node.kind === 'fluid') {
      const prev = totals.get(node.id) ?? 0;
      totals.set(node.id, prev + (node.amount ?? 0));
      return;
    }
    if (node.kind === 'item') {
      const n = node as RequirementNode & {
        recipeIdUsed?: string;
        machineCount?: number;
        cycle?: boolean;
        recovery?: boolean;
      };
      if (n.recipeIdUsed && !n.cycle && !n.recovery) {
        const mc = n.machineCount ?? 0;
        const maxMc = maxMachineCountByRecipe.get(n.recipeIdUsed) ?? 0;
        if (mc < maxMc - 1e-9) return;
        if (seenRecipeIds.has(n.recipeIdUsed)) return;
        seenRecipeIds.add(n.recipeIdUsed);
      }
      node.children.forEach(walk);
    }
  };

  walk(mergedTree.value.root);
  return totals;
});

const rawItemEntries = computed(() => {
  return Array.from(rawItemTotals.value.entries()).sort((a, b) => b[1] - a[1]);
});

const rawFluidEntries = computed(() => {
  return Array.from(rawFluidTotals.value.entries()).sort((a, b) => b[1] - a[1]);
});

type CycleSeedInfo = {
  nodeId: string;
  itemKey: ItemKey;
  amountNeeded: number;
  seedAmount: number;
  cycleFactor?: number;
};

const cycleSeedEntries = computed<CycleSeedInfo[]>(() => {
  if (!mergedTree.value) return [];
  const seedsByKey = new Map<string, CycleSeedInfo>();

  const walk = (node: RequirementNode) => {
    if (node.kind === 'item') {
      if (node.cycleSeed) {
        const key = itemKeyHash(node.itemKey);
        const amountNeeded = node.cycleAmountNeeded ?? node.amount ?? 0;
        const seedAmount = node.cycleSeedAmount ?? node.amount ?? 0;
        const prev = seedsByKey.get(key);
        if (prev) {
          prev.amountNeeded += amountNeeded;
          prev.seedAmount += seedAmount;
          if (node.cycleFactor && (!prev.cycleFactor || node.cycleFactor > prev.cycleFactor)) {
            prev.cycleFactor = node.cycleFactor;
          }
        } else {
          seedsByKey.set(key, {
            nodeId: node.nodeId,
            itemKey: node.itemKey,
            amountNeeded,
            seedAmount,
            ...(node.cycleFactor !== undefined ? { cycleFactor: node.cycleFactor } : {}),
          });
        }
      }
      node.children.forEach(walk);
    }
  };

  walk(mergedTree.value.root);
  return Array.from(seedsByKey.values()).sort((a, b) => b.amountNeeded - a.amountNeeded);
});

const planningComplete = computed(() => {
  // LP 模式：只要 LP 完成并构建了 mergedTree 就算完成，不依赖 pendingDecisions
  if (lpMode.value) return planningStarted.value && lpResult.value !== null;
  return planningStarted.value && pendingDecisions.value.length === 0;
});

function collectPendingDecisions(): PlannerDecision[] {
  if (!props.pack || !props.index || targets.value.length === 0) return [];

  const collected: PlannerDecision[] = [];
  for (const target of targets.value) {
    try {
      const decisions = computePlannerDecisions({
        pack: props.pack,
        index: props.index,
        rootItemKey: target.itemKey,
        selectedRecipeIdByItemKeyHash: selectedRecipeIdByItemKeyHash.value,
        selectedItemIdByTagId: selectedItemIdByTagId.value,
        forcedRawItemKeyHashes: forcedRawItemKeyHashes.value,
        maxDepth: 20,
      });
      collected.push(...decisions);
    } catch (e) {
      console.error('Failed to compute decisions for', target.itemName, e);
    }
  }

  const decisionsMap = new Map<string, PlannerDecision>();
  for (const d of collected) {
    const key = d.kind === 'item_recipe' ? d.itemKeyHash : `tag:${d.tagId}`;
    if (!decisionsMap.has(key)) decisionsMap.set(key, d);
  }
  return Array.from(decisionsMap.values());
}

function recomputePlanningState(): void {
  if (!planningStarted.value) return;
  allDecisions.value = collectPendingDecisions();
  if (allDecisions.value.length > 0) {
    mergedTree.value = null;
    mergedRootItemKey.value = null;
    return;
  }
  buildMergedTree();
}

const forcedRawSignature = computed(() =>
  Array.from(forcedRawItemKeyHashes.value.values()).sort().join('|'),
);

watch(forcedRawSignature, () => {
  recomputePlanningState();
});
watch(useProductRecovery, () => {
  recomputePlanningState();
  emitLiveState();
});

const buildMergedTree = () => {
  if (!props.pack || !props.index || targets.value.length === 0) return;

  // 创建虚拟配方，将所有目标合并为一个输出
  // 为了实现多目标融合，我们需要：
  // 1. 分别为每个目标构建需求树
  // 2. 合并所有中间产物的需求
  // 3. 生成统一的树结构

  try {
    const trees = targets.value
      .map((target) =>
        buildEnhancedRequirementTree({
          pack: props.pack!,
          index: props.index!,
          rootItemKey: target.itemKey,
          targetAmount: target.rate,
          targetUnit: target.unit,
          selectedRecipeIdByItemKeyHash: selectedRecipeIdByItemKeyHash.value,
          selectedItemIdByTagId: selectedItemIdByTagId.value,
          useProductRecovery: useProductRecovery.value,
          forcedRawItemKeyHashes: forcedRawItemKeyHashes.value,
          maxDepth: 20,
        }),
      )
      .filter((tree): tree is EnhancedBuildTreeResult => Boolean(tree));

    if (trees.length === 0) {
      mergedTree.value = null;
      mergedRootItemKey.value = null;
      return;
    }

    const leafItemTotals = new Map<ItemId, number>();
    const leafFluidTotals = new Map<string, number>();
    const catalysts = new Map<ItemId, number>();

    for (const tree of trees) {
      for (const [itemId, amount] of tree.leafItemTotals.entries()) {
        const existing = leafItemTotals.get(itemId) ?? 0;
        leafItemTotals.set(itemId, existing + amount);
      }
      for (const [fluidId, amount] of tree.leafFluidTotals.entries()) {
        const existing = leafFluidTotals.get(fluidId) ?? 0;
        leafFluidTotals.set(fluidId, existing + amount);
      }
      for (const [itemId, amount] of tree.catalysts.entries()) {
        const existing = catalysts.get(itemId) ?? 0;
        catalysts.set(itemId, Math.max(existing, amount));
      }
    }

    const totals = {
      machines: new Map<ItemId, number>(),
      perSecond: new Map<string, number>(),
      power: 0,
      pollution: 0,
    } satisfies EnhancedBuildTreeResult['totals'];

    // Merge machine counts by recipeId (same recipe in multiple trees → MAX, not SUM);
    // different recipes sharing the same machine type are still summed correctly.
    const mergedRecipeMachines = new Map<string, { machineItemId: ItemId; count: number }>();
    for (const tree of trees) {
      const walkRecipes = (node: RequirementNode): void => {
        if (node.kind !== 'item') return;
        const n = node as RequirementNode & {
          recipeIdUsed?: string;
          machineItemId?: ItemId;
          machineCount?: number;
          cycle?: boolean;
          recovery?: boolean;
        };
        if (n.recipeIdUsed && n.machineItemId && !n.cycle && !n.recovery) {
          const count = n.machineCount ?? 0;
          const existing = mergedRecipeMachines.get(n.recipeIdUsed);
          if (!existing || count > existing.count) {
            mergedRecipeMachines.set(n.recipeIdUsed, { machineItemId: n.machineItemId, count });
          }
        }
        node.children.forEach(walkRecipes);
      };
      walkRecipes(tree.root);
      for (const [itemId, perSecond] of tree.totals.perSecond.entries()) {
        totals.perSecond.set(itemId, (totals.perSecond.get(itemId) ?? 0) + perSecond);
      }
      totals.power += tree.totals.power;
      totals.pollution += tree.totals.pollution;
    }
    // Rebuild machines total from deduplicated per-recipe data.
    for (const { machineItemId, count } of mergedRecipeMachines.values()) {
      totals.machines.set(machineItemId, (totals.machines.get(machineItemId) ?? 0) + count);
    }

    if (trees.length === 1) {
      const singleTree = trees[0];
      if (singleTree) {
        mergedTree.value = singleTree;
        mergedRootItemKey.value = singleTree.root.kind === 'item' ? singleTree.root.itemKey : null;
        return;
      }
    }

    const virtualRoot: EnhancedRequirementNode = {
      kind: 'item',
      nodeId: 'virtual-root',
      itemKey: { id: '__multi_target__' },
      amount: 1,
      children: trees.map((t) => t.root),
      catalysts: [],
      cycle: false,
    };

    mergedTree.value = {
      root: virtualRoot,
      leafItemTotals,
      leafFluidTotals,
      catalysts,
      totals,
    };
    mergedRootItemKey.value = virtualRoot.itemKey;
  } catch (e) {
    console.error('Failed to build merged tree', e);
    mergedTree.value = null;
  }

  // LP 手动模式：决策全部解决并建好传统树后，触发 LP 求解
  if (lpMode.value && lpPendingAfterDecisions.value) {
    lpPendingAfterDecisions.value = false;
    runLpSolve();
  }
};

const addTarget = (itemKey: ItemKey, itemName: string, rate = 1) => {
  const keyHash = itemKeyHash(itemKey);
  // 检查是否已存在
  const existing = targets.value.find((t) => itemKeyHash(t.itemKey) === keyHash);
  if (existing) {
    existing.rate += rate;
    invalidatePlanningIfNeeded();
  } else {
    targets.value.push({ itemKey, itemName, rate, unit: 'per_minute', type: ObjectiveType.Output });
    invalidatePlanningIfNeeded();
  }
};

const loadSavedPlan = (payload: PlannerSavePayload) => {
  if (payload.kind !== 'advanced' || !payload.targets?.length) return;
  targets.value = payload.targets.map((t) => ({
    itemKey: t.itemKey,
    itemName: t.itemName ?? itemName(t.itemKey),
    rate: t.value ?? 1,
    unit: t.unit as 'per_second' | 'per_minute' | 'per_hour',
    type: t.type ?? ObjectiveType.Output,
  }));

  selectedRecipeIdByItemKeyHash.value = new Map(
    Object.entries(payload.selectedRecipeIdByItemKeyHash ?? {}),
  );
  selectedItemIdByTagId.value = new Map(Object.entries(payload.selectedItemIdByTagId ?? {}));
  useProductRecovery.value = payload.useProductRecovery === true;
  forcedRawItemKeyHashes.value = new Set(payload.forcedRawItemKeyHashes ?? []);
  applySavedViewState(payload.viewState);
  emitLiveState();

  allDecisions.value = [];
  mergedTree.value = null;
  mergedRootItemKey.value = null;
  collapsed.value = new Set();

  if (!props.pack || !props.index) {
    planningStarted.value = false;
    return;
  }

  planningStarted.value = true;
  recomputePlanningState();
};

const removeTarget = (index: number) => {
  targets.value.splice(index, 1);
  // 如果没有目标了，重置规划状态
  if (targets.value.length === 0) {
    resetPlanning();
  } else {
    invalidatePlanningIfNeeded();
  }
};

const updateTargetRate = (index: number, rate: number) => {
  if (rate > 0 && targets.value[index]) {
    targets.value[index].rate = rate;
    invalidatePlanningIfNeeded();
  }
};

const updateTargetUnit = (index: number, unit: 'per_second' | 'per_minute' | 'per_hour') => {
  if (targets.value[index]) {
    targets.value[index].unit = unit;
    invalidatePlanningIfNeeded();
  }
};

const updateTargetType = (index: number, type: ObjectiveType) => {
  if (targets.value[index]) {
    targets.value[index].type = type;
    invalidatePlanningIfNeeded();
  }
};

const clearTargets = () => {
  targets.value = [];
  forcedRawItemKeyHashes.value = new Set();
  resetPlanning();
};

const resetPlanning = () => {
  planningStarted.value = false;
  lpPendingAfterDecisions.value = false;
  allDecisions.value = [];
  selectedRecipeIdByItemKeyHash.value = new Map();
  selectedItemIdByTagId.value = new Map();
  mergedTree.value = null;
  mergedRootItemKey.value = null;
  collapsed.value = new Set();
  selectedLineNodeId.value = null;
  lineNodePositions.value = new Map();
  quantNodePositions.value = new Map();
};

const invalidatePlanningIfNeeded = () => {
  if (planningStarted.value) resetPlanning();
};

/** 提取 LP 求解逻辑，供多处复用 */
const runLpSolve = () => {
  if (!props.index || !props.pack) return;
  lpResult.value = null;
  lpSolving.value = true;
  const objectives: ObjectiveState[] = targets.value.map((t, i) => ({
    id: `obj_${i}`,
    targetId: t.itemKey.id,
    value: rational(t.rate),
    unit: t.unit as ObjectiveUnit,
    type: t.type,
  }));
  solveAdvanced({
    objectives,
    index: props.index,
    selectedRecipeIdByItemKeyHash: selectedRecipeIdByItemKeyHash.value,
    selectedItemIdByTagId: selectedItemIdByTagId.value as Map<string, string>,
    defaultNs: props.pack.manifest.gameId,
  })
    .then((result) => {
      lpResult.value = result;
      lpSolving.value = false;
      // 把 LP 求出的配方选择全部回写，覆盖已有选择，保证树与 LP 结果一致。
      // 对于多产物配方（如精炼炉），LP 每条配方只生成一个 Step（主产物），
      // 但副产物也需映射到同一配方；否则副产物目标会 fallback 到错误配方。
      const merged = new Map(selectedRecipeIdByItemKeyHash.value);
      for (const step of result.steps) {
        if (!step.recipeId) continue;
        const recipe = props.index!.recipesById.get(step.recipeId);
        if (recipe) {
          const recipeType = props.index!.recipeTypesByKey.get(recipe.type);
          const norm = normalizeRecipe(recipe, recipeType);
          for (const { key } of norm.outputItems) {
            merged.set(itemKeyHash(key), step.recipeId);
          }
        } else if (step.itemKey) {
          merged.set(itemKeyHash(step.itemKey), step.recipeId);
        }
      }
      selectedRecipeIdByItemKeyHash.value = merged;
      planningStarted.value = true;
      // LP 已决定所有配方，跳过 collectPendingDecisions 直接构建树；
      // 否则 LP 新引入的子依赖会被判为"待决策"从而清空 mergedTree。
      allDecisions.value = [];
      buildMergedTree();
    })
    .catch((e) => {
      console.error('[LP] solve failed', e);
      lpSolving.value = false;
    });
};

const startPlanning = () => {
  if (!props.index || !props.pack || targets.value.length === 0) return;

  if (lpMode.value) {
    // LP 手动模式：先走普通决策流程，让用户自行选配方，决策完成后自动触发 LP
    lpResult.value = null;
    lpPendingAfterDecisions.value = true;
    planningStarted.value = false;
    allDecisions.value = [];
    selectedRecipeIdByItemKeyHash.value = new Map();
    selectedItemIdByTagId.value = new Map();
    mergedTree.value = null;
    mergedRootItemKey.value = null;
    collapsed.value = new Set();
    planningStarted.value = true;
    recomputePlanningState();
    return;
  }

  planningStarted.value = false;
  allDecisions.value = [];
  selectedRecipeIdByItemKeyHash.value = new Map();
  selectedItemIdByTagId.value = new Map();
  mergedTree.value = null;
  mergedRootItemKey.value = null;
  collapsed.value = new Set();
  planningStarted.value = true;
  recomputePlanningState();
};

const autoOptimize = () => {
  if (!props.index || !props.pack || targets.value.length === 0) return;
  // 每次自动优化都重新收集决策，保证新增目标生效
  startPlanning();

  // 对每个目标运行自动选择算法
  const allRecipeSelections = new Map<string, string>();
  const allTagSelections = new Map<string, ItemId>();

  for (const target of targets.value) {
    try {
      const autoSelections = autoPlanSelections({
        pack: props.pack,
        index: props.index,
        rootItemKey: target.itemKey,
        useProductRecovery: useProductRecovery.value,
        maxDepth: 20,
      });

      // 合并选择结果
      for (const [keyHash, recipeId] of Object.entries(
        autoSelections.selectedRecipeIdByItemKeyHash,
      )) {
        allRecipeSelections.set(keyHash, recipeId);
      }

      for (const [tagId, itemId] of Object.entries(autoSelections.selectedItemIdByTagId)) {
        allTagSelections.set(tagId, itemId);
      }
    } catch (e) {
      console.error('Failed to auto optimize for', target.itemName, e);
    }
  }

  // 应用自动选择
  selectedRecipeIdByItemKeyHash.value = allRecipeSelections;
  selectedItemIdByTagId.value = allTagSelections;

  if (lpMode.value) {
    // LP 自动优化：配方已自动选好，直接跑 LP，不经过决策面板
    lpPendingAfterDecisions.value = false;
    runLpSolve();
    return;
  }
  recomputePlanningState();
};

const itemName = (itemKey: ItemKey): string => {
  if (itemKey.id === '__multi_target__') return t('multiTargetPlanning2');
  const keyHash = itemKeyHash(itemKey);
  return props.itemDefsByKeyHash?.[keyHash]?.name ?? itemKey.id;
};

function itemColorOfDef(def?: ItemDef): string | null {
  const fromDef = (def as { color?: string } | undefined)?.color?.trim();
  if (fromDef) return fromDef;
  const fromRarity = def?.rarity?.color?.trim();
  if (fromRarity) return fromRarity;
  const fromSprite = def?.iconSprite?.color?.trim();
  if (fromSprite) return fromSprite;
  return null;
}

const recoverySourceText = (node: {
  recovery?: boolean;
  recoverySourceItemKey?: ItemKey;
  recoverySourceRecipeId?: string;
  recoverySourceRecipeTypeKey?: string;
}): string => {
  if (!node.recovery) return '';
  const sourceItem = node.recoverySourceItemKey ? itemName(node.recoverySourceItemKey) : '';
  const sourceRecipe = node.recoverySourceRecipeTypeKey ?? node.recoverySourceRecipeId ?? '';
  if (sourceItem && sourceRecipe) return `回收自 ${sourceItem} (${sourceRecipe})`;
  if (sourceItem) return `回收自 ${sourceItem}`;
  if (sourceRecipe) return `回收自 ${sourceRecipe}`;
  return t('recovery');
};

function isForcedRawKey(itemKey: ItemKey): boolean {
  return forcedRawItemKeyHashes.value.has(itemKeyHash(itemKey));
}

function setForcedRawForKey(itemKey: ItemKey, forced: boolean): void {
  const keyHash = itemKeyHash(itemKey);
  if (targetRootHashes.value.has(keyHash)) return;
  const next = new Set(forcedRawItemKeyHashes.value);
  if (forced) next.add(keyHash);
  else next.delete(keyHash);
  forcedRawItemKeyHashes.value = next;
}

function setForcedRawByKeyHash(keyHash: string, forced: boolean): void {
  if (targetRootHashes.value.has(keyHash)) return;
  const next = new Set(forcedRawItemKeyHashes.value);
  if (forced) next.add(keyHash);
  else next.delete(keyHash);
  forcedRawItemKeyHashes.value = next;
}

function setForcedRawForItemId(itemId: string, forced: boolean): void {
  const keyHash = itemKeyHash({ id: itemId });
  if (targetRootHashes.value.has(keyHash)) return;
  if (forced) {
    setForcedRawForKey({ id: itemId }, true);
    return;
  }
  const next = new Set(forcedRawItemKeyHashes.value);
  Array.from(next).forEach((hash) => {
    const def = props.itemDefsByKeyHash?.[hash];
    const defId = def?.key?.id;
    if (defId === itemId || (!def && hash === keyHash)) {
      next.delete(hash);
    }
  });
  next.delete(keyHash);
  forcedRawItemKeyHashes.value = next;
}

const decisionKey = (d: PlannerDecision): string => {
  return d.kind === 'item_recipe' ? `recipe:${d.itemKeyHash}` : `tag:${d.tagId}`;
};

const recipeOptionsForDecision = (d: Extract<PlannerDecision, { kind: 'item_recipe' }>) => {
  if (!props.index) return [];

  return d.recipeOptions.map((recipeId: string) => {
    const r = props.index!.recipesById.get(recipeId);
    const recipeType = r ? props.index!.recipeTypesByKey.get(r.type) : undefined;
    const label = r ? `${recipeType?.displayName ?? r.type}` : recipeId;
    const inputs: Stack[] = r ? extractRecipeStacks(r, recipeType).inputs : [];
    return { label, value: recipeId, inputs, recipe: r, recipeType };
  });
};

const getSelectedRecipe = (itemKeyHash: string): string | null => {
  return selectedRecipeIdByItemKeyHash.value.get(itemKeyHash) ?? null;
};

const getSelectedTag = (tagId: string): string | null => {
  return selectedItemIdByTagId.value.get(tagId) ?? null;
};

const setRecipeChoice = (itemKeyHash: string, recipeId: string) => {
  const next = new Map(selectedRecipeIdByItemKeyHash.value);
  next.set(itemKeyHash, recipeId);
  selectedRecipeIdByItemKeyHash.value = next;
  recomputePlanningState();
  emitLiveState();
};

const setTagChoice = (tagId: string, itemId: string) => {
  const next = new Map(selectedItemIdByTagId.value);
  next.set(tagId, itemId);
  selectedItemIdByTagId.value = next;
  recomputePlanningState();
  emitLiveState();
};

function mapToRecord<V extends string>(m: Map<string, V>): Record<string, V> {
  return Object.fromEntries(m.entries());
}

function emitLiveState() {
  emit('state-change', {
    targetAmount: targets.value[0]?.rate ?? 1,
    ...(isPlannerTargetUnit(targets.value[0]?.unit) ? { targetUnit: targets.value[0]?.unit } : {}),
    useProductRecovery: useProductRecovery.value,
    selectedRecipeIdByItemKeyHash: mapToRecord(selectedRecipeIdByItemKeyHash.value),
    selectedItemIdByTagId: mapToRecord(selectedItemIdByTagId.value),
    forcedRawItemKeyHashes: Array.from(forcedRawItemKeyHashes.value),
    viewState: buildSavedViewState(),
  });
}

function openSaveDialog() {
  const base = targets.value.length ? targets.value[0]!.itemName : t('multiTargetPlanning2');
  saveName.value = `${base} 线路`;
  saveDialogOpen.value = true;
}

function confirmSave() {
  const payload = buildCurrentPlanPayload(saveName.value.trim());
  if (!payload) return;
  emit('save-plan', payload);
  saveDialogOpen.value = false;
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

const tagItemOptions = (d: Extract<PlannerDecision, { kind: 'tag_item' }>) => {
  if (!props.index) return [];

  return d.candidateItemIds
    .map((itemId: ItemId) => {
      const keyHashes = props.index!.itemKeyHashesByItemId.get(itemId) ?? [];
      const keyHash = keyHashes[0];
      const def = keyHash ? props.itemDefsByKeyHash?.[keyHash] : undefined;
      const label = def?.name ? `${def.name} (${itemId})` : itemId;
      return { label, value: itemId };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
};

function toggleCollapsed(nodeId: string) {
  const next = new Set(collapsed.value);
  if (next.has(nodeId)) next.delete(nodeId);
  else next.add(nodeId);
  collapsed.value = next;
}

type TreeRow = { node: RequirementNode; depth: number };
type TreeListRow = { node: RequirementNode; connect: boolean[] };

const treeRows = computed<TreeRow[]>(() => {
  if (!mergedTree.value) return [];
  const rows: TreeRow[] = [];

  const walk = (node: RequirementNode, depth: number) => {
    rows.push({ node, depth });
    if (node.kind !== 'item') return;
    if (collapsed.value.has(node.nodeId)) return;
    node.children.forEach((c) => walk(c, depth + 1));
  };

  walk(mergedTree.value.root, 0);
  return rows;
});

const treeListRows = computed<TreeListRow[]>(() => {
  if (!mergedTree.value) return [];
  const rows: TreeListRow[] = [];

  const walk = (node: RequirementNode, connect: boolean[]) => {
    rows.push({ node, connect });
    if (node.kind !== 'item') return;
    if (collapsed.value.has(node.nodeId)) return;
    node.children.forEach((c, idx) => walk(c, [...connect, idx !== node.children.length - 1]));
  };

  walk(mergedTree.value.root, []);
  return rows;
});

const recoveryProducedByNodeId = computed(() => {
  const out = new Map<string, Array<{ itemKey: ItemKey; amount: number }>>();
  if (!mergedTree.value) return out;

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

  walk(mergedTree.value.root);
  byNodeAndItem.forEach((bucket, nodeId) => out.set(nodeId, Array.from(bucket.values())));
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
  if (treeDisplayUnit.value === 'per_second') return t('itemsPerSecond');
  if (treeDisplayUnit.value === 'per_hour') return t('itemsPerHour');
  return t('itemsPerMinute');
});

function finiteOr(n: unknown, fallback: number): number {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function nodeDisplayAmount(node: RequirementNode): number {
  return finiteOr(node.amount, 0);
}

function nodeDisplayRate(node: RequirementNode): number {
  const amount = nodeDisplayAmount(node);
  if (treeDisplayUnit.value === 'per_second') return amount / 60;
  if (treeDisplayUnit.value === 'per_hour') return amount * 60;
  return amount;
}

function nodeDisplayRateByUnit(
  node: RequirementNode,
  unit: 'per_second' | 'per_minute' | 'per_hour',
): number {
  const amount = nodeDisplayAmount(node);
  if (unit === 'per_second') return amount / 60;
  if (unit === 'per_hour') return amount * 60;
  return amount;
}

function nodeBeltsText(node: RequirementNode): string {
  if (node.kind !== 'item') return '';
  const perSecond = nodeDisplayAmount(node) / 60;
  const belts = perSecond / beltSpeed.value;
  if (!Number.isFinite(belts) || belts <= 0) return '';
  if (belts < 0.1) return '<0.1';
  return String(formatAmount(belts));
}

function nodeMachinesText(node: RequirementNode): string {
  if (node.kind !== 'item') return '';
  const meta = node as RequirementNode & { machineCount?: unknown; machines?: unknown };
  const machineCount = finiteOr(meta.machineCount, 0);
  if (Number.isFinite(machineCount) && machineCount > 0) return String(Math.round(machineCount));
  const machines = finiteOr(meta.machines, 0);
  if (!Number.isFinite(machines) || machines <= 0) return '';
  return String(Math.ceil(machines - 1e-9));
}

function nodePowerText(node: RequirementNode): string {
  if (node.kind !== 'item') return '';
  const power = finiteOr((node as RequirementNode & { power?: unknown }).power, 0);
  if (!Number.isFinite(power) || power <= 0) return '';
  return `${formatAmount(power)} kW`;
}

function formatAmount(n: number) {
  if (!Number.isFinite(n)) return 0;
  const rounded = Math.round(n * 1000) / 1000;
  return rounded;
}

function unitSuffix(unit: 'per_second' | 'per_minute' | 'per_hour') {
  if (unit === 'per_second') return '/s';
  if (unit === 'per_hour') return '/h';
  return '/min';
}

function displayRateFromAmount(
  amountPerMinute: number,
  unit: 'per_second' | 'per_minute' | 'per_hour',
) {
  if (unit === 'per_second') return amountPerMinute / 60;
  if (unit === 'per_hour') return amountPerMinute * 60;
  return amountPerMinute;
}

function rateByUnitFromPerSecond(
  perSecond: number,
  unit: 'per_second' | 'per_minute' | 'per_hour',
) {
  if (unit === 'per_second') return perSecond;
  if (unit === 'per_hour') return perSecond * 3600;
  return perSecond * 60;
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

type GraphNodeData = {
  kind: 'item' | 'fluid';
  title: string;
  subtitle: string;
  itemKey?: ItemKey;
  machineItemId?: ItemId;
  machineCount?: number;
  cycle?: boolean;
  cycleSeed?: boolean;
  recovery?: boolean;
  recoverySource?: string;
};

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

const graphFlow = computed(() => {
  if (!mergedTree.value) return { nodes: [] as Node<GraphNodeData>[], edges: [] as Edge[] };

  const nodes: Node<GraphNodeData>[] = [];
  const edges: Edge[] = [];
  const nodeW = 240;
  const nodeH = 64;
  const gapX = 64;
  const gapY = 96;
  const pad = 16;

  const leafSpan = new WeakMap<RequirementNode, number>();
  const isVisible = (node: RequirementNode) => node.kind !== 'fluid' || graphShowFluids.value;
  const recoverySourceKey = (recipeId: string, sourceItemKey: ItemKey, recipeTypeKey?: string) =>
    `${recipeId}|${itemKeyHash(sourceItemKey)}|${recipeTypeKey ?? ''}`;
  const sourceNodeIdsByRecoveryKey = new Map<string, string[]>();
  const collectRecoverySourceNodes = (node: RequirementNode, path: string) => {
    if (!isVisible(node) || node.kind !== 'item') return;
    if (!node.recovery && node.recipeIdUsed) {
      const key = recoverySourceKey(node.recipeIdUsed, node.itemKey, node.recipeTypeKeyUsed);
      const bucket = sourceNodeIdsByRecoveryKey.get(key) ?? [];
      bucket.push(`g:${path}`);
      sourceNodeIdsByRecoveryKey.set(key, bucket);
    }
    const visibleChildren = node.children.filter(isVisible);
    visibleChildren.forEach((c, idx) => collectRecoverySourceNodes(c, `${path}.${idx}`));
  };
  collectRecoverySourceNodes(mergedTree.value.root, '0');
  const recoveryEdgeKeys = new Set<string>();

  // 合并原材料：收集所有原材料节点并按 itemKey 分组
  const rawMaterialsMap = new Map<string, { nodes: RequirementNode[]; totalRate: number }>();
  const rawMaterialNodeIds = new Set<string>();

  const collectRawMaterials = (node: RequirementNode, path: string) => {
    if (!isVisible(node)) return;
    const nodeId = `g:${path}`;

    if (node.kind === 'item') {
      const visibleChildren = node.children.filter(isVisible);
      const isRaw = visibleChildren.length === 0;

      if (isRaw && graphMergeRawMaterials.value) {
        const key = itemKeyHash(node.itemKey);
        rawMaterialNodeIds.add(nodeId);

        if (!rawMaterialsMap.has(key)) {
          rawMaterialsMap.set(key, { nodes: [], totalRate: 0 });
        }
        const entry = rawMaterialsMap.get(key)!;
        entry.nodes.push(node);
        entry.totalRate += nodeDisplayRateByUnit(node, graphDisplayUnit.value);
      } else {
        visibleChildren.forEach((c, idx) => collectRawMaterials(c, `${path}.${idx}`));
      }
    }
  };

  if (graphMergeRawMaterials.value) {
    collectRawMaterials(mergedTree.value.root, '0');
  }

  const countLeaves = (node: RequirementNode): number => {
    if (!isVisible(node)) return 0;
    if (node.kind === 'item') {
      const visibleChildren = node.children.filter(isVisible);
      if (visibleChildren.length === 0) {
        leafSpan.set(node, 1);
        return 1;
      }
      const sum = visibleChildren.reduce((acc, child) => acc + countLeaves(child), 0);
      const span = Math.max(1, sum);
      leafSpan.set(node, span);
      return span;
    }
    leafSpan.set(node, 1);
    return 1;
  };

  countLeaves(mergedTree.value.root);

  // Deduplicate multi-output recipes: track first graph node created per recipeId.
  // Secondary occurrences of the same recipe redirect to the existing node.
  const seenRecipeToNodeId = new Map<string, string>();

  const walk = (
    node: RequirementNode,
    depth: number,
    leftX: number,
    path: string,
  ): string | null => {
    if (!isVisible(node)) return null;

    const span = leafSpan.get(node) ?? 1;
    const nodeId = `g:${path}`;
    const x = leftX + (span * (nodeW + gapX) - nodeW) / 2;
    const y = pad + depth * (nodeH + gapY);

    if (node.kind === 'item') {
      const visibleChildren = node.children.filter(isVisible);
      const isRaw = visibleChildren.length === 0;

      // 如果这是原材料节点且需要合并，创建合并后的节点
      if (isRaw && graphMergeRawMaterials.value && rawMaterialNodeIds.has(nodeId)) {
        const key = itemKeyHash(node.itemKey);
        const mergedId = `g:merged:${key}`;

        // 只为每个合并的原材料创建一次节点
        if (!nodes.find((n) => n.id === mergedId)) {
          const entry = rawMaterialsMap.get(key)!;
          const subtitle = `${formatAmount(entry.totalRate)}${unitSuffix(graphDisplayUnit.value)}`;

          nodes.push({
            id: mergedId,
            type: 'graphItemNode',
            position: { x, y },
            draggable: false,
            selectable: false,
            data: {
              kind: 'item',
              itemKey: node.itemKey,
              title: itemName(node.itemKey),
              subtitle,
              cycle: false,
              cycleSeed: false,
            },
          });
        }
        return mergedId;
      }

      const machineCount = finiteOr(
        (node as EnhancedRequirementNode & { machineCount?: number }).machineCount,
        0,
      );
      const rate = nodeDisplayRateByUnit(node, graphDisplayUnit.value);
      const subtitle = `${formatAmount(rate)}${unitSuffix(graphDisplayUnit.value)}`;
      const recoverySource = node.recovery ? recoverySourceText(node) : '';

      // Merge same-recipe nodes: if the recipe already has a node, reuse it.
      if (!node.recovery && !node.cycle && node.recipeIdUsed) {
        const existingId = seenRecipeToNodeId.get(node.recipeIdUsed);
        if (existingId) {
          // Secondary output of an already-placed recipe — point parent edge to the primary node.
          const existingNode = nodes.find((n) => n.id === existingId);
          if (existingNode && machineCount > 0) {
            const existingMc = (existingNode.data as GraphNodeData).machineCount ?? 0;
            if (machineCount > existingMc)
              (existingNode.data as GraphNodeData).machineCount = Math.round(machineCount);
          }
          return existingId;
        }
        seenRecipeToNodeId.set(node.recipeIdUsed, nodeId);
      }

      nodes.push({
        id: nodeId,
        type: 'graphItemNode',
        position: { x, y },
        draggable: false,
        selectable: false,
        data: {
          kind: 'item',
          itemKey: node.itemKey,
          title: itemName(node.itemKey),
          subtitle,
          ...(node.machineItemId !== undefined ? { machineItemId: node.machineItemId } : {}),
          ...(machineCount > 0 ? { machineCount: Math.round(machineCount) } : {}),
          cycle: node.cycle,
          cycleSeed: !!node.cycleSeed,
          ...(node.recovery ? { recovery: true, recoverySource } : {}),
        },
      });

      let childLeft = leftX;
      visibleChildren.forEach((c, idx) => {
        const childSpan = leafSpan.get(c) ?? 1;
        const childId = walk(c, depth + 1, childLeft, `${path}.${idx}`);
        if (!childId) return;

        // 避免创建重复的边
        const edgeId = `${nodeId}->${childId}`;
        if (!edges.find((e) => e.id === edgeId)) {
          edges.push({
            id: edgeId,
            source: nodeId,
            target: childId,
            type: 'smoothstep',
            markerEnd: MarkerType.ArrowClosed,
          });
        }
        if (
          c.kind === 'item' &&
          c.recovery &&
          c.recoverySourceRecipeId &&
          c.recoverySourceItemKey
        ) {
          const sourceKey = recoverySourceKey(
            c.recoverySourceRecipeId,
            c.recoverySourceItemKey,
            c.recoverySourceRecipeTypeKey,
          );
          const sourceNodeId = (sourceNodeIdsByRecoveryKey.get(sourceKey) ?? []).find(
            (id) => id !== nodeId,
          );
          if (sourceNodeId && sourceNodeId !== childId) {
            const recoveryEdgeKey = `${sourceNodeId}->${childId}`;
            if (!recoveryEdgeKeys.has(recoveryEdgeKey)) {
              recoveryEdgeKeys.add(recoveryEdgeKey);
              edges.push({
                id: `recovery:${recoveryEdgeKey}`,
                source: sourceNodeId,
                target: childId,
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#26a69a', strokeDasharray: '6 4' },
                label: 'recovery',
                labelBgPadding: [4, 2],
                labelBgBorderRadius: 4,
                markerEnd: MarkerType.ArrowClosed,
              });
            }
          }
        }
        childLeft += childSpan * (nodeW + gapX);
      });
    } else {
      const rate = nodeDisplayRateByUnit(node, graphDisplayUnit.value);
      const subtitle = `${formatAmount(rate)}${unitSuffix(graphDisplayUnit.value)}`;
      nodes.push({
        id: nodeId,
        type: 'graphFluidNode',
        position: { x, y },
        draggable: false,
        selectable: false,
        data: {
          kind: 'fluid',
          title: node.id,
          subtitle: node.unit ? `${subtitle} ${node.unit}` : subtitle,
        },
      });
    }

    return nodeId;
  };

  walk(mergedTree.value.root, 0, pad, '0');
  return { nodes, edges };
});

const graphFlowNodesStyled = computed(() => {
  return graphFlow.value.nodes.map((node) => {
    const saved = graphNodePositions.value.get(node.id);
    return {
      ...node,
      ...(saved ? { position: saved } : {}),
      draggable: true,
      selectable: true,
    };
  });
});

const graphFlowEdgesStyled = computed(() => {
  const selectedId = selectedGraphNodeId.value;
  if (!selectedId) {
    return graphFlow.value.edges.map((edge) => ({
      ...edge,
      ...(edge.style !== undefined ? { style: edge.style } : {}),
      ...(edge.zIndex !== undefined ? { zIndex: edge.zIndex } : {}),
    }));
  }

  const outEdgesBySource = new Map<string, Edge[]>();
  const inEdgesByTarget = new Map<string, Edge[]>();
  graphFlow.value.edges.forEach((edge) => {
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

  return graphFlow.value.edges.map((edge) => {
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

const graphFlowNodes = computed(() => graphFlow.value.nodes);

const lineModel = computed<ReturnType<typeof buildProductionLineModel>>(() => {
  if (!mergedTree.value) return { nodes: [], edges: [] };

  const roots =
    mergedTree.value.root.kind === 'item' && mergedTree.value.root.itemKey.id === '__multi_target__'
      ? mergedTree.value.root.children
      : [mergedTree.value.root];

  const mergedNodeById = new Map<
    string,
    ReturnType<typeof buildProductionLineModel>['nodes'][number]
  >();
  const mergedEdgeById = new Map<
    string,
    ReturnType<typeof buildProductionLineModel>['edges'][number]
  >();

  roots.forEach((root) => {
    const params: Parameters<typeof buildProductionLineModel>[0] = {
      root: root as RequirementNode,
      includeCycleSeeds: lineIncludeCycleSeeds.value,
      collapseIntermediateItems: lineCollapseIntermediate.value,
    };
    if (root.kind === 'item') {
      params.rootItemKey = root.itemKey;
    }
    const model = buildProductionLineModel(params);

    model.nodes.forEach((n) => {
      const prev = mergedNodeById.get(n.nodeId);
      if (!prev) {
        mergedNodeById.set(n.nodeId, { ...n });
        return;
      }

      if (n.kind === 'item' && prev.kind === 'item') {
        prev.amount += n.amount;
        if (n.seedAmount !== undefined) {
          prev.seedAmount = (prev.seedAmount ?? 0) + n.seedAmount;
        }
        if (n.isRoot) prev.isRoot = true;
      } else if (n.kind === 'fluid' && prev.kind === 'fluid') {
        prev.amount += n.amount;
      } else if (n.kind === 'machine' && prev.kind === 'machine') {
        prev.amount += n.amount;
        if (n.machineCount !== undefined) {
          prev.machineCount = (prev.machineCount ?? 0) + n.machineCount;
        }
        if (n.machines !== undefined) {
          prev.machines = (prev.machines ?? 0) + n.machines;
        }
        if (!prev.machineItemId && n.machineItemId) prev.machineItemId = n.machineItemId;
        if (!prev.machineName && n.machineName) prev.machineName = n.machineName;
        n.outputItemKeys.forEach((k2) => {
          const h2 = itemKeyHash(k2);
          if (!prev.outputItemKeys.some((x) => itemKeyHash(x) === h2)) prev.outputItemKeys.push(k2);
        });
        if (n.outputDetails?.length) {
          if (!prev.outputDetails) prev.outputDetails = [];
          n.outputDetails.forEach((d) => {
            const h2 = itemKeyHash(d.key);
            const existing = prev.outputDetails!.find((x) => itemKeyHash(x.key) === h2);
            if (!existing) {
              prev.outputDetails!.push({ ...d });
              return;
            }
            existing.demanded += d.demanded;
            existing.machineCountOwn += d.machineCountOwn;
            existing.surplusRate += d.surplusRate;
          });
        }
      }
    });

    model.edges.forEach((e) => {
      const prev = mergedEdgeById.get(e.id);
      if (!prev) {
        mergedEdgeById.set(e.id, { ...e });
        return;
      }
      prev.amount += e.amount;
    });
  });

  mergedNodeById.forEach((n) => {
    if (n.kind !== 'item') return;
    const hash = itemKeyHash(n.itemKey);
    if (targetRootHashes.value.has(hash)) n.isRoot = true;
  });

  return { nodes: Array.from(mergedNodeById.values()), edges: Array.from(mergedEdgeById.values()) };
});

const lineFlow = computed(() => {
  if (!mergedTree.value) return { nodes: [] as Node[], edges: [] as Edge[] };

  const model = lineModel.value;
  if (!model.nodes.length) return { nodes: [] as Node[], edges: [] as Edge[] };

  const titleById = new Map<string, string>();
  const unit = lineDisplayUnit.value;
  const unitText = unitSuffix(unit);

  const nodes: Node[] = model.nodes.map((n) => {
    if (n.kind === 'item') {
      const base = `${formatAmount(displayRateFromAmount(n.amount, unit))}${unitText}`;
      const seed =
        lineIncludeCycleSeeds.value && n.seedAmount && n.seedAmount > 0
          ? ` (seed ${formatAmount(n.seedAmount)})`
          : '';
      const subtitle = n.isSurplus ? `冗余 +${base}` : `${base}${seed}`;
      const title = itemName(n.itemKey);
      const recoverySource = n.recovery ? recoverySourceText(n) : '';
      titleById.set(n.nodeId, title);
      return {
        id: n.nodeId,
        type: 'lineItemNode',
        position: { x: 0, y: 0 },
        draggable: true,
        selectable: true,
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
      const subtitle = `${formatAmount(displayRateFromAmount(n.amount, unit))}${unitText}${n.unit ?? ''}`;
      titleById.set(n.nodeId, n.id);
      return {
        id: n.nodeId,
        type: 'lineFluidNode',
        position: { x: 0, y: 0 },
        draggable: true,
        selectable: true,
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
        ? `总产 ${formatAmount(displayRateFromAmount(totalProduced, unit))}${unitText} / 已用 ${formatAmount(displayRateFromAmount(totalUsed, unit))}${unitText}`
        : `${outName} ${formatAmount(displayRateFromAmount(n.amount, unit))}${unitText}`;
    titleById.set(n.nodeId, title);
    return {
      id: n.nodeId,
      type: 'lineMachineNode',
      position: { x: 0, y: 0 },
      draggable: true,
      selectable: true,
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
                demandedText: `${formatAmount(displayRateFromAmount(d.demanded, unit))}${unitText}`,
                usedText: `${formatAmount(displayRateFromAmount(d.demanded, unit))}${unitText}`,
                producedText: `${formatAmount(displayRateFromAmount(d.demanded + Math.max(0, d.surplusRate), unit))}${unitText}`,
                ...(d.surplusRate > 1e-9
                  ? {
                      surplusText: `${formatAmount(displayRateFromAmount(d.surplusRate, unit))}${unitText}`,
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
    const label = `${formatAmount(displayRateFromAmount(e.amount, unit))}${unitText}${recovery ? ' ♻' : surplus ? ' □' : ''}`;
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

  const nodeW = 340;
  const nodeH = 64;
  const gapX = 90;
  const gapY = 48;
  const pad = 18;

  const ids = nodes.map((n) => n.id);
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
  const X_GAP = 60;
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

const lineFlowNodes = computed(() => {
  return lineFlow.value.nodes.map((node) => ({
    ...node,
    draggable: true,
  }));
});
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
    const color = itemColorOfDef(props.itemDefsByKeyHash?.[itemKeyHash(data.itemKey)]);
    if (color) return color;
  }
  return null;
}
const lineFlowEdgesStyled = computed(() => {
  const selectedId = selectedLineNodeId.value;
  if (!selectedId) {
    return lineFlowEdges.value.map((edge) => ({
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
  lineFlowEdges.value.forEach((edge) => {
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
    lineFlowNodes.value
      .filter((n) => n.type === 'lineItemNode' && (n.data as LineFlowItemData).isRoot)
      .map((n) => n.id),
  );
  const itemIds = new Set(
    lineFlowNodes.value.filter((n) => n.type === 'lineItemNode').map((n) => n.id),
  );
  const incomingFromMachine = new Set<string>();
  lineFlowEdges.value.forEach((e) => {
    if (e.source.startsWith('m:') && itemIds.has(e.target)) incomingFromMachine.add(e.target);
  });
  const leafItemIds = new Set(Array.from(itemIds).filter((id) => !incomingFromMachine.has(id)));

  return lineFlowEdges.value.map((edge) => {
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

const quantModel = computed<ReturnType<typeof buildQuantFlowModel>>(() => {
  if (!mergedTree.value) return { nodes: [], edges: [] };

  const roots =
    mergedTree.value.root.kind === 'item' && mergedTree.value.root.itemKey.id === '__multi_target__'
      ? mergedTree.value.root.children
      : [mergedTree.value.root];

  const mergedNodeById = new Map<string, ReturnType<typeof buildQuantFlowModel>['nodes'][number]>();
  const mergedEdgeById = new Map<string, ReturnType<typeof buildQuantFlowModel>['edges'][number]>();

  roots.forEach((root) => {
    const params: Parameters<typeof buildQuantFlowModel>[0] = {
      root: root as RequirementNode,
      includeFluids: quantShowFluids.value,
    };
    if (root.kind === 'item') {
      params.rootItemKey = root.itemKey;
    }
    const model = buildQuantFlowModel(params);

    model.nodes.forEach((n) => {
      const prev = mergedNodeById.get(n.nodeId);
      if (!prev) {
        mergedNodeById.set(n.nodeId, { ...n });
        return;
      }

      if (n.kind === 'item' && prev.kind === 'item') {
        prev.amount += n.amount;
        if (n.isRoot) prev.isRoot = true;
        if (n.recovery) prev.recovery = true;
        if (n.machineItemId && !prev.machineItemId) prev.machineItemId = n.machineItemId;
        if (n.machineName && !prev.machineName) prev.machineName = n.machineName;
        if (n.machineCount !== undefined) {
          prev.machineCount = (prev.machineCount ?? 0) + n.machineCount;
        }
      } else if (n.kind === 'fluid' && prev.kind === 'fluid') {
        prev.amount += n.amount;
      }
    });

    model.edges.forEach((e) => {
      const prev = mergedEdgeById.get(e.id);
      if (!prev) {
        mergedEdgeById.set(e.id, { ...e });
        return;
      }
      prev.amount += e.amount;
      if (e.machineItemId && !prev.machineItemId) prev.machineItemId = e.machineItemId;
      if (e.machineName && !prev.machineName) prev.machineName = e.machineName;
      if (e.machineCount !== undefined) {
        prev.machineCount = (prev.machineCount ?? 0) + e.machineCount;
      }
    });
  });

  mergedNodeById.forEach((n) => {
    if (n.kind !== 'item') return;
    const hash = itemKeyHash(n.itemKey);
    if (targetRootHashes.value.has(hash) && !n.recovery) n.isRoot = true;
  });

  return { nodes: Array.from(mergedNodeById.values()), edges: Array.from(mergedEdgeById.values()) };
});

const calcTotals = computed(() => mergedTree.value?.totals ?? null);

const calcMachineRows = computed(() => {
  if (!calcTotals.value) return [] as Array<{ id: ItemId; name: string; count: number }>;
  return Array.from(calcTotals.value.machines.entries())
    .map(([id, count]) => ({ id, name: getItemName(id), count }))
    .sort((a, b) => b.count - a.count);
});

const calcItemRows = computed(() => {
  if (!calcTotals.value) return [] as Array<{ id: ItemId; name: string; rate: number }>;
  return Array.from(calcTotals.value.perSecond.entries())
    .map(([id, perSecond]) => ({
      id,
      name: getItemName(id),
      rate: rateByUnitFromPerSecond(perSecond, calcDisplayUnit.value),
    }))
    .sort((a, b) => b.rate - a.rate);
});

const calcIntermediateRows = computed(() => {
  if (!mergedTree.value) {
    return [] as Array<{
      id: ItemId;
      name: string;
      amount: number;
      rate: number;
      forcedRaw: boolean;
    }>;
  }

  const amountById = new Map<ItemId, number>();
  const rateById = new Map<ItemId, number>();
  const rootTargetHashes = targetRootHashes.value;

  const walk = (node: RequirementNode, isRoot: boolean) => {
    if (node.kind !== 'item') return;
    const hash = itemKeyHash(node.itemKey);
    const forcedRaw = forcedRawItemKeyHashes.value.has(hash);
    const isTarget = rootTargetHashes.has(hash);
    const isIntermediate = !isRoot && !isTarget && node.children.length > 0 && !forcedRaw;
    if (isIntermediate) {
      const itemId = node.itemKey.id;
      amountById.set(itemId, (amountById.get(itemId) ?? 0) + nodeDisplayAmount(node));
      rateById.set(
        itemId,
        (rateById.get(itemId) ?? 0) +
          displayRateFromAmount(nodeDisplayAmount(node), calcDisplayUnit.value),
      );
    }
    node.children.forEach((child) => walk(child, false));
  };

  walk(mergedTree.value.root, true);

  return Array.from(amountById.entries())
    .map(([id, amount]) => ({
      id,
      name: getItemName(id),
      amount,
      rate: rateById.get(id) ?? 0,
      forcedRaw: isForcedRawKey({ id }),
    }))
    .sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name));
});

const calcForcedRawRows = computed(() => {
  if (!mergedTree.value) {
    return [] as Array<{
      keyHash: string;
      itemKey: ItemKey;
      name: string;
      amount: number;
      rate: number;
    }>;
  }

  const rowsByHash = new Map<
    string,
    { keyHash: string; itemKey: ItemKey; name: string; amount: number; rate: number }
  >();

  const walk = (node: RequirementNode) => {
    if (node.kind !== 'item') return;
    const hash = itemKeyHash(node.itemKey);
    if (forcedRawItemKeyHashes.value.has(hash) && !targetRootHashes.value.has(hash)) {
      const prev = rowsByHash.get(hash);
      const amount = nodeDisplayAmount(node);
      const rate = displayRateFromAmount(amount, calcDisplayUnit.value);
      if (prev) {
        prev.amount += amount;
        prev.rate += rate;
      } else {
        rowsByHash.set(hash, {
          keyHash: hash,
          itemKey: node.itemKey,
          name: getItemName(node.itemKey.id),
          amount,
          rate,
        });
      }
    }
    node.children.forEach((child) => walk(child));
  };

  walk(mergedTree.value.root);

  return Array.from(rowsByHash.values()).sort(
    (a, b) => b.rate - a.rate || a.name.localeCompare(b.name),
  );
});

const calcMachineTotal = computed(() => {
  return calcMachineRows.value.reduce((sum, r) => sum + r.count, 0);
});

// ─── LP raw data table ─────────────────────────────────────────────────────
const lpRawRows = computed(() => {
  if (!lpResult.value) return [];
  return lpResult.value.steps.map((step) => ({
    id: step.id,
    name: (getItemName(step.itemId ?? '') || step.recipeId) ?? step.id,
    itemId: step.itemId,
    recipeId: step.recipeId,
    perSecond: step.perSecond?.toNumber() ?? 0,
    perMinute: step.perMinute?.toNumber() ?? 0,
    machines: step.machines?.toNumber() ?? 0,
    power: step.power?.toNumber() ?? 0,
    surplus: step.surplus?.toNumber() ?? 0,
  }));
});

const lpRawColumns = computed(() => [
  { name: 'name', label: t('itemOrRecipe'), field: 'name', align: 'left' as const },
  {
    name: 'perSecond',
    label: t('outputPerSecond'),
    field: 'perSecond',
    align: 'right' as const,
    format: (v: number) => (v > 0 ? v.toFixed(4) : '-'),
  },
  {
    name: 'perMinute',
    label: t('outputPerMinute'),
    field: 'perMinute',
    align: 'right' as const,
    format: (v: number) => (v > 0 ? v.toFixed(2) : '-'),
  },
  {
    name: 'machines',
    label: t('machineCount'),
    field: 'machines',
    align: 'right' as const,
    format: (v: number) => (v > 0 ? v.toFixed(2) : '-'),
  },
  { name: 'surplus', label: t('surplusPerSecond'), field: 'surplus', align: 'right' as const },
]);
// ──────────────────────────────────────────────────────────────────────────────

const calcMachineColumns = computed(() => [
  { name: 'name', label: t('equipment'), field: 'name', align: 'left' as const },
  { name: 'count', label: t('itemCount'), field: 'count', align: 'right' as const },
]);

const calcItemColumns = computed(() => [
  { name: 'name', label: t('item'), field: 'name', align: 'left' as const },
  {
    name: 'rate',
    label: `${t('outputRate')} (${unitSuffix(calcDisplayUnit.value)})`,
    field: 'rate',
    align: 'right' as const,
  },
]);

const calcIntermediateColumns = computed(() => [
  { name: 'name', label: t('item'), field: 'name', align: 'left' as const },
  { name: 'amount', label: t('amountPerMin'), field: 'amount', align: 'right' as const },
  {
    name: 'rate',
    label: `${t('productionSpeed')} (${unitSuffix(calcDisplayUnit.value)})`,
    field: 'rate',
    align: 'right' as const,
  },
  { name: 'action', label: t('action'), field: 'action', align: 'right' as const },
]);

const calcForcedRawColumns = computed(() => [
  { name: 'name', label: t('item'), field: 'name', align: 'left' as const },
  { name: 'amount', label: t('amountPerMin'), field: 'amount', align: 'right' as const },
  {
    name: 'rate',
    label: `${t('productionSpeed')} (${unitSuffix(calcDisplayUnit.value)})`,
    field: 'rate',
    align: 'right' as const,
  },
  { name: 'action', label: t('action'), field: 'action', align: 'right' as const },
]);

const getRateUnitLabel = (unit: 'per_second' | 'per_minute' | 'per_hour') => {
  return rateUnitOptions.value.find((o) => o.value === unit)?.label ?? unit;
};

const getItemName = (itemId: ItemId): string => {
  if (!props.index) return itemId;
  const keyHashes = props.index.itemKeyHashesByItemId.get(itemId) ?? [];
  const keyHash = keyHashes[0];
  return keyHash ? (props.itemDefsByKeyHash?.[keyHash]?.name ?? itemId) : itemId;
};

const targetRootHashes = computed(() => new Set(targets.value.map((t) => itemKeyHash(t.itemKey))));

const flowBackgroundPatternColor = computed(() =>
  Dark.isActive ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.12)',
);

defineExpose({
  addTarget,
  loadSavedPlan,
});
</script>

<style scoped>
.advanced-planner {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.advanced-planner-panels {
  flex: 1 1 auto;
  min-height: 0;
}

.advanced-planner-panels :deep(.q-tab-panel) {
  /* 让标签面板高度自适应内容，外层容器提供滚动 */
  height: auto;
  overflow: visible;
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
  /* 与每行高度一致，避免使用视窗高度（vh）导致内层滚动 */
  height: 46px;
}

.planner__connect--last,
.planner__connect--trail {
  border-left: 2px dotted rgba(0, 0, 0, 0.35);
}

.planner__connect--last:not(.planner__connect--trail) {
  /* 仅作视觉终止，不影响高度 */
  margin-bottom: 0;
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

.planner__tree-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.planner__tree-indent {
  height: 1px;
}

.planner__tree-content {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.planner__graph {
  height: 640px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  overflow: hidden;
}

.planner__flow {
  width: 100%;
  height: 720px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  background: #fff;
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

.planner__pagefull--active .planner__graph,
.planner__pagefull--active .planner__flow {
  flex: 1 1 auto;
  height: auto;
  min-height: 0;
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
  background: #fff;
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

.planner__flow-node--machine {
  justify-content: space-between;
  gap: 10px;
}

.planner__handle {
  width: 10px !important;
  height: 10px !important;
  background: rgba(0, 0, 0, 0.32) !important;
  border: 1px solid rgba(255, 255, 255, 0.9) !important;
}

.planner__flow-node-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.planner__flow-node-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.planner__flow-node-title {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.planner__flow-node-sub {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  gap: 4px;
}

.planner__flow-node-machine {
  flex: 0 0 auto;
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

.decision-card {
  animation: fadeIn 0.3s ease-in;
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

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 暗色模式支持 */
.body--dark .advanced-planner {
  background-color: var(--q-dark);
}

.body--dark .planner__graph {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
}

.body--dark .planner__flow {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
}

.body--dark .planner__pagefull--active {
  background: var(--q-dark);
}

.body--dark .planner__flow-node {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.16);
}

.body--dark .planner__flow-node-sub {
  color: rgba(255, 255, 255, 0.68);
}

.body--dark .planner__quant-node-circle {
  border-color: rgba(255, 255, 255, 0.24);
  background: radial-gradient(
    circle at 35% 30%,
    rgba(255, 255, 255, 0.2),
    rgba(94, 120, 150, 0.34) 62%,
    rgba(62, 88, 117, 0.44)
  );
}

.body--dark .planner__quant-node-circle--fluid {
  background: radial-gradient(
    circle at 35% 30%,
    rgba(196, 243, 250, 0.26),
    rgba(82, 145, 157, 0.42) 62%,
    rgba(54, 109, 123, 0.5)
  );
}

.body--dark .planner__quant-node-sub {
  color: rgba(255, 255, 255, 0.72);
}

.body--dark .decision-card {
  border-color: rgba(255, 255, 255, 0.1);
}

/* 响应式布局 */
@media (max-width: 600px) {
  .advanced-planner :deep(.q-card) {
    padding: 8px !important;
  }
}

/* 修复全屏模式下 q-select 下拉菜单的 z-index 问题 */
:deep(.q-menu.planner__select-menu) {
  z-index: 99999 !important;
}
</style>
