<template>
  <q-layout view="lHh Lpr lFf">
    <q-header>
      <q-toolbar>
        <q-btn
          flat
          dense
          round
          :class="$q.dark.isActive ? 'text-white' : 'text-grey-8'"
          icon="menu"
          aria-label="Menu"
          @click="toggleLeftDrawer"
        />

        <q-toolbar-title :class="$q.dark.isActive ? 'text-white' : 'text-grey-9'"
          >JEI-web</q-toolbar-title
        >

        <q-btn
          flat
          dense
          round
          :class="$q.dark.isActive ? 'text-white' : 'text-grey-8'"
          :icon="isPageFullscreen ? 'fullscreen_exit' : 'fullscreen'"
          aria-label="Fullscreen"
          @click="togglePageFullscreen"
        >
          <q-tooltip>{{
            isPageFullscreen ? t('exitWebFullscreen') : t('webFullscreen')
          }}</q-tooltip>
        </q-btn>

        <q-btn
          flat
          dense
          round
          :class="$q.dark.isActive ? 'text-white' : 'text-grey-8'"
          aria-label="Language"
        >
          <q-icon name="translate" />

          <q-menu>
            <q-list style="min-width: 120px">
              <q-item
                v-for="lang in languageList"
                :key="lang.code"
                clickable
                :active="settingsStore.language === lang.code"
                @click="setLanguage(lang.code)"
              >
                <q-item-section avatar>
                  <q-icon name="translate" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ lang.label }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>

        <q-btn
          flat
          dense
          round
          :class="$q.dark.isActive ? 'text-white' : 'text-grey-8'"
          aria-label="Theme"
        >
          <q-icon :name="themeIcon" />

          <q-menu>
            <q-list style="min-width: 120px">
              <q-item
                clickable
                :active="settingsStore.darkMode === 'auto'"
                @click="setTheme('auto')"
              >
                <q-item-section avatar>
                  <q-icon name="brightness_4" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ t('auto') }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-item
                clickable
                :active="settingsStore.darkMode === 'light'"
                @click="setTheme('light')"
              >
                <q-item-section avatar>
                  <q-icon name="light_mode" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ t('light') }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-item
                clickable
                :active="settingsStore.darkMode === 'dark'"
                @click="setTheme('dark')"
              >
                <q-item-section avatar>
                  <q-icon name="dark_mode" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ t('dark') }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
        <q-btn
          v-if="isHomePageRoute"
          flat
          dense
          round
          :class="$q.dark.isActive ? 'text-white' : 'text-grey-8'"
          icon="input"
          aria-label="Import Shared Plan"
          @click="triggerPlannerShareImport"
        >
          <q-tooltip>{{ t('importShareLinkOrJson') }}</q-tooltip>
        </q-btn>

        <div :class="$q.dark.isActive ? 'text-white' : 'text-grey-8'">v{{ appVersion }}</div>

        <q-btn
          flat
          dense
          no-caps
          :class="$q.dark.isActive ? 'text-white' : 'text-grey-8'"
          @click="showQQGroupDialog"
        >
          <q-icon name="group" class="q-mr-xs" />
          <span>官方QQ群：1080814651</span>
        </q-btn>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="leftDrawerOpen" bordered>
      <q-list>
        <q-item-label header> Essential Links </q-item-label>

        <EssentialLink v-for="link in linksList" :key="link.title" v-bind="link" />

        <q-separator />

        <q-item-label header> {{ t('friendLinks') }} </q-item-label>

        <q-item clickable tag="a" target="_blank" href="https://www.gamekee.com/zmd">
          <q-item-section avatar>
            <q-icon name="link" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ t('arknightsEndfieldWiki') }}</q-item-label>
            <q-item-label caption>GameKee</q-item-label>
          </q-item-section>
        </q-item>
        <q-item clickable tag="a" target="_blank" href="https://end.shallow.ink/">
          <q-item-section avatar>
            <q-icon name="link" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ t('endfieldProtocolTerminal') }}</q-item-label>
            <q-item-label caption>{{ t('entropyProjectTeam') }}</q-item-label>
          </q-item-section>
        </q-item>

        <q-separator />

        <q-item-label header> {{ t('officialQQGroupTitle') }} </q-item-label>

        <q-item
          clickable
          tag="a"
          target="_blank"
          href="https://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=zqJY9RCCW3Hs2dH_745AoKSGkd6ME0qM&authKey=f5TTWw4D3XWrz%2B3y%2FB%2BDntQY4gRUOgNz9fsIQ5umYUzXZdAyg7rqIm2z%2B2tU39RB&noverify=0&group_code=1080814651"
        >
          <q-item-section avatar>
            <q-icon name="group" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ t('officialQQGroupLabel', { groupId: '1080814651' }) }}</q-item-label>
            <q-item-label caption>{{ t('officialQQGroupCaption') }}</q-item-label>
          </q-item-section>
        </q-item>

        <q-separator />

        <q-item-label header> {{ t('help') }} </q-item-label>

        <q-item clickable @click="showTutorial">
          <q-item-section avatar>
            <q-icon name="school" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ t('tutorial') }}</q-item-label>
            <q-item-label caption>{{ t('learnHowToUse') }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <QQGroupDialog
      v-model:visible="qqGroupDialogVisible"
      title="欢迎来到 JEI Web"
      :show-dont-show-again="true"
      :managed="true"
      @close="handleQQGroupDialogClose"
    />

    <SetupWizardDialog
      v-model:visible="setupWizardVisible"
      :plugins="setupWizardPlugins"
      :packs="setupWizardPacks"
      :initial-intent="setupWizardInitialIntent"
      :initial-selected-pack="settingsStore.selectedPack"
      :initial-item-click-default-tab="settingsStore.itemClickDefaultTab"
      :initial-favorites-opens-new-stack="settingsStore.favoritesOpensNewStack"
      :initial-ui-style="settingsStore.itemListIconDisplayMode"
      :initial-mobile-item-click-opens-detail="settingsStore.mobileItemClickOpensDetail"
      :initial-hover-tooltip-allow-mouse-enter="settingsStore.hoverTooltipAllowMouseEnter"
      :initial-hover-tooltip-show-description="settingsStore.hoverTooltipDisplay.description"
      :initial-hover-tooltip-show-source-line="settingsStore.hoverTooltipDisplay.sourceLine"
      @finish="handleSetupWizardFinish"
      @skip="handleSetupWizardSkip"
    />

    <InteractiveTour
      v-model="tutorialManager.tutorialState.value.visible"
      :steps="tutorialManager.currentSteps.value"
      :progress="tutorialProgress"
      :managed="true"
      @next="tutorialManager.nextStep"
      @finish="handleTutorialFinish"
      @skip="handleTutorialSkip"
    />

    <q-page-container :class="pageContainerClass">
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Dark, useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import EssentialLink, { type EssentialLinkProps } from 'components/EssentialLink.vue';
import QQGroupDialog from 'components/QQGroupDialog.vue';
import SetupWizardDialog from 'components/SetupWizardDialog.vue';
import InteractiveTour, { type TutorialProgress } from 'components/InteractiveTour.vue';
import {
  useSettingsStore,
  type DarkMode,
  type ItemClickDefaultTab,
  type Language,
} from 'src/stores/settings';
import {
  SETUP_WIZARD_DIALOG_ID,
  TUTORIAL_DIALOG_ID,
  useDialogManager,
} from 'src/stores/dialogManager';
import { usePackOptionsStore } from 'src/stores/packOptions';
import { getTutorialManager } from 'src/composables/useTutorialManager';
import { builtinPlugins } from 'src/jei/plugins/builtin';

const settingsStore = useSettingsStore();
const dialogManager = useDialogManager();
const packOptionsStore = usePackOptionsStore();
const tutorialManager = getTutorialManager();
const $q = useQuasar();
const { t, locale } = useI18n();
const route = useRoute();
// 开发环境使用 package.json 版本，生产环境使用 git commit hash
const appVersion = import.meta.env.DEV ? '0.0.1-dev' : (__APP_VERSION__ ?? 'unknown');

// 阶段名称映射
const stageNames: Record<string, string> = {
  welcome: '欢迎',
  sidebar: '侧边栏',
  itemList: '物品列表',
  recipeViewer: '资料查看器',
  planner: '计划器',
  advancedPlanner: '高级计划',
  complete: '完成',
};

// 教程进度信息
const tutorialProgress = computed<TutorialProgress>(() => {
  const stages = [
    'welcome',
    'sidebar',
    'itemList',
    'recipeViewer',
    'planner',
    'advancedPlanner',
    'complete',
  ];
  const currentStageIndex = stages.indexOf(tutorialManager.tutorialState.value.currentStage);
  return {
    currentStage: currentStageIndex,
    totalStages: stages.length,
    stageName: stageNames[tutorialManager.tutorialState.value.currentStage] || '未知',
  };
});

// 语言相关
const languageList = [
  { code: 'zh-CN' as Language, label: '简体中文', icon: 'translate' },
  { code: 'en-US' as Language, label: 'English', icon: 'translate' },
  { code: 'ja-JP' as Language, label: '日本語', icon: 'translate' },
];

const themeIcon = computed(() => {
  if (settingsStore.darkMode === 'auto') {
    return Dark.isActive ? 'dark_mode' : 'light_mode';
  }
  return settingsStore.darkMode === 'dark' ? 'dark_mode' : 'light_mode';
});

const isHomePageRoute = computed(() => {
  const path = route.path;
  return path === '/' || path === '/item' || path.startsWith('/item/');
});

const pageContainerClass = computed(() => {
  if (!isHomePageRoute.value) return null;
  return settingsStore.debugLayout ? 'debug-scroll' : 'no-scroll';
});

function setTheme(mode: DarkMode) {
  settingsStore.setDarkMode(mode);
}

function setLanguage(lang: Language) {
  settingsStore.setLanguage(lang);
  locale.value = lang;
}

const isPageFullscreen = ref($q.fullscreen.isActive);

function handleFullscreenChange() {
  isPageFullscreen.value = $q.fullscreen.isActive;
}

function togglePageFullscreen() {
  if (!$q.fullscreen.isCapable) return;
  $q.fullscreen.toggle().catch(() => undefined);
}

function triggerPlannerShareImport() {
  window.dispatchEvent(new CustomEvent('jei:import-shared-plan'));
}

const linksList: EssentialLinkProps[] = [
  {
    title: 'Home',
    icon: 'home',
    link: '/',
  },
  {
    title: 'Wiki Renderer',
    caption: 'Block-based Wiki',
    icon: 'article',
    link: '/wiki-renderer',
  },
  {
    title: 'Editor',
    icon: 'edit',
    link: '/editor',
  },
  {
    title: 'Storage Editor',
    caption: 'LocalStorage Manager',
    icon: 'storage',
    link: '/storage-editor',
  },
  {
    title: 'Circuit Puzzle',
    caption: 'Block fitting minigame',
    icon: 'extension',
    link: '/circuit-puzzle',
  },
  {
    title: 'Puzzle Collection',
    caption: 'Curated puzzle levels',
    icon: 'library_books',
    link: '/circuit-puzzle-collection',
  },
  {
    title: 'README',
    icon: 'description',
    link: '/readme',
  },
  {
    title: 'About',
    icon: 'info',
    link: '/about',
  },
  {
    title: 'GitHub',
    caption: 'github.com/AndreaFrederica',
    icon: 'code',
    link: 'https://github.com/AndreaFrederica/jei-web',
  },
  {
    title: 'Blog',
    caption: 'blog.sirrus.cc',
    icon: 'article',
    link: 'https://blog.sirrus.cc',
  },
  {
    title: 'Wiki',
    caption: 'wiki.sirrus.cc',
    icon: 'menu_book',
    link: 'https://wiki.sirrus.cc',
  },
  {
    title: '小说助手',
    caption: 'anh.sirrus.cc',
    icon: 'auto_stories',
    link: 'https://anh.sirrus.cc',
  },
  {
    title: 'License',
    caption: 'Mozilla Public License 2.0',
    icon: 'gavel',
    link: '/license',
  },
  {
    title: 'Third-Party Licenses',
    caption: 'factoriolab-zmd (MIT)',
    icon: 'assignment',
    link: '/third-party-licenses',
  },
];

const leftDrawerOpen = ref(false);
const qqGroupDialogVisible = ref(false);
const setupWizardVisible = ref(false);
const tutorialForceShow = ref(false);
const qqGroupForceShow = ref(false);
const QQ_GROUP_DIALOG_ID = 'qq-group-intro';

type SetupWizardIntent = 'wiki' | 'recipes' | 'planner';

const setupWizardPlugins = computed(() => {
  const visiblePluginIds = [
    'external-link',
    'protocol-terminal',
    'bilibili-wiki',
    'endfield-planner',
  ];
  const descriptions: Record<string, string> = {
    'external-link': t('setupWizardPluginExternalLinkDesc'),
    'protocol-terminal': t('setupWizardPluginProtocolTerminalDesc'),
    'bilibili-wiki': t('setupWizardPluginBilibiliWikiDesc'),
    'endfield-planner': t('setupWizardPluginEndfieldPlannerDesc'),
  };
  const recommendedFor: Record<string, SetupWizardIntent[]> = {
    'external-link': ['wiki'],
    'protocol-terminal': ['recipes', 'planner'],
    'bilibili-wiki': ['wiki', 'recipes'],
    'endfield-planner': ['planner'],
  };

  return builtinPlugins
    .filter((plugin) => visiblePluginIds.includes(plugin.id))
    .map((plugin) => {
      const configured = settingsStore.pluginEnabledById[plugin.id];
      return {
        id: plugin.id,
        name: plugin.name,
        enabled: typeof configured === 'boolean' ? configured : plugin.enabledByDefault !== false,
        description: descriptions[plugin.id] ?? plugin.id,
        recommendedFor: recommendedFor[plugin.id] ?? [],
      };
    });
});

function getPackRecommendedFor(packId: string): SetupWizardIntent[] {
  if (packId === 'aef') return ['recipes', 'planner'];
  if (packId === 'aef-aggregated') return ['wiki', 'recipes'];
  if (packId === 'aef-aggregated-full') return ['wiki', 'recipes', 'planner'];
  if (packId === 'aef-skland' || packId === 'warfarin-next') return ['wiki'];
  return ['wiki', 'recipes', 'planner'];
}

function getPackDescription(packId: string, label: string): string {
  if (packId === 'aef') return t('setupWizardPackAefDesc');
  if (packId === 'aef-aggregated') return t('setupWizardPackAggregatedDesc');
  if (packId === 'aef-aggregated-full') return t('setupWizardPackAggregatedFullDesc');
  if (packId === 'aef-skland') return t('setupWizardPackSklandDesc');
  if (packId === 'warfarin-next') return t('setupWizardPackWarfarinDesc');
  if (packId.startsWith('local:')) return t('setupWizardPackLocalDesc', { label });
  return t('setupWizardPackCustomDesc', { label });
}

const setupWizardPacks = computed(() => {
  const sourceOptions = packOptionsStore.options.length
    ? packOptionsStore.options
    : settingsStore.selectedPack
      ? [{ label: settingsStore.selectedPack, value: settingsStore.selectedPack }]
      : [];

  return sourceOptions.map((pack) => ({
    value: pack.value,
    label: pack.label,
    description: getPackDescription(pack.value, pack.label),
    recommendedFor: getPackRecommendedFor(pack.value),
  }));
});

const setupWizardInitialIntent = computed<SetupWizardIntent>(() => {
  if (settingsStore.itemClickDefaultTab === 'wiki') return 'wiki';
  if (settingsStore.itemClickDefaultTab === 'planner') return 'planner';
  return 'recipes';
});

// 检测是否是PC端
function isDesktop(): boolean {
  return !!$q.platform.is.desktop;
}

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value;
}

