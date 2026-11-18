/**
 * 本插件往官方「视图选项」菜单里加的「按虚拟分组」一项。
 *
 * 官方菜单项是克隆而非重建的，这样它的标记、类名和勾选状态始终与当前 DSH
 * 版本渲染出来的一致。选择任意官方分组方式都会让本层退回官方分组。
 */
import { t as translate } from './i18n.ts'
import { LAYER_ICON } from './ui.ts'

/** 菜单需要视图模式持有方提供的能力。 */
export interface ViewOptionsHost {
  mode(): 'virtual' | 'official'
  /** 切换模式；由层负责持久化并重新渲染。 */
  select(mode: 'virtual' | 'official'): void
}

let suppressViewModeClick = false
let lastSelectedExtra: string[] = []
let lastCheckHTML: string | null = null
const viewMenuMeta = new WeakMap<HTMLButtonElement, { baseClass: string; selectedExtra: string[]; check: string | null }>()

/** 官方分组方式的图标；跨语言界面稳定。 */
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
  // 兜底：DSH 版本换了图标名时按文案匹配。
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

/** 菜单项文案跟随 DSH 当前语言。 */
function virtualGroupingLabel(): string {
  return translate('viewMode.virtual')
}

function findViewOptionsMenu(): HTMLElement | null {
  for (const menu of document.querySelectorAll<HTMLElement>('[role="menu"]')) {
    // CSS module 的局部类名经过哈希后仍保留，且与界面语言无关。
    if (menu.className.includes('viewOptionsMenu')) return menu
    // 兜底：包含官方分组方式的菜单就是它。
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

/** 在官方视图选项菜单里添加或刷新「按虚拟分组」这一项。 */
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
    if (label !== undefined) label.textContent = virtualGroupingLabel()
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
  } else {
    // 语言可能已经切换，刷新已存在条目的文案。
    const current = [...ours.querySelectorAll(':scope > span')]
      .find((span) => span.querySelector('svg') === null && (span.textContent ?? '').trim() !== '')
    const text = virtualGroupingLabel()
    if (current !== undefined && current.textContent !== text) current.textContent = text
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
    const selectedClass = meta.selectedExtra.length > 0
      ? `${meta.baseClass} ${meta.selectedExtra.join(' ')}`
      : meta.baseClass
    if (ours.className !== selectedClass) ours.className = selectedClass
    if (meta.check !== null && ours.querySelector(':scope > svg') === null) {
      const holder = document.createElement('template')
      holder.innerHTML = meta.check
      const check = holder.content.firstElementChild
      if (check !== null) ours.append(check)
    }
  } else {
    if (ours.className !== meta.baseClass) ours.className = meta.baseClass
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
  // 选择虚拟分组时顺便把官方模式归一到扁平的「按工作区」列表，否则官方树形
  // 嵌套会和虚拟分区打架。这次点击要屏蔽我们自己挂的官方菜单项监听。
  suppressViewModeClick = true
  byWorkspace.click()
  window.setTimeout(() => {
    suppressViewModeClick = false
    if (menu.isConnected) closeViewOptions()
  }, 0)
}

