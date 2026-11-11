/**
 * Pure grouping rules for the virtual-group model: the built-in default group
 * is always present and is the fallback for every workspace without an explicit
 * group, while rules and manual groups remain opt-in overrides.
 */
import { describe, expect, it } from 'vitest'
import {
  displayCategoryKeys,
  effectiveCategories,
  isManualOnlyCategory,
  moveAfter,
  moveBefore,
  orderedWorkspaceIds,
  originalRuleNameForDisplay,
  resolveCategory,
  ruleDisplayName,
  takenCategoryNames,
} from '../src/core/matcher.ts'
import { parseGroupsConfig } from '../src/host-config.ts'
import { DEFAULT_GROUP, UNCATEGORIZED_LABEL, type GroupsConfig, type ManualGroups } from '../src/core/types.ts'

const CONFIG: GroupsConfig = {
  categories: [
    { name: 'DSH 插件', rules: [{ pathPrefix: '/Users/zcol/Project/SkillsManagePlugins' }, { nameContains: '峰谷' }] },
    { name: '文档', rules: [{ basenameContains: 'docs' }] },
  ],
}

describe('resolveCategory', () => {
  it('matches by path prefix, name substring and basename substring', () => {
    expect(resolveCategory(CONFIG, undefined, 'ws', '/Users/zcol/Project/SkillsManagePlugins', 'X')).toBe('DSH 插件')
    expect(resolveCategory(CONFIG, undefined, 'ws', '/p/x', 'DeepSeek峰谷小组件')).toBe('DSH 插件')
    expect(resolveCategory(CONFIG, undefined, 'ws', '/p/SomeDocs', 'SomeDocs')).toBe('文档')
  })

  it('first matching rule category wins', () => {
    const config: GroupsConfig = {
      categories: [
        { name: 'A', rules: [{ nameContains: 'common' }] },
        { name: 'B', rules: [{ nameContains: 'common' }] },
      ],
    }
    expect(resolveCategory(config, undefined, 'ws', '/p/x', 'common-project')).toBe('A')
  })

  it('falls back to the built-in default group when nothing matches', () => {
    expect(resolveCategory(CONFIG, undefined, 'ws', '/tmp/random', 'Random')).toBe(DEFAULT_GROUP)
  })

  it('a manual override wins over rules', () => {
    const manual: ManualGroups = { categories: ['临时'], assignments: { ws: '临时' } }
    expect(resolveCategory(CONFIG, manual, 'ws', '/Users/zcol/Project/SomeDocs', 'SomeDocs')).toBe('临时')
  })

  it('a null override forces the built-in default group even when a rule matches', () => {
    const manual: ManualGroups = { categories: [], assignments: { ws: null } }
    expect(resolveCategory(CONFIG, manual, 'ws', '/Users/zcol/Project/SkillsManagePlugins', 'X')).toBe(DEFAULT_GROUP)
  })

  it('an override naming a deleted group falls back to the default group', () => {
    const manual: ManualGroups = { categories: [], assignments: { ws: 'gone' } }
    expect(resolveCategory(CONFIG, manual, 'ws', '/tmp/random', 'Random')).toBe(DEFAULT_GROUP)
  })

  it('a hidden rule is inert and its members fall back to the default group', () => {
    const manual: ManualGroups = { categories: [], assignments: {}, hidden: ['DSH 插件'] }
    expect(resolveCategory(CONFIG, manual, 'ws', '/Users/zcol/Project/SkillsManagePlugins', 'X')).toBe(DEFAULT_GROUP)
  })

  it('a renamed rule resolves to its display name', () => {
    const manual: ManualGroups = { categories: [], assignments: {}, renamed: { 'DSH 插件': '插件集' } }
    expect(ruleDisplayName(manual, 'DSH 插件')).toBe('插件集')
    expect(resolveCategory(CONFIG, manual, 'ws', '/Users/zcol/Project/SkillsManagePlugins', 'X')).toBe('插件集')
    expect(originalRuleNameForDisplay(CONFIG.categories, manual, '插件集')).toBe('DSH 插件')
  })
})