function showQQGroupDialog() {
  qqGroupForceShow.value = true;
  dialogManager.resetDialogStatus(QQ_GROUP_DIALOG_ID);
  dialogManager.triggerProcess();
}

function handleQQGroupDialogClose(dontShowAgain: boolean) {
  console.log('[MainLayout] QQGroupDialog close', { dontShowAgain });
  if (dontShowAgain) {
    settingsStore.addAcceptedStartupDialog(QQ_GROUP_DIALOG_ID);
  }
  // 通知弹窗管理器当前弹窗已完成
  dialogManager.completeDialog();
}

function showTutorial() {
  // 手动显示教程（由侧边栏菜单触发）
  tutorialForceShow.value = true;
  dialogManager.resetDialogStatus(TUTORIAL_DIALOG_ID);
  dialogManager.triggerProcess();
}

function applySetupWizardPlugins(pluginEnabledById: Record<string, boolean>) {
  Object.entries(pluginEnabledById).forEach(([pluginId, enabled]) => {
    settingsStore.setPluginEnabled(pluginId, enabled);
  });
}

function handleSetupWizardFinish(payload: {
  intent: SetupWizardIntent;
  selectedPack: string;
  itemClickDefaultTab: ItemClickDefaultTab;
  favoritesOpensNewStack: boolean;
  uiStyle: 'modern' | 'jei_classic';
  mobileItemClickOpensDetail: boolean;
  hoverTooltipAllowMouseEnter: boolean;
  hoverTooltipShowDescription: boolean;
  hoverTooltipShowSourceLine: boolean;
  pluginEnabledById: Record<string, boolean>;
}) {
  applySetupWizardPlugins(payload.pluginEnabledById);
  if (payload.selectedPack) {
    settingsStore.setSelectedPack(payload.selectedPack);
  }
  settingsStore.setItemClickDefaultTab(payload.itemClickDefaultTab);
  settingsStore.setFavoritesOpensNewStack(payload.favoritesOpensNewStack);
  settingsStore.setItemListIconDisplayMode(payload.uiStyle);
  settingsStore.setFavoritesIconDisplayMode(payload.uiStyle);
  settingsStore.setMobileItemClickOpensDetail(payload.mobileItemClickOpensDetail);
  settingsStore.setHoverTooltipAllowMouseEnter(payload.hoverTooltipAllowMouseEnter);
  settingsStore.setHoverTooltipDisplaySetting('description', payload.hoverTooltipShowDescription);
  settingsStore.setHoverTooltipDisplaySetting('sourceLine', payload.hoverTooltipShowSourceLine);
  settingsStore.setCompletedSetupWizard(true);
  settingsStore.clearSetupWizardForceShow();
  dialogManager.completeDialog();
}

