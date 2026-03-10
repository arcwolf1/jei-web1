# JEI Web Plugin API 文档

JEI Web 插件系统允许开发者扩展物品详情页的功能，支持添加自定义标签页、iframe 嵌入、外部链接跳转以及与宿主应用进行双向通信。

## 插件定义 (`JeiPluginDefinition`)

每个插件由一个 `JeiPluginDefinition` 对象描述，包含以下核心字段：

```typescript
interface JeiPluginDefinition {
  id: string; // 插件唯一标识符
  name: string; // 插件显示名称
  version: string; // 版本号
  enabledByDefault?: boolean; // 是否默认启用
  permissions?: {
    // 权限声明
    allowedOrigins?: string[]; // 允许通信的 iframe 域名
    allowOpenExternal?: boolean; // 是否允许打开外部链接
    allowIframeService?: boolean; // 是否允许 iframe 调用宿主服务
  };
  settings?: PluginSettingDefinition[]; // 用户配置项
  queryActions?: PluginQueryAction[]; // 外部查询动作（如跳转搜索引擎）
  apiQueries?: PluginApiQuery[]; // 内部 API 查询（用于数据聚合）
  tabs?: PluginTabDefinition[]; // 物品详情页的自定义标签页
  centerTabs?: PluginCenterTabDefinition[]; // 中心区域（顶部）的自定义标签页
}
```

## 功能模块详解

### 1. 设置 (`settings`)

定义插件的用户配置项，支持 `boolean`, `text`, `number`, `select` 类型。

```typescript
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
];
```

### 2. 查询动作 (`queryActions`)

在物品详情页提供外部链接跳转功能。

```typescript
queryActions: [
  {
    id: 'web-search',
    label: '外部搜索',
    icon: 'search',
    buildUrl: (context) => {
      // context 包含当前物品信息
      const name = context.itemDef?.name;
      return `https://www.bing.com/search?q=${encodeURIComponent(name)}`;
    },
  },
];
```

### 3. Iframe 标签页 (`tabs`)

在物品详情页嵌入自定义 iframe 页面。支持定义多个标签页。

```typescript
tabs: [
  {
    key: 'custom-tab-1',
    label: '自定义页面 1',
    order: 10,
    visibleWhen: (context) => !!context.itemDef,
    iframe: {
      /* ... */
    },
  },
  {
    key: 'custom-tab-2',
    label: '自定义页面 2',
    order: 20,
    iframe: {
      /* ... */
    },
  },
];
```

#### 单个 Tab 配置示例

```typescript
{
  key: 'wiki-tab',
  label: 'Wiki',
  iframe: {
    // 动态生成 iframe URL
    src: (context) => {
      const itemId = context.itemDef?.key.id;
      return `https://example.com/item/${itemId}`;
    },
    // 允许通信的源，必须显式声明
    allowedOrigins: ['https://example.com'],
    // 可选：自定义 sandbox 属性
    sandbox: 'allow-scripts allow-same-origin',
    // 可选：设为 true 则不显示“API连接中”状态条，仅显示外部打开按钮
    noApi: true,
  },
}
```

## Iframe 通信协议

宿主应用与 iframe 插件之间通过 `postMessage` 进行通信。

### 1. 初始化握手

iframe 加载完成后，需发送 `pluginReady` 消息，宿主会回复当前上下文信息。

**Plugin -> Host**

```javascript
window.parent.postMessage(
  {
    channel: 'jei-plugin',
    type: 'pluginReady',
  },
  '*',
);
```

**Host -> Plugin (Reply)**

```javascript
{
  channel: 'jei-plugin',
  type: 'hostContext',
  payload: {
    pluginId: '...',
    itemId: '...',
    itemName: '...',
    packId: '...',
    gameId: '...',
    activeTab: '...',
    settings: { /* 插件配置项 */ }
  }
}
```

### 2. 调用宿主 API

插件可以请求宿主提供的 API。

**Plugin -> Host**

```javascript
window.parent.postMessage(
  {
    channel: 'jei-plugin',
    type: 'hostApiCall',
    requestId: 'unique-id-123',
    payload: {
      api: 'getItemContext', // 或 navigateToItem, toggleBookmark, getItemImage
    },
  },
  '*',
);
```

**Host -> Plugin (Reply)**

```javascript
{
  channel: 'jei-plugin',
  type: 'hostApiResponse',
  requestId: 'unique-id-123',
  payload: {
    ok: true,
    value: { /* 上下文数据或 API 返回结果 */ }
  }
}
```

#### 可用宿主 API 列表

| API 名称          | 参数 (`args`)                            | 返回值                                              | 描述                                                     |
| :---------------- | :--------------------------------------- | :-------------------------------------------------- | :------------------------------------------------------- |
| `getItemContext`  | 无                                       | `{ itemId, itemName, packId, gameId }`              | 获取当前物品上下文信息                                   |
| `navigateToItem`  | `{ itemId: string, newStack?: boolean }` | `boolean` (是否成功)                                | 导航到指定物品详情页。`newStack` 为 true 时重置导航栈。  |
| `toggleBookmark`  | `{ itemId: string, favorite?: boolean }` | `boolean` (操作后的收藏状态)                        | 切换或设置物品收藏状态。如果不传 `favorite` 则切换状态。 |
| `getItemImage`    | `{ itemId: string }`                     | `string \| null`                                    | 获取物品的图标 URL（已处理代理和路径）。                 |
| `getHostSettings` | 无                                       | `{ theme: 'light'\|'dark', language: string, ... }` | 获取宿主应用的全局设置。                                 |

### 3. 宿主调用插件服务

插件可以注册服务供宿主调用（例如在宿主界面点击“调用服务”按钮）。

**Plugin -> Host (注册服务)**

```javascript
window.parent.postMessage(
  {
    channel: 'jei-plugin',
    type: 'registerServices',
    payload: {
      services: ['myService'],
    },
  },
  '*',
);
```

**Host -> Plugin (调用)**

```javascript
{
  channel: 'jei-plugin',
  type: 'callService',
  requestId: 'req-456',
  payload: {
    service: 'myService',
    args: { itemId: '...' }
  }
}
```

**Plugin -> Host (响应)**

```javascript
window.parent.postMessage(
  {
    channel: 'jei-plugin',
    type: 'serviceResponse',
    requestId: 'req-456',
    payload: { result: 'done' },
  },
  '*',
);
```

## 完整示例

参考 `src/jei/plugins/builtin.ts` 中的 `iframe-bridge` 插件实现。
