import type { JeiPluginDefinition } from '../types';

export const endfieldPlannerPlugin: JeiPluginDefinition = {
  id: 'endfield-planner',
  name: '基质规划器',
  version: '2.0.0',
  enabledByDefault: true,
  permissions: {
    allowIframeService: true,
    allowedOrigins: ['https://essence-planner.jei.sirrus.cc'],
  },
  settings: [
    {
      key: 'useLegacy',
      label: '使用旧版引擎',
      type: 'boolean',
      defaultValue: false,
      description: '在完整基质规划器中强制使用 Legacy 渲染引擎',
    },
  ],
  tabs: [
    {
      key: 'planner',
      label: '基质规划',
      order: 20,
      visibleWhen: (context) => {
        if (!context.itemDef?.name?.trim()) return false;
        return context.itemDef.tags?.includes('sub:武器') ?? false;
      },
      iframe: {
        src: (context) => {
          const name = context.itemDef?.name?.trim();
          if (!name) return null;
          return `https://essence-planner.jei.sirrus.cc/?view=planner&embed=1&api=1&weapons=${encodeURIComponent(name)}`;
        },
        allowedOrigins: ['https://essence-planner.jei.sirrus.cc'],
        sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups',
        noApi: true,
      },
    },
    {
      key: 'match',
      label: '词条对照',
      order: 30,
      visibleWhen: (context) => {
        if (!context.itemDef?.name?.trim()) return false;
        return context.itemDef.tags?.includes('sub:武器') ?? false;
      },
      iframe: {
        src: (context) => {
          const name = context.itemDef?.name?.trim();
          if (!name) return null;
          return `https://essence-planner.jei.sirrus.cc/?view=match&embed=1&api=1&matchSource=${encodeURIComponent(name)}`;
        },
        allowedOrigins: ['https://essence-planner.jei.sirrus.cc'],
        sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups',
        noApi: true,
      },
    },
    {
      key: 'gear-refining',
      label: '装备精锻',
      order: 40,
      visibleWhen: (context) => {
        if (!context.itemDef?.name?.trim()) return false;
        return context.itemDef.tags?.includes('sub:装备') ?? false;
      },
      iframe: {
        src: (context) => {
          const name = context.itemDef?.name?.trim();
          if (!name) return null;
          return `https://essence-planner.jei.sirrus.cc/?view=gear-refining&embed=1&api=1&gearName=${encodeURIComponent(name)}`;
        },
        allowedOrigins: ['https://essence-planner.jei.sirrus.cc'],
        sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups',
        noApi: true,
      },
    },
  ],
  centerTabs: [
    {
      key: 'planner-full',
      label: '基质规划器',
      order: 10,
      iframe: {
        src: (context) => {
          const useLegacy = context.pluginSettingsById['endfield-planner']?.useLegacy;
          const renderer = useLegacy ? '&renderer=legacy' : '';
          return `https://essence-planner.jei.sirrus.cc/?view=planner&api=1${renderer}`;
        },
        allowedOrigins: ['https://essence-planner.jei.sirrus.cc'],
        sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups',
        keepAlive: true,
        noApi: true,
      },
    },
    {
      key: 'rerun-ranking',
      label: '复刻排行',
      order: 20,
      iframe: {
        src: () => 'https://essence-planner.jei.sirrus.cc/?view=rerun-ranking&embed=1&api=1',
        allowedOrigins: ['https://essence-planner.jei.sirrus.cc'],
        sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups',
        keepAlive: true,
        noApi: true,
      },
    },
  ],
};
