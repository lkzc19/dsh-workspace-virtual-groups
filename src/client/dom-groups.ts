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
 * The grouping overlay is the same one the host half serves: manual groups,
 * per-workspace assignments, rules and rename/delete overlays are persisted in
 * `$DSH_HOME/workspace-virtual-groups.manual.json`.
 */
import type { GroupsConfig, ManualGroups } from '../core/types.ts'
import { DEFAULT_GROUP, LEGACY_DEFAULT_GROUP, TOP_LEVEL_ORDER_KEY, UNCATEGORIZED_LABEL } from '../core/types.ts'
import {
  effectiveCategories,
  moveAfter,
  moveBefore,
  originalRuleNameForDisplay,
  resolveCategory,
  takenCategoryNames,
} from '../core/matcher.ts'
import css from './styles.css?inline'

const MIME = 'application/x-dsh-workspace-virtual-groups'
const GROUP_MIME = 'application/x-dsh-workspace-virtual-group'

/** Layer glyph used by the new-group button and the view-options item. */
const LAYER_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round" data-wvg-layer="1" aria-hidden="true"><path d="M8 1.8 14 5 8 8.2 2 5 8 1.8Z"></path><path d="M2 8 8 11.2 14 8"></path><path d="M2 11 8 14.2 14 11"></path></svg>'
const CONFIG_ROUTE = '/workspace-virtual-groups/config'
const MANUAL_ROUTE = '/workspace-virtual-groups/manual'
const COLLAPSED_KEY = 'dsh.workspace.virtual-groups.collapsed.v1'
/** Indentation applied to project sections inside a virtual group (matches the official tree step). */
const GROUP_INDENT = '20px'

type NormalizedManual = Required<ManualGroups>

const EMPTY_MANUAL: NormalizedManual = {
  categories: [],
  assignments: {},
  categoryOrder: [],
  workspaceOrder: {},
  renamed: {},
  hidden: [],
  mode: 'virtual',
}

interface WorkspaceInfo {
  path: string
  title: string
}

interface LoadedState {
  config: GroupsConfig
  manual: NormalizedManual
}

/** Materialize optional overlay fields and fold every legacy default-group spelling. */
function normalizeManual(manual: ManualGroups | undefined): NormalizedManual {
  if (manual === undefined) return EMPTY_MANUAL
  const assignments = Object.fromEntries(
    Object.entries(manual.assignments).map(([id, category]): [string, string | null] => [
      id,
      category === DEFAULT_GROUP || category === LEGACY_DEFAULT_GROUP ? null : category,
    ]),
  )
  const workspaceOrder: Record<string, string[]> = { ...(manual.workspaceOrder ?? {}) }
  for (const defaultKey of [DEFAULT_GROUP, LEGACY_DEFAULT_GROUP]) {
    const defaultOrder = workspaceOrder[defaultKey]
    if (defaultOrder === undefined) continue
    workspaceOrder[TOP_LEVEL_ORDER_KEY] = defaultOrder
    delete workspaceOrder[defaultKey]
  }
  return {
    categories: manual.categories.filter(name => name !== DEFAULT_GROUP && name !== LEGACY_DEFAULT_GROUP),
    assignments,
    categoryOrder: (manual.categoryOrder ?? []).filter(key => key !== DEFAULT_GROUP && key !== LEGACY_DEFAULT_GROUP),
    workspaceOrder,
    renamed: manual.renamed ?? {},
    hidden: manual.hidden ?? [],
    mode: manual.mode === 'official' ? 'official' : 'virtual',
  }
}

