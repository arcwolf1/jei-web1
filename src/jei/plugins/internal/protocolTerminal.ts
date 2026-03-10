import type { JeiPluginDefinition } from '../types';

export const protocolTerminalPlugin: JeiPluginDefinition = {
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
        keepAlive: true,
      },
    },
  ],
};
