/**
 * Virtual workspace groups as a thin layer over the official sidebar browser.
 *
 * The official `@deepseek-ai/dsh-client-ui-workspace` browser is left
 * completely intact: its row markup, icons, hover actions, search, keyboard
 * handling and view options are the ones users already know. This module only
 * reorders the official workspace sections (via CSS `order` on a flex list)
 * and inserts group labels between them. No official row is cloned, replaced
 * or restyled.
 *
 * The grouping overlay is the same one the host half serves: manual groups and
 * per-workspace assignments are persisted in
 * `$DSH_HOME/workspace-virtual-groups.manual.json`.
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
import { closeModal, openConfirmDialog, openNameDialog } from './dialogs.ts'
import {
  ensureNewGroupButton,
  officialAddButton,
  removeNewGroupButtons,
} from './new-group-button.ts'
import { closeMenu, openMenu, type MenuEntry } from './menu.ts'
import { disposeToast, showToast } from './toast.ts'
import { LAYER_ICON, svgIcon } from './ui.ts'
import { closeViewOptions, ensureViewOptions } from './view-options.ts'
import css from './styles.css?inline'

/**
 * Drag payload MIME. Firefox only starts a drag when `dataTransfer` carries
 * data; nothing reads the value back — the dragged item is tracked in
 * `dragId` / `draggingGroup`.
 */
const DRAG_MIME = 'application/x-dsh-workspace-virtual-groups'

const MANUAL_ROUTE = '/workspace-virtual-groups/manual'
const COLLAPSED_KEY = 'dsh.workspace.virtual-groups.collapsed.v1'
/** Header padding at depth 0, and the extra step per nesting level. */
const HEADER_INDENT_START = 12
const INDENT_STEP = 16
/** Project rows sit one step further in than the header of their group. */
const PROJECT_INDENT_START = 20

/** Fetch the runtime overlay. */
async function loadState(): Promise<NormalizedManual> {
  const response = await fetch(MANUAL_ROUTE, { cache: 'no-cache' })
  if (!response.ok) throw new Error(`manual request failed: ${response.status}`)
  return normalizeManual((await response.json()) as ManualGroups)
}

/** Persist the whole overlay. The host validates and writes atomically. */
async function putManual(manual: NormalizedManual): Promise<void> {
  const response = await fetch(MANUAL_ROUTE, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(manual),
  })
  if (response.ok) return
  let message = `保存失败（${response.status}）`
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
 * Mount the grouping layer over the official Workspace browser.
 *
 * @param ctx - client context carrying the Workspace controller snapshot.
 * @returns the disposer that removes every DOM node, listener and style.
 */
