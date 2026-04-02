import { defineStore } from 'pinia';
import { storage } from 'src/utils/storage';

export type KeyAction =
  // IndexPage 快捷键
  | 'closeDialog'        // Esc - 关闭对话框
  | 'goBack'             // Backspace - 返回
  | 'viewRecipes'        // R - 查看配方
  | 'viewUses'           // U - 查看用途
  | 'viewWiki'           // W - 查看维基
  | 'viewIcon'           // I - 查看图标
  | 'viewPlanner'        // P - 查看规划器
  | 'plannerTree'        // T/1 - 树结构
  | 'plannerGraph'       // G/2 - 节点图
  | 'plannerLine'        // L/3 - 生产线
  | 'plannerCalc'        // C/4 - 计算器
  | 'plannerQuant'       // Q/5 - 量化视图
  | 'toggleFavorite'     // A - 收藏/取消收藏
  | 'addToAdvanced'      // D - 添加到高级计划器
  | 'hoverTooltipInteract' // 临时允许鼠标移入 hover
  // CircuitPuzzle 快捷键
  | 'circuitRotate'      // R - 旋转
  | 'circuitRun'         // G - 运行
  | 'circuitDeselect'    // Esc - 取消选择
  | 'circuitDelete'      // Delete/Backspace - 删除
  ;

export type KeyBinding = {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
};

export type KeyBindingsConfig = {
  [K in KeyAction]: KeyBinding;
};

const defaultKeyBindings: KeyBindingsConfig = {
  closeDialog: { key: 'Escape' },
  goBack: { key: 'Backspace' },
  viewRecipes: { key: 'r' },
  viewUses: { key: 'u' },
  viewWiki: { key: 'w' },
  viewIcon: { key: 'i' },
  viewPlanner: { key: 'p' },
  plannerTree: { key: 't' },
  plannerGraph: { key: 'g' },
  plannerLine: { key: 'l' },
  plannerCalc: { key: 'c' },
  plannerQuant: { key: 'q' },
  toggleFavorite: { key: 'a' },
  addToAdvanced: { key: 'd' },
  hoverTooltipInteract: { key: 'Shift' },
  circuitRotate: { key: 'r' },
  circuitRun: { key: 'g' },
  circuitDeselect: { key: 'Escape' },
  circuitDelete: { key: 'Delete' },
};

const KEYBINDINGS_KEY = 'jei.keybindings';

export function keyBindingToString(binding: KeyBinding): string {
  const parts: string[] = [];
  const normalizedKey = binding.key.toLowerCase();
  if (binding.ctrl && normalizedKey !== 'control') parts.push('Ctrl');
  if (binding.alt && normalizedKey !== 'alt') parts.push('Alt');
  if (binding.shift && normalizedKey !== 'shift') parts.push('Shift');
  parts.push(binding.key.length === 1 ? binding.key.toUpperCase() : binding.key);
  return parts.join('+');
}

export function parseKeyBindingString(str: string): KeyBinding | null {
  const parts = str.split('+').map(s => s.trim().toLowerCase());
  const key = parts.pop();
  if (!key) return null;

  const binding: KeyBinding = { key };
  for (const part of parts) {
    if (part === 'ctrl') binding.ctrl = true;
    else if (part === 'alt') binding.alt = true;
    else if (part === 'shift') binding.shift = true;
  }
  return binding;
}

export function eventMatchesBinding(event: KeyboardEvent, binding: KeyBinding): boolean {
  const normalizedKey = binding.key.toLowerCase();
  if (event.key.toLowerCase() !== normalizedKey) return false;
  const expectsCtrl = !!binding.ctrl || normalizedKey === 'control';
  const expectsAlt = !!binding.alt || normalizedKey === 'alt';
  const expectsShift = !!binding.shift || normalizedKey === 'shift';
  if (!!event.ctrlKey !== expectsCtrl) return false;
  if (!!event.altKey !== expectsAlt) return false;
  if (!!event.shiftKey !== expectsShift) return false;
  return true;
}

export function eventReleasesBinding(event: KeyboardEvent, binding: KeyBinding): boolean {
  const normalizedKey = binding.key.toLowerCase();
  if (event.key.toLowerCase() !== normalizedKey) return false;
  if (normalizedKey === 'control' || normalizedKey === 'alt' || normalizedKey === 'shift') {
    return true;
  }
  const expectsCtrl = !!binding.ctrl;
  const expectsAlt = !!binding.alt;
  const expectsShift = !!binding.shift;
  if (!!event.ctrlKey !== expectsCtrl) return false;
  if (!!event.altKey !== expectsAlt) return false;
  if (!!event.shiftKey !== expectsShift) return false;
  return true;
}

export function keyBindingEquals(a: KeyBinding, b: KeyBinding): boolean {
  return (
    a.key.toLowerCase() === b.key.toLowerCase() &&
    !!a.ctrl === !!b.ctrl &&
    !!a.alt === !!b.alt &&
    !!a.shift === !!b.shift
  );
}

/**
 * Load keybindings from storage
 */
async function loadKeyBindings(): Promise<KeyBindingsConfig> {
  try {
    const raw = await storage.getItem(KEYBINDINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<KeyBindingsConfig>;
      return {
        ...defaultKeyBindings,
        ...parsed,
      };
    }
  } catch {
    // Use defaults on error
  }
  return { ...defaultKeyBindings };
}

export const useKeyBindingsStore = defineStore('keybindings', {
  state: (): { bindings: KeyBindingsConfig; initialized: boolean } => ({
    bindings: { ...defaultKeyBindings },
    initialized: false,
  }),

  actions: {
    /**
     * Initialize keybindings from storage
     * Call this during app initialization
     */
    async init() {
      this.bindings = await loadKeyBindings();
      this.initialized = true;
    },

    getBinding(action: KeyAction): KeyBinding {
      return this.bindings[action] ?? defaultKeyBindings[action];
    },

    setBinding(action: KeyAction, binding: KeyBinding) {
      this.bindings[action] = binding;
      void this.save();
    },

    resetToDefaults() {
      this.bindings = { ...defaultKeyBindings };
      void this.save();
    },

    async save() {
      try {
        await storage.setItem(KEYBINDINGS_KEY, JSON.stringify(this.bindings));
      } catch (e) {
        console.error('[KeyBindings] Failed to save:', e);
      }
    },
  },
});

/**
 * Initialize keybindings store from storage
 * Call this during app initialization
 */
export async function initKeyBindingsStore() {
  const store = useKeyBindingsStore();
  await store.init();
}
