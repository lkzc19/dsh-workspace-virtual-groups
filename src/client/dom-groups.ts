/**
 * 在官方侧边栏浏览器之上的一层很薄的虚拟工作区分组。
 *
 * 官方 `@deepseek-ai/dsh-client-ui-workspace` 浏览器完全保持原样：行标记、
 * 图标、悬停操作、搜索、键盘处理、视图选项，都还是用户熟悉的那一套。本模块
 * 只做两件事——用 CSS `order` 重排官方的工作区 section，并在它们之间插入分组
 * 标题。不克隆、不替换、也不改写任何官方行的样式。
 *
 * 分组叠加层与宿主侧提供的是同一份：手动分组和每个工作区的归属都持久化在
 * `$DSH_HOME/workspace-virtual-groups.manual.json`。
 */
import type { ManualGroups } from '../core/types.ts'
import { DEFAULT_GROUP } from '../core/types.ts'
import {
  applyGroupMove,
  displayCategoryKeys,
  groupParents,
  isDescendant,
  normalizeManual,
  removeGroup,
  resolveCategory,
  takenCategoryNames,
  walkRenderOrder,
  type GroupDropMode,
  type NormalizedManual,
} from '../core/grouping.ts'
import { applyVisibilityBatch, resetVisibility } from './collapse.ts'
import { installMessages, t, type LocaleFace } from './i18n.ts'
import { closeModal, openConfirmDialog, openNameDialog } from './dialogs.ts'
import {
  ensureNewGroupButton,
  officialAddButton,
  removeNewGroupButtons,
} from './new-group-button.ts'
import { closeMenu, openMenu, type MenuEntry } from './menu.ts'
import { disposeToast, showToast } from './toast.ts'
import { LAYER_ICON, setStyle, svgIcon } from './ui.ts'
import { closeViewOptions, ensureViewOptions } from './view-options.ts'
import css from './styles.css?inline'

/**
 * 拖拽载荷的 MIME。Firefox 要求 `dataTransfer` 里有数据才会开始拖拽；这个值
 * 本身没人读回——被拖的是哪个工作区/分组由 `dragId` / `draggingGroup` 记录。
 */
const DRAG_MIME = 'application/x-dsh-workspace-virtual-groups'

const MANUAL_ROUTE = '/workspace-virtual-groups/manual'
const COLLAPSED_KEY = 'dsh.workspace.virtual-groups.collapsed.v1'
/** 分组标题在深度 0 的左内边距，以及每加深一级增加的步长。 */
const HEADER_INDENT_START = 12
const INDENT_STEP = 16
/** 项目行比所属分组的标题再向内缩进一级。 */
const PROJECT_INDENT_START = 20

/** 拉取运行时叠加层。 */
async function loadState(): Promise<NormalizedManual> {
  const response = await fetch(MANUAL_ROUTE, { cache: 'no-cache' })
  if (!response.ok) throw new Error(`manual request failed: ${response.status}`)
  return normalizeManual((await response.json()) as ManualGroups)
}

/** 整体写回叠加层；由宿主校验并原子写入。 */
async function putManual(manual: NormalizedManual): Promise<void> {
  const response = await fetch(MANUAL_ROUTE, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(manual),
  })
  if (response.ok) return
  let message = t('error.saveFailed', { status: String(response.status) })
  try {
    const text = await response.text()
    if (text !== '') message = text
  } catch { /* keep the fallback */ }
  throw new Error(message)
}

function readCollapsed(): Set<string> {
  try {
    const raw = window.localStorage.getItem(COLLAPSED_KEY)
    if (raw === null) return new Set()
    const parsed: unknown = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === 'string') : [])
  } catch {
    return new Set()
  }
}

function writeCollapsed(collapsed: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]))
  } catch { /* private mode / quota: expansion is only a view preference */ }
}

/**
 * 在官方 Workspace 浏览器之上挂载分组层。
 *
 * @param ctx - 携带 Workspace 控制器快照的客户端上下文。
 * @returns 卸载函数，会移除本层添加的全部 DOM、监听器和样式。
 */
