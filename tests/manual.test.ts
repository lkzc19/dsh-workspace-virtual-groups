/**
 * Manual-overlay tests: shape validation, group-reference validation at the
 * write boundary, and the atomic file round-trip.
 */
import { describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  parseManualGroups,
  readManualGroups,
  validateManualGroups,
  writeManualGroups,
} from '../src/host-manual.ts'
import {
  DEFAULT_GROUP,
  LEGACY_DEFAULT_GROUP,
  TOP_LEVEL_ORDER_KEY,
  UNCATEGORIZED_LABEL,
  type ManualGroups,
} from '../src/core/types.ts'

describe('parseManualGroups', () => {
  it('parses a valid overlay', () => {
    const parsed = parseManualGroups({
      categories: ['临时'],
      assignments: { 'ws-1': '临时', 'ws-2': null },
    })
    expect(parsed).toEqual({
      categories: ['临时'],
      assignments: { 'ws-1': '临时', 'ws-2': null },
    })
  })

  it('empty / undefined input yields an empty overlay', () => {
    expect(parseManualGroups(undefined)).toEqual({ categories: [], assignments: {} })
    expect(parseManualGroups({})).toEqual({ categories: [], assignments: {} })
  })

  it('rejects a non-mapping top level', () => {
    expect(() => parseManualGroups([])).toThrow(/mapping/)
    expect(() => parseManualGroups('nope')).toThrow(/mapping/)
  })

  it('rejects non-string / empty category names and trims them', () => {
    expect(() => parseManualGroups({ categories: [42] })).toThrow(/non-empty string/)
    expect(() => parseManualGroups({ categories: [''] })).toThrow(/non-empty string/)
    expect(parseManualGroups({ categories: [' 临时 '] }).categories).toEqual(['临时'])
  })

  it('rejects the uncategorized name and folds default-group aliases', () => {
    expect(() => parseManualGroups({ categories: [UNCATEGORIZED_LABEL] })).toThrow(/reserved/)
    expect(parseManualGroups({ categories: [DEFAULT_GROUP, LEGACY_DEFAULT_GROUP] }).categories).toEqual([])
  })

  it('rejects duplicate category names', () => {
    expect(() => parseManualGroups({ categories: ['临时', '临时'] })).toThrow(/duplicate/)
  })

  it('rejects a non-mapping assignments value', () => {
    expect(() => parseManualGroups({ assignments: [] })).toThrow(/assignments/)
  })

  it('rejects empty assignment keys and non-string assignment values', () => {
    expect(() => parseManualGroups({ assignments: { '': '临时' } })).toThrow(/non-empty/)
    expect(() => parseManualGroups({ assignments: { 'ws-1': 42 } })).toThrow(/category name/)
  })

  it('folds default/legacy/uncategorized assignments to null', () => {
    const parsed = parseManualGroups({
      assignments: { 'ws-1': null, 'ws-2': DEFAULT_GROUP, 'ws-3': LEGACY_DEFAULT_GROUP, 'ws-4': UNCATEGORIZED_LABEL },
    })
    expect(parsed.assignments).toEqual({ 'ws-1': null, 'ws-2': null, 'ws-3': null, 'ws-4': null })
  })

  it('parses the persisted view mode', () => {
    expect(parseManualGroups({ mode: 'official' }).mode).toBe('official')
    expect(parseManualGroups({ mode: 'virtual' }).mode).toBe('virtual')
    expect(parseManualGroups({}).mode).toBeUndefined()
    expect(() => parseManualGroups({ mode: 'other' })).toThrow(/mode/)
  })

  it('parses ordering fields and ignores removed rule fields', () => {
    const parsed = parseManualGroups({
      categories: ['临时'],
      assignments: { 'ws-1': '临时' },
      categoryOrder: ['临时'],
      workspaceOrder: { '临时': ['ws-1'], __topLevel__: ['ws-2'] },
      renamed: { old: 'new' },
      hidden: ['old'],
    })
    expect(parsed.categoryOrder).toEqual(['临时'])
    expect(parsed.workspaceOrder).toEqual({ '临时': ['ws-1'], __topLevel__: ['ws-2'] })
    expect(parsed).not.toHaveProperty('renamed')
    expect(parsed).not.toHaveProperty('hidden')
  })

  it('rejects duplicate categoryOrder entries', () => {
    expect(() => parseManualGroups({ categoryOrder: ['A', 'A'] })).toThrow(/duplicate/)
  })
})

describe('validateManualGroups (write boundary)', () => {
  it('accepts null assignments and assignments to manual groups', () => {
    const manual: ManualGroups = {
      categories: ['临时'],
      assignments: { 'ws-1': null, 'ws-2': '临时' },
    }
    expect(() => validateManualGroups(manual)).not.toThrow()
  })

  it('rejects an assignment into a group that does not exist', () => {
    const manual: ManualGroups = { categories: [], assignments: { 'ws-1': '幽灵分组' } }
    expect(() => validateManualGroups(manual)).toThrow(/unknown group/)
  })

  it('rejects categoryOrder / workspaceOrder keys that do not exist', () => {
    const manual1: ManualGroups = { categories: [], assignments: {}, categoryOrder: ['幽灵'] }
    expect(() => validateManualGroups(manual1)).toThrow(/categoryOrder/)
    const manual2: ManualGroups = { categories: [], assignments: {}, workspaceOrder: { '幽灵': [] } }
    expect(() => validateManualGroups(manual2)).toThrow(/workspaceOrder/)
  })

  it('accepts the reserved top-level order key in workspaceOrder', () => {
    const manual: ManualGroups = {
      categories: [],
      assignments: {},
      workspaceOrder: { [TOP_LEVEL_ORDER_KEY]: ['ws-1', 'ws-2'] },
    }
    expect(() => validateManualGroups(manual)).not.toThrow()
  })
})

describe('manual file round-trip', () => {
  it('a missing file yields an empty overlay', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wg-manual-'))
    try {
      expect(await readManualGroups(join(dir, 'missing.json'))).toEqual({ categories: [], assignments: {} })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('write then read returns the same overlay (atomic publish)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wg-manual-'))
    const path = join(dir, 'workspace-groups.manual.json')
    try {
      const overlay: ManualGroups = {
        categories: ['临时'],
        assignments: { 'ws-1': '临时', 'ws-2': null },
        categoryOrder: ['临时'],
        workspaceOrder: { '临时': ['ws-1'], [TOP_LEVEL_ORDER_KEY]: ['ws-2'] },
        mode: 'official',
      }
      await writeManualGroups(path, overlay)
      expect(await readManualGroups(path)).toEqual(overlay)
      const text = await readFile(path, 'utf8')
      expect(JSON.parse(text)).toEqual(overlay)
      expect(text.endsWith('\n')).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
