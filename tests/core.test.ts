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
  resolveCategory,
  takenCategoryNames,
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
})

describe('takenCategoryNames', () => {
  it('covers manual groups and the built-in default group', () => {
    const manual: ManualGroups = { categories: ['临时'], assignments: {} }
    const taken = takenCategoryNames(manual)
    expect(taken.has('临时')).toBe(true)
    expect(taken.has(DEFAULT_GROUP)).toBe(true)
    expect(taken.has('新分组')).toBe(false)
  })
})

describe('moveBefore / moveAfter', () => {
  it('moves within a list', () => {
    expect(moveBefore(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b'])
    expect(moveAfter(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a'])
    expect(moveBefore(['a', 'b', 'c'], 'a', undefined)).toEqual(['b', 'c', 'a'])
  })
})
