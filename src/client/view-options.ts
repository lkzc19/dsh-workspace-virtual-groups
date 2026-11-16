/**
 * The "按虚拟分组" entry this plugin adds to the official view-options menu.
 *
 * The official menu is cloned rather than rebuilt so its markup, classes and
 * check mark keep matching the DSH build it was rendered by. Selecting any
 * official grouping mode switches the layer back to official grouping.
 */
import { LAYER_ICON } from './ui.ts'

/** What the menu needs from the layer that owns the view mode. */
export interface ViewOptionsHost {
  mode(): 'virtual' | 'official'
  /** Switch mode; the layer persists it and re-renders. */
  select(mode: 'virtual' | 'official'): void
}

let suppressViewModeClick = false
let lastSelectedExtra: string[] = []
let lastCheckHTML: string | null = null
const viewMenuMeta = new WeakMap<HTMLButtonElement, { baseClass: string; selectedExtra: string[]; check: string | null }>()

/** Official grouping-mode icons; stable across UI locales. */
const GROUPING = {
  workspace: {
    icon: 'dsw-icon-folder-close-regular',
    labels: ['按工作区', 'By workspace'],
  },
  tree: {
    icon: 'dsw-icon-workspace-tree-outline-regular',
    labels: ['按工作区树', 'By workspace tree'],
  },
  flatList: {
    icon: 'dsw-icon-flat-list-outline-regular',
    labels: ['单列表', 'Flat list'],
  },
} as const
const OFFICIAL_GROUPING_ICONS = new Set<string>(
  Object.values(GROUPING).map((entry) => entry.icon),
)
const OFFICIAL_GROUPING_LABELS = new Set<string>(
  Object.values(GROUPING).flatMap((entry) => entry.labels),
)
function groupingIcon(button: HTMLButtonElement): string | null {
  const svg = button.querySelector<SVGElement>(':scope > span svg[data-icon]')
  return svg?.getAttribute('data-icon') ?? null
}

function groupingLabel(button: HTMLButtonElement): string {
  return (button.textContent ?? '').trim()
}

function isOfficialGroupingButton(button: HTMLButtonElement): boolean {
  const icon = groupingIcon(button)
  if (icon !== null && OFFICIAL_GROUPING_ICONS.has(icon)) return true
  // Fallback for a DSH build that changes the icon names.
  return OFFICIAL_GROUPING_LABELS.has(groupingLabel(button))
}

function findGroupingButton(
  menu: HTMLElement,
  group: (typeof GROUPING)[keyof typeof GROUPING],
): HTMLButtonElement | null {
  const buttons = [...menu.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')]
  const labels: readonly string[] = group.labels
  return buttons.find((button) => groupingIcon(button) === group.icon)
    ?? buttons.find((button) => labels.includes(groupingLabel(button)))
    ?? null
}

function virtualGroupingLabel(menu: HTMLElement): string {
  const workspace = findGroupingButton(menu, GROUPING.workspace)
  const label = workspace === null ? '' : groupingLabel(workspace)
  return label.includes('按') || label.includes('工作区') ? '按虚拟分组' : 'Virtual groups'
}

function findViewOptionsMenu(): HTMLElement | null {
  for (const menu of document.querySelectorAll<HTMLElement>('[role="menu"]')) {
    // The CSS-module local name survives hashing and is language-independent.
    if (menu.className.includes('viewOptionsMenu')) return menu
    // Fallback: a menu that contains an official grouping mode.
    if ([...menu.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')].some(isOfficialGroupingButton)) {
      return menu
    }
  }
  return null
}

export function closeViewOptions(): void {
  if (findViewOptionsMenu() === null) return
  const use = document.querySelector<SVGUseElement>('use[href="#dsw-icon-sliders-two-outline-regular"]')
  const trigger = use?.closest('button')
  if (trigger instanceof HTMLButtonElement) trigger.click()
  else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
}

/** Add/refresh the "按虚拟分组" item inside the official view-options menu. */
export function ensureViewOptions(host: ViewOptionsHost): void {
  const menu = findViewOptionsMenu()
  if (menu === null) return
  const isOfficial = isOfficialGroupingButton
  let ours = menu.querySelector<HTMLButtonElement>('button[data-wvg-view-virtual]')
  if (ours === null) {
    const tree = findGroupingButton(menu, GROUPING.tree)
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
    const label = [...button.querySelectorAll(':scope > span')]
      .find((span) => span.querySelector('svg') === null && (span.textContent ?? '').trim() !== '')
    if (label !== undefined) label.textContent = virtualGroupingLabel(menu)
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
      activateVirtualMode(menu, host)
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
      host.select('official')
    }, true)
  }

  const meta = viewMenuMeta.get(ours)
    ?? { baseClass: ours.className, selectedExtra: lastSelectedExtra, check: lastCheckHTML }
  if (host.mode() === 'virtual') {
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

function activateVirtualMode(menu: HTMLElement, host: ViewOptionsHost): void {
  host.select('virtual')
  const byWorkspace = findGroupingButton(menu, GROUPING.workspace)
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

