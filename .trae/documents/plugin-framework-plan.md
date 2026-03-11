# 信息查看器插件框架规划（Plan）

## 1. 目标与边界

### 1.1 目标
- 建立一套可扩展插件框架，使“信息查看器”可以集成外部网站提供的 URL 查询、API 查询与 iframe 能力。
- 允许插件在信息查看器中注册“物品相关能力”（查询、跳转、补充数据、附加展示）。
- 提供与“高级规划器同规格”的 tabs 接入机制，使插件可在现有 tabs 体系中注册并显示页面。
- 支持插件通过 iframe 形式嵌入页面，并支持通过 iframe 向宿主提供服务接口。

### 1.2 非目标（首期）
- 不实现远程执行第三方脚本。
- 不支持任意权限插件；仅支持受控能力声明。
- 不在首期实现插件商店与在线热更新。

---

## 2. 现状与可复用基础

### 2.1 已有能力（可复用）
- 数据源注册：`registerPackSource` / `packRegistry`。
- tabs 承载：`CenterPanel.vue` + `RecipeContentView.vue`。
- 页面状态路由：`IndexPage.vue` + `/item/:keyHash/:tab?`。
- 弹窗注册机制：`dialogManager.registerDialog`。

### 2.2 关键问题
- 当前扩展点分散，缺少统一插件生命周期与能力声明。
- tabs 内容虽可扩展，但没有标准化插件注册协议。
- 外部 URL/API 查询尚无统一缓存、错误处理与节流策略。

---

## 3. 目标架构

### 3.1 分层模型
- `Plugin Runtime`：插件注册、生命周期、能力调度。
- `Capability Layer`：URL 查询能力、API 查询能力、iframe 视图能力、Tab 渲染能力。
- `Integration Layer`：与 IndexPage/CenterPanel/RecipeContentView 对接。
- `Safety Layer`：权限声明、域名白名单、超时与重试策略。

### 3.2 插件类型
- `QueryPlugin`：提供 URL 生成与外链查询入口。
- `ApiPlugin`：提供 API 请求、结果标准化与缓存键策略。
- `TabPlugin`：注册与“recipes/uses/wiki/icon/planner”同层级或同区域的 tab 视图。
- `IframePlugin`：通过 iframe 提供嵌入页面或服务桥接能力。
- `CompositePlugin`：组合以上能力。

### 3.3 生命周期
- `register`：注册元数据与能力声明。
- `activate`：在 pack/index 就绪后激活。
- `resolveItemContext`：接收当前物品上下文（itemId/gameId/tag/keyHash）。
- `deactivate`：页面切换/卸载时释放资源。

---

## 4. 核心契约设计（Type Contract）

### 4.1 元数据契约
- `id`、`name`、`version`、`description`。
- `capabilities`：`urlQuery`、`apiQuery`、`iframeView`、`iframeService`、`tabView`。
- `permissions`：允许访问的域名、请求方法、是否可打开外链、是否允许 iframe 服务调用。

### 4.2 运行时上下文
- `ItemContext`：当前 item 基础信息、当前 pack、当前 tab、语言配置。
- `RuntimeContext`：请求器、缓存器、日志器、事件总线（受限 API）。

### 4.3 查询结果标准化
- `PluginResult`：`status`、`title`、`summary`、`links`、`blocks`。
- 支持失败态：超时、权限拒绝、解析失败、空结果。

### 4.4 Tab 渲染契约
- `tabKey`、`tabLabel`、`order`、`visibleWhen(context)`。
- `renderMode`：组件式（Vue component）、数据驱动式（schema）或 iframe 式。

### 4.5 iframe 契约（重点）
- `iframe.srcTemplate`：基于当前 ItemContext 生成 iframe URL。
- `iframe.sandbox`：最小权限沙箱策略（默认禁用高风险能力）。
- `iframe.allowedOrigins`：允许 postMessage 通信的来源白名单。
- `iframe.handshake`：初始化握手协议（pluginReady / hostReady / protocolVersion）。
- `iframe.services`：插件向宿主暴露的服务清单（名称、入参 schema、返回 schema、超时）。
- `iframe.hostApis`：宿主向 iframe 暴露的受控 API（读取当前物品上下文、触发受限查询、请求刷新）。

---

## 5. 与现有页面的集成方案

### 5.1 IndexPage 集成
- 在当前物品切换时触发插件上下文刷新。
- 合并插件提供的“外部查询入口”到物品侧栏或操作区。
- 将插件错误与加载状态纳入现有页面状态管理。

