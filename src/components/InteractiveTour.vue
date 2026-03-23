<template>
  <Teleport to="body">
    <div v-if="modelValue && currentStep" class="tour-overlay" @click="handleOverlayClick">
      <!-- 遮罩分块（仅高亮区域可点） -->
      <template v-for="(maskStyle, index) in maskStyles" :key="`mask-${index}`">
        <div class="tour-mask" :style="maskStyle" />
      </template>

      <!-- 高亮区域 -->
      <div
        v-if="targetElement"
        class="tour-highlight"
        :class="{ 'tour-highlight--pulse': currentStep.waitForInteraction }"
        :style="highlightStyle"
      />

      <!-- 说明卡片 -->
      <div class="tour-card" :style="cardStyle" @click.stop>
        <q-card>
          <q-card-section>
            <div class="text-h6">
              <q-icon name="school" class="q-mr-sm" />
              {{ t('interactiveTour') }}
            </div>
            <!-- 阶段进度节点图 -->
            <div v-if="progress" class="tutorial-progress q-mt-md">
              <div class="text-caption text-grey-7 q-mb-xs">
                {{ t('stage') }} {{ progress.currentStage + 1 }}/{{ progress.totalStages }}:
                {{ progress.stageName }}
              </div>
              <div class="progress-dots">
                <div
                  v-for="stage in progress.totalStages"
                  :key="stage"
                  class="progress-dot"
                  :class="{
                    'progress-dot--completed': stage - 1 < progress.currentStage,
                    'progress-dot--current': stage - 1 === progress.currentStage,
                    'progress-dot--pending': stage - 1 > progress.currentStage,
                  }"
                />
              </div>
              <div class="text-caption text-grey-7 q-mt-xs">
                {{ t('step') }} {{ currentStepIndex + 1 }}/{{ steps.length }}
              </div>
            </div>
            <div v-else class="text-subtitle2 text-grey-7">
              {{ t('step') }} {{ currentStepIndex + 1 }}/{{ steps.length }}
            </div>
            <p>{{ t('tourStuckHint') }}</p>
          </q-card-section>

          <q-card-section>
            <p>{{ currentStep.content }}</p>
            <p
              v-if="currentStep.waitForInteraction"
              class="text-caption"
              :class="interactionCompleted ? 'text-positive' : 'text-primary'"
            >
              <q-icon :name="interactionCompleted ? 'check_circle' : 'touch_app'" class="q-mr-xs" />
              {{
                interactionCompleted
                  ? `✔ ${t('completedPleaseContinue')}`
                  : currentStep.interactionHint || t('pleaseCompleteOperation')
              }}
            </p>
          </q-card-section>

          <q-card-actions align="between">
            <q-btn
              v-if="currentStepIndex > 0 && !currentStep.waitForInteraction"
              flat
              :label="t('previousStep')"
              @click="previousStep"
            />
            <q-space v-if="!currentStep.waitForInteraction" />
            <q-btn flat :label="t('skipTour')" color="grey" @click="skipTour" />
            <q-btn
              v-if="!currentStep.waitForInteraction"
              v-show="currentStepIndex < steps.length - 1"
              flat
              :label="t('nextStep')"
              color="primary"
              @click="nextStep"
            />
            <q-btn
              v-if="currentStepIndex >= steps.length - 1"
              flat
              :label="isLastStage ? t('complete') : t('nextStage')"
              :color="isLastStage ? 'positive' : 'primary'"
              @click="isLastStage ? finishTour() : nextStep()"
            />
          </q-card-actions>
        </q-card>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

export type TourStepPosition = 'top' | 'bottom' | 'left' | 'right' | 'center';
export type TourStepInteractionType = 'click' | 'keypress' | 'custom';

export interface TutorialProgress {
  currentStage: number; // 当前阶段索引（从0开始）
  totalStages: number; // 总阶段数
  stageName: string; // 当前阶段名称
}

