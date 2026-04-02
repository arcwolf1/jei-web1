import { ref, computed } from 'vue';

type TourStepPosition = 'top' | 'bottom' | 'left' | 'right' | 'center';
type TourStepInteractionType = 'click' | 'keypress' | 'custom';

interface TourStep {
  target: string;
  content: string;
  position?: TourStepPosition;
  waitForInteraction?: boolean;
  interactionType?: TourStepInteractionType;
  interactionHint?: string;
  validateInteraction?: () => boolean;
}

export type TutorialStage = 'welcome' | 'sidebar' | 'itemList' | 'recipeViewer' | 'planner' | 'advancedPlanner' | 'complete';

export interface TutorialState {
  visible: boolean;
  currentStage: TutorialStage;
  currentStepIndex: number;
  completedStages: Set<TutorialStage>;
}

const tutorialState = ref<TutorialState>({
  visible: false,
  currentStage: 'welcome',
  currentStepIndex: 0,
  completedStages: new Set<TutorialStage>(),
});

// 各阶段的教程步骤定义
const tutorialStages: Record<TutorialStage, TourStep[]> = {
  welcome: [
    {
      target: '.q-toolbar',
      content: '欢迎来到 JEI Web！这是一个物品合成查询工具，让你轻松查找游戏物品的配方和用途。',
      position: 'bottom',
    },
    {
      target: '.q-toolbar',
      content: '首先，让我们打开侧边栏。请点击左上角的菜单按钮。',
      position: 'bottom',
      waitForInteraction: true,
      interactionType: 'custom',
      interactionHint: '点击左上角的菜单按钮',
      validateInteraction: () => {
        return document.querySelector('.q-drawer:not(.q-drawer--hidden)') !== null;
      },
    },
  ],
  sidebar: [
    {
      target: '.q-drawer',
      content: '侧边栏包含所有的站点导航，你可以打开编辑器、主页、QQ群、Github等。',
      position: 'right',
    },
    {
      target: '.q-drawer',
      content: '点击"新手教程"可以随时重新打开本教程。',
      position: 'right',
    },
    {
      target: '.q-toolbar',
      content: '现在你可以关闭侧边栏继续下一步。',
      position: 'bottom',
      // waitForInteraction: true,
      // interactionType: 'custom',
      // interactionHint: '点击左上角的菜单按钮',
      // validateInteraction: () => {
      //   return document.querySelector('.q-drawer.q-drawer--hidden') !== null;
      // },
    },
  ],
  itemList: [
    {
      target: '.jei-list',
      content: '这是物品列表面板，显示所有可搜索的物品。你可以使用底部搜索栏来筛选物品。',
      position: 'left',
    },
    {
      target: '.jei-bottombar',
      content: '在搜索框中输入物品名称、ID或标签来筛选物品。支持拼音搜索！',
      position: 'top',
    },
    {
      target: '.jei-grid__cell',
      content: '鼠标悬停在物品上，然后按下 R 键可以查看配方，U 键查看用途，A 键加入收藏。',
      position: 'center',
    },
    {
      target: '.jei-grid__cell',
      content: '请尝试：将鼠标悬停在任意物品上，然后按 R 键查看配方。',
      position: 'center',
      waitForInteraction: true,
      interactionType: 'custom',
      interactionHint: '按 R 键查看配方',
      validateInteraction: () => {
        return document.querySelector('.q-tab-panel.q-pa-none.jei-panel__tab-panel') !== null;
      },
    },
  ],
  recipeViewer: [
    {
      target: '.jei-panel__body',
      content: '配方查看器显示了当前物品的所有配方和用途。你可以切换不同的配方类型查看。',
      position: 'bottom',
    },
    {
      target: '.jei-panel__body',
      content: '在配方中，鼠标悬停在物品上然后按 R 可以查看该物品的配方，按 U 查看用途。',
      position: 'bottom',
    },
  ],
  planner: [
    {
      target: '.jei-panel__body',
      content: '按 P 键可以打开计划器，计算生产目标数量所需的原料。',
      position: 'bottom',
    },
  ],
  advancedPlanner: [
    {
      target: '.jei-root',
      content: '高级计划器允许设置多个生产目标，并支持按速率（每秒/每分钟/每小时）计算。',
      position: 'center',
    },
  ],
  complete: [
    {
      target: '.jei-root',
      content: '恭喜你完成了基础教程！你可以继续探索更多功能，或随时从侧边栏帮助菜单重新打开教程。',
      position: 'center',
    },
  ],
};

export function useTutorialManager() {
  const currentSteps = computed(() => tutorialStages[tutorialState.value.currentStage] || []);

  function startTutorial(stage: TutorialStage = 'welcome') {
    tutorialState.value.currentStage = stage;
    tutorialState.value.currentStepIndex = 0;
    tutorialState.value.visible = true;
  }

  function nextStep() {
    const steps = currentSteps.value;
    if (tutorialState.value.currentStepIndex < steps.length - 1) {
      tutorialState.value.currentStepIndex++;
    } else {
      // 当前阶段完成，进入下一阶段
      nextStage();
    }
  }

  function nextStage() {
    const stages: TutorialStage[] = ['welcome', 'sidebar', 'itemList', 'recipeViewer', 'planner', 'advancedPlanner', 'complete'];
    const currentIndex = stages.indexOf(tutorialState.value.currentStage);
    tutorialState.value.completedStages.add(tutorialState.value.currentStage);

    if (currentIndex < stages.length - 1) {
      const nextStage = stages[currentIndex + 1];
      if (nextStage) {
        tutorialState.value.currentStage = nextStage;
        tutorialState.value.currentStepIndex = 0;
      }
    } else {
      // 教程完成
      tutorialState.value.visible = false;
    }
  }

  function skipTutorial() {
    tutorialState.value.visible = false;
  }

  function finishTutorial() {
    tutorialState.value.visible = false;
  }

  function jumpToStage(stage: TutorialStage, stepIndex = 0) {
    tutorialState.value.currentStage = stage;
    tutorialState.value.currentStepIndex = stepIndex;
    tutorialState.value.visible = true;
  }

  return {
    tutorialState,
    currentSteps,
    startTutorial,
    nextStep,
    nextStage,
    skipTutorial,
    finishTutorial,
    jumpToStage,
  };
}

// 导出单例实例
let tutorialManagerInstance: ReturnType<typeof useTutorialManager> | null = null;

export function getTutorialManager() {
  if (!tutorialManagerInstance) {
    tutorialManagerInstance = useTutorialManager();
  }
  return tutorialManagerInstance;
}
