<p align="center">
  <img src="public/icons/icon.svg" alt="JEI-web Icon" width="20%">
</p>

# JEI-web

Just Enough Items but Running in web - 一个基于 Web 的物品查看和合成规划工具。

> **注意**：本项目与 Minecraft 的 JEI (Just Enough Items) mod 无任何关系。仅从 JEI 获取了物品查看和合成规划的设计灵感，两者在代码和功能上完全独立。

## 功能特性

### 基础功能

- **物品浏览** - 查看游戏中所有物品的详细信息
- **配方查询** - 查看物品的合成配方和用途
- **物品收藏** - 收藏常用物品，快速访问
- **高级过滤** - 支持按名称、物品 ID、命名空间、标签等多条件筛选
- **Wiki 支持** - 支持 Markdown 格式的物品描述
- **多 Pack 支持** - 动态加载和管理多个数据包
- **历史记录** - 自动记录浏览历史

### 合成规划器

- **自动规划** - 自动计算合成所需的材料和速率
- **多种视图模式**：
  - **树形视图** - 层级展示合成依赖关系
  - **节点图视图** - 可视化展示合成流程节点关系，支持拖拽和缩放
  - **线性视图** - 线性展示配方流程
  - **计算器视图** - 精确计算材料需求和生产速率
- **保存/加载方案** - 支持保存规划方案，随时恢复工作进度

### 高级计划器

- **多目标规划** - 支持同时规划多个物品的生产目标
- **灵活的速率设置** - 支持按秒/分钟/小时设置生产速率
- **节点图可视化** - 使用 Vue Flow 展示复杂的合成网络
- **方案管理** - 保存和加载多目标规划方案

### 用户界面

- **可视化流程图** - 使用 Vue Flow 展示合成流程图，支持深色主题
- **响应式布局** - 支持弹窗和面板两种显示模式
  - **可折叠面板** - 支持收藏夹和详情面板的折叠
  - **全屏支持** - 支持全屏模式浏览
- **上下文菜单** - 右键/长按物品快速操作，支持收藏、规划等功能
- **移动端适配** - 专门的移动端界面和触摸支持
  - 底部导航栏切换不同面板
  - 长按物品显示上下文菜单

### 开发者功能

- **导航栈调试** - 实时查看和调试页面导航状态
- **调试面板** - 可拖动的调试悬浮窗，显示导航堆栈和操作日志
- **设置管理** - 自定义显示偏好和选项
  - 历史记录数量限制
  - 配方显示模式
  - 调试面板开关

## 技术栈

### 核心框架

