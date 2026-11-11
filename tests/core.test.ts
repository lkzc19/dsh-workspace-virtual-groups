/**
 * Pure manual-group helpers: the built-in default group catches workspaces
 * without an assignment; user-created groups are ordered explicitly.
 */
import { describe, expect, it } from 'vitest'
import {
  displayCategoryKeys,
  effectiveCategories,
  moveAfter,
  moveBefore,
  orderedWorkspaceIds,
  resolveCategory,
  takenCategoryNames,
} from '../src/core/grouping.ts'
import {
  DEFAULT_GROUP,
  LEGACY_DEFAULT_GROUP,
  TOP_LEVEL_ORDER_KEY,
  UNCATEGORIZED_LABEL,
  type ManualGroups,
} from '../src/core/types.ts'

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

  it('null assignment and legacy default labels resolve to the default group', () => {
    const manual: ManualGroups = {
      categories: [],
      assignments: { ws1: null, ws2: DEFAULT_GROUP, ws3: LEGACY_DEFAULT_GROUP },
    }
    expect(resolveCategory(manual, 'ws1')).toBe(DEFAULT_GROUP)
    expect(resolveCategory(manual, 'ws2')).toBe(DEFAULT_GROUP)
    expect(resolveCategory(manual, 'ws3')).toBe(DEFAULT_GROUP)
  })

  it('an assignment naming a deleted group falls back to the default group', () => {
    const manual: ManualGroups = { categories: [], assignments: { ws: 'gone' } }
    expect(resolveCategory(manual, 'ws')).toBe(DEFAULT_GROUP)
  })
})

describe('effectiveCategories / displayCategoryKeys', () => {
  it('always starts with the built-in default group', () => {
    expect(displayCategoryKeys(undefined)).toEqual([DEFAULT_GROUP])
    expect(effectiveCategories(undefined)[0]).toEqual({ key: DEFAULT_GROUP, source: 'builtin' })
  })

  it('manual groups follow in creation order', () => {
    const manual: ManualGroups = { categories: ['临时', '归档'], assignments: {} }
    expect(displayCategoryKeys(manual)).toEqual([DEFAULT_GROUP, '临时', '归档'])
  })

  it('categoryOrder reorders non-default groups but the default group stays first', () => {
    const manual: ManualGroups = { categories: ['临时', '归档'], assignments: {}, categoryOrder: ['归档', '临时'] }
    expect(displayCategoryKeys(manual)).toEqual([DEFAULT_GROUP, '归档', '临时'])
  })

  it('never includes the legacy uncategorized label', () => {
    expect(displayCategoryKeys(undefined)).not.toContain(UNCATEGORIZED_LABEL)
  })
})

describe('takenCategoryNames', () => {
  it('covers manual groups and all reserved names', () => {
    const manual: ManualGroups = { categories: ['临时'], assignments: {} }
    const taken = takenCategoryNames(manual)
    expect(taken.has('临时')).toBe(true)
    expect(taken.has(UNCATEGORIZED_LABEL)).toBe(true)
    expect(taken.has(DEFAULT_GROUP)).toBe(true)
    expect(taken.has(LEGACY_DEFAULT_GROUP)).toBe(true)
    expect(taken.has('新分组')).toBe(false)
  })
})

describe('orderedWorkspaceIds / moveBefore / moveAfter', () => {
  it('stored order wins, missing members appended in fallback order', () => {
    const manual: ManualGroups = { categories: [], assignments: {}, workspaceOrder: { '临时': ['b', 'a'] } }
    expect(orderedWorkspaceIds(manual, '临时', ['a', 'b', 'c'])).toEqual(['b', 'a', 'c'])
  })

  it('the default group reads its order from the reserved top-level key', () => {
    const manual: ManualGroups = {
      categories: [],
      assignments: {},
      workspaceOrder: { [TOP_LEVEL_ORDER_KEY]: ['c', 'a'] },
    }
    expect(orderedWorkspaceIds(manual, DEFAULT_GROUP, ['a', 'b', 'c'])).toEqual(['c', 'a', 'b'])
  })

  it('moveBefore / moveAfter move within a list', () => {
    expect(moveBefore(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b'])
    expect(moveAfter(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a'])
    expect(moveBefore(['a', 'b', 'c'], 'a', undefined)).toEqual(['b', 'c', 'a'])
  })
})
