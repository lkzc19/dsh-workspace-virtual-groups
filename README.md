# dsh-workspace-virtual-groups

给 DSH Web 侧边栏的工作区列表加一层**虚拟分组**，把工作、个人等不同来源的项目分开显示。项目仍存放在原来的目录，不会被移动或复制。

## 功能

- 新建、重命名、删除分组。
- 内置「默认」分组始终排在最前面，不可重命名或删除。
- 把项目行拖到分组标题上即可归入该分组；拖到「默认」标题上则移回默认。
- 拖拽分组标题可调整分组顺序。
- 分组标题的 `⋯` 菜单支持「添加工作区」，新工作区直接归入该分组。
- 删除分组时，组内项目回到默认，不会丢失。
- 沿用官方「视图选项 → 分组方式」，新增「按虚拟分组」；选择其他模式即回到官方分组。
- 分组、归属和顺序保存在插件自己的 JSON 文件中，不改官方工作区数据。
- 可选 YAML 规则，按路径或名称自动归类。

## 安装

从 GitHub 安装（把 `<你的用户名>` 换成实际地址）：

```sh
# 桌面端
dsh plugin --profile desktop add "https://github.com/<你的用户名>/dsh-workspace-virtual-groups.git"

# 浏览器 / Web 端
dsh plugin --profile web add "https://github.com/<你的用户名>/dsh-workspace-virtual-groups.git"
```

`lib/` 已提交，安装时不需要构建。安装后重启 DSH。

## 使用

1. 打开 Web 侧边栏的「工作区」区域。
2. 点击标题栏的「新建分组」按钮，创建「工作」「个人」等分组。
3. 把项目行拖到分组标题上完成归类。
4. 分组标题的 `⋯` 菜单可添加工作区、重命名或删除分组。
5. 「视图选项 → 分组方式」选择「按虚拟分组」显示分组，选择其他项恢复官方分组。

## 数据文件

| 文件 | 作用 |
| --- | --- |
| `$DSH_HOME/workspace-virtual-groups.manual.json` | 分组、项目归属、排序和视图模式 |
| `$DSH_HOME/workspace-virtual-groups.yaml` | 可选的自动分类规则 |

YAML 示例：

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

规则字段支持 `pathPrefix`、`pathExact`、`nameContains`、`basenameContains`；同一分组内任一规则命中即可，多个分组按顺序匹配，先命中者优先。没有命中规则的项目进入默认分组。

## 开发

```sh
npm install
npm run build
npm test
```

修改 `src/` 后重新构建；`lib/index.js` 和 `lib/client.js` 是构建产物。

## 许可证

MIT。基于 [z-col/dsh-workspace-groups](https://github.com/z-col/dsh-workspace-groups)（MIT）修改。完整许可见 [LICENSE](./LICENSE)，第三方依赖许可见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
