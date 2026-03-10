import type { JeiPluginDefinition } from '../types';

export const iframeBridgePlugin: JeiPluginDefinition = {
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
};
