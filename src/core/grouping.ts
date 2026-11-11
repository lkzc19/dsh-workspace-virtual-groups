/**
 * Pure manual-group ordering/assignment helpers shared by the host half
 * (validation) and the browser half (tree derivation).
 *
 * There is no automatic classifier: a workspace is in a manual group when the
 * overlay assigns it there, otherwise it is in the built-in default group.
 */
import {
  DEFAULT_GROUP,
  LEGACY_DEFAULT_GROUP,
  TOP_LEVEL_ORDER_KEY,
  UNCATEGORIZED_LABEL,
  type ManualGroups,
} from './types.ts'

/** One rendered group entry; default is always first. */
export interface EffectiveCategory {
  /** Display key (what the tree renders and assignments reference). */
  key: string
  /** Origin: the built-in default group or a manual group. */
  source: 'builtin' | 'manual'
}

/**
 * Effective manual groups in display order: default first, then manual groups
 * ordered by `categoryOrder` (absent entries keep creation order).
 */
export function effectiveCategories(manual: ManualGroups | undefined): EffectiveCategory[] {
  const entries: EffectiveCategory[] = [{ key: DEFAULT_GROUP, source: 'builtin' }]
  const seen = new Set<string>([DEFAULT_GROUP, LEGACY_DEFAULT_GROUP])
  for (const name of manual?.categories ?? []) {
    if (seen.has(name)) continue
    seen.add(name)
    entries.push({ key: name, source: 'manual' })
  }
  const order = manual?.categoryOrder
  if (order === undefined || order.length === 0) return entries
  const position = new Map(order.map((key, index) => [key, index]))
  const [defaultEntry, ...rest] = entries
  rest.sort((a, b) => {
    const pa = position.get(a.key)
    const pb = position.get(b.key)
    if (pa !== undefined && pb !== undefined) return pa - pb
    if (pa !== undefined) return -1
    if (pb !== undefined) return 1
    return 0
  })
  return [defaultEntry!, ...rest]
}

/** Display keys of all effective groups (default first). */
export function displayCategoryKeys(manual: ManualGroups | undefined): string[] {
  return effectiveCategories(manual).map(entry => entry.key)
}

/**
 * Resolve the group key a workspace renders under. Assignments naming a group
 * that no longer exists (or a legacy name) fall back to the default group.
 */
export function resolveCategory(manual: ManualGroups | undefined, workspaceId: string): string {
  const assignment = manual?.assignments[workspaceId]
  if (assignment === undefined || assignment === null) return DEFAULT_GROUP
  if (assignment === DEFAULT_GROUP || assignment === LEGACY_DEFAULT_GROUP) return DEFAULT_GROUP
  return manual?.categories.includes(assignment) ? assignment : DEFAULT_GROUP
}

/** Names reserved for the built-in default group and the legacy label. */
export function takenCategoryNames(manual: ManualGroups | undefined): Set<string> {
  const taken = new Set<string>(displayCategoryKeys(manual))
  taken.add(UNCATEGORIZED_LABEL)
  taken.add(DEFAULT_GROUP)
  taken.add(LEGACY_DEFAULT_GROUP)
  return taken
}

/**
 * Order a bucket of workspace ids: the stored per-group order first (filtered
 * to actual members), then any remaining members in `fallback` order.
 */
export function orderedWorkspaceIds(
  manual: ManualGroups | undefined,
  categoryKey: string,
  members: readonly string[],
): string[] {
  const key = categoryKey === DEFAULT_GROUP || categoryKey === LEGACY_DEFAULT_GROUP
    ? TOP_LEVEL_ORDER_KEY
    : categoryKey
  const stored = manual?.workspaceOrder?.[key]
  if (stored === undefined || stored.length === 0) return [...members]
  const memberSet = new Set(members)
  const ordered: string[] = []
  const seen = new Set<string>()
  for (const id of stored) {
    if (!memberSet.has(id) || seen.has(id)) continue
    seen.add(id)
    ordered.push(id)
  }
  for (const id of members) {
    if (seen.has(id)) continue
    ordered.push(id)
  }
  return ordered
}

/** Move `id` before `beforeId` (undefined = append) within an ordered list. */
export function moveBefore(list: readonly string[], id: string, beforeId: string | undefined): string[] {
  const rest = list.filter(x => x !== id)
  if (beforeId === undefined) return [...rest, id]
  const index = rest.indexOf(beforeId)
  if (index === -1) return [...rest, id]
  rest.splice(index, 0, id)
  return rest
}

/** Move `id` after `afterId` (undefined = append) within an ordered list. */
export function moveAfter(list: readonly string[], id: string, afterId: string | undefined): string[] {
  const rest = list.filter(x => x !== id)
  if (afterId === undefined) return [...rest, id]
  const index = rest.indexOf(afterId)
  if (index === -1) return [...rest, id]
  rest.splice(index + 1, 0, id)
  return rest
}
