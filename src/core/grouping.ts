/**
 * Pure manual-group tree helpers shared by the host half (validation) and the
 * browser half (rendering, drag and drop).
 *
 * Groups form a tree: the built-in default group is the root and is never
 * nested; user groups sit either at the top level (beside the root) or inside
 * another user group.
 */
import { DEFAULT_GROUP, type ManualGroups } from './types.ts'

/** One group in display (depth-first) order. */
export interface GroupNode {
  key: string
  /** Parent group name, or null for the root and top-level groups. */
  parent: string | null
  /** Nesting level: root and top-level groups are 0, their children 1, … */
  depth: number
  source: 'builtin' | 'manual'
}

/**
 * Sanitized child → parent map. Unknown names, self-parenting, the built-in
 * group as a participant, and cycles are dropped, so a hand-edited overlay can
 * never produce an infinite walk.
 */
export function groupParents(manual: ManualGroups | undefined): Map<string, string> {
  const known = new Set(manual?.categories ?? [])
  const parents = new Map<string, string>()
  for (const [child, parent] of Object.entries(manual?.parents ?? {})) {
    // The built-in group is a valid parent but never a child.
    if (child === DEFAULT_GROUP || child === parent) continue
    if (!known.has(child)) continue
    if (parent !== DEFAULT_GROUP && !known.has(parent)) continue
    parents.set(child, parent)
  }
  for (const child of [...parents.keys()]) {
    const seen = new Set<string>([child])
    let cursor = parents.get(child)
    while (cursor !== undefined) {
      if (seen.has(cursor)) {
        parents.delete(child)
        break
      }
      seen.add(cursor)
      cursor = parents.get(cursor)
    }
  }
  return parents
}

/** True when `candidate` is nested anywhere below `ancestor`. */
export function isDescendant(manual: ManualGroups | undefined, candidate: string, ancestor: string): boolean {
  const parents = groupParents(manual)
  const seen = new Set<string>()
  let cursor = parents.get(candidate)
  while (cursor !== undefined && !seen.has(cursor)) {
    if (cursor === ancestor) return true
    seen.add(cursor)
    cursor = parents.get(cursor)
  }
  return false
}

/**
 * Every group bucketed by parent, each bucket in display order. Built once per
 * traversal so walking the tree never rebuilds the parent map per node.
 */
function childrenIndex(manual: ManualGroups | undefined): Map<string | null, string[]> {
  const parents = groupParents(manual)
  const position = new Map((manual?.categoryOrder ?? []).map((key, index) => [key, index]))
  const creation = new Map((manual?.categories ?? []).map((key, index) => [key, index]))
  const index = new Map<string | null, string[]>()
  for (const name of manual?.categories ?? []) {
    const parent = parents.get(name) ?? null
    const bucket = index.get(parent) ?? []
    bucket.push(name)
    index.set(parent, bucket)
  }
  for (const bucket of index.values()) {
    bucket.sort((a, b) => {
      const pa = position.get(a)
      const pb = position.get(b)
      if (pa !== undefined && pb !== undefined) return pa - pb
      if (pa !== undefined) return -1
      if (pb !== undefined) return 1
      return (creation.get(a) ?? 0) - (creation.get(b) ?? 0)
    })
  }
  return index
}

/** Children of one parent (null = top level), in display order. */
export function childrenOf(manual: ManualGroups | undefined, parent: string | null): string[] {
  return [...(childrenIndex(manual).get(parent) ?? [])]
}

/** The whole group tree in display order: root first, then top-level groups. */
export function groupTree(manual: ManualGroups | undefined): GroupNode[] {
  const nodes: GroupNode[] = [{ key: DEFAULT_GROUP, parent: null, depth: 0, source: 'builtin' }]
  const index = childrenIndex(manual)
  const walk = (parent: string | null, depth: number): void => {
    for (const key of index.get(parent) ?? []) {
      nodes.push({ key, parent, depth, source: 'manual' })
      walk(key, depth + 1)
    }
  }
  // The built-in group comes first with its own subtree, then the top-level
  // groups that sit beside it.
  walk(DEFAULT_GROUP, 1)
  walk(null, 0)
  return nodes
}

/** Receives the flattened render sequence of {@link walkRenderOrder}. */
export interface RenderEmitter<T> {
  header(key: string, depth: number): void
  member(item: T, groupKey: string, depth: number): void
}

/**
 * Walk groups in render order: a group emits its header, then its whole
 * subtree of nested groups, then its own members. Nested groups therefore
 * always sit above the projects they share a level with.
 */
export function walkRenderOrder<T>(
  manual: ManualGroups | undefined,
  membersOf: (groupKey: string) => readonly T[],
  emit: RenderEmitter<T>,
): void {
  const tree = groupTree(manual)
  const children = new Map<string | null, GroupNode[]>()
  for (const node of tree) {
    if (node.key === DEFAULT_GROUP) continue
    const bucket = children.get(node.parent) ?? []
    bucket.push(node)
    children.set(node.parent, bucket)
  }
  const place = (node: GroupNode): void => {
    emit.header(node.key, node.depth)
    for (const child of children.get(node.key) ?? []) place(child)
    for (const item of membersOf(node.key)) emit.member(item, node.key, node.depth)
  }
  const root = tree.find(node => node.key === DEFAULT_GROUP)
  if (root !== undefined) place(root)
  for (const topLevel of children.get(null) ?? []) place(topLevel)
}

