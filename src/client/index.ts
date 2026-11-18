/**
 * dsh-workspace-virtual-groups 的客户端侧。
 *
 * 它刻意不去替换官方的 Workspace 浏览器，而是在上面挂一层很薄的分组层：
 * 重排官方侧边栏的 section，并在其间插入分组标题。官方行保留原有的标记、
 * 样式、悬停操作、搜索和键盘行为。
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// 仅类型的服务合并：Workspace 控制器，以及负责目录选择与会话创建的导航面。
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import { mountWorkspaceVirtualGroups } from './dom-groups.ts'

/** 必需服务：Workspace 控制器、导航面，以及界面文案的 locale 服务。 */
export const inject = ['workspaces', 'uiWorkspace', 'locale']

/** 挂载分组层，并随客户端 fiber 一同卸载。 */
export function apply(ctx: ClientContext): void {
  ctx.effect(
    () => mountWorkspaceVirtualGroups(ctx as unknown as Parameters<typeof mountWorkspaceVirtualGroups>[0]),
    'dsh-workspace-virtual-groups: sidebar grouping layer',
  )
}
