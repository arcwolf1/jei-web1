import type { JeiPluginDefinition, PluginApiResult } from '../types';
import { itemKeyHash } from 'src/jei/indexing/key';

function createCatalogApiResult(
  itemId: string,
  recipeCount: number,
  usageCount: number,
): PluginApiResult {
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

export const catalogApiPlugin: JeiPluginDefinition = {
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
};
