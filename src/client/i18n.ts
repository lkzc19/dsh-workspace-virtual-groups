/**
 * 界面文案的中英文词典，跟随 DSH 当前语言。
 *
 * 走客户端的 `ctx.locale` 服务：注册命名空间后 `bind()` 得到的翻译函数在调用时
 * 读取当前语言，因此切换语言后重渲染即可生效。DSH 的语言查找会沿回退链走到
 * 内置的 `zh` / `en`，所以这里只需要维护这两份完整词典。
 */

/** 本插件在 locale 服务里占用的命名空间。 */
export const NAMESPACE = 'dsh-workspace-virtual-groups'

const zh = {
  'dialog.close': '关闭',
  'dialog.cancel': '取消',
  'dialog.nameLabel': '分组名称',
  'dialog.create': '创建',
  'dialog.rename': '重命名',
  'dialog.delete': '删除',
  'group.default': '默认',
  'group.new': '新建分组',
  'group.newChild': '新建子分组',
  'group.more': '分组“{name}”的操作',
  'group.moreLabel': '分组操作',
  'menu.addWorkspace': '添加工作区',
  'menu.addGroup': '添加分组',
  'menu.rename': '重命名分组',
  'menu.delete': '删除分组',
  'delete.title': '删除分组',
  'delete.message': '删除后，该分组内的项目和子分组会移到「{destination}」。',
  'error.nameUnusable': '该名称不可用',
  'error.nameTaken': '已存在同名分组',
  'error.saveFailed': '保存失败（{status}）',
  'error.loadFailed': '分组数据加载失败，虚拟分组已暂时停用。请刷新重试。',
  'viewMode.virtual': '按虚拟分组',
} as const

export type MessageKey = keyof typeof zh

const en: Record<MessageKey, string> = {
  'dialog.close': 'Close',
  'dialog.cancel': 'Cancel',
  'dialog.nameLabel': 'Group name',
  'dialog.create': 'Create',
  'dialog.rename': 'Rename',
  'dialog.delete': 'Delete',
  'group.default': 'Default',
  'group.new': 'New group',
  'group.newChild': 'New sub-group',
  'group.more': 'Actions for “{name}”',
  'group.moreLabel': 'Group actions',
  'menu.addWorkspace': 'Add workspace',
  'menu.addGroup': 'Add group',
  'menu.rename': 'Rename group',
  'menu.delete': 'Delete group',
  'delete.title': 'Delete group',
  'delete.message': 'Its workspaces and sub-groups move to “{destination}”.',
  'error.nameUnusable': 'That name is not available',
  'error.nameTaken': 'A group with that name already exists',
  'error.saveFailed': 'Save failed ({status})',
  'error.loadFailed': 'Failed to load groups; virtual grouping is paused. Refresh to retry.',
  'viewMode.virtual': 'Virtual groups',
}

/** 客户端 locale 服务里本插件用到的那部分能力。 */
export interface LocaleFace {
  register(namespace: string, locale: string, dict: Record<string, string>): () => void
  bind(namespace: string): (key: string) => string
  subscribe(listener: () => void): () => void
}

let translate: ((key: string) => string) | null = null

/**
 * 注册词典并取回当前语言的翻译函数。
 * @param locale - 客户端的 locale 服务。
 * @returns 卸载函数，移除本次注册的词典。
 */
export function installMessages(locale: LocaleFace): () => void {
  const disposers = [
    locale.register(NAMESPACE, 'zh', zh),
    locale.register(NAMESPACE, 'en', en),
  ]
  translate = locale.bind(NAMESPACE)
  return () => {
    for (const dispose of disposers) dispose()
    translate = null
  }
}

/**
 * 取一条当前语言的文案。`{name}` 形式的占位符由 `params` 填充；
 * 词典尚未注册时回退到中文。
 */
export function t(key: MessageKey, params?: Record<string, string>): string {
  const looked = translate === null ? zh[key] : translate(key)
  // 服务在整条回退链都没命中时会原样返回键名；此时用英文兜底，
  // 这样第三方语言包（回退到 en）即使没有本插件的词典也不会露出键名。
  const message = looked === key ? en[key] : looked
  if (params === undefined) return message
  return message.replace(/\{(\w+)\}/g, (match, name: string) => params[name] ?? match)
}
