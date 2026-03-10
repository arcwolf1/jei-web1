import type { JeiPluginDefinition } from '../types';

export const bilibiliWikiPlugin: JeiPluginDefinition = {
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
};
