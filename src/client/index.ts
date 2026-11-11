/**
 * dsh-workspace-virtual-groups client half.
 *
 * This is deliberately NOT a replacement for the official Workspace browser.
 * It mounts a thin grouping layer that reorders the official sidebar sections
 * and inserts group labels between them; every official row keeps its markup,
 * styles, hover actions, search and keyboard behavior.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only service merges: the Workspace controller and the navigation face
// that owns the directory picker / session creation.
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import { mountWorkspaceVirtualGroups } from './dom-groups.ts'

/** Required services: the Workspace controller and its navigation face. */
export const inject = ['workspaces', 'uiWorkspace']

/** Mount the grouping layer and remove it with the client fiber. */
export function apply(ctx: ClientContext): void {
  ctx.effect(
    () => mountWorkspaceVirtualGroups(ctx as unknown as Parameters<typeof mountWorkspaceVirtualGroups>[0]),
    'dsh-workspace-virtual-groups: sidebar grouping layer',
  )
}