export function mountWorkspaceVirtualGroups(ctx: {
  workspaces: {
    create(input: { path: string }): Promise<{ workspaceId: string }>
  }
  uiWorkspace: {
    pickDirectory(): Promise<string | null>
    startSession(workspaceId?: string): void
  }
  /** 界面文案跟随 DSH 当前语言。 */
  locale: LocaleFace
}): () => void {
  const style = document.createElement('style')
  style.dataset.plugin = 'dsh-workspace-virtual-groups'
  style.textContent = css
  document.head.append(style)

  const disposeMessages = installMessages(ctx.locale)
  // 切换语言后重渲染，让菜单、对话框和 aria 文案跟着变。
  const disposeLocale = ctx.locale.subscribe(() => schedule())

  let disposed = false
  let manual: NormalizedManual = normalizeManual(undefined)
  let loaded = false
  let list: HTMLElement | null = null
  let viewMode: 'virtual' | 'official' = 'virtual'
  let addingWorkspace = false
  let frame = 0
  let dragId: string | null = null
  let draggingGroup: string | null = null
  let saveQueue: Promise<void> = Promise.resolve()
  const groupedHeaders = new Map<string, HTMLElement>()
  const collapsed = readCollapsed()
  /** 本层改动某个 section 之前，官方的 `--dsh-workspace-indent` 值。 */
  const originalIndent = new WeakMap<HTMLElement, string>()
  /** 本层最近一次写入该 section 的缩进值（按嵌套深度区分）。 */
  const writtenIndent = new WeakMap<HTMLElement, string>()

  const viewOptionsHost = {
    mode: (): 'virtual' | 'official' => viewMode,
    select: (mode: 'virtual' | 'official'): void => setViewMode(mode),
  }

  const newGroupButtonHost = {
    isVirtual: (): boolean => viewMode === 'virtual',
    onCreate: (): void => openCreateGroupDialog(),
  }

  /** 在虚拟分组和官方分组方式之间切换。 */
  function setViewMode(mode: 'virtual' | 'official'): void {
    if (!loaded) return
    if (viewMode === mode) {
      schedule()
      return
    }
    viewMode = mode
    manual = { ...manual, mode }
    schedule()
    void persist(manual).catch((reason) => {
      showToast(reason instanceof Error ? reason.message : String(reason))
    })
  }

  /** 把 DOM 与状态通知合并到一帧里处理。 */
  function schedule(): void {
    if (disposed || frame !== 0) return
    frame = window.requestAnimationFrame(() => {
      frame = 0
      if (!disposed) reconcile()
    })
  }

  /** 找到官方的工作区列表（不含搜索结果树）。 */
  function findList(): HTMLElement | null {
    const row = document.querySelector<HTMLElement>('[data-row-key^="workspace:"]')
    return row?.closest<HTMLElement>('[role="tree"]') ?? null
  }

  /** 官方列表的直接子级里，属于工作区的那些 section。 */
  function sectionsOf(target: HTMLElement): HTMLElement[] {
    return Array.from(target.children).filter((element): element is HTMLElement =>
      element instanceof HTMLElement
      && element.querySelector(':scope [data-row-key^="workspace:"]') !== null,
    )
  }

  function sectionWorkspaceId(section: HTMLElement): string | undefined {
    const key = section.querySelector<HTMLElement>('[data-row-key^="workspace:"]')?.getAttribute('data-row-key') ?? ''
    return key.startsWith('workspace:') ? key.slice('workspace:'.length) : undefined
  }

  /** 官方列表是块级容器；改成 flex 列布局后 `order` 才能生效。 */
  function markList(target: HTMLElement): void {
    target.classList.add('wvg-list')
  }

  function clearSections(target: HTMLElement): void {
    for (const section of sectionsOf(target)) {
      section.style.order = ''
      resetVisibility(section)
      const original = originalIndent.get(section)
      // 只有缩进仍是本层写进去的那个值时才还原。如果期间官方树形视图改过它，
      // 就保留官方的值，不能还原成分组之前的值。
      const written = writtenIndent.get(section)
      if (original !== undefined && written !== undefined
        && section.style.getPropertyValue('--dsh-workspace-indent') === written) {
        if (original === '') section.style.removeProperty('--dsh-workspace-indent')
        else section.style.setProperty('--dsh-workspace-indent', original)
      }
      originalIndent.delete(section)
      writtenIndent.delete(section)
      delete section.dataset.wvgIndent
    }
  }

  function clearHeaders(): void {
    for (const header of groupedHeaders.values()) {
      resetVisibility(header)
      header.remove()
    }
    groupedHeaders.clear()
  }

  function cleanupList(): void {
    if (list === null) return
    list.classList.remove('wvg-list')
    clearSections(list)
    clearHeaders()
  }

  /**
   * 新建分组。没有父级时落在顶层；给了父级就成为它的子分组，「默认」分组
   * 也包括在内。
   */
  /** 分组的显示名：内置分组跟随语言，其余是用户起的名字。 */
  function groupLabel(key: string): string {
    return key === DEFAULT_GROUP ? t('group.default') : key
  }

  function openCreateGroupDialog(parent: string | null = null): void {
    const parentKey = parent
    openNameDialog(parentKey === null ? t('group.new') : t('group.newChild'), '', t('dialog.create'), async (name) => {
      const taken = takenCategoryNames(manual)
      if (name === '' || name === DEFAULT_GROUP || name === groupLabel(DEFAULT_GROUP)) return t('error.nameUnusable')
      if (taken.has(name)) return t('error.nameTaken')
      if (parentKey !== null && collapsed.delete(parentKey)) writeCollapsed(collapsed)
      await persist({
        ...manual,
        categories: [...manual.categories, name],
        parents: parentKey === null ? manual.parents : { ...manual.parents, [name]: parentKey },
        categoryOrder: [...displayCategoryKeys(manual).filter(key => key !== DEFAULT_GROUP), name],
      })
      return null
    })
  }

  function createGroupHeader(key: string): HTMLElement {
    const header = document.createElement('div')
    header.className = 'wvg-group'
    header.dataset.wvgGroup = key
    header.dataset.wvgDefault = key === DEFAULT_GROUP ? '1' : '0'
    header.setAttribute('role', 'treeitem')
    header.setAttribute('aria-expanded', 'true')
    header.setAttribute('aria-label', groupLabel(key))
    header.draggable = key !== DEFAULT_GROUP
    header.innerHTML = `<span class="wvg-chevron">${svgIcon('dsw-icon-triangle-right-fill-regular', 14)}</span><span class="wvg-label"></span><button type="button" class="wvg-more" aria-label="${t('group.moreLabel')}" aria-haspopup="menu">${svgIcon('dsw-icon-ellipsis-outline-regular', 16)}</button>`
    // 分组名是用户输入，绝不能拼进 innerHTML。
    header.querySelector<HTMLElement>('.wvg-more')?.setAttribute('aria-label', t('group.more', { name: groupLabel(key) }))
    header.addEventListener('dragstart', (event) => {
      if (key === DEFAULT_GROUP) {
        event.preventDefault()
        return
      }
      if ((event.target as HTMLElement | null)?.closest('.wvg-more') !== null) {
        event.preventDefault()
        return
      }
      draggingGroup = key
      try {
        event.dataTransfer?.setData(DRAG_MIME, key)
        if (event.dataTransfer !== null) event.dataTransfer.effectAllowed = 'move'
      } catch { /* synthetic drag */ }
      header.classList.add('wvg-dragging')
    })
    header.addEventListener('dragend', () => { clearDrag() })
    header.addEventListener('click', (event) => {
      if ((event.target as HTMLElement | null)?.closest('.wvg-more') !== null) return
      toggleGroup(key)
    })
    header.addEventListener('contextmenu', (event) => {
      event.preventDefault()
      openGroupMenu(key, header, event.clientX, event.clientY)
    })
    header.addEventListener('dragover', (event) => onGroupDragOver(event, header))
    header.addEventListener('dragleave', (event) => onGroupDragLeave(event, header))
    header.addEventListener('drop', (event) => onGroupDrop(event, key, header))
    header.querySelector<HTMLElement>('.wvg-more')?.addEventListener('click', (event) => {
      event.stopPropagation()
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
      openGroupMenu(key, event.currentTarget as HTMLElement, rect.left, rect.bottom + 4)
    })
    return header
  }

  /** 让分组操作按钮用上官方的原生图标按钮类名。 */
  function applyNativeIconClasses(): void {
    const rowAction = document.querySelector<HTMLButtonElement>('[data-row-key^="workspace:"] [data-context-menu-trigger]')
    const nativeClass = rowAction?.className ?? officialAddButton()?.className ?? ''
    if (nativeClass === '') return
    document.querySelectorAll<HTMLButtonElement>('.wvg-more').forEach((button) => {
      const previous = button.dataset.wvgNativeClass ?? ''
      if (previous === nativeClass) return
      for (const name of previous.split(/\s+/).filter(Boolean)) button.classList.remove(name)
      button.classList.add(...nativeClass.split(/\s+/).filter(Boolean))
      button.dataset.wvgNativeClass = nativeClass
      button.dataset.wvgNativeIcon = '1'
    })
  }

  /** 应用分组：标题、顺序、折叠状态，以及新建分组按钮。 */
  function reconcile(): void {
    if (disposed) return
    // 叠加层加载完成前既不渲染也不允许编辑：若手动请求失败，把空占位持久化
    // 下去会把已有分组全部抹掉。
    if (!loaded) {
      cleanupList()
      removeNewGroupButtons()
      return
    }
    ensureViewOptions(viewOptionsHost)
    ensureNewGroupButton(newGroupButtonHost)
    if (viewMode !== 'virtual') {
      cleanupList()
      return
    }
    const nextList = findList()
    if (nextList !== list) {
      cleanupList()
      list = nextList
    }
    if (list === null) return
    const sections = sectionsOf(list)
    if (sections.length === 0) {
      cleanupList()
      return
    }
    // 官方的「按工作区树」模式按路径嵌套项目；把它拍平成虚拟分组会毁掉这层
    // 层级，所以原样放过。覆盖缩进前先记下官方值；section 会跨渲染复用，
    // 因此用 WeakMap 按元素保存原始值。
    for (const section of sections) {
      if (!originalIndent.has(section)) originalIndent.set(section, section.style.getPropertyValue('--dsh-workspace-indent'))
    }
    const inOfficialTree = sections.some((section) => {
      const original = originalIndent.get(section) ?? ''
      if (Number.parseFloat(original) > 0) return true
      // 复用的节点若行内缩进已不等于本层写的值，说明两次协调之间官方树形视图
      // 改过它。
      const written = writtenIndent.get(section)
      return section.dataset.wvgIndent === '1'
        && written !== undefined
        && section.style.getPropertyValue('--dsh-workspace-indent') !== written
    })
    if (inOfficialTree) {
      cleanupList()
      return
    }

    markList(list)

    const members = new Map<string, HTMLElement[]>()
    for (const section of sections) {
      const workspaceId = sectionWorkspaceId(section)
      const key = workspaceId === undefined ? DEFAULT_GROUP : resolveCategory(manual, workspaceId)
      const bucket = members.get(key)
      if (bucket === undefined) members.set(key, [section])
      else bucket.push(section)
    }

    // 折叠状态会继承：祖先折叠时整棵子树都隐藏。
    const parentByKey = groupParents(manual)
    const hiddenUnderCollapsed = (key: string): boolean => {
      let cursor = parentByKey.get(key)
      while (cursor !== undefined) {
        if (collapsed.has(cursor)) return true
        cursor = parentByKey.get(cursor)
      }
      return false
    }

    const visible = new Set<string>()
    const visibility: Array<{ element: HTMLElement; visible: boolean }> = []
    let cursor = 0
    walkRenderOrder<HTMLElement>(manual, key => members.get(key) ?? [], {
      header: (key, depth) => {
        visible.add(key)
        let header = groupedHeaders.get(key)
        if (header === undefined || !header.isConnected) {
          header = createGroupHeader(key)
          groupedHeaders.set(key, header)
          list!.append(header)
        }
        setStyle(header, 'order', String(cursor++))
        setStyle(header, 'padding-left', `${HEADER_INDENT_START + depth * INDENT_STEP}px`)
        visibility.push({ element: header, visible: !hiddenUnderCollapsed(key) })
        const expanded = collapsed.has(key) ? 'false' : 'true'
        if (header.getAttribute('aria-expanded') !== expanded) header.setAttribute('aria-expanded', expanded)
        const label = header.querySelector<HTMLElement>('.wvg-label')
        const displayName = groupLabel(key)
        if (label !== null && label.textContent !== displayName) label.textContent = displayName
        const more = header.querySelector<HTMLElement>('.wvg-more')
        const moreLabel = t('group.more', { name: displayName })
        if (more !== null && more.getAttribute('aria-label') !== moreLabel) more.setAttribute('aria-label', moreLabel)
      },
      member: (section, groupKey, depth) => {
        setStyle(section, 'order', String(cursor++))
        visibility.push({
          element: section,
          visible: !hiddenUnderCollapsed(groupKey) && !collapsed.has(groupKey),
        })
        const indent = `${PROJECT_INDENT_START + depth * INDENT_STEP}px`
        setStyle(section, '--dsh-workspace-indent', indent)
        writtenIndent.set(section, indent)
        if (section.dataset.wvgIndent !== '1') section.dataset.wvgIndent = '1'
      },
    })
    // 折叠/展开统一在遍历结束后批量处理：集中写、读一次布局、再集中写。
    applyVisibilityBatch(visibility)
    for (const [key, header] of groupedHeaders) {
      if (visible.has(key)) continue
      header.remove()
      groupedHeaders.delete(key)
    }
    applyNativeIconClasses()
  }

  function toggleGroup(key: string): void {
    if (collapsed.has(key)) collapsed.delete(key)
    else collapsed.add(key)
    writeCollapsed(collapsed)
    schedule()
  }

  function onDragStart(event: DragEvent): void {
    const row = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-row-key^="workspace:"]')
    if (row === null || row === undefined) return
    const key = row.getAttribute('data-row-key') ?? ''
    if (!key.startsWith('workspace:')) return
    dragId = key.slice('workspace:'.length)
    try {
      event.dataTransfer?.setData(DRAG_MIME, dragId)
      if (event.dataTransfer !== null) event.dataTransfer.effectAllowed = 'move'
    } catch { /* some synthetic drags have no writable dataTransfer */ }
  }

  function clearDrag(): void {
    dragId = null
    draggingGroup = null
    document.querySelectorAll<HTMLElement>('.wvg-group.wvg-dragging, .wvg-group.wvg-drop, .wvg-group.wvg-insert-before, .wvg-group.wvg-insert-after')
      .forEach((header) => header.classList.remove('wvg-dragging', 'wvg-drop', 'wvg-insert-before', 'wvg-insert-after'))
  }

  /**
   * 分组标题内的落点区域：上下三分之一插入为同级，中间三分之一变成子分组。
   * 「默认」分组是根、不可能有同级，因此落在它上面的任何位置都按嵌套处理。
   */
  function dropMode(event: DragEvent, header: HTMLElement): GroupDropMode {
    if ((header.dataset.wvgGroup ?? '') === DEFAULT_GROUP) return 'inside'
    const rect = header.getBoundingClientRect()
    const ratio = (event.clientY - rect.top) / rect.height
    if (ratio < 0.3) return 'before'
    if (ratio > 0.7) return 'after'
    return 'inside'
  }

  /** 分组不能落到自己身上，也不能落到自己的子树里。 */
  function canDropGroup(target: string): boolean {
    const dragged = draggingGroup
    if (dragged === null || target === dragged) return false
    return !isDescendant(manual, target, dragged)
  }

  function clearDropMarks(): void {
    document.querySelectorAll<HTMLElement>('.wvg-group.wvg-drop, .wvg-group.wvg-insert-before, .wvg-group.wvg-insert-after')
      .forEach((node) => node.classList.remove('wvg-drop', 'wvg-insert-before', 'wvg-insert-after'))
  }

  function onGroupDragOver(event: DragEvent, header: HTMLElement): void {
    if (draggingGroup !== null) {
      if (!canDropGroup(header.dataset.wvgGroup ?? '')) return
      event.preventDefault()
      event.stopPropagation()
      if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'move'
      const mode = dropMode(event, header)
      clearDropMarks()
      header.classList.add(mode === 'inside' ? 'wvg-drop' : mode === 'before' ? 'wvg-insert-before' : 'wvg-insert-after')
      return
    }
    if (dragId === null) return
    event.preventDefault()
    event.stopPropagation()
    if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'move'
    header.classList.add('wvg-drop')
  }

  function onGroupDragLeave(event: DragEvent, header: HTMLElement): void {
    if (event.relatedTarget instanceof Node && header.contains(event.relatedTarget)) return
    header.classList.remove('wvg-drop', 'wvg-insert-before', 'wvg-insert-after')
  }

  function onGroupDrop(event: DragEvent, key: string, header: HTMLElement): void {
    if (draggingGroup !== null) {
      if (!canDropGroup(key)) return
      event.preventDefault()
      event.stopPropagation()
      const mode = dropMode(event, header)
      const dragged = draggingGroup
      clearDrag()
      void moveGroup(dragged, key, mode)
      return
    }
    if (dragId === null) return
    event.preventDefault()
    event.stopPropagation()
    const workspaceId = dragId
    clearDrag()
    header.classList.remove('wvg-drop')
    void moveToGroup(workspaceId, key)
  }

  function onDocumentDragStart(event: DragEvent): void { onDragStart(event) }
  function onDocumentDragEnd(): void { clearDrag() }

  async function addWorkspaceToGroup(key: string): Promise<void> {
    if (addingWorkspace) return
    addingWorkspace = true
    try {
      const path = await ctx.uiWorkspace.pickDirectory()
      if (path === null) return
      const workspace = await ctx.workspaces.create({ path })
      collapsed.delete(key)
      writeCollapsed(collapsed)
      await persist({
        ...manual,
        assignments: { ...manual.assignments, [workspace.workspaceId]: key === DEFAULT_GROUP ? null : key },
      })
      try {
        ctx.uiWorkspace.startSession(workspace.workspaceId)
      } catch (reason) {
        showToast(reason instanceof Error ? reason.message : String(reason))
      }
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : String(reason))
    } finally {
      addingWorkspace = false
    }
  }

  /** 应用一次分组拖拽：挂到目标下面，或成为它的同级。 */
  async function moveGroup(draggedKey: string, targetKey: string, mode: GroupDropMode): Promise<void> {
    const next = applyGroupMove(manual, draggedKey, targetKey, mode)
    const parentsOf = (record: Record<string, string>): string => Object.entries(record)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([child, parent]) => `${child}\u0000${parent}`)
      .join('\u0001')
    if (parentsOf(next.parents) === parentsOf(manual.parents)
      && next.categoryOrder.join('\u0000') === manual.categoryOrder.join('\u0000')) {
      return
    }
    // 展开目标，避免被拖的分组落进折叠的父级里而看不见。
    const destination = next.parents[draggedKey]
    if (destination !== undefined && collapsed.delete(destination)) writeCollapsed(collapsed)
    try {
      await persist({ ...manual, parents: next.parents, categoryOrder: next.categoryOrder })
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : String(reason))
    }
  }

  async function moveToGroup(workspaceId: string, key: string): Promise<void> {
    const current = resolveCategory(manual, workspaceId)
    if (current === key) return
    collapsed.delete(key)
    writeCollapsed(collapsed)
    try {
      await persist({
        ...manual,
        assignments: { ...manual.assignments, [workspaceId]: key === DEFAULT_GROUP ? null : key },
      })
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : String(reason))
    }
  }

  /** 串行化叠加层写入，避免两次快速拖拽互相覆盖。 */
  function persist(next: NormalizedManual): Promise<void> {
    const run = saveQueue.then(async () => {
      await putManual(next)
      manual = next
      schedule()
    })
    // 某次写入失败后队列仍要继续，同时把错误交给调用方。
    saveQueue = run.catch(() => {})
    return run
  }

  function requestDeleteGroup(key: string): void {
    const destination = groupParents(manual).get(key) ?? DEFAULT_GROUP
    openConfirmDialog(t('delete.title'), t('delete.message', { destination: groupLabel(destination) }), async () => {
      await deleteGroup(key)
    })
  }

  function openGroupMenu(key: string, anchor: HTMLElement, x: number, y: number): void {
    const entries: MenuEntry[] = [
      {
        label: t('menu.addWorkspace'),
        icon: 'dsw-icon-project-add-outline-regular',
        onSelect: () => { void addWorkspaceToGroup(key) },
      },
      { label: t('menu.addGroup'), svg: LAYER_ICON, onSelect: () => { openCreateGroupDialog(key) } },
    ]
    // 「默认」分组可以放工作区和子分组，但不能重命名、删除或拖动，
    // 因此它的菜单只有两个添加类动作。
    if (key !== DEFAULT_GROUP) {
      entries.push(
        { label: t('menu.rename'), icon: 'dsw-icon-edit-outline-regular', onSelect: () => { openRenameDialog(key) } },
        { separator: true },
        { label: t('menu.delete'), icon: 'dsw-icon-trash-outline-regular', danger: true, onSelect: () => { requestDeleteGroup(key) } },
      )
    }
    openMenu(anchor, t('group.more', { name: groupLabel(key) }), entries, x, y)
  }

  function openRenameDialog(key: string): void {
    openNameDialog(t('menu.rename'), key, t('dialog.rename'), async (name) => {
      if (name === '' || name === DEFAULT_GROUP || name === groupLabel(DEFAULT_GROUP)) return t('error.nameUnusable')
      if (name === key) return null
      if (takenCategoryNames(manual).has(name)) return t('error.nameTaken')
      await renameGroup(key, name)
      return null
    })
  }

  async function renameGroup(from: string, name: string): Promise<void> {
    const assignments = Object.fromEntries(
      Object.entries(manual.assignments).map(([id, category]): [string, string | null] => [
        id,
        category === from ? name : category,
      ]),
    )
    // 被重命名的分组既可能是父级，也可能是子级。
    const parents = Object.fromEntries(
      Object.entries(manual.parents).map(([child, parent]) => [
        child === from ? name : child,
        parent === from ? name : parent,
      ]),
    )
    const categoryOrder = manual.categoryOrder.map(key => key === from ? name : key)
    await persist({
      ...manual,
      categories: manual.categories.map(key => key === from ? name : key),
      assignments,
      parents,
      categoryOrder,
    })
  }

  async function deleteGroup(key: string): Promise<void> {
    if (key === DEFAULT_GROUP) return
    await persist({ ...manual, ...removeGroup(manual, key) })
  }

  // 先做一次初始加载；之后的 DOM 变化由下面的观察器跟进。
  void loadState().then((state) => {
    if (disposed) return
    manual = state
    viewMode = manual.mode
    loaded = true
    schedule()
  }).catch((reason: unknown) => {
    if (disposed) return
    loaded = false
    console.warn('workspace virtual groups: manual overlay unavailable:', reason)
    showToast(t('error.loadFailed'))
    schedule()
  })

  // 对话内容也在页面里不断变动，若对所有 mutation 都响应，每帧都会白跑一次
  // 协调。只有侧边栏列表、它的头部操作区，或官方/注入的菜单被碰到时才安排。
  const OBSERVED_SELECTOR = [
    '[role="tree"]',
    '[role="menu"]',
    '[class*="viewOptionsMenu"]',
    '[class*="sectionHeader"]',
    '[class*="headerActions"]',
    '[data-wvg-new-group]',
    '[data-wvg-view-wrap]',
  ].join(',')
  const mutationRelevant = (record: MutationRecord): boolean => {
    if (record.target instanceof Element && record.target.closest(OBSERVED_SELECTOR) !== null) return true
    for (const node of record.addedNodes) {
      if (node instanceof Element && (node.matches(OBSERVED_SELECTOR) || node.querySelector(OBSERVED_SELECTOR) !== null)) return true
    }
    for (const node of record.removedNodes) {
      if (node instanceof Element && (node.matches(OBSERVED_SELECTOR) || node.querySelector(OBSERVED_SELECTOR) !== null)) return true
    }
    return !(record.target instanceof Element)
  }
  const observer = new MutationObserver((records) => {
    if (records.some(mutationRelevant)) schedule()
  })
  observer.observe(document.body, { childList: true, subtree: true })
  document.addEventListener('dragstart', onDocumentDragStart, true)
  document.addEventListener('dragend', onDocumentDragEnd, true)
  schedule()

  return () => {
    disposed = true
    observer.disconnect()
    document.removeEventListener('dragstart', onDocumentDragStart, true)
    document.removeEventListener('dragend', onDocumentDragEnd, true)
    if (frame !== 0) window.cancelAnimationFrame(frame)
    disposeToast()
    closeMenu()
    closeViewOptions()
    closeModal()
    disposeLocale()
    disposeMessages()
    cleanupList()
    removeNewGroupButtons()
    document.querySelectorAll('[data-wvg-view-wrap]').forEach((node) => node.remove())
    style.remove()
  }
}
