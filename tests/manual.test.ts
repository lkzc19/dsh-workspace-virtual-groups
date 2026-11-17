/**
 * 叠加层测试：形状校验、写入边界的分组引用校验，以及文件原子往返。
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
import { DEFAULT_GROUP, type ManualGroups } from '../src/core/types.ts'

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

  it('rejects the built-in group name', () => {
    expect(() => parseManualGroups({ categories: [DEFAULT_GROUP] })).toThrow(/reserved/)
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

  it('keeps assignment values verbatim and trims them', () => {
    const parsed = parseManualGroups({ assignments: { 'ws-1': null, 'ws-2': ' 临时 ' } })
    expect(parsed.assignments).toEqual({ 'ws-1': null, 'ws-2': '临时' })
  })

  it('parses the persisted view mode', () => {
    expect(parseManualGroups({ mode: 'official' }).mode).toBe('official')
    expect(parseManualGroups({ mode: 'virtual' }).mode).toBe('virtual')
    expect(parseManualGroups({}).mode).toBeUndefined()
    expect(() => parseManualGroups({ mode: 'other' })).toThrow(/mode/)
  })

  it('parses categoryOrder and ignores unknown fields', () => {
    const parsed = parseManualGroups({
      categories: ['临时'],
      assignments: { 'ws-1': '临时' },
      categoryOrder: ['临时'],
      workspaceOrder: { '临时': ['ws-1'] },
      renamed: { old: 'new' },
      hidden: ['old'],
    })
    expect(parsed.categoryOrder).toEqual(['临时'])
    expect(parsed).not.toHaveProperty('workspaceOrder')
    expect(parsed).not.toHaveProperty('renamed')
    expect(parsed).not.toHaveProperty('hidden')
  })

  it('rejects duplicate categoryOrder entries', () => {
    expect(() => parseManualGroups({ categoryOrder: ['A', 'A'] })).toThrow(/duplicate/)
  })

  it('parses the parent map, including the built-in group as a parent', () => {
    const parsed = parseManualGroups({ categories: ['A', 'B'], parents: { B: 'A', A: DEFAULT_GROUP } })
    expect(parsed.parents).toEqual({ B: 'A', A: DEFAULT_GROUP })
    expect(() => parseManualGroups({ parents: { [DEFAULT_GROUP]: 'A' } })).toThrow(/cannot be nested/)
    expect(() => parseManualGroups({ parents: { A: '' } })).toThrow(/group name/)
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

  it('rejects categoryOrder entries that do not exist', () => {
    const manual: ManualGroups = { categories: [], assignments: {}, categoryOrder: ['幽灵'] }
    expect(() => validateManualGroups(manual)).toThrow(/categoryOrder/)
  })

  it('rejects parent entries that name unknown or non-group values', () => {
    const unknownChild: ManualGroups = { categories: ['A'], assignments: {}, parents: { '幽灵': 'A' } }
    expect(() => validateManualGroups(unknownChild)).toThrow(/unknown group/)
    const unknownParent: ManualGroups = { categories: ['A'], assignments: {}, parents: { A: '幽灵' } }
    expect(() => validateManualGroups(unknownParent)).toThrow(/not a group/)
  })

  it('rejects a parent cycle', () => {
    const manual: ManualGroups = { categories: ['A', 'B'], assignments: {}, parents: { A: 'B', B: 'A' } }
    expect(() => validateManualGroups(manual)).toThrow(/cycle/)
  })

  it('accepts a nested forest, including the built-in group as a parent', () => {
    const manual: ManualGroups = {
      categories: ['A', 'B', 'C'],
      assignments: {},
      parents: { B: 'A', C: DEFAULT_GROUP },
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
        categories: ['临时', '子分组'],
        assignments: { 'ws-1': '临时', 'ws-2': null },
        categoryOrder: ['临时', '子分组'],
        parents: { '子分组': '临时' },
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
