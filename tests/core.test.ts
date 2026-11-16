/**
 * Pure manual-group helpers: the built-in default group is the root of a tree,
 * user groups sit either at the top level or nested inside another group.
 */
import { describe, expect, it } from 'vitest'
import {
  applyGroupMove,
  childrenOf,
  displayCategoryKeys,
  groupParents,
  groupTree,
  isDescendant,
  removeGroup,
  resolveCategory,
  takenCategoryNames,
  walkRenderOrder,
} from '../src/core/grouping.ts'
import { DEFAULT_GROUP, type ManualGroups } from '../src/core/types.ts'

const EMPTY: ManualGroups = { categories: [], assignments: {} }

describe('resolveCategory', () => {
  it('falls back to the built-in default group without an assignment', () => {
    expect(resolveCategory(EMPTY, 'ws')).toBe(DEFAULT_GROUP)
    expect(resolveCategory(undefined, 'ws')).toBe(DEFAULT_GROUP)
  })

  it('resolves an assignment to a manual group', () => {
    const manual: ManualGroups = { categories: ['临时'], assignments: { ws: '临时' } }
    expect(resolveCategory(manual, 'ws')).toBe('临时')
  })

  it('a null assignment resolves to the default group', () => {
    const manual: ManualGroups = { categories: ['临时'], assignments: { ws: null } }
    expect(resolveCategory(manual, 'ws')).toBe(DEFAULT_GROUP)
  })

  it('an assignment naming a deleted group falls back to the default group', () => {
    const manual: ManualGroups = { categories: [], assignments: { ws: 'gone' } }
    expect(resolveCategory(manual, 'ws')).toBe(DEFAULT_GROUP)
  })
})

describe('childrenOf / groupTree', () => {
  it('always starts with the built-in default group', () => {
    expect(displayCategoryKeys(undefined)).toEqual([DEFAULT_GROUP])
    expect(groupTree(undefined)).toEqual([{ key: DEFAULT_GROUP, parent: null, depth: 0, source: 'builtin' }])
  })

  it('keeps the default group first with its own subtree, then top-level groups', () => {
    const manual: ManualGroups = {
      categories: ['个人', '神策', '项目 A', '默认的子分组'],
      assignments: {},
      parents: { '项目 A': '个人', '默认的子分组': DEFAULT_GROUP },
    }
    expect(groupTree(manual).map(n => [n.key, n.depth])).toEqual([
      [DEFAULT_GROUP, 0],
      ['默认的子分组', 1],
      ['个人', 0],
      ['项目 A', 1],
      ['神策', 0],
    ])
  })

  it('siblings follow categoryOrder, then creation order', () => {
    const manual: ManualGroups = {
      categories: ['A', 'B', 'C'],
      assignments: {},
      categoryOrder: ['C', 'A'],
    }
    expect(childrenOf(manual, null)).toEqual(['C', 'A', 'B'])
  })

  it('sanitizes unknown parents, self-parenting and cycles', () => {
    const manual: ManualGroups = {
      categories: ['A', 'B'],
      assignments: {},
      parents: { A: 'missing', B: 'B' },
    }
    expect(groupParents(manual).size).toBe(0)
    const cyclic: ManualGroups = {
      categories: ['A', 'B'],
      assignments: {},
      parents: { A: 'B', B: 'A' },
    }
    expect(() => groupTree(cyclic)).not.toThrow()
    expect(groupTree(cyclic)).toHaveLength(3)
  })
})

describe('isDescendant', () => {
  const manual: ManualGroups = {
    categories: ['A', 'B', 'C'],
    assignments: {},
    parents: { B: 'A', C: 'B' },
  }

  it('walks the whole ancestor chain', () => {
    expect(isDescendant(manual, 'B', 'A')).toBe(true)
    expect(isDescendant(manual, 'C', 'A')).toBe(true)
    expect(isDescendant(manual, 'A', 'C')).toBe(false)
    expect(isDescendant(manual, 'A', 'A')).toBe(false)
  })
})