/** Display keys of every group (root first, depth-first). */
export function displayCategoryKeys(manual: ManualGroups | undefined): string[] {
  return groupTree(manual).map(entry => entry.key)
}

/** Resolve the group key a workspace renders under. */
export function resolveCategory(manual: ManualGroups | undefined, workspaceId: string): string {
  const assignment = manual?.assignments[workspaceId]
  if (assignment === undefined || assignment === null) return DEFAULT_GROUP
  return manual?.categories.includes(assignment) ? assignment : DEFAULT_GROUP
}

/** Overlay with every optional field materialized, as the browser half uses it. */
export type NormalizedManual = Required<ManualGroups>

/**
 * Materialize the overlay for rendering: assignments to groups that no longer
 * exist fall back to the built-in group, and the parent map is sanitized (the
 * built-in group may be a parent, never a child).
 */
export function normalizeManual(manual: ManualGroups | undefined): NormalizedManual {
  if (manual === undefined) {
    return { categories: [], assignments: {}, categoryOrder: [], parents: {}, mode: 'virtual' }
  }
  const categories = [...new Set(manual.categories)].filter(name => name !== DEFAULT_GROUP)
  const known = new Set(categories)
  const assignments = Object.fromEntries(
    Object.entries(manual.assignments).map(([workspaceId, category]): [string, string | null] => [
      workspaceId,
      category !== null && known.has(category) ? category : null,
    ]),
  )
  const parents = Object.fromEntries(groupParents({ categories, assignments, parents: manual.parents }))
  return {
    categories,
    assignments,
    categoryOrder: (manual.categoryOrder ?? []).filter(key => known.has(key)),
    parents,
    mode: manual.mode === 'official' ? 'official' : 'virtual',
  }
}

/** Names that may not be used for a new group. */
export function takenCategoryNames(manual: ManualGroups | undefined): Set<string> {
  return new Set<string>(displayCategoryKeys(manual))
}

/** Overlay patch produced when a group is deleted. */
export interface GroupRemoval {
  categories: string[]
  assignments: Record<string, string | null>
  parents: Record<string, string>
  categoryOrder: string[]
}

/**
 * Delete one group without losing its contents: its workspaces and its child
 * groups move up one level — into the parent group, or into the built-in group
 * when it sits at the top level.
 */
export function removeGroup(manual: ManualGroups | undefined, key: string): GroupRemoval {
  const parent = groupParents(manual).get(key) ?? null
  const destination = parent ?? DEFAULT_GROUP
  const categories = (manual?.categories ?? []).filter(name => name !== key)
  const assignments = Object.fromEntries(
    Object.entries(manual?.assignments ?? {}).map(([workspaceId, category]): [string, string | null] => [
      workspaceId,
      category === key ? (destination === DEFAULT_GROUP ? null : destination) : category,
    ]),
  )
  const parents: Record<string, string> = {}
  for (const [child, childParent] of groupParents(manual)) {
    if (child === key) continue
    parents[child] = childParent === key ? destination : childParent
  }
  return {
    categories,
    assignments,
    parents,
    categoryOrder: displayCategoryKeys(manual).filter(name => name !== DEFAULT_GROUP && name !== key),
  }
}

/** Where a dragged group lands relative to the group it was dropped on. */
export type GroupDropMode = 'before' | 'after' | 'inside'

/** Patch to apply to an overlay after a group drag. */
export interface GroupMove {
  parents: Record<string, string>
  categoryOrder: string[]
}

/** Copy of the overlay's parents, sanitized, as a plain record. */
function parentsRecord(manual: ManualGroups | undefined): Record<string, string> {
  return Object.fromEntries(groupParents(manual))
}

/** No-op patch, used when a drop is refused. */
function unchanged(manual: ManualGroups | undefined): GroupMove {
  return {
    parents: parentsRecord(manual),
    categoryOrder: displayCategoryKeys(manual).filter(key => key !== DEFAULT_GROUP),
  }
}

/**
 * Move `key` relative to `target`.
 *
 * - `inside` nests it under the target (dropping onto the built-in group
 *   returns it to the top level);
 * - `before` / `after` makes it a sibling of the target at the target's level.
 *
 * The move is refused — the overlay comes back unchanged — when the target is
 * the dragged group itself or sits inside its subtree, which would create a
 * cycle; the built-in default group can never be dragged.
 */
export function applyGroupMove(
  manual: ManualGroups | undefined,
  key: string,
  target: string,
  mode: GroupDropMode,
): GroupMove {
  if (key === DEFAULT_GROUP || key === target) return unchanged(manual)
  if (isDescendant(manual, target, key)) return unchanged(manual)

  const parents = parentsRecord(manual)
  const newParent = mode === 'inside'
    ? target
    : (groupParents(manual).get(target) ?? null)
  if (newParent === null) delete parents[key]
  else parents[key] = newParent

  const order = displayCategoryKeys(manual).filter(entry => entry !== DEFAULT_GROUP && entry !== key)
  if (mode === 'inside') {
    // Append: the moved group becomes the target's last child.
    order.push(key)
  } else {
    const index = order.indexOf(target)
    order.splice(index === -1 ? order.length : (mode === 'before' ? index : index + 1), 0, key)
  }
  return { parents, categoryOrder: order }
}
