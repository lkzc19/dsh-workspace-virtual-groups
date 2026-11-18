/**
 * 文案层：中英词典注册、跟随语言切换、占位符替换。
 */
import { describe, expect, it } from 'vitest'
import { installMessages, t, type LocaleFace } from '../src/client/i18n.ts'

/** 最小 locale 面：记录词典、按当前语言查词。 */
function createLocale() {
  const dicts = new Map<string, Record<string, string>>()
  let active = 'zh'
  let listener: (() => void) | null = null
  const face: LocaleFace = {
    register(namespace, locale, dict) {
      const key = `${namespace}:${locale}`
      dicts.set(key, dict)
      return () => dicts.delete(key)
    },
    bind(namespace) {
      return (key: string) => dicts.get(`${namespace}:${active}`)?.[key] ?? key
    },
    subscribe(fn) {
      listener = fn
      return () => { listener = null }
    },
  }
  return {
    face,
    setLocale(id: string) {
      active = id
      listener?.()
    },
  }
}

describe('i18n', () => {
  it('跟随当前语言，切换后立刻生效', () => {
    const locale = createLocale()
    const dispose = installMessages(locale.face)
    try {
      expect(t('menu.addGroup')).toBe('添加分组')
      locale.setLocale('en')
      expect(t('menu.addGroup')).toBe('Add group')
      locale.setLocale('zh')
      expect(t('menu.addGroup')).toBe('添加分组')
    } finally {
      dispose()
    }
  })

  it('替换 {name} 占位符', () => {
    const locale = createLocale()
    const dispose = installMessages(locale.face)
    try {
      expect(t('group.more', { name: '个人' })).toBe('分组“个人”的操作')
      locale.setLocale('en')
      expect(t('group.more', { name: 'Personal' })).toBe('Actions for “Personal”')
    } finally {
      dispose()
    }
  })

  it('未覆盖的语言回退到英文', () => {
    const locale = createLocale()
    const dispose = installMessages(locale.face)
    try {
      locale.setLocale('ja')
      expect(t('menu.addGroup')).toBe('Add group')
    } finally {
      dispose()
    }
  })

  it('词典卸载后回退到中文', () => {
    const locale = createLocale()
    const dispose = installMessages(locale.face)
    locale.setLocale('en')
    expect(t('menu.delete')).toBe('Delete group')
    dispose()
    expect(t('menu.delete')).toBe('删除分组')
  })

  it('内置分组的显示名也跟随语言', () => {
    const locale = createLocale()
    const dispose = installMessages(locale.face)
    try {
      expect(t('group.default')).toBe('默认')
      locale.setLocale('en')
      expect(t('group.default')).toBe('Default')
    } finally {
      dispose()
    }
  })

  it('两种语言的键集合一致', () => {
    const locale = createLocale()
    const dispose = installMessages(locale.face)
    try {
      locale.setLocale('zh')
      const zhKeys = ['menu.addGroup', 'dialog.cancel', 'error.nameTaken'] as const
      locale.setLocale('en')
      for (const key of zhKeys) expect(t(key)).not.toBe(key)
    } finally {
      dispose()
    }
  })
})