describe('applyGroupMove', () => {
  const base: ManualGroups = { categories: ['A', 'B', 'C'], assignments: {}, categoryOrder: ['A', 'B', 'C'] }

  it('inside nests under the target', () => {
    const next = applyGroupMove(base, 'C', 'A', 'inside')
    expect(next.parents).toEqual({ C: 'A' })
    expect(childrenOf({ ...base, parents: next.parents }, 'A')).toEqual(['C'])
  })

  it('inside the built-in group nests it under the built-in group', () => {
    const nested: ManualGroups = { ...base, parents: { C: 'A' } }
    const next = applyGroupMove(nested, 'C', DEFAULT_GROUP, 'inside')
    expect(next.parents).toEqual({ C: DEFAULT_GROUP })
    expect(childrenOf({ ...base, parents: next.parents }, DEFAULT_GROUP)).toEqual(['C'])
  })

  it('before / after place the group beside the target at its level', () => {
    const nested: ManualGroups = { ...base, parents: { B: 'A' }, categoryOrder: ['A', 'B', 'C'] }
    const next = applyGroupMove(nested, 'C', 'B', 'before')
    expect(next.parents).toEqual({ C: 'A', B: 'A' })
    expect(childrenOf({ ...base, ...next }, 'A')).toEqual(['C', 'B'])
  })

  it('refuses to move a group into its own subtree', () => {
    const nested: ManualGroups = { ...base, parents: { B: 'A' } }
    expect(applyGroupMove(nested, 'A', 'B', 'inside').parents).toEqual({ B: 'A' })
    expect(applyGroupMove(nested, 'A', 'B', 'after').parents).toEqual({ B: 'A' })
  })

  it('never moves the built-in group', () => {
    expect(applyGroupMove(base, DEFAULT_GROUP, 'A', 'inside').parents).toEqual({})
  })
})

describe('walkRenderOrder', () => {
  it('puts nested groups above the projects of the level they share', () => {
    const manual: ManualGroups = {
      categories: ['A', 'B', 'C'],
      assignments: {},
      parents: { B: 'A' },
    }
    const members: Record<string, string[]> = { A: ['a1', 'a2'], B: ['b1'], C: ['c1'] }
    const seq: string[] = []
    walkRenderOrder(manual, key => members[key] ?? [], {
      header: key => seq.push(`#${key}`),
      member: (item, groupKey) => seq.push(`${groupKey}/${item}`),
    })
    expect(seq).toEqual(['#默认', '#A', '#B', 'B/b1', 'A/a1', 'A/a2', '#C', 'C/c1'])
  })

  it('emits the built-in group\'s own subtree before its projects', () => {
    const manual: ManualGroups = {
      categories: ['子', '顶层'],
      assignments: {},
      parents: { 子: DEFAULT_GROUP },
    }
    const members: Record<string, string[]> = { [DEFAULT_GROUP]: ['d1'], 子: ['s1'], 顶层: ['t1'] }
    const seq: string[] = []
    walkRenderOrder(manual, key => members[key] ?? [], {
      header: key => seq.push(`#${key}`),
      member: (item, groupKey) => seq.push(`${groupKey}/${item}`),
    })
    expect(seq).toEqual(['#默认', '#子', '子/s1', '默认/d1', '#顶层', '顶层/t1'])
  })
})

describe('removeGroup', () => {
  const manual: ManualGroups = {
    categories: ['个人', '工作', '存档'],
    assignments: { w1: '工作', w2: '存档', w3: null },
    categoryOrder: ['个人', '工作', '存档'],
    parents: { '工作': '个人', '存档': '工作' },
  }

  it('moves a nested group\'s workspaces and children into its parent', () => {
    const next = removeGroup(manual, '工作')
    expect(next.categories).toEqual(['个人', '存档'])
    expect(next.assignments.w1).toBe('个人')
    expect(next.parents).toEqual({ '存档': '个人' })
  })

  it('moves a top-level group\'s workspaces into the built-in group', () => {
    const next = removeGroup(manual, '个人')
    // Only 个人's own members move; 工作 keeps its workspace and subtree.
    expect(next.assignments).toEqual({ w1: '工作', w2: '存档', w3: null })
    expect(next.parents).toEqual({ '工作': DEFAULT_GROUP, '存档': '工作' })
  })

  it('keeps the remaining groups and ordering', () => {
    const next = removeGroup(manual, '存档')
    expect(next.categoryOrder).toEqual(['个人', '工作'])
    expect(next.assignments.w2).toBe('工作')
  })
})

describe('takenCategoryNames', () => {
  it('covers manual groups and the built-in default group', () => {
    const taken = takenCategoryNames({ categories: ['临时'], assignments: {} })
    expect(taken.has('临时')).toBe(true)
    expect(taken.has(DEFAULT_GROUP)).toBe(true)
    expect(taken.has('新分组')).toBe(false)
  })
})
