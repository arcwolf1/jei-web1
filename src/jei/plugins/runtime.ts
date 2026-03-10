import type {
  PluginCenterTabRuntime,
  JeiPluginDefinition,
  PluginActionRuntime,
  PluginApiRuntime,
  PluginItemContext,
  PluginSettingDefinition,
  PluginTabRuntime,
} from './types';

export class PluginManager {
  private readonly plugins = new Map<string, JeiPluginDefinition>();

  register(plugin: JeiPluginDefinition): void {
    this.plugins.set(plugin.id, plugin);
  }

  list(): JeiPluginDefinition[] {
    return Array.from(this.plugins.values());
  }

  getSettingDefinitions(): Array<{
    pluginId: string;
    pluginName: string;
    settings: PluginSettingDefinition[];
  }> {
    return this.list()
      .map((plugin) => ({
        pluginId: plugin.id,
        pluginName: plugin.name,
        settings: plugin.settings ?? [],
      }))
      .filter((it) => it.settings.length > 0);
  }

  getEnabledPlugins(enabledById: Record<string, boolean>): JeiPluginDefinition[] {
    return this.list().filter((plugin) => {
      const configured = enabledById[plugin.id];
      if (typeof configured === 'boolean') return configured;
      return plugin.enabledByDefault !== false;
    });
  }

  getActions(enabledById: Record<string, boolean>, context: PluginItemContext): PluginActionRuntime[] {
    const out: PluginActionRuntime[] = [];
    for (const plugin of this.getEnabledPlugins(enabledById)) {
      for (const action of plugin.queryActions ?? []) {
        const url = action.buildUrl(context);
        if (!url) continue;
        const next: PluginActionRuntime = {
          pluginId: plugin.id,
          actionId: action.id,
          label: action.label,
          openInNewTab: action.openInNewTab !== false,
          url,
        };
        if (action.icon) {
          next.icon = action.icon;
        }
        out.push(next);
      }
    }
    return out;
  }

  getTabs(enabledById: Record<string, boolean>, context: PluginItemContext): PluginTabRuntime[] {
    const out: PluginTabRuntime[] = [];
    for (const plugin of this.getEnabledPlugins(enabledById)) {
      for (const tab of plugin.tabs ?? []) {
        const visible = tab.visibleWhen ? tab.visibleWhen(context) : true;
        if (!visible) continue;
        const next: PluginTabRuntime = {
          pluginId: plugin.id,
          tabKey: `plugin:${plugin.id}:${tab.key}`,
          tabLabel: tab.label,
          order: tab.order ?? 0,
        };
        if (tab.iframe) next.iframe = tab.iframe;
        if (tab.api) next.api = tab.api;
        out.push(next);
      }
    }
    out.sort((a, b) => a.order - b.order || a.tabLabel.localeCompare(b.tabLabel));
    return out;
  }

  getCenterTabs(enabledById: Record<string, boolean>, context: PluginItemContext): PluginCenterTabRuntime[] {
    const out: PluginCenterTabRuntime[] = [];
    for (const plugin of this.getEnabledPlugins(enabledById)) {
      for (const tab of plugin.centerTabs ?? []) {
        const visible = tab.visibleWhen ? tab.visibleWhen(context) : true;
        if (!visible) continue;
        out.push({
          pluginId: plugin.id,
          tabKey: `plugin-center:${plugin.id}:${tab.key}`,
          tabLabel: tab.label,
          order: tab.order ?? 0,
          iframe: tab.iframe,
        });
      }
    }
    out.sort((a, b) => a.order - b.order || a.tabLabel.localeCompare(b.tabLabel));
    return out;
  }

  getApiQuery(
    enabledById: Record<string, boolean>,
    context: PluginItemContext,
    pluginId: string,
    queryId: string,
  ): PluginApiRuntime | null {
    const plugin = this.getEnabledPlugins(enabledById).find((it) => it.id === pluginId);
    if (!plugin) return null;
    const query = (plugin.apiQueries ?? []).find((it) => it.id === queryId);
    if (!query) return null;
    return {
      pluginId: plugin.id,
      queryId: query.id,
      label: query.label,
      run: (signal: AbortSignal) => query.run(context, signal),
    };
  }
}

export function parsePluginTabKey(tab: string): { pluginId: string; tabKey: string } | null {
  if (!tab.startsWith('plugin:')) return null;
  const parts = tab.split(':');
  if (parts.length < 3) return null;
  return {
    pluginId: parts[1] || '',
    tabKey: parts.slice(2).join(':'),
  };
}