- **前端框架**: [Vue 3](https://vuejs.org/) (Composition API)
- **UI 框架**: [Quasar Framework](https://quasar.dev/)
- **状态管理**: [Pinia](https://pinia.vuejs.org/)
- **路由**: [Vue Router](https://router.vuejs.org/)

### 功能库

- **流程图可视化**: [Vue Flow](https://vueflow.dev/) 及其扩展包
  - `@vue-flow/core` - 核心流程图功能
  - `@vue-flow/background` - 背景网格
  - `@vue-flow/controls` - 缩放和平移控件
  - `@vue-flow/minimap` - 小地图
- **Markdown 渲染**: [markdown-it](https://github.com/markdown-it/markdown-it)
- **拼音搜索**: [pinyin-pro](https://pinyin-pro.cn/)
- **HTTP 请求**: [axios](https://axios-http.com/)
- **拖拽排序**: [vuedraggable](https://github.com/SortableJS/Vue.Draggable)
- **ZIP 文件处理**: [jszip](https://stuk.github.io/jszip/)

### 开发工具

- **构建工具**: Vite (通过 Quasar CLI)
- **语言**: TypeScript
- **代码检查**: ESLint + TypeScript ESLint
- **代码格式化**: Prettier
- **国际化**: Vue I18n
- **包管理**: pnpm

## 快速开始

### 访问应用

1. 本地开发：运行 `pnpm dev` 启动开发服务器
2. 直接访问首页 `/` 开始浏览物品
3. 使用底部导航栏切换不同的面板

### 物品浏览

1. 在物品格子中滚动或使用搜索框筛选物品
2. 点击或使用快捷键打开物品详情：
   - `R` - 查看配方
   - `U` - 查看用途
   - `W` - 查看 Wiki
3. 点击配方中的物品可以跳转到该物品

### 合成规划

1. 打开物品详情，切换到"规划器"标签页
2. 选择目标物品和目标数量
3. 查看不同视图的合成计划：
   - **树形视图** - 层级查看所有依赖配方
   - **节点图** - 可视化流程图，支持拖拽节点和缩放
   - **线性视图** - 按配方顺序展示
   - **计算器** - 精确计算各材料的需求量
4. 点击"保存方案"按钮保存当前计划

### 高级计划器（多目标规划）

1. 在物品上按 `D` 键或右键选择"添加到高级计划器"
2. 在中间面板的"高级计划器"标签页管理所有目标
3. 为每个目标设置生产速率（每秒/每分钟/每小时）
4. 节点图视图展示完整的合成网络
5. 保存方案以便后续使用

### 管理收藏和历史

- **收藏**：点击物品上的星标图标或按 `A` 键
- **查看历史**：点击底部导航栏的历史图标
- **管理面板**：可折叠/展开收藏夹和详情面板以获得更多空间

## 开发

### 安装依赖

```bash
pnpm install
# 或
npm install
```

### 启动开发服务器

```bash
pnpm dev
# 或
npm run dev
```

### 构建生产版本

```bash
pnpm build
# 或
npm run build
```

### 代码检查

```bash
pnpm lint
# 或
npm run lint
```

### 代码格式化

```bash
pnpm format
# 或
npm run format
```

## 添加新的数据包

1. 在 `public/packs/` 目录下创建新的数据包文件夹
2. 添加必要的数据文件：
   - `manifest.json` - 数据包清单
   - `items.json` - 物品数据
   - `recipes.json` - 配方数据
   - `recipeTypes.json` - 配方类型
   - `tags.json` - 标签数据（可选）
   - `assets/` - 静态资源（可选，例如图片、图标）
3. 更新 `public/packs/index.json`，添加新数据包的条目：

```json
{
  "packs": [
    {
      "packId": "your-pack-id",
      "label": "Your Pack Name",
      "mirrors": ["https://your-pack.example.com"],
      "devMirrors": ["http://127.0.0.1:4179"]
    }
  ]
}
```

其中 `devMirrors` 为可选字段，仅在主程序中启用“Dev 镜像”设置后才会参与镜像选择，适合本地调试或临时测试环境。

### 虚拟聚合源（多源平级聚合）

当同一游戏有多个平级数据源且各自不完整时，可以在 `index.json` 增加一个虚拟源，并通过描述文件定义聚合优先级：

```json
{
  "packId": "your-aggregated-pack",
  "label": "Your Game (Aggregated)",
  "aggregateDescriptor": "aggregates/your-aggregated-pack.json"
}
```

描述文件示例（`public/packs/aggregates/your-aggregated-pack.json`）：

```json
{
  "displayName": "Your Game (Aggregated)",
  "gameId": "your-game",
  "sources": [
    { "packId": "source-a", "priority": 10, "matchByName": true },
    { "packId": "source-b", "priority": 20, "matchByName": true }
  ]
}
```

- `sources` 按 `priority` 从小到大决定展示顺序（仅排序，不做覆盖裁决）
- `matchByName: true` 会按物品名称将不同源的同名物品映射到统一 ID
- 聚合后的结果会影响配方收集、用途查询和自动合成规划

## 编辑器：静态资源与导出

### 添加图片资源

1. 打开编辑器：`/editor`
2. 进入 **Assets** 页面：`/editor/assets`
3. 点击 **Add Images** 选择图片文件（png/webp/jpg/svg 等）
4. 在列表里复制资源路径，然后在物品/配方类型里引用：
   - 推荐路径形式：`/packs/<packId>/assets/<filename>`
   - 导出 ZIP 时会把 `assets/<filename>` 一并打包

### 导出格式

- **Export JSON**：导出一个大 JSON（便于分享/备份）
- **Export ZIP**：导出与 `public/packs/<packId>/` 一致的目录结构：
  - `manifest.json`
  - `items.json` / `tags.json` / `recipeTypes.json` / `recipes.json`
  - `assets/*`（如有）

## 更新日志

### 近期更新 (2026年2月)

#### 功能增强

- **高级计划器** - 新增节点图视图和计算器视图功能
- **多目标规划** - 支持同时规划多个物品的生产目标
- **CenterPanel 组件** - 添加 `save-plan` 事件和 `loadAdvancedPlan` 方法
- **规划方案保存** - 支持保存和加载合成规划方案

#### 组件重构

- 新增 `ItemContextMenu` - 右键上下文菜单组件
- 新增 `ItemDialog` - 物品详情对话框组件
- 新增 `ItemListPanel` - 物品列表面板组件
- 新增 `RecipeContentView` - 配方内容视图组件
- 新增 `SettingsDialog` - 设置对话框组件

#### 调试功能

- **导航栈调试面板** - 可拖动的调试悬浮窗，实时显示导航堆栈和操作日志
- **调试布局模式** - 支持开启/关闭调试布局显示

#### 界面优化

- **Vue Flow 优化** - 改进深色主题样式，支持背景网格和缩放控件
- **流程图拖拽** - 修复拖拽功能，支持拖拽画布平移
- **连线层级** - 修复连线和节点的层级关系
- **端口样式** - 优化流程图中输入输出端口的样式计算逻辑

#### 修复

- 修复上下文菜单关闭后目标未清除的问题
- 修复流程图拖拽和连线层级问题
- 优化代码格式和代码质量

## 数据包编辑器

访问 `/editor` 可以：

- 管理本地数据包
- 编辑物品、配方、配方类型和标签
- 上传和管理图片资源
- 导出修改后的数据包

## 数据格式

### manifest.json

```json
{
  "packId": "example",
  "gameId": "example",
  "displayName": "Example Pack",
  "version": "1.0.0",
  "files": {
    "items": "items.json",
    "tags": "tags.json",
    "recipeTypes": "recipeTypes.json",
    "recipes": "recipes.json"
  }
}
```

## 贡献指南

### 提交 PR

1. Fork 本仓库到你的账号
2. 新建分支：`git checkout -b feat/<something>`
3. 用编辑器完成修改，并用 **Export ZIP** 导出
4. 解压 ZIP，把内容放到 `public/packs/<packId>/`（新 pack 就新建目录；已有 pack 就覆盖对应文件）
5. 如新增 pack，更新 `public/packs/index.json` 增加条目
6. 本地验证：
   - `pnpm lint`
   - `pnpm dev`（可选）
7. Push 分支并在 GitHub 创建 Pull Request，说明改动内容与截图/示例

## 键盘快捷键

### 导航操作

- `Backspace` - 返回上一级（在对话框中）
- `Esc` - 关闭对话框
- `鼠标滚轮` - 翻页

### 物品查看

- `R` - 查看配方 (Recipes)
- `U` - 查看用途 (Uses)
- `W` - 查看 Wiki
- `A` - 收藏/取消收藏物品

### 合成规划器

- `P` / `T` / `1` - 打开规划器，切换到树形视图
- `G` / `2` - 打开规划器，切换到节点图视图
- `L` / `3` - 打开规划器，切换到线性视图
- `C` / `4` - 打开规划器，切换到计算器视图

### 高级计划器

- `D` - 添加物品到高级计划器

## 数据来源

本项目使用了以下第三方数据源和工具：

### factoriolab-zmd

**项目地址:** https://github.com/Bakingss/factoriolab-zmd

**许可证:** MIT License

**数据包位置:** `public/packs/aef-skland/`

**说明:** 本项目的数据生成工具和数据结构设计受到了 factoriolab-zmd 项目的启发。Arknights:Endfield 数据包使用了基于 factoriolab-zmd 的工具生成。

### Arknights:Endfield Skland Wiki数据

**游戏开发商:** Hypergryph

**数据包位置:** `public/packs/aef-skland/`

**说明:** Arknights:Endfield Skland wiki 数据包包含从Wiki公开访问区域中提取的物品、配方和机器数据，仅供信息参考使用。

## 许可证

本项目采用 Mozilla Public License 2.0 开源协议，详见 [LICENSE](LICENSE) 文件。

本项目使用的第三方组件和数据遵循各自的许可证，详见 [THIRD-PARTY_LICENSES.md](THIRD-PARTY_LICENSES.md) 文件。

## 作者

AndreaFrederica <andreafrederica@outlook.com>
