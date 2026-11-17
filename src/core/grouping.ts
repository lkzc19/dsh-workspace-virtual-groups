/**
 * 手动分组的纯树形工具，宿主侧（校验）和浏览器侧（渲染、拖拽）共用。
 *
 * 分组构成一棵树：内置的「默认」分组是根，永不嵌套；普通分组可以位于顶层，
 * 也可以挂在任意分组（包括「默认」）下面。
 */
import { DEFAULT_GROUP, type ManualGroups } from './types.ts'

/** 按显示顺序（深度优先）排列的一个分组。 */
export interface GroupNode {
  key: string
  /** 父分组名；根与顶层分组为 null。 */
  parent: string | null
  /** 嵌套层级：根与顶层分组为 0，其子级为 1，依此类推。 */
  depth: number
  source: 'builtin' | 'manual'
}

/**
 * 清洗后的「子 → 父」映射。未知分组名、指向自身、以「默认」分组作为子级，以及
 * 成环的条目都会被丢弃，因此手工改过的叠加层也不会导致无限遍历。
 */
export function groupParents(manual: ManualGroups | undefined): Map<string, string> {
  const known = new Set(manual?.categories ?? [])
  const parents = new Map<string, string>()
  for (const [child, parent] of Object.entries(manual?.parents ?? {})) {
    // 「默认」分组可以作为父级，但永远不能是子级。
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

/** 当 `candidate` 位于 `ancestor` 子树中的任意层级时返回 true。 */
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
 * 按父级分桶的所有分组，每个桶内已按显示顺序排好。每次遍历只构建一次，
 * 避免逐节点重建父级映射。
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

/** 某个父级（null 表示顶层）的直接子级，按显示顺序。 */
export function childrenOf(manual: ManualGroups | undefined, parent: string | null): string[] {
  return [...(childrenIndex(manual).get(parent) ?? [])]
}

/** 整棵分组树，按显示顺序：先根，再顶层分组。 */
export function groupTree(manual: ManualGroups | undefined): GroupNode[] {
  const nodes: GroupNode[] = [{ key: DEFAULT_GROUP, parent: null, depth: 0, source: 'builtin' }]
  const index = childrenIndex(manual)
  const walk = (parent: string | null, depth: number): void => {
    for (const key of index.get(parent) ?? []) {
      nodes.push({ key, parent, depth, source: 'manual' })
      walk(key, depth + 1)
    }
  }
  // 「默认」分组连同它的子树排在最前，紧随其后的是与它平级的顶层分组。
  walk(DEFAULT_GROUP, 1)
  walk(null, 0)
  return nodes
}

/** 接收 {@link walkRenderOrder} 展开后的渲染序列。 */
export interface RenderEmitter<T> {
  header(key: string, depth: number): void
  member(item: T, groupKey: string, depth: number): void
}

/**
 * 按渲染顺序遍历分组：先输出该分组的标题，再输出整棵子分组子树，最后输出它
 * 自己的成员。因此同级里子分组总排在该层项目之前。
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

/** 所有分组的显示名（先根，深度优先）。 */
export function displayCategoryKeys(manual: ManualGroups | undefined): string[] {
  return groupTree(manual).map(entry => entry.key)
}

/** 解析某个工作区实际渲染在哪个分组下。 */
export function resolveCategory(manual: ManualGroups | undefined, workspaceId: string): string {
  const assignment = manual?.assignments[workspaceId]
  if (assignment === undefined || assignment === null) return DEFAULT_GROUP
  return manual?.categories.includes(assignment) ? assignment : DEFAULT_GROUP
}

/** 所有可选字段都已补齐的叠加层，浏览器侧直接使用。 */
export type NormalizedManual = Required<ManualGroups>

/**
 * 把叠加层补齐成渲染用的形状：指向已不存在分组的归属回退到「默认」分组，
 * 父级映射也做一次清洗（「默认」分组可作父级，不能作子级）。
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

/** 不能再用作新分组名的集合。 */
export function takenCategoryNames(manual: ManualGroups | undefined): Set<string> {
  return new Set<string>(displayCategoryKeys(manual))
}

/** 删除分组后要写回叠加层的补丁。 */
export interface GroupRemoval {
  categories: string[]
  assignments: Record<string, string | null>
  parents: Record<string, string>
  categoryOrder: string[]
}

/**
 * 删除一个分组但不丢失内容：组内工作区与子分组上移一级——进入父分组；没有
 * 父分组时进入「默认」分组。
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

/** 拖拽的分组相对落点分组的位置。 */
export type GroupDropMode = 'before' | 'after' | 'inside'

/** 拖拽分组后要写回叠加层的补丁。 */
export interface GroupMove {
  parents: Record<string, string>
  categoryOrder: string[]
}

/** 叠加层父级映射的副本，清洗后以普通对象返回。 */
function parentsRecord(manual: ManualGroups | undefined): Record<string, string> {
  return Object.fromEntries(groupParents(manual))
}

/** 空补丁：拖放被拒绝时原样返回。 */
function unchanged(manual: ManualGroups | undefined): GroupMove {
  return {
    parents: parentsRecord(manual),
    categoryOrder: displayCategoryKeys(manual).filter(key => key !== DEFAULT_GROUP),
  }
}

/**
 * 把 `key` 移动到 `target` 的相对位置。
 *
 * - `inside`：挂到目标下面，目标可以是「默认」分组；
 * - `before` / `after`：成为目标在同级的兄弟。
 *
 * 当目标是自身、或位于自身子树内（会成环）时拒绝移动，叠加层原样返回；
 * 「默认」分组永远不可拖动。
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
    // 追加到末尾：被移动的分组成为目标的最后一个子级。
    order.push(key)
  } else {
    const index = order.indexOf(target)
    order.splice(index === -1 ? order.length : (mode === 'before' ? index : index + 1), 0, key)
  }
  return { parents, categoryOrder: order }
}