export interface TourStep {
  target: string | HTMLElement; // CSS选择器或DOM元素
  content: string;
  position?: TourStepPosition;
  // 交互式教程相关
  waitForInteraction?: boolean; // 是否需要等待用户交互
  interactionTarget?: string; // 需要交互的元素选择器
  interactionType?: TourStepInteractionType; // 交互类型
  interactionKeys?: string[]; // 对于keypress，等待的按键列表
  interactionHint?: string; // 交互提示文字
  validateInteraction?: () => boolean | Promise<boolean>; // 自定义验证函数
}

interface Props {
  steps: TourStep[];
  modelValue: boolean;
  managed?: boolean;
  progress?: TutorialProgress; // 教程进度信息
}

const props = withDefaults(defineProps<Props>(), {
  managed: false,
});
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  finish: [];
  skip: [];
  stepChange: [stepIndex: number];
  next: [];
}>();

const currentStepIndex = ref(0);
const targetElement = ref<HTMLElement | null>(null);
const interactionElement = ref<HTMLElement | null>(null);
const interactionCompleted = ref(false); // 跟踪当前交互是否完成

const currentStep = computed(() => props.steps[currentStepIndex.value]);

// 判断是否是最后一个阶段
const isLastStage = computed(() => {
  if (!props.progress) return true; // 如果没有进度信息，默认认为是最后阶段
  return props.progress.currentStage >= props.progress.totalStages - 1;
});

function getElementBox(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(element);
  const isFixed = computedStyle.position === 'fixed';
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

  return {
    top: rect.top + (isFixed ? 0 : scrollTop),
    left: rect.left + (isFixed ? 0 : scrollLeft),
    right: rect.right + (isFixed ? 0 : scrollLeft),
    bottom: rect.bottom + (isFixed ? 0 : scrollTop),
    width: rect.width,
    height: rect.height,
  };
}