function handleSetupWizardSkip() {
  settingsStore.setCompletedSetupWizard(true);
  settingsStore.clearSetupWizardForceShow();
  dialogManager.skipDialog();
}

function handleTutorialFinish() {
  console.log('[MainLayout] tutorial finish');
  // 检查是否是最后一个阶段
  if (tutorialManager.tutorialState.value.currentStage === 'complete') {
    tutorialManager.finishTutorial();
    settingsStore.setCompletedTutorial(true);
    // 通知弹窗管理器教程已完成
    dialogManager.completeTutorial();
  } else {
    // 进入下一阶段
    tutorialManager.nextStep();
  }
}

function handleTutorialSkip() {
  console.log('[MainLayout] tutorial skip');
  tutorialManager.skipTutorial();
  settingsStore.setCompletedTutorial(true);
  // 通知弹窗管理器教程已跳过
  dialogManager.skipTutorial();
}

// 注册QQ群弹窗到弹窗管理器
dialogManager.registerDialog({
  id: QQ_GROUP_DIALOG_ID,
  priority: 'high',
  title: 'QQ群欢迎弹窗',
  canShow: () => {
    // 只有在未被接受时才显示，或手动强制展示
    return (
      !settingsStore.acceptedStartupDialogs.includes(QQ_GROUP_DIALOG_ID) || qqGroupForceShow.value
    );
  },
  onShow: () => {
    qqGroupDialogVisible.value = true;
    qqGroupForceShow.value = false;
  },
  onClose: () => {
    qqGroupDialogVisible.value = false;
    qqGroupForceShow.value = false;
  },
});

