import type { JeiPluginDefinition, PluginApiResult } from './types';
import { itemKeyHash } from 'src/jei/indexing/key';

function createCatalogApiResult(itemId: string, recipeCount: number, usageCount: number): PluginApiResult {
  return {
    status: 'success',
    title: '内置目录 API',
    summary: `已返回 ${itemId} 的聚合信息`,
    blocks: [
      { label: 'itemId', value: itemId },
      { label: 'recipes', value: String(recipeCount) },
      { label: 'uses', value: String(usageCount) },
    ],
  };
}

export const builtinPlugins: JeiPluginDefinition[] = [
  {
    id: 'external-link',
    name: '外部检索',
    version: '1.0.0',
    enabledByDefault: false,
    settings: [
      {
        key: 'searchEngine',
        label: '搜索引擎',
        type: 'select',
        defaultValue: 'bing',
        options: [
          { label: 'Google', value: 'google' },
          { label: 'Bing', value: 'bing' },
        ],
      },
    ],
    permissions: {
      allowOpenExternal: true,
    },
    queryActions: [
      {
        id: 'web-search',
        label: '外部搜索',
        icon: 'search',
        buildUrl: (context) => {
          const name = context.itemDef?.name?.trim();
          if (!name) return null;
          const engine = context.pluginSettingsById['external-link']?.searchEngine;
          const query = encodeURIComponent(name);
          if (engine === 'google') {
            return `https://www.google.com/search?q=${query}`;
          }
          return `https://www.bing.com/search?q=${query}`;
        },
      },
    ],
  },
  {
    id: 'catalog-api',
    name: '目录查询',
    version: '1.0.0',
    enabledByDefault: false,
    apiQueries: [
      {
        id: 'item-aggregate',
        label: '物品聚合',
        run: (context, signal) => {
          const def = context.itemDef;
          const index = context.index;
          if (!def || !index) {
            return Promise.resolve({
              status: 'empty',
              title: '内置目录 API',
              summary: '当前没有可查询的物品上下文',
            });
          }
          if (signal.aborted) {
            return Promise.resolve({
              status: 'error',
              title: '内置目录 API',
              summary: '请求已取消',
            });
          }
          const keyHash = itemKeyHash(def.key);
          const recipeCount = index.producingByKeyHash.get(keyHash)?.length ?? 0;
          const usageCount = index.consumingByKeyHash.get(keyHash)?.length ?? 0;
          return Promise.resolve(createCatalogApiResult(def.key.id, recipeCount, usageCount));
        },
      },
    ],
    tabs: [
      {
        key: 'catalog-api',
        label: '插件 API',
        order: 40,
        api: {
          queryId: 'item-aggregate',
        },
      },
    ],
  },
  {
    id: 'iframe-bridge',
    name: 'Iframe 服务示例',
    version: '1.0.0',
    enabledByDefault: false,
    permissions: {
      allowIframeService: true,
      allowedOrigins: ['*'],
    },
    tabs: [
      {
        key: 'iframe-service',
        label: 'Iframe 服务',
        order: 50,
        iframe: {
          src: (context) => {
            const itemId = context.itemDef?.key.id ?? '';
            const gameId = context.pack?.manifest.gameId ?? '';
            const params = new URLSearchParams({
              itemId,
              gameId,
            });
            return `/plugins/demo-iframe.html?${params.toString()}`;
          },
          allowedOrigins: ['*'],
          sandbox: 'allow-scripts allow-same-origin allow-popups',
        },
      },
    ],
  },
  {
    id: 'protocol-terminal',
    name: '协议终端',
    version: '1.0.0',
    enabledByDefault: true,
    centerTabs: [
      {
        key: 'dashboard',
        label: '协议终端',
        order: 90,
        iframe: {
          src: () => 'https://end.shallow.ink/dashboard',
          allowedOrigins: ['https://end.shallow.ink'],
          sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups',
        },
      },
    ],
  },
  {
    id: 'bilibili-wiki',
    name: 'BilibiliWiki',
    version: '1.0.0',
    enabledByDefault: true,
    tabs: [
      {
        key: 'bilibili-wiki',
        label: 'BilibiliWiki',
        order: 10,
        visibleWhen: (context) => !!context.itemDef?.name?.trim(),
        iframe: {
          src: (context) => {
            const name = context.itemDef?.name?.trim();
            if (!name) return null;
            return `https://wiki.biligame.com/zmd/${encodeURIComponent(name)}`;
          },
          allowedOrigins: ['https://wiki.biligame.com'],
          sandbox:
            'allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation',
          noApi: true,
        },
      },
    ],
  },
];
