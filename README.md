# dsh-workspace-virtual-groups

给 DSH Web 侧边栏的 Workspace 列表加一层**虚拟分组**：把工作、个人等不同来源的项目分到不同的分组里。项目本身仍然真实存在于原来的目录，不会被移动或复制。

这个插件是 [z-col/dsh-workspace-groups](https://github.com/z-col/dsh-workspace-groups)（MIT）的衍生版本，但实现方式改成了**只加分组、不改官方样式**：官方的 Workspace 浏览器、项目行、会话行、图标、字体、间距、悬停操作、搜索和视图选项全部保留，插件只在项目之间插入分组标题并调整顺序。

## 功能

- **官方界面不变**：项目行和会话行仍然是官方 `@deepseek-ai/dsh-client-ui-workspace` 的组件和样式，没有自定义连线、花朵、等宽字体或替换行。
- **沿用 DSH 样式**：分组标题使用官方 36px section label 的 14px/20px 与次要色；分组标题的 `⋯` 复用官方 workspace 行的 24px iconButton（默认隐藏，hover/菜单打开时显示，hover 只变文字色）；分组菜单使用 16px 圆角、4px 内边距、13px 菜单项；新建/重命名/删除弹窗使用 28px 圆角、380px 宽度、44px 输入框和 36px 按钮。
- **分组内缩进**：分组内的项目使用官方 `--dsh-workspace-indent` 变量向右缩进 20px，会话行随项目一起缩进；分组标题本身不缩进。
- **视图选项切换**：官方「视图选项 → 分组方式」里新增「按虚拟分组」，与「按工作区 / 按工作区树 / 单列表」并列。选中「按虚拟分组」时显示虚拟分组；选择其他官方模式时自动退出虚拟分组，完全回到官方分组。
- **默认**：内置分组，名称固定为 `默认`，始终显示在最前面；**不可重命名、不可删除**。它的 `⋯` 菜单里只有「添加工作区」。
- **未分组即默认**：没有显式分组的项目、以及从其他分组移出的项目，都会出现在默认里。
- **兼容旧数据**：旧版本使用过的名称 `默认工作区` 会自动映射到 `默认`，不需要手动迁移。
- **分组增删改查**：
  - 官方「添加工作区」按钮保持原行为；旁边新增一个带 layer 图标的「新建分组」按钮（仅在「按虚拟分组」模式下显示）；
  - 每个分组标题悬停后的 `⋯` 菜单都有「添加工作区」，新工作区会直接归入该分组；
  - 非默认分组的 `⋯` 菜单里，「添加工作区」「重命名分组」放在一起，下面用一条分隔线隔开「删除分组」；
  - 删除分组时，组内项目会回到默认，不会丢失；
  - 分组名称不能为空、不能重名，也不能使用 `默认`。
- **拖拽分组**：
  - 把官方项目行拖到分组标题上，即可归入该分组；
  - 拖到默认标题上，即可移回默认分组；
  - 拖拽分组标题可调整分组顺序，默认固定第一、不可拖动；
  - 项目在组内的顺序沿用官方浏览器的拖拽排序，不额外改写官方行。
- **保留官方行为**：官方搜索、视图选项、项目/会话的悬停操作、键盘操作和通知类插件贡献都还在。
- **持久化**：分组、归属、重命名/隐藏信息以及视图模式（`virtual` / `official`）写入 `$DSH_HOME/workspace-virtual-groups.manual.json`，由 Host 端校验并原子写入。
- **零侵入**：不修改 `~/.dsh/storages/workspace.json`、会话日志或官方 Workspace 包。分组只是展示层与插件自己的 JSON sidecar。
- **可选规则分类**：`$DSH_HOME/workspace-virtual-groups.yaml` 可以按路径/名称前缀自动归类；没有命中规则的项目仍然进入默认。

## 安装

### 本地目录安装（开发时）

```sh
dsh plugin --profile web add /绝对路径/dsh-workspace
```

桌面端使用的是 `desktop` profile，所以桌面端需要装到：

```sh
dsh plugin --profile desktop add /绝对路径/dsh-workspace
```

安装后重启对应 profile（或重启 DSH 桌面端）：

```sh
dsh web
```

验证：

```sh
dsh --profile web --dump-config | grep -A3 workspace-virtual-groups
# 期望看到：
# - id: workspace-virtual-groups
#   name: dsh-workspace-virtual-groups
#   config: {}
```

### 卸载

```sh
dsh plugin --profile desktop remove dsh-workspace-virtual-groups
```

然后重启 DSH。

## 使用

1. 打开 Web 侧边栏的“工作区”区域。
2. 点击标题栏里带 layer 图标的「新建分组」按钮，新建分组，例如“工作”“个人”。
3. 把项目行拖到分组标题上；项目会从默认移动到目标分组。
4. 在分组标题的 `⋯` 菜单里选「添加工作区」，选择目录后会创建并归入该分组。
5. 非默认分组的 `⋯` 菜单还能重命名分组；「删除分组」在菜单底部，用一条分隔线和上面两个操作分开。默认始终在第一位，不能重命名或删除，只能在它的菜单里添加工作区。
6. 需要回到官方分组时，打开「视图选项 → 分组方式」，选择「按工作区」「按工作区树」或「单列表」；再选「按虚拟分组」即可切回来。

## 数据文件

| 文件 | 作用 |
| --- | --- |
| `$DSH_HOME/workspace-virtual-groups.manual.json` | 插件拥有的运行时覆盖：手动分组、项目归属、分组/项目顺序、规则分类的重命名/隐藏，以及视图模式 `mode`（`virtual` / `official`）。由 Web 端通过 `PUT /workspace-virtual-groups/manual` 原子写入。 |
| `$DSH_HOME/workspace-virtual-groups.yaml` | 可选的规则分类配置；不创建时所有项目都在默认。 |

覆盖文件中的约定：

- `categories`：手动创建的分组名（不包含内置默认分组）。
- `assignments`：项目 id → 分组名；`null` 表示默认。
- `workspaceOrder`：项目顺序（由官方浏览器维护；默认的顺序存放在保留键 `__topLevel__` 下）。
- `categoryOrder`：分组顺序；默认不参与排序，始终第一。

示例 YAML：

```yaml
categories:
  - name: 工作
    rules:
      - pathPrefix: /Users/me/Projects/company
      - nameContains: 工作
  - name: 个人
    rules:
      - pathPrefix: /Users/me/Projects/personal
```

规则字段：`pathPrefix`、`pathExact`、`nameContains`、`basenameContains`；同一分类内任一规则命中即可，多个分类按顺序匹配，先命中者优先。没有命中任何规则的项目进入默认。

## 实现方式

`dsh-client-ui-workspace` 的官方浏览器仍然完整运行。插件只做两件事：

1. 把官方 Workspace 列表变成 flex column，用 CSS `order` 按分组重排官方项目区块；
2. 在项目区块之间插入分组标题，并给分组标题绑定新建/重命名/删除和拖放。

因此官方行的 DOM、字体、图标、悬停菜单和搜索不会被替换；分组只是一个薄层。官方进入搜索模式或“按工作区树”模式时，这个薄层会自动退出，避免干扰官方布局。

## 构建

仓库里已提交 `lib/index.js`（Host 半）和 `lib/client.js`（浏览器半），安装时不需要构建。修改 `src/` 后重新构建浏览器半：

```sh
npm install
npm run build
```

`scripts/build-client.mjs` 用 esbuild 生成 DSH 模块加载器需要的 lazy-CJS 产物。浏览器半没有 React 或 UI 库依赖。

## 兼容性

- 面向 DSH Web 0.2.x。
- 依赖官方 Workspace 浏览器的 DOM 结构（`[data-row-key^="workspace:"]`、`[role="tree"]` 和项目区块）。如果 DSH 后续修改这些结构，插件会自动退化为“不分组”，不会破坏官方列表。

## 许可证与致谢

MIT。基于 [z-col/dsh-workspace-groups](https://github.com/z-col/dsh-workspace-groups)（Copyright (c) 2026 zcol）修改，原项目同样以 MIT 发布。完整的 MIT 文本见 [LICENSE](./LICENSE)。
