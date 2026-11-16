# @lkzc19/dsh-workspace-virtual-groups

给 DSH 侧边栏的工作区列表加一层**手动虚拟分组**。项目仍在原目录，插件只改变显示归属和顺序。

## 功能

- 内置「默认」分组固定第一，不可重命名、删除或拖动，但可以添加工作区和子分组。
- 新建、重命名、删除分组；删除后组内项目与子分组上移到父分组，没有父分组时回到「默认」。
- 分组可多层嵌套：把分组标题拖到另一个分组标题中间即成为其子分组，拖到上/下缘则插入为同级。
- 把项目行拖到分组标题上即可归组；分组和项目都随层级缩进。
- 分组标题的 `⋯` 菜单：添加工作区、添加分组（直接建在该分组下）；非默认分组另有重命名和删除。
- 官方「视图选项 → 分组方式」新增「按虚拟分组」；选择其他模式即回到官方分组。
- 分组和排序保存在插件自己的 JSON 中，不修改官方工作区数据。

## 安装

```sh
dsh plugin --profile desktop add @lkzc19/dsh-workspace-virtual-groups
```

从源码安装（`lib/` 是构建产物，不入库，需先构建）：

```sh
git clone https://github.com/lkzc19/dsh-workspace-virtual-groups.git
cd dsh-workspace-virtual-groups
npm install
dsh plugin --profile desktop add "$PWD"
```

安装后重启桌面端或对应的 `dsh web` 进程。git URL 直装不可用：pnpm 不对 git 依赖执行 `prepare`，拿到的源码没有 `lib/`。

卸载：

```sh
dsh plugin --profile desktop remove @lkzc19/dsh-workspace-virtual-groups
```

## 使用

1. 打开侧边栏「工作区」区域。
2. 点击标题栏的「新建分组」创建分组。
3. 把项目行拖到分组标题上完成归类。
4. 需要回到官方分组时，在「视图选项 → 分组方式」选择「按工作区」「按工作区树」或「单列表」；再选「按虚拟分组」即可切回。

## 数据

手动分组、归属、排序和视图模式保存在：

```text
$DSH_HOME/workspace-virtual-groups.manual.json
```

## 兼容性

- 面向 DSH 0.2.x，桌面端和 `dsh web` 共用同一套代码。
- 插件依赖官方侧边栏的 DOM 结构；DSH 大版本升级后如果结构变化，插件会退化为不分组，不会破坏官方数据。
- 桌面端和 Web 端使用不同的 profile，需要分别安装。

## 开发

```sh
npm install   # 装依赖并构建
npm run build
npm test
```

产物：Host `lib/index.js`，Client `lib/client.js`。`lib/` 已 gitignore。

## 许可证

MIT。基于 [z-col/dsh-workspace-groups](https://github.com/z-col/dsh-workspace-groups)（MIT）修改。完整许可见 [LICENSE](./LICENSE)。