export function mountWorkspaceVirtualGroups(ctx: {
  workspaces: {
    create(input: { path: string }): Promise<{ workspaceId: string }>
  }
  uiWorkspace: {
    pickDirectory(): Promise<string | null>
    startSession(workspaceId?: string): void
  }
}): () => void {
  const style = document.createElement('style')
  style.dataset.plugin = 'dsh-workspace-virtual-groups'
  style.textContent = css
  document.head.append(style)

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
  /** Official `--dsh-workspace-indent` value before this layer touched a section. */
  const originalIndent = new WeakMap<HTMLElement, string>()
  /** Indent value this layer last wrote into a section (one per nesting depth). */
  const writtenIndent = new WeakMap<HTMLElement, string>()

  const viewOptionsHost = {
    mode: (): 'virtual' | 'official' => viewMode,
    select: (mode: 'virtual' | 'official'): void => setViewMode(mode),
  }

  const newGroupButtonHost = {
    isVirtual: (): boolean => viewMode === 'virtual',
    onCreate: (): void => openCreateGroupDialog(),
  }

  /** Switch between virtual grouping and the official grouping modes. */
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

  /** Coalesce DOM/state notifications into one animation frame. */
  function schedule(): void {
    if (disposed || frame !== 0) return
    frame = window.requestAnimationFrame(() => {
      frame = 0
      if (!disposed) reconcile()
    })
  }

  /** Find the official workspace list (not the search tree). */
  function findList(): HTMLElement | null {
    const row = document.querySelector<HTMLElement>('[data-row-key^="workspace:"]')
    return row?.closest<HTMLElement>('[role="tree"]') ?? null
  }

  /** Direct workspace sections of the official list. */
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

  /** The official list is a block container; a flex column lets `order` work. */
  function markList(target: HTMLElement): void {
    target.classList.add('wvg-list')
  }

  function clearSections(target: HTMLElement): void {
    for (const section of sectionsOf(target)) {
      section.style.order = ''
      section.style.display = ''
      const original = originalIndent.get(section)
      // Only undo the indent when it is still the value this layer wrote. If
      // the official tree view changed it in the meantime, leave the official
      // value in place instead of restoring the pre-grouping one.
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
    for (const header of groupedHeaders.values()) header.remove()
    groupedHeaders.clear()
  }

  function cleanupList(): void {
    if (list === null) return
    list.classList.remove('wvg-list')
    clearSections(list)
    clearHeaders()
  }

  /** Open the create-group dialog. Shared by the repurposed header button. */
  /**
   * Create a group. Without a parent it lands at the top level; with one it
   * becomes that group's child (the built-in group is the top level itself, so
   * a "child" of it is just another top-level group).
   */
  function openCreateGroupDialog(parent: string | null = null): void {
    const parentKey = parent
    openNameDialog(parentKey === null ? '新建分组' : '新建子分组', '', '创建', async (name) => {
      const taken = takenCategoryNames(manual)
      if (name === '' || name === DEFAULT_GROUP) return '该名称不可用'
      if (taken.has(name)) return '已存在同名分组'
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
    header.setAttribute('aria-label', key)
    header.draggable = key !== DEFAULT_GROUP
    header.innerHTML = `<span class="wvg-chevron">${svgIcon('dsw-icon-triangle-right-fill-regular', 14)}</span><span class="wvg-label"></span><button type="button" class="wvg-more" aria-label="分组操作" aria-haspopup="menu">${svgIcon('dsw-icon-ellipsis-outline-regular', 16)}</button>`
    // Group names are user input; never interpolate them into innerHTML.
    header.querySelector<HTMLElement>('.wvg-more')?.setAttribute('aria-label', `分组“${key}”的操作`)
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

  /** Give group action buttons the exact native icon-button class. */
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

  /** Apply grouping: headers, order, collapse and the new-group button. */
  function reconcile(): void {
    if (disposed) return
    // Do not render or allow edits before the overlay has loaded: persisting an
    // empty placeholder would wipe existing groups if the manual request failed.
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
    // The official "workspace tree" mode nests projects by path. Flattening it
    // into virtual groups would destroy that hierarchy, so leave it untouched.
    // Capture the official indent before overwriting it; sections can be reused
    // across renders, so a WeakMap keeps the original per element.
    for (const section of sections) {
      if (!originalIndent.has(section)) originalIndent.set(section, section.style.getPropertyValue('--dsh-workspace-indent'))
    }
    const inOfficialTree = sections.some((section) => {
      const original = originalIndent.get(section) ?? ''
      if (Number.parseFloat(original) > 0) return true
      // A reused node whose inline indent no longer matches ours was changed by
      // the official tree view between reconciles.
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

    // Collapsed state is inherited: a collapsed ancestor hides the whole subtree.
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
        const hidden = hiddenUnderCollapsed(key)
        header.style.order = String(cursor++)
        header.style.paddingLeft = `${HEADER_INDENT_START + depth * INDENT_STEP}px`
        header.style.display = hidden ? 'none' : ''
          header.setAttribute('aria-expanded', collapsed.has(key) ? 'false' : 'true')
        const label = header.querySelector<HTMLElement>('.wvg-label')
        if (label !== null) label.textContent = key
      },
      member: (section, groupKey, depth) => {
        section.style.order = String(cursor++)
        section.style.display = hiddenUnderCollapsed(groupKey) || collapsed.has(groupKey) ? 'none' : ''
        const indent = `${PROJECT_INDENT_START + depth * INDENT_STEP}px`
        section.style.setProperty('--dsh-workspace-indent', indent)
        writtenIndent.set(section, indent)
        section.dataset.wvgIndent = '1'
      },
    })
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
   * Drop zone inside a group header: the outer thirds insert as a sibling, the
   * middle nests. Every drop on the built-in group means "move to the top
   * level", because that group is the root and can never have siblings.
   */
  function dropMode(event: DragEvent, header: HTMLElement): GroupDropMode {
    if ((header.dataset.wvgGroup ?? '') === DEFAULT_GROUP) return 'inside'
    const rect = header.getBoundingClientRect()
    const ratio = (event.clientY - rect.top) / rect.height
    if (ratio < 0.3) return 'before'
    if (ratio > 0.7) return 'after'
    return 'inside'
  }

  /** A group cannot be dropped on itself or anywhere inside its own subtree. */
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

  /** Apply a group drag: nest under the target, or sit beside it. */
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
    // Reveal the destination so the dragged group does not vanish into a
    // collapsed parent.
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

  /** Serialize overlay writes so two fast drags cannot race each other. */
  function persist(next: NormalizedManual): Promise<void> {
    const run = saveQueue.then(async () => {
      await putManual(next)
      manual = next
      schedule()
    })
    // Keep the queue alive after a rejection; the caller still sees the error.
    saveQueue = run.catch(() => {})
    return run
  }

  function requestDeleteGroup(key: string): void {
    const destination = groupParents(manual).get(key) ?? DEFAULT_GROUP
    openConfirmDialog('删除分组', `删除后，该分组内的项目和子分组会移到「${destination}」。`, async () => {
      await deleteGroup(key)
    })
  }

  function openGroupMenu(key: string, anchor: HTMLElement, x: number, y: number): void {
    const entries: MenuEntry[] = [
      {
        label: '添加工作区',
        icon: 'dsw-icon-project-add-outline-regular',
        onSelect: () => { void addWorkspaceToGroup(key) },
      },
      { label: '添加分组', svg: LAYER_ICON, onSelect: () => { openCreateGroupDialog(key) } },
    ]
    // The built-in group may hold workspaces and nested groups, but it can never
    // be renamed, deleted or dragged: its menu stops after the two add actions.
    if (key !== DEFAULT_GROUP) {
      entries.push(
        { separator: true },
        { label: '重命名分组', icon: 'dsw-icon-edit-outline-regular', onSelect: () => { openRenameDialog(key) } },
        { label: '删除分组', icon: 'dsw-icon-trash-outline-regular', danger: true, onSelect: () => { requestDeleteGroup(key) } },
      )
    }
    openMenu(anchor, `分组“${key}”的操作`, entries, x, y)
  }

  function openRenameDialog(key: string): void {
    openNameDialog('重命名分组', key, '重命名', async (name) => {
      if (name === '' || name === DEFAULT_GROUP) return '该名称不可用'
      if (name === key) return null
      if (takenCategoryNames(manual).has(name)) return '已存在同名分组'
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
    // The renamed group can be a parent as well as a child.
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

  // Initial data, then the official DOM is enhanced whenever it changes.
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
    showToast('分组数据加载失败，虚拟分组已暂时停用。请刷新重试。')
    schedule()
  })

  // The conversation streams below the sidebar; observing every mutation would
  // reconcile once per frame for no reason. Only schedule when the sidebar
  // list, its header actions, or an official/injected menu is touched.
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
    cleanupList()
    removeNewGroupButtons()
    document.querySelectorAll('[data-wvg-view-wrap]').forEach((node) => node.remove())
    style.remove()
  }
}