dialogManager.registerDialog({
  id: SETUP_WIZARD_DIALOG_ID,
  priority: 'high',
  title: '首次使用向导',
  canShow: () => !settingsStore.completedSetupWizard || settingsStore.setupWizardForceShow,
  onShow: () => {
    setupWizardVisible.value = true;
    leftDrawerOpen.value = false;
  },
  onClose: () => {
    setupWizardVisible.value = false;
    leftDrawerOpen.value = false;
    settingsStore.clearSetupWizardForceShow();
  },
});

// 注册教程弹窗到弹窗管理器
const tutorialShouldRegister = isDesktop();
if (tutorialShouldRegister) {
  // 只在桌面端注册教程
  dialogManager.registerDialog({
    id: TUTORIAL_DIALOG_ID,
    priority: 'low',
    title: '新手教程',
    canShow: () => {
      // 只有在PC端且教程未完成时才显示
      const canShow = isDesktop() && (!settingsStore.completedTutorial || tutorialForceShow.value);
      console.log('[MainLayout] tutorial canShow', {
        isDesktop: isDesktop(),
        completedTutorial: settingsStore.completedTutorial,
        tutorialForceShow: tutorialForceShow.value,
        result: canShow,
      });
      return canShow;
    },
    onShow: () => {
      tutorialManager.startTutorial('welcome');
      leftDrawerOpen.value = false;
    },
    onClose: () => {
      tutorialManager.tutorialState.value.visible = false;
      leftDrawerOpen.value = false;
      tutorialForceShow.value = false;
    },
  });
}

onMounted(() => {
  // 暴露函数供IndexPage调用（包加载完成后触发）
  (window as unknown as { jeiPackDialogLoaded?: () => void }).jeiPackDialogLoaded = () => {
    // 包加载完成，触发弹窗队列处理
    dialogManager.triggerProcess();
  };

  document.addEventListener('fullscreenchange', handleFullscreenChange);
  handleFullscreenChange();
});

onUnmounted(() => {
  delete (window as unknown as { jeiPackDialogLoaded?: () => void }).jeiPackDialogLoaded;
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
});
</script>

<style>
.no-scroll {
  height: 100vh;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.debug-scroll {
  overflow: auto;
  height: 100vh;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.no-scroll > .q-page,
.debug-scroll > .q-page {
  flex: 1 1 auto;
  min-height: 0;
}

/* 顶栏样式：颜色与页面背景一致，去除光晕效果 */
.q-header {
  background-color: var(--q-page-background);
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

body.body--dark .q-header {
  background-color: var(--q-page-background);
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}
</style>
