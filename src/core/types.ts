/**
 * Shared manual-group types for dsh-workspace-virtual-groups. Pure types (zero
 * runtime deps) so the host half (sidecar persistence) and the browser half
 * (tree derivation) compile against the same contract.
 *
 * Groups are user-created only. The built-in default group catches every
 * workspace that has no explicit assignment.
 */

/** Which grouping surface the sidebar should present. */
export type GroupViewMode = 'virtual' | 'official'

/**
 * Runtime-managed grouping overlay: groups created in the sidebar UI plus
 * per-workspace assignments and user-controlled group ordering. Owned by the
 * plugin (JSON sidecar, `$DSH_HOME/workspace-virtual-groups.manual.json`).
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
   * never listed. Absent = manual creation order. Sibling groups compare by
   * their position here, so one flat list orders every level of the tree.
   */
  categoryOrder?: string[]
  /**
   * Nesting: child group name → parent group name. An absent entry means the
   * group sits at the top level, beside the built-in default group.
   *
   * The built-in default group may be a parent (it holds a subtree of its own)
   * but is never a child: it always stays first.
   */
  parents?: Record<string, string>
  /**
   * View mode last selected in the official view-options menu. Absent is
   * treated as `virtual`.
   */
  mode?: GroupViewMode
}

/**
 * The built-in, non-deletable group that holds every workspace without an
 * explicit group assignment. The name is fixed by product requirement: it is
 * shown verbatim in every UI language and may never be renamed or deleted.
 *
 * Persistence convention: a `null` assignment means "default group".
 */
export const DEFAULT_GROUP = '默认'