/** Fetch the rule config plus the runtime overlay in one request. */
async function loadState(): Promise<LoadedState> {
  const response = await fetch(CONFIG_ROUTE, { cache: 'no-cache' })
  if (!response.ok) throw new Error(`config request failed: ${response.status}`)
  const body = (await response.json()) as GroupsConfig & { manual?: ManualGroups }
  return {
    config: Array.isArray(body.categories) ? body : { categories: [] },
    manual: normalizeManual(body.manual),
  }
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

function svgIcon(id: string, size: number): string {
  return `<svg width="${size}" height="${size}" aria-hidden="true"><use href="#${id}"></use></svg>`
}

/**
 * Mount the grouping layer over the official Workspace browser.
 *
 * @param ctx - client context carrying the Workspace controller snapshot.
 * @returns the disposer that removes every DOM node, listener and style.
 */
export function mountWorkspaceVirtualGroups(ctx: {
  workspaces: {
    list: {
      getSnapshot(): { items: readonly { workspaceId: string; path: string; title: string }[] }
      subscribe(listener: () => void): () => void
    }
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
  let config: GroupsConfig = { categories: [] }
  let manual: NormalizedManual = EMPTY_MANUAL
  let ready = false
  let list: HTMLElement | null = null
  let viewMode: 'virtual' | 'official' = 'virtual'
  let suppressViewModeClick = false
  let lastSelectedExtra: string[] = []
  let lastCheckHTML: string | null = null
  let addingWorkspace = false
  let frame = 0
  let menu: HTMLElement | null = null
  let menuPointerClose: ((event: PointerEvent) => void) | null = null
  let menuKeyClose: ((event: KeyboardEvent) => void) | null = null
  let modal: HTMLElement | null = null
  let modalKeyHandler: ((event: KeyboardEvent) => void) | null = null
  let toastTimer = 0
  let dragId: string | null = null
  let draggingGroup: string | null = null
  let saveQueue: Promise<void> = Promise.resolve()
  const groupedHeaders = new Map<string, HTMLElement>()
  const workspaceMap = new Map<string, WorkspaceInfo>()
  const collapsed = readCollapsed()
  /** Official `--dsh-workspace-indent` value before this layer touched a section. */
  const originalIndent = new WeakMap<HTMLElement, string>()
  const viewMenuMeta = new WeakMap<HTMLButtonElement, { baseClass: string; selectedExtra: string[]; check: string | null }>()
  const headerActionsMeta = new WeakMap<HTMLElement, { width: string; minWidth: string; overflow: string }>()

  const workspaceSnapshot = () => ctx.workspaces.list.getSnapshot()
  const workspaceInfo = (id: string): WorkspaceInfo | undefined => workspaceMap.get(id)

  /** Re-read the Workspace controller snapshot into a lookup table. */
  const syncWorkspaces = (): void => {
    workspaceMap.clear()
    for (const item of workspaceSnapshot().items) {
      workspaceMap.set(item.workspaceId, { path: item.path, title: item.title })
    }
    schedule()
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
    target.dataset.wvgList = '1'
  }

  function clearSections(target: HTMLElement): void {
    for (const section of sectionsOf(target)) {
      section.style.order = ''
      section.style.display = ''
      const original = originalIndent.get(section)
      // Only undo the indent when it is still the value this layer wrote. If
      // the official tree view changed it in the meantime, leave the official
      // value in place instead of restoring the pre-grouping one.
      if (original !== undefined && section.style.getPropertyValue('--dsh-workspace-indent') === GROUP_INDENT) {
        if (original === '') section.style.removeProperty('--dsh-workspace-indent')
        else section.style.setProperty('--dsh-workspace-indent', original)
      }
      originalIndent.delete(section)
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
    delete list.dataset.wvgList
    clearSections(list)
    clearHeaders()
  }

  /** Open the create-group dialog. Shared by the repurposed header button. */
  function openCreateGroupDialog(): void {
    openNameDialog('新建分组', '', '创建', async (name) => {
      const taken = takenCategoryNames(config, manual)
      if (name === '' || name === DEFAULT_GROUP || name === LEGACY_DEFAULT_GROUP || name === UNCATEGORIZED_LABEL) return '该名称不可用'
      if (taken.has(name)) return '已存在同名分组'
      await persist({ ...manual, categories: [...manual.categories, name] })
      return null
    })
  }

  /** Undo the old 0.1.x repurposing of the official add-workspace button. */
  function restoreLegacyAddButton(): void {
    document.querySelectorAll<HTMLButtonElement>('button[data-wvg-add-group]').forEach((button) => {
      delete button.dataset.wvgAddGroup
      button.setAttribute('aria-label', '添加工作区')
      button.setAttribute('aria-keyshortcuts', 'Alt+Meta+O')
      const svg = button.querySelector('svg')
      const use = button.querySelector('use')
      if (svg !== null) svg.setAttribute('data-icon', 'dsw-icon-project-add-outline-regular')
      if (use !== null) use.setAttribute('href', '#dsw-icon-project-add-outline-regular')
    })
  }

  function officialAddButton(): HTMLButtonElement | null {
    const use = document.querySelector<SVGUseElement>('use[href="#dsw-icon-project-add-outline-regular"]')
    const button = use?.closest('button')
    return button instanceof HTMLButtonElement ? button : null
  }

  /** Restore the official header-actions width after the extra button goes away. */
  function restoreHeaderActions(actions: HTMLElement | null): void {
    if (actions === null) return
    const original = headerActionsMeta.get(actions)
    if (original === undefined) return
    actions.style.width = original.width
    actions.style.minWidth = original.minWidth
    actions.style.overflow = original.overflow
    headerActionsMeta.delete(actions)
  }

  function removeNewGroupButtons(): void {
    document.querySelectorAll<HTMLElement>('[data-wvg-new-group]').forEach((node) => {
      const actions = node.parentElement
      node.remove()
      restoreHeaderActions(actions)
    })
  }

  /** The layer-icon button next to the official add-workspace button. */
  function ensureNewGroupButton(): void {
    restoreLegacyAddButton()
    if (viewMode !== 'virtual') {
      removeNewGroupButtons()
      return
    }
    const add = officialAddButton()
    if (add === null) {
      removeNewGroupButtons()
      return
    }
    let button = document.querySelector<HTMLButtonElement>('button[data-wvg-new-group]')
    if (button !== null && button.dataset.wvgVersion !== '2') {
      const oldActions = button.parentElement
      button.remove()
      restoreHeaderActions(oldActions)
      button = null
    }
    if (button === null || !button.isConnected) {
      button = add.cloneNode(true) as HTMLButtonElement
      button.dataset.wvgNewGroup = '1'
      button.dataset.wvgVersion = '2'
      add.after(button)
    }
    if (button.previousElementSibling !== add) add.after(button)
    button.setAttribute('aria-label', '新建分组')
    button.removeAttribute('aria-keyshortcuts')
    button.removeAttribute('aria-expanded')
    if (button.querySelector('svg[data-wvg-layer="1"]') === null) button.innerHTML = LAYER_ICON
    button.onclick = (event) => {
      event.preventDefault()
      event.stopPropagation()
      openCreateGroupDialog()
    }
    // The official actions container is sized for two 28px buttons and clips
    // overflow. Widen it to fit the layer button; restore it when the button is
    // removed or the plugin unmounts.
    const actions = button.parentElement
    if (actions !== null) {
      if (!headerActionsMeta.has(actions)) {
        headerActionsMeta.set(actions, {
          width: actions.style.width,
          minWidth: actions.style.minWidth,
          overflow: actions.style.overflow,
        })
      }
      actions.style.width = '88px'
      actions.style.minWidth = '88px'
      actions.style.overflow = 'visible'
    }
  }

  function findViewOptionsMenu(): HTMLElement | null {
    for (const menu of document.querySelectorAll<HTMLElement>('[role="menu"]')) {
      const text = menu.textContent ?? ''
      if (text.includes('分组方式') && text.includes('按工作区树')) return menu
    }
    return null
  }

  function groupingButton(menu: HTMLElement, label: string): HTMLButtonElement | null {
    return [...menu.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')]
      .find((button) => (button.textContent ?? '').trim() === label) ?? null
  }

  function closeViewOptions(): void {
    if (findViewOptionsMenu() === null) return
    const use = document.querySelector<SVGUseElement>('use[href="#dsw-icon-sliders-two-outline-regular"]')
    const trigger = use?.closest('button')
    if (trigger instanceof HTMLButtonElement) trigger.click()
    else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  }

  /** Add/refresh the "按虚拟分组" item inside the official view-options menu. */
  function ensureViewOptions(): void {
    const menu = findViewOptionsMenu()
    if (menu === null) return
    const officialLabels = ['按工作区', '按工作区树', '单列表']
    const isOfficial = (button: HTMLButtonElement): boolean => {
      const label = (button.textContent ?? '').trim()
      return officialLabels.includes(label)
    }
    let ours = menu.querySelector<HTMLButtonElement>('button[data-wvg-view-virtual]')
    if (ours === null) {
      const tree = groupingButton(menu, '按工作区树')
      const wrap = tree?.parentElement
      if (tree === null || wrap === undefined || wrap === null) return
      const official = [...menu.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')].filter(isOfficial)
      const unselected = official.find((button) => button.querySelector(':scope > svg') === null) ?? tree
      const selected = official.find((button) => button.querySelector(':scope > svg') !== null)
      const baseClass = unselected.className
      const selectedExtra = selected === undefined
        ? []
        : [...selected.classList].filter((name) => !unselected.classList.contains(name))
      const checkHTML = selected?.querySelector(':scope > svg')?.outerHTML ?? null
      if (selectedExtra.length > 0) lastSelectedExtra = selectedExtra
      if (checkHTML !== null) lastCheckHTML = checkHTML
      const clone = wrap.cloneNode(true) as HTMLElement
      clone.dataset.wvgViewWrap = '1'
      const button = clone.querySelector<HTMLButtonElement>('button[role="menuitem"]')
      if (button === null) return
      button.dataset.wvgViewVirtual = '1'
      button.className = baseClass
      const label = [...button.querySelectorAll('span')]
        .find((span) => span.textContent?.trim() === '按工作区树')
      if (label !== undefined) label.textContent = '按虚拟分组'
      const icon = button.querySelector<HTMLElement>('[class*="itemIcon"]')
        ?? [...button.querySelectorAll('span')].find((span) => span.querySelector('svg') !== null)
      if (icon !== undefined) icon.innerHTML = LAYER_ICON
      button.querySelector(':scope > svg')?.remove()
      wrap.after(clone)
      viewMenuMeta.set(button, {
        baseClass,
        selectedExtra: selectedExtra.length > 0 ? selectedExtra : lastSelectedExtra,
        check: checkHTML ?? lastCheckHTML,
      })
      button.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        activateVirtualMode(menu)
      })
      ours = button
    }

    if (menu.dataset.wvgModeListener !== '1') {
      menu.dataset.wvgModeListener = '1'
      menu.addEventListener('click', (event) => {
        if (suppressViewModeClick) return
        const button = (event.target as Element | null)?.closest<HTMLButtonElement>('button[role="menuitem"]')
        if (button === null || button === undefined) return
        if (!isOfficial(button)) return
        setViewMode('official')
      }, true)
    }

    const meta = viewMenuMeta.get(ours)
      ?? { baseClass: ours.className, selectedExtra: lastSelectedExtra, check: lastCheckHTML }
    if (viewMode === 'virtual') {
      for (const button of menu.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')) {
        if (button === ours || !isOfficial(button)) continue
        if (meta.selectedExtra.length > 0) button.classList.remove(...meta.selectedExtra)
        button.querySelector(':scope > svg')?.remove()
      }
      ours.className = meta.selectedExtra.length > 0
        ? `${meta.baseClass} ${meta.selectedExtra.join(' ')}`
        : meta.baseClass
      if (meta.check !== null && ours.querySelector(':scope > svg') === null) {
        const holder = document.createElement('template')
        holder.innerHTML = meta.check
        const check = holder.content.firstElementChild
        if (check !== null) ours.append(check)
      }
    } else {
      ours.className = meta.baseClass
      ours.querySelector(':scope > svg')?.remove()
    }
  }

  function setViewMode(mode: 'virtual' | 'official'): void {
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

  function activateVirtualMode(menu: HTMLElement): void {
    setViewMode('virtual')
    const byWorkspace = groupingButton(menu, '按工作区')
    if (byWorkspace === null) {
      closeViewOptions()
      return
    }
    // Selecting virtual grouping also normalizes the official mode to the flat
    // "按工作区" list, otherwise the official tree nesting would fight the
    // virtual sections. Suppress our own official-item listener for this click.
    suppressViewModeClick = true
    byWorkspace.click()
    window.setTimeout(() => {
      suppressViewModeClick = false
      if (menu.isConnected) closeViewOptions()
    }, 0)
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
    header.innerHTML = `<span class="wvg-chevron">${svgIcon('dsw-icon-triangle-right-fill-regular', 14)}</span><span class="wvg-label"></span><button type="button" class="wvg-more" aria-label="分组“${key}”的操作" aria-haspopup="menu">${svgIcon('dsw-icon-ellipsis-outline-regular', 16)}</button>`
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
        event.dataTransfer?.setData(GROUP_MIME, key)
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

  /** Apply grouping: headers, order, collapse and the new-group button. */
  function reconcile(): void {
    if (disposed) return
    ensureViewOptions()
    if (!ready) return
    ensureNewGroupButton()
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
      return section.dataset.wvgIndent === '1'
        && section.style.getPropertyValue('--dsh-workspace-indent') !== GROUP_INDENT
    })
    if (inOfficialTree) {
      cleanupList()
      return
    }

    markList(list)

    const members = new Map<string, HTMLElement[]>()
    for (const section of sections) {
      const workspaceId = sectionWorkspaceId(section)
      const info = workspaceId === undefined ? undefined : workspaceInfo(workspaceId)
      const key = workspaceId === undefined
        ? DEFAULT_GROUP
        : resolveCategory(config, manual, workspaceId, info?.path ?? '', info?.title ?? '')
      const bucket = members.get(key)
      if (bucket === undefined) members.set(key, [section])
      else bucket.push(section)
    }

    const groups = effectiveCategories(config, manual)
      .filter(entry => entry.key === DEFAULT_GROUP
        || entry.source === 'manual'
        || (members.get(entry.key)?.length ?? 0) > 0)

    const visible = new Set<string>()
    groups.forEach((entry, groupIndex) => {
      visible.add(entry.key)
      let header = groupedHeaders.get(entry.key)
      if (header === undefined || !header.isConnected) {
        header = createGroupHeader(entry.key)
        groupedHeaders.set(entry.key, header)
        list!.append(header)
      }
      header.style.order = String(groupIndex * 100000 - 1000)
      header.setAttribute('aria-expanded', collapsed.has(entry.key) ? 'false' : 'true')
      const label = header.querySelector<HTMLElement>('.wvg-label')
      if (label !== null) label.textContent = entry.key
      const items = members.get(entry.key) ?? []
      items.forEach((section, index) => {
        section.style.order = String(groupIndex * 100000 + index)
        section.style.display = collapsed.has(entry.key) ? 'none' : ''
        section.style.setProperty('--dsh-workspace-indent', GROUP_INDENT)
        section.dataset.wvgIndent = '1'
      })
    })
    for (const [key, header] of groupedHeaders) {
      if (visible.has(key)) continue
      header.remove()
      groupedHeaders.delete(key)
    }
  }

  function toggleGroup(key: string): void {
    if (collapsed.has(key)) collapsed.delete(key)
    else collapsed.add(key)
    writeCollapsed(collapsed)
    schedule()
  }

  function onDragStart(event: DragEvent): void {
    const row = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-row-key^="workspace:"]')
    if (row === null) return
    const key = row.getAttribute('data-row-key') ?? ''
    if (!key.startsWith('workspace:')) return
    dragId = key.slice('workspace:'.length)
    try {
      event.dataTransfer?.setData(MIME, dragId)
      if (event.dataTransfer !== null) event.dataTransfer.effectAllowed = 'move'
    } catch { /* some synthetic drags have no writable dataTransfer */ }
  }

  function clearDrag(): void {
    dragId = null
    draggingGroup = null
    document.querySelectorAll<HTMLElement>('.wvg-group.wvg-dragging, .wvg-group.wvg-drop, .wvg-group.wvg-insert-before, .wvg-group.wvg-insert-after')
      .forEach((header) => header.classList.remove('wvg-dragging', 'wvg-drop', 'wvg-insert-before', 'wvg-insert-after'))
  }

  function onGroupDragOver(event: DragEvent, header: HTMLElement): void {
    if (draggingGroup !== null) {
      const key = header.dataset.wvgGroup ?? ''
      if (key === DEFAULT_GROUP || key === draggingGroup) return
      event.preventDefault()
      event.stopPropagation()
      if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'move'
      const rect = header.getBoundingClientRect()
      const before = event.clientY < rect.top + rect.height / 2
      document.querySelectorAll<HTMLElement>('.wvg-group.wvg-insert-before, .wvg-group.wvg-insert-after')
        .forEach((node) => node.classList.remove('wvg-insert-before', 'wvg-insert-after'))
      header.classList.add(before ? 'wvg-insert-before' : 'wvg-insert-after')
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
      if (key === DEFAULT_GROUP || key === draggingGroup) return
      event.preventDefault()
      event.stopPropagation()
      const rect = header.getBoundingClientRect()
      const before = event.clientY < rect.top + rect.height / 2
      const dragged = draggingGroup
      clearDrag()
      void reorderGroup(dragged, key, before)
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

  async function reorderGroup(draggedKey: string, targetKey: string, before: boolean): Promise<void> {
    if (draggedKey === targetKey || targetKey === DEFAULT_GROUP) return
    const order = effectiveCategories(config, manual)
      .map(entry => entry.key)
      .filter(key => key !== DEFAULT_GROUP)
    const categoryOrder = before
      ? moveBefore(order, draggedKey, targetKey)
      : moveAfter(order, draggedKey, targetKey)
    try {
      await persist({ ...manual, categoryOrder })
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : String(reason))
    }
  }

  async function moveToGroup(workspaceId: string, key: string): Promise<void> {
    const info = workspaceInfo(workspaceId)
    const current = info === undefined
      ? DEFAULT_GROUP
      : resolveCategory(config, manual, workspaceId, info.path, info.title)
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

  /** Menu row matching DSH's context-menu item (16px icon + 13px label). */
  function menuItem(label: string, icon: string, danger = false): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = danger ? 'wvg-menu-item wvg-danger' : 'wvg-menu-item'
    button.innerHTML = `<span class="wvg-menu-icon">${svgIcon(icon, 16)}</span><span class="wvg-menu-label"></span>`
    const text = button.querySelector<HTMLElement>('.wvg-menu-label')
    if (text !== null) text.textContent = label
    return button
  }

  function openGroupMenu(key: string, anchor: HTMLElement, x: number, y: number): void {
    closeMenu()
    const panel = document.createElement('div')
    panel.className = 'wvg-menu'
    panel.setAttribute('role', 'menu')
    const addWorkspace = menuItem('添加工作区', 'dsw-icon-project-add-outline-regular')
    addWorkspace.addEventListener('click', () => {
      closeMenu()
      void addWorkspaceToGroup(key)
    })
    panel.append(addWorkspace)
    if (key !== DEFAULT_GROUP) {
      const separator = document.createElement('div')
      separator.className = 'wvg-menu-separator'
      separator.setAttribute('role', 'separator')
      const rename = menuItem('重命名分组', 'dsw-icon-edit-outline-regular')
      rename.addEventListener('click', () => {
        closeMenu()
        openNameDialog('重命名分组', key, '重命名', async (name) => {
          if (name === '' || name === DEFAULT_GROUP || name === LEGACY_DEFAULT_GROUP || name === UNCATEGORIZED_LABEL) return '该名称不可用'
          if (name === key) return null
          if (takenCategoryNames(config, manual).has(name)) return '已存在同名分组'
          await renameGroup(key, name)
          return null
        })
      })
      const remove = menuItem('删除分组', 'dsw-icon-trash-outline-regular', true)
      remove.addEventListener('click', () => {
        closeMenu()
        openConfirmDialog('删除分组', `删除后，该分组内的项目会移到「${DEFAULT_GROUP}」。`, async () => {
          await deleteGroup(key)
        })
      })
      panel.append(separator, rename, remove)
    }
    document.body.append(panel)
    const rect = panel.getBoundingClientRect()
    panel.style.left = `${Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))}px`
    panel.style.top = `${Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))}px`
    menu = panel
    const close = (event: PointerEvent): void => {
      if (panel.contains(event.target as Node)) return
      closeMenu()
    }
    menuPointerClose = close
    window.setTimeout(() => {
      if (menuPointerClose === close) document.addEventListener('pointerdown', close, true)
    }, 0)
    menuKeyClose = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') closeMenu()
    }
    document.addEventListener('keydown', menuKeyClose, true)
    anchor.focus?.()
  }

  function closeMenu(): void {
    if (menuPointerClose !== null) document.removeEventListener('pointerdown', menuPointerClose, true)
    if (menuKeyClose !== null) document.removeEventListener('keydown', menuKeyClose, true)
    menuPointerClose = null
    menuKeyClose = null
    menu?.remove()
    menu = null
  }

  async function renameGroup(from: string, name: string): Promise<void> {
    const originalRule = originalRuleNameForDisplay(config.categories, manual, from)
    const assignments = Object.fromEntries(
      Object.entries(manual.assignments).map(([id, category]): [string, string | null] => [
        id,
        category === from ? name : category,
      ]),
    )
    const workspaceOrder = Object.fromEntries(
      Object.entries(manual.workspaceOrder).map(([key, ids]): [string, string[]] => [key === from ? name : key, ids]),
    )
    const categoryOrder = manual.categoryOrder.map(key => key === from ? name : key)
    const next: NormalizedManual = {
      ...manual,
      assignments,
      workspaceOrder,
      categoryOrder,
      ...(originalRule === undefined
        ? { categories: manual.categories.map(key => key === from ? name : key) }
        : { renamed: { ...manual.renamed, [originalRule]: name } }),
    }
    await persist(next)
  }

  async function deleteGroup(key: string): Promise<void> {
    if (key === DEFAULT_GROUP) return
    const originalRule = originalRuleNameForDisplay(config.categories, manual, key)
    const assignments = { ...manual.assignments }
    for (const [workspaceId, info] of workspaceMap) {
      if (resolveCategory(config, manual, workspaceId, info.path, info.title) === key) assignments[workspaceId] = null
    }
    const workspaceOrder = { ...manual.workspaceOrder }
    delete workspaceOrder[key]
    const categoryOrder = manual.categoryOrder.filter(entry => entry !== key)
    const next: NormalizedManual = {
      ...manual,
      assignments,
      workspaceOrder,
      categoryOrder,
      ...(originalRule === undefined
        ? { categories: manual.categories.filter(entry => entry !== key) }
        : {
            renamed: Object.fromEntries(Object.entries(manual.renamed).filter(([original]) => original !== originalRule)),
            hidden: [...manual.hidden, originalRule],
          }),
    }
    await persist(next)
  }

  function openNameDialog(title: string, initial: string, confirmLabel: string, submit: (name: string) => Promise<string | null>): void {
    closeModal()
    const overlay = document.createElement('div')
    overlay.className = 'wvg-overlay'
    overlay.innerHTML = `<div class="wvg-dialog" role="dialog" aria-modal="true"><div class="wvg-dialog-header"><div class="wvg-dialog-title"></div><button type="button" class="wvg-dialog-close" aria-label="关闭">${svgIcon('dsw-icon-close-outline-regular', 14)}</button></div><input class="wvg-input" type="text" maxlength="80" /><div class="wvg-error" role="alert"></div><div class="wvg-dialog-actions"><button type="button" class="wvg-button wvg-outline" data-wvg-cancel>取消</button><button type="button" class="wvg-button wvg-primary" data-wvg-ok></button></div></div>`
    const dialog = overlay.querySelector<HTMLElement>('.wvg-dialog')!
    dialog.querySelector<HTMLElement>('.wvg-dialog-title')!.textContent = title
    const input = dialog.querySelector<HTMLInputElement>('.wvg-input')!
    input.value = initial
    const error = dialog.querySelector<HTMLElement>('.wvg-error')!
    const ok = dialog.querySelector<HTMLButtonElement>('[data-wvg-ok]')!
    ok.textContent = confirmLabel
    let busy = false
    const initialTrimmed = initial.trim()
    const syncOk = (): void => {
      if (busy) return
      const value = input.value.trim()
      ok.disabled = value === '' || (initialTrimmed !== '' && value === initialTrimmed)
    }
    syncOk()
    const close = (): void => closeModal()
    const confirm = async (): Promise<void> => {
      if (busy || ok.disabled) return
      busy = true
      ok.disabled = true
      error.textContent = ''
      try {
        const message = await submit(input.value.trim())
        if (message !== null) {
          error.textContent = message
          return
        }
        close()
      } catch (reason) {
        error.textContent = reason instanceof Error ? reason.message : String(reason)
      } finally {
        busy = false
        syncOk()
      }
    }
    dialog.querySelector<HTMLElement>('[data-wvg-cancel]')!.addEventListener('click', close)
    dialog.querySelector<HTMLElement>('.wvg-dialog-close')!.addEventListener('click', close)
    input.addEventListener('input', syncOk)
    ok.addEventListener('click', () => { void confirm() })
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault()
        void confirm()
      }
    })
    overlay.addEventListener('pointerdown', (event) => {
      if (event.target === overlay) close()
    })
    document.body.append(overlay)
    modal = overlay
    modalKeyHandler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', modalKeyHandler)
    window.requestAnimationFrame(() => {
      input.focus()
      input.select()
    })
  }

  function openConfirmDialog(title: string, message: string, confirm: () => Promise<void>): void {
    closeModal()
    const overlay = document.createElement('div')
    overlay.className = 'wvg-overlay'
    overlay.innerHTML = `<div class="wvg-dialog" role="dialog" aria-modal="true"><div class="wvg-dialog-header"><div class="wvg-dialog-title"></div><button type="button" class="wvg-dialog-close" aria-label="关闭">${svgIcon('dsw-icon-close-outline-regular', 14)}</button></div><div class="wvg-dialog-message"></div><div class="wvg-error" role="alert"></div><div class="wvg-dialog-actions"><button type="button" class="wvg-button wvg-outline" data-wvg-cancel>取消</button><button type="button" class="wvg-button wvg-danger" data-wvg-ok>删除</button></div></div>`
    const dialog = overlay.querySelector<HTMLElement>('.wvg-dialog')!
    dialog.querySelector<HTMLElement>('.wvg-dialog-title')!.textContent = title
    dialog.querySelector<HTMLElement>('.wvg-dialog-message')!.textContent = message
    const error = dialog.querySelector<HTMLElement>('.wvg-error')!
    const ok = dialog.querySelector<HTMLButtonElement>('[data-wvg-ok]')!
    let busy = false
    const close = (): void => closeModal()
    const run = async (): Promise<void> => {
      if (busy) return
      busy = true
      ok.disabled = true
      error.textContent = ''
      try {
        await confirm()
        close()
      } catch (reason) {
        error.textContent = reason instanceof Error ? reason.message : String(reason)
      } finally {
        busy = false
        ok.disabled = false
      }
    }
    dialog.querySelector<HTMLElement>('[data-wvg-cancel]')!.addEventListener('click', close)
    dialog.querySelector<HTMLElement>('.wvg-dialog-close')!.addEventListener('click', close)
    ok.addEventListener('click', () => { void run() })
    overlay.addEventListener('pointerdown', (event) => {
      if (event.target === overlay) close()
    })
    document.body.append(overlay)
    modal = overlay
    modalKeyHandler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', modalKeyHandler)
  }

  function closeModal(): void {
    if (modalKeyHandler !== null) document.removeEventListener('keydown', modalKeyHandler)
    modalKeyHandler = null
    modal?.remove()
    modal = null
  }

  function showToast(message: string): void {
    document.querySelectorAll('.wvg-toast').forEach((node) => node.remove())
    const toast = document.createElement('div')
    toast.className = 'wvg-toast'
    toast.textContent = message
    document.body.append(toast)
    window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => toast.remove(), 3200)
  }

  // Initial data, then the official DOM is enhanced whenever it changes.
  const stopWorkspaces = ctx.workspaces.list.subscribe(syncWorkspaces)
  syncWorkspaces()
  void loadState().then((state) => {
    if (disposed) return
    config = state.config
    manual = state.manual
    viewMode = manual.mode
    ready = true
    schedule()
  }).catch((reason: unknown) => {
    if (disposed) return
    ready = true
    console.warn('workspace virtual groups: config unavailable:', reason)
    schedule()
  })

  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true })
  document.addEventListener('dragstart', onDocumentDragStart, true)
  document.addEventListener('dragend', onDocumentDragEnd, true)
  schedule()

  return () => {
    disposed = true
    stopWorkspaces()
    observer.disconnect()
    document.removeEventListener('dragstart', onDocumentDragStart, true)
    document.removeEventListener('dragend', onDocumentDragEnd, true)
    if (frame !== 0) window.cancelAnimationFrame(frame)
    window.clearTimeout(toastTimer)
    closeMenu()
    closeViewOptions()
    closeModal()
    cleanupList()
    restoreLegacyAddButton()
    removeNewGroupButtons()
    document.querySelectorAll('[data-wvg-view-wrap]').forEach((node) => node.remove())
    style.remove()
  }
}
