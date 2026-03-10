import { describe, expect, it } from 'vitest';
import { PluginManager, parsePluginTabKey } from './runtime';
import type { JeiPluginDefinition, PluginItemContext } from './types';

const mockContext: PluginItemContext = {
  pack: null,
  index: null,
  itemKey: null,
  itemDef: null,
  activeTab: 'recipes',
  language: 'zh-CN',
  pluginSettingsById: {},
};

function createPlugin(): JeiPluginDefinition {
  return {
    id: 'demo',
    name: 'Demo',
    version: '1.0.0',
    enabledByDefault: true,
    settings: [
      {
        key: 'engine',
        label: 'Engine',
        type: 'select',
        defaultValue: 'google',
        options: [{ label: 'Google', value: 'google' }],
      },
    ],
    queryActions: [
      {
        id: 'query',
        label: '查询',
        buildUrl: () => 'https://example.com',
      },
    ],
    apiQueries: [
      {
        id: 'api',
        label: 'API',
        run: () =>
          Promise.resolve({
            status: 'success',
            title: 'ok',
          }),
      },
    ],
    tabs: [
      {
        key: 'tab',
        label: '标签',
        order: 10,
        api: { queryId: 'api' },
      },
    ],
    centerTabs: [
      {
        key: 'terminal',
        label: '协议终端',
        order: 20,
        iframe: {
          src: () => 'https://example.com/terminal',
          allowedOrigins: ['https://example.com'],
        },
      },
    ],
  };
}

describe('plugin runtime', () => {
  it('collects actions and tabs from enabled plugins', () => {
    const manager = new PluginManager();
    manager.register(createPlugin());
    const actions = manager.getActions({}, mockContext);
    const tabs = manager.getTabs({}, mockContext);
    const centerTabs = manager.getCenterTabs({}, mockContext);
    expect(actions).toHaveLength(1);
    expect(actions[0]?.url).toBe('https://example.com');
    expect(tabs).toHaveLength(1);
    expect(tabs[0]?.tabKey).toBe('plugin:demo:tab');
    expect(centerTabs).toHaveLength(1);
    expect(centerTabs[0]?.tabKey).toBe('plugin-center:demo:terminal');
  });

  it('resolves api query by plugin id and query id', async () => {
    const manager = new PluginManager();
    manager.register(createPlugin());
    const api = manager.getApiQuery({}, mockContext, 'demo', 'api');
    expect(api).not.toBeNull();
    const result = await api!.run(new AbortController().signal);
    expect(result.status).toBe('success');
  });

  it('hides plugin artifacts when disabled in settings map', () => {
    const manager = new PluginManager();
    manager.register(createPlugin());
    const enabledById = { demo: false };
    expect(manager.getActions(enabledById, mockContext)).toHaveLength(0);
    expect(manager.getTabs(enabledById, mockContext)).toHaveLength(0);
    expect(manager.getCenterTabs(enabledById, mockContext)).toHaveLength(0);
    expect(manager.getApiQuery(enabledById, mockContext, 'demo', 'api')).toBeNull();
  });

  it('parses plugin tab key', () => {
    expect(parsePluginTabKey('plugin:abc:def')).toEqual({ pluginId: 'abc', tabKey: 'def' });
    expect(parsePluginTabKey('recipes')).toBeNull();
  });

  it('returns plugin setting definitions', () => {
    const manager = new PluginManager();
    manager.register(createPlugin());
    const sections = manager.getSettingDefinitions();
    expect(sections).toHaveLength(1);
    expect(sections[0]?.pluginId).toBe('demo');
    expect(sections[0]?.settings[0]?.key).toBe('engine');
  });
});
