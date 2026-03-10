import type { JeiPluginDefinition } from '../types';

export const externalLinkPlugin: JeiPluginDefinition = {
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
};