describe('effectiveCategories / displayCategoryKeys', () => {
  it('always starts with the built-in default group', () => {
    expect(displayCategoryKeys(CONFIG, undefined)).toEqual([DEFAULT_GROUP, 'DSH 插件', '文档'])
    expect(effectiveCategories(CONFIG, undefined)[0]).toEqual({ key: DEFAULT_GROUP, source: 'builtin' })
  })

  it('manual groups follow the rule categories', () => {
    const manual: ManualGroups = { categories: ['临时', '归档'], assignments: {} }
    expect(displayCategoryKeys(CONFIG, manual)).toEqual([DEFAULT_GROUP, 'DSH 插件', '文档', '临时', '归档'])
  })

  it('categoryOrder reorders non-default groups but the default group stays first', () => {
    const manual: ManualGroups = { categories: ['临时'], assignments: {}, categoryOrder: ['临时', '文档', 'DSH 插件'] }
    expect(displayCategoryKeys(CONFIG, manual)).toEqual([DEFAULT_GROUP, '临时', '文档', 'DSH 插件'])
  })

  it('hidden rules drop out and renamed rules appear under the new name', () => {
    const manual: ManualGroups = { categories: [], assignments: {}, hidden: ['文档'], renamed: { 'DSH 插件': '插件集' } }
    expect(displayCategoryKeys(CONFIG, manual)).toEqual([DEFAULT_GROUP, '插件集'])
  })

  it('never includes the legacy uncategorized label', () => {
    expect(displayCategoryKeys(CONFIG, undefined)).not.toContain(UNCATEGORIZED_LABEL)
  })
})

describe('isManualOnlyCategory', () => {
  const manual: ManualGroups = { categories: ['临时'], assignments: {} }
  it('true for a manual-only category, false for rules, the default group and unknown names', () => {
    expect(isManualOnlyCategory(CONFIG, manual, '临时')).toBe(true)
    expect(isManualOnlyCategory(CONFIG, manual, 'DSH 插件')).toBe(false)
    expect(isManualOnlyCategory(CONFIG, manual, DEFAULT_GROUP)).toBe(false)
    expect(isManualOnlyCategory(CONFIG, manual, '不存在')).toBe(false)
    expect(isManualOnlyCategory(CONFIG, undefined, '临时')).toBe(false)
  })
})

describe('takenCategoryNames', () => {
  it('covers rules, manual groups, the legacy label and the built-in default group', () => {
    const manual: ManualGroups = { categories: ['临时'], assignments: {}, renamed: { 'DSH 插件': '插件集' } }
    const taken = takenCategoryNames(CONFIG, manual)
    expect(taken.has('插件集')).toBe(true)
    expect(taken.has('文档')).toBe(true)
    expect(taken.has('临时')).toBe(true)
    expect(taken.has(UNCATEGORIZED_LABEL)).toBe(true)
    expect(taken.has(DEFAULT_GROUP)).toBe(true)
    expect(taken.has('新分组')).toBe(false)
  })
})

describe('orderedWorkspaceIds / moveBefore / moveAfter', () => {
  it('stored order wins, missing members appended in fallback order', () => {
    const manual: ManualGroups = { categories: [], assignments: {}, workspaceOrder: { 'DSH 插件': ['b', 'a'] } }
    expect(orderedWorkspaceIds(manual, 'DSH 插件', ['a', 'b', 'c'])).toEqual(['b', 'a', 'c'])
  })

  it('the default group reads its order from the reserved __topLevel__ key', () => {
    const manual: ManualGroups = { categories: [], assignments: {}, workspaceOrder: { __topLevel__: ['c', 'a'] } }
    expect(orderedWorkspaceIds(manual, DEFAULT_GROUP, ['a', 'b', 'c'])).toEqual(['c', 'a', 'b'])
  })

  it('moveBefore / moveAfter move within a list', () => {
    expect(moveBefore(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b'])
    expect(moveAfter(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a'])
    expect(moveBefore(['a', 'b', 'c'], 'a', undefined)).toEqual(['b', 'c', 'a'])
  })
})

describe('parseGroupsConfig', () => {
  it('parses a valid document and rejects invalid ones', () => {
    const parsed = parseGroupsConfig({ categories: [{ name: 'X', rules: [{ pathPrefix: '/a' }] }] })
    expect(parsed.categories[0]?.name).toBe('X')
    expect(parseGroupsConfig(undefined).categories).toEqual([])
    expect(() => parseGroupsConfig({ categories: [{ rules: [] }] })).toThrow(/name/)
    expect(() => parseGroupsConfig({ categories: [{ name: 'X', rules: [{}] }] })).toThrow(/no matchers/)
  })
})
