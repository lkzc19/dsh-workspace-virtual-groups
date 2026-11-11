/**
 * Shared manual-group types for dsh-workspace-virtual-groups. Pure types (zero
 * runtime deps) so the host half (sidecar persistence) and the browser half
 * (tree derivation) compile against the same contract.
 *
 * Groups are user-created only. The built-in default group catches every
 * workspace that has no explicit assignment; there is no rule/YAML classifier.
 */

/** Which grouping surface the sidebar should present. */
export type GroupViewMode = 'virtual' | 'official'

/**
 * Runtime-managed grouping overlay: groups created in the sidebar UI plus
 * per-workspace assignments and user-controlled ordering. Owned by the plugin
 * (JSON sidecar, `$DSH_HOME/workspace-virtual-groups.manual.json`).
 *
 * Optional fields keep files written by older versions readable; unknown
 * legacy fields (for example `renamed` / `hidden` from the removed rule
 * classifier) are ignored and dropped on the next write.
 */
export interface ManualGroups {
  /** Manually created group names, in creation order. */
  categories: string[]
  /**
   * Per-workspace group assignment, keyed by workspace id. Value is a manual
   * category name, or `null` for the built-in default group. An absent key is
   * also treated as the default group.
   */
  assignments: Record<string, string | null>
  /**
   * Display order of manual groups. The default group is pinned first and is
   * never listed. Absent = manual creation order.
   */
  categoryOrder?: string[]
  /**
   * Per-group ordered workspace ids (user drag-reorder within a group).
   * Keyed by group name; absent key = registration order.
   */
  workspaceOrder?: Record<string, string[]>
  /**
   * View mode last selected in the official view-options menu. Absent is
   * treated as `virtual`.
   */
  mode?: GroupViewMode
}

/**
 * Legacy label of the fallback bucket. The top-level (ungrouped) concept
 * replaced the rendered "未分类" bucket: workspaces in no group render as
 * top-level rows beside the group folders. The constant survives for data
 * compatibility (reserved name, assignment null marker).
 */
export const UNCATEGORIZED_LABEL = '未分类'

/**
 * The built-in, non-deletable group that holds every workspace without an
 * explicit group assignment. The name is fixed by product requirement: it is
 * shown verbatim in every UI language and may never be renamed or deleted.
 *
 * Persistence convention: a `null` assignment means "default group", and the
 * default group's project order is stored under `TOP_LEVEL_ORDER_KEY`.
 */
export const DEFAULT_GROUP = '默认'

/**
 * Previous name of the built-in default group. Older overlays may still carry
 * this label in categories/assignments/orders; reads fold it into
 * `DEFAULT_GROUP` so existing data keeps landing in the default group.
 */
export const LEGACY_DEFAULT_GROUP = '默认工作区'

/**
 * Reserved key under `workspaceOrder` holding the manual order of TOP-LEVEL
 * (ungrouped) project rows. Distinct from any real group display name (a group
 * may not be named this), so it can never collide.
 */
export const TOP_LEVEL_ORDER_KEY = '__topLevel__'