### 5.2 CenterPanel / RecipeContentView 集成
- 为 tabs 增加“插件 tab 注册表”汇总层。
- 统一排序规则：内置 tab 优先 + 插件 order。
- 路由兼容：允许 `:tab` 指向插件 tabKey（无效时回退默认 tab）。
- 对 iframe tab 提供统一容器组件（加载态、超时态、通信异常态）。

### 5.3 SettingsDialog 集成
- 插件开关、权限提示、域名授权可视化。
- 每个插件独立配置区（如 API token 占位，但默认不存敏感信息）。

---

## 6. 安全与稳定性设计

### 6.1 权限模型
- 插件必须声明可访问域名与能力；运行时做白名单校验。
- API 请求统一经受控请求器，禁止插件直接访问全局网络能力。
- iframe 通信仅允许 `allowedOrigins`，并校验消息类型、会话 id 与 schema。

### 6.2 可靠性
- 每插件请求超时、并发上限、重试次数可配置。
- 内置缓存策略：按 `pluginId + itemKey + queryParams` 生成缓存键。
- 错误隔离：单插件失败不影响主页面渲染。
- iframe 服务调用增加请求 id、超时、取消、降级回退（只读展示）。

### 6.3 性能
- 延迟激活：仅在物品详情页且命中可见条件时加载。
- 结果去抖与请求取消：物品快速切换时中止旧请求。

---

## 7. 实施阶段（按提交粒度）

### 阶段 A：插件内核
1. 新增插件目录与类型定义（metadata/capability/context/result）。
2. 实现 `PluginManager`（注册、激活、禁用、上下文分发）。
3. 提供受控 `RuntimeContext`（request/cache/logger/event）。

### 阶段 B：查询能力
4. 实现 URL 查询 provider（模板化 URL 生成 + 打开策略）。
5. 实现 API 查询 provider（请求封装 + 结果标准化 + 缓存）。
6. 在物品详情交互区接入查询入口与状态展示。

### 阶段 C：Tab 与 iframe 能力
7. 实现 tab 注册中心（内置 tab + 插件 tab 聚合与排序）。
8. 扩展路由解析以支持插件 tabKey。
9. 在 `RecipeContentView` 中增加插件 tab 渲染分发。
10. 实现 iframe 容器与通信桥（握手、消息路由、超时取消）。
11. 支持 iframe 插件向宿主注册服务与调用受控 Host API。

### 阶段 D：配置与安全
12. 在设置页接入插件开关、权限展示、配置项编辑。
13. 增加权限检查、请求超时/重试/并发限制。
14. 增加 iframe origin 校验、schema 校验与服务级权限控制。
15. 补充失败回退与观测日志。

### 阶段 E：示例插件与验收
16. 提供 2~3 个示例插件：
   - URL 查询型：按 itemId 拼接外站检索链接。
   - API 查询型：拉取外部信息并展示在插件 tab。
   - iframe 服务型：在 iframe 页面内调用宿主 API 并反向提供服务。
17. 编写单元测试与集成测试。
18. 完成文档（插件开发指南、能力声明示例、故障排查、iframe 协议说明）。

---

## 8. 验证策略

### 8.1 单元测试
- PluginManager 生命周期测试。
- 权限校验、缓存键、错误处理测试。
- tab 注册排序与可见性测试。
- iframe 握手、origin 校验、消息 schema 校验测试。

### 8.2 集成测试
- 物品切换时插件上下文刷新正确。
- 插件 tab 路由进入/回退正确。
- iframe 插件与宿主双向服务调用成功与超时回退正确。
- 单插件故障不影响内置 tabs 与主流程。

### 8.3 手工验收
- 在信息查看器中可见插件查询入口。
- 可切换至插件 tab 并展示内容。
- iframe 页面可加载、可通信、可调用受控服务。
- 设置页可启停插件并生效。

---

## 9. 兼容与迁移
- 默认无插件时行为与当前一致（零侵入回退）。
- 内置 tabs 保持原有 key 与顺序策略（除新增聚合层）。
- 后续可将现有分散扩展点逐步迁移为插件能力实现。

---

## 10. 交付物清单
- 插件框架核心代码（manager + capability + runtime）。
- tabs 插件化接入。
- URL/API/iframe 查询与服务能力接入。
- 插件配置与权限面板（含 iframe 通信授权）。
- 示例插件、测试与开发文档。