const highlightStyle = computed(() => {
  const element =
    currentStep.value?.waitForInteraction && interactionElement.value
      ? interactionElement.value
      : targetElement.value;

  if (!element) return {};

  const box = getElementBox(element);

  return {
    top: `${box.top}px`,
    left: `${box.left}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
  };
});

const cardStyle = computed(() => {
  if (!targetElement.value || !currentStep.value) {
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  const box = getElementBox(targetElement.value);
  const position = currentStep.value.position || 'bottom';

  // 获取视口尺寸
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const cardWidth = 400; // max-width in CSS
  const cardHeight = 300; // 预估高度
  const padding = 16;

  // 计算各个方向的可用空间
  const spaceTop = box.top;
  const spaceBottom = viewportHeight - box.bottom;
  const spaceLeft = box.left;
  const spaceRight = viewportWidth - box.right;

  let top = 0;
  let left = 0;
  let transform = '';
  let opacity = 1;
  let finalPosition: TourStepPosition = position;

  // 检查首选方向是否有足够空间，如果没有则选择最佳方向
  const hasSpaceInPreferredDirection =
    (position === 'top' && spaceTop >= cardHeight + padding) ||
    (position === 'bottom' && spaceBottom >= cardHeight + padding) ||
    (position === 'left' && spaceLeft >= cardWidth + padding) ||
    (position === 'right' && spaceRight >= cardWidth + padding);

  if (!hasSpaceInPreferredDirection) {
    // 垂直方向优先
    if (position === 'top' || position === 'bottom') {
      if (spaceBottom >= cardHeight + padding) {
        finalPosition = 'bottom';
      } else if (spaceTop >= cardHeight + padding) {
        finalPosition = 'top';
      } else if (spaceBottom > spaceTop) {
        finalPosition = 'bottom';
      } else {
        finalPosition = 'top';
      }
    } else {
      // 水平方向
      if (spaceRight >= cardWidth + padding) {
        finalPosition = 'right';
      } else if (spaceLeft >= cardWidth + padding) {
        finalPosition = 'left';
      } else if (spaceRight > spaceLeft) {
        finalPosition = 'right';
      } else {
        finalPosition = 'left';
      }
    }

    // 如果所有方向都没有足够空间，覆盖在目标上并降低透明度
    const hasEnoughSpace =
      (finalPosition === 'top' && spaceTop >= cardHeight + padding) ||
      (finalPosition === 'bottom' && spaceBottom >= cardHeight + padding) ||
      (finalPosition === 'left' && spaceLeft >= cardWidth + padding) ||
      (finalPosition === 'right' && spaceRight >= cardWidth + padding);

    if (!hasEnoughSpace) {
      // 覆盖模式：放在目标元素上方中央，设置透明度
      opacity = 0.95;
      return {
        top: `${box.top + box.height / 2}px`,
        left: `${box.left + box.width / 2}px`,
        transform: 'translate(-50%, -50%)',
        opacity: opacity.toString(),
      };
    }
  } else {
    finalPosition = position;
  }

  // 根据最终位置计算坐标
  switch (finalPosition) {
    case 'top':
      top = Math.max(padding, box.top - padding);
      left = box.left + box.width / 2;
      transform = 'translate(-50%, -100%)';
      break;
    case 'bottom':
      top = Math.min(viewportHeight - padding, box.bottom + padding);
      left = box.left + box.width / 2;
      transform = 'translate(-50%, 0)';
      break;
    case 'left':
      top = box.top + box.height / 2;
      left = Math.max(padding, box.left - padding);
      transform = 'translate(-100%, -50%)';
      break;
    case 'right':
      top = box.top + box.height / 2;
      left = Math.min(viewportWidth - padding, box.right + padding);
      transform = 'translate(0, -50%)';
      break;
    default:
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
  }

  // 微调确保不超出视口
  const halfCardWidth = cardWidth / 2;
  if (transform.includes('-50%,')) {
    // 水平居中的情况
    if (left - halfCardWidth < padding) {
      left = halfCardWidth + padding;
    } else if (left + halfCardWidth > viewportWidth - padding) {
      left = viewportWidth - halfCardWidth - padding;
    }
  }

  return {
    top: `${top}px`,
    left: `${left}px`,
    transform,
    opacity: opacity.toString(),
  };
});

const maskStyles = computed(() => {
  const element =
    currentStep.value?.waitForInteraction && interactionElement.value
      ? interactionElement.value
      : targetElement.value;

  if (!element) {
    return [
      {
        top: '0px',
        left: '0px',
        width: '100%',
        height: '100%',
      },
    ];
  }

  const box = getElementBox(element);

  const top = box.top;
  const left = box.left;
  const right = box.right;
  const bottom = box.bottom;

  return [
    // 上
    { top: '0px', left: '0px', width: '100%', height: `${top}px` },
    // 左
    { top: `${top}px`, left: '0px', width: `${left}px`, height: `${box.height}px` },
    // 右
    {
      top: `${top}px`,
      left: `${right}px`,
      width: `calc(100% - ${right}px)`,
      height: `${box.height}px`,
    },
    // 下
    { top: `${bottom}px`, left: '0px', width: '100%', height: `calc(100% - ${bottom}px)` },
  ];
});

function findTarget(): HTMLElement | null {
  if (!currentStep.value) return null;

  const target = currentStep.value.target;
  if (typeof target === 'string') {
    const element = document.querySelector(target);
    if (!element) {
      console.warn('[InteractiveTour] target not found:', target);
    }
    return element as HTMLElement | null;
  }
  return target;
}

function findInteractionTarget(): HTMLElement | null {
  if (!currentStep.value?.waitForInteraction || !currentStep.value.interactionTarget) {
    return null;
  }
  return document.querySelector(currentStep.value.interactionTarget);
}

async function updatePosition() {
  await nextTick();
  targetElement.value = findTarget();
  interactionElement.value = findInteractionTarget();

  const scrollTarget =
    currentStep.value?.waitForInteraction && interactionElement.value
      ? interactionElement.value
      : targetElement.value;

  if (scrollTarget) {
    scrollTarget.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center',
    });
  }

  // 设置交互元素的监听
  setupInteractionListeners();
}

function handleClickInteraction(event: MouseEvent) {
  if (!currentStep.value?.waitForInteraction) return;

  const target = event.target as HTMLElement;
  if (!interactionElement.value?.contains(target)) return;

  // 检查是否需要自定义验证
  if (currentStep.value.validateInteraction) {
    const result = currentStep.value.validateInteraction();
    if (result instanceof Promise) {
      void result.then((valid) => {
        if (valid) {
          nextStep();
        }
      });
      return;
    }
    if (!result) return;
  }

  nextStep();
}

function handleKeyPressInteraction(event: KeyboardEvent) {
  if (!currentStep.value?.waitForInteraction) return;
  if (currentStep.value.interactionType !== 'keypress') return;

  const keys = currentStep.value.interactionKeys || [];
  if (keys.length > 0 && !keys.includes(event.key)) return;

  // 检查是否需要自定义验证
  if (currentStep.value.validateInteraction) {
    const result = currentStep.value.validateInteraction();
    if (result instanceof Promise) {
      void result.then((valid) => {
        if (valid) {
          nextStep();
        }
      });
      return;
    }
    if (!result) return;
  }

  nextStep();
}

function setupInteractionListeners() {
  // 清除旧的监听器
  cleanupInteractionListeners();

  if (!currentStep.value?.waitForInteraction) return;

  console.log('[InteractiveTour] setupInteractionListeners', {
    interactionType: currentStep.value.interactionType,
    hasValidateInteraction: !!currentStep.value.validateInteraction,
    hasInteractionTarget: !!currentStep.value.interactionTarget,
  });

  if (currentStep.value.interactionType === 'click' && interactionElement.value) {
    interactionElement.value.addEventListener('click', handleClickInteraction);
  } else if (currentStep.value.interactionType === 'keypress') {
    document.addEventListener('keydown', handleKeyPressInteraction);
  }

  // 如果有验证函数，启动定时检查
  if (currentStep.value.validateInteraction) {
    startValidationCheck();
  }
}

function cleanupInteractionListeners() {
  if (interactionElement.value) {
    interactionElement.value.removeEventListener('click', handleClickInteraction);
  }
  document.removeEventListener('keydown', handleKeyPressInteraction);
  stopValidationCheck();
}

let validationCheckInterval: ReturnType<typeof setInterval> | null = null;

function startValidationCheck() {
  stopValidationCheck();
  interactionCompleted.value = false;

  console.log('[InteractiveTour] startValidationCheck', {
    currentStep: currentStep.value?.content,
  });

  // 每 500ms 检查一次验证状态
  validationCheckInterval = setInterval(() => {
    if (!currentStep.value?.validateInteraction) return;

    const result = currentStep.value.validateInteraction();
    console.log('[InteractiveTour] validation check result:', result);

    if (result instanceof Promise) {
      void result.then((valid) => {
        console.log('[InteractiveTour] validation check result (async):', valid);
        if (valid && !interactionCompleted.value) {
          console.log('[InteractiveTour] validation completed (async)');
          interactionCompleted.value = true;
          // 等待 1 秒让用户看到完成状态，然后自动进入下一步
          setTimeout(() => {
            nextStep();
          }, 1000);
        }
      });
    } else if (result && !interactionCompleted.value) {
      console.log('[InteractiveTour] validation completed (sync)');
      interactionCompleted.value = true;
      // 等待 1 秒让用户看到完成状态，然后自动进入下一步
      setTimeout(() => {
        nextStep();
      }, 1000);
    }
  }, 500);
}

function stopValidationCheck() {
  if (validationCheckInterval) {
    clearInterval(validationCheckInterval);
    validationCheckInterval = null;
  }
  interactionCompleted.value = false;
}

function nextStep() {
  cleanupInteractionListeners();
  if (currentStepIndex.value < props.steps.length - 1) {
    currentStepIndex.value++;
    void updatePosition();
    emit('stepChange', currentStepIndex.value);
  } else {
    // 当前阶段最后一步，发射 next 事件让教程管理器决定
    emit('next');
  }
}

function previousStep() {
  cleanupInteractionListeners();
  if (currentStepIndex.value > 0) {
    currentStepIndex.value--;
    void updatePosition();
    emit('stepChange', currentStepIndex.value);
  }
}

function skipTour() {
  cleanupInteractionListeners();
  emit('skip');
  if (!props.managed) {
    emit('update:modelValue', false);
  }
}

function finishTour() {
  cleanupInteractionListeners();
  emit('finish');
  if (!props.managed) {
    emit('update:modelValue', false);
  }
}

function handleOverlayClick(event: MouseEvent) {
  event.stopPropagation();
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      currentStepIndex.value = 0;
      void updatePosition();
    } else {
      cleanupInteractionListeners();
    }
  },
);

watch(currentStepIndex, () => {
  interactionCompleted.value = false;
  void updatePosition();
});

// 监听 steps 变化（阶段切换时重新初始化）
watch(
  () => props.steps,
  () => {
    currentStepIndex.value = 0;
    cleanupInteractionListeners();
    void updatePosition();
  },
);

onMounted(() => {
  window.addEventListener('resize', () => void updatePosition());
  window.addEventListener('scroll', () => void updatePosition(), true);
});

onUnmounted(() => {
  cleanupInteractionListeners();
  window.removeEventListener('resize', () => void updatePosition());
  window.removeEventListener('scroll', () => void updatePosition(), true);
});
</script>

<style scoped>
.tour-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  background-color: transparent;
  pointer-events: none;
}

.tour-mask {
  position: absolute;
  background-color: rgba(0, 0, 0, 0.5);
  pointer-events: auto;
}

.tour-highlight {
  position: absolute;
  border-radius: 4px;
  box-shadow:
    0 0 0 9999px rgba(0, 0, 0, 0.5),
    0 0 0 4px #1976d2;
  pointer-events: none;
  transition: all 0.3s ease;
}

.tour-highlight--pulse {
  animation: highlight-pulse 1.5s ease-in-out infinite;
}

@keyframes highlight-pulse {
  0%,
  100% {
    box-shadow:
      0 0 0 9999px rgba(0, 0, 0, 0.5),
      0 0 0 4px #1976d2;
  }
  50% {
    box-shadow:
      0 0 0 9999px rgba(0, 0, 0, 0.5),
      0 0 0 8px #42a5f5;
  }
}

.tour-card {
  position: absolute;
  z-index: 10000;
  max-width: 400px;
  min-width: 280px;
  transition: all 0.3s ease;
  pointer-events: auto;
}

.tour-card .q-card {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

/* 教程进度节点图样式 */
.tutorial-progress {
  padding: 8px 0;
}

.progress-dots {
  display: flex;
  justify-content: center;
  gap: 8px;
  padding: 8px 0;
}

.progress-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  transition: all 0.3s ease;
  position: relative;
}

.progress-dot--completed {
  background-color: #4caf50;
  box-shadow: 0 0 8px rgba(76, 175, 80, 0.5);
}

.progress-dot--current {
  background-color: #2196f3;
  box-shadow: 0 0 12px rgba(33, 150, 243, 0.7);
  animation: pulse-dot 1.5s ease-in-out infinite;
}

.progress-dot--pending {
  background-color: #bdbdbd;
  opacity: 0.5;
}

@keyframes pulse-dot {
  0%,
  100% {
    transform: scale(1);
    box-shadow: 0 0 12px rgba(33, 150, 243, 0.7);
  }
  50% {
    transform: scale(1.2);
    box-shadow: 0 0 16px rgba(33, 150, 243, 1);
  }
}
</style>
