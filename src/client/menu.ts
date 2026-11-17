/**
 * 分组标题使用的上下文菜单。
 *
 * 同一时刻只开一个；打开新菜单会先关掉旧的。点击外部或按 Esc 关闭，关闭后
 * 焦点回到触发元素，好让只在悬停时出现的操作按钮保持可见。
 */
import { svgIcon } from './ui.ts'

/** 菜单中的一行：一个动作，或一条分隔线。 */
export type MenuEntry =
  | { separator: true }
  | {
    separator?: false
    label: string
    /** DSH 雪碧图标 id。 */
    icon?: string
    /** 行内 SVG 标记，用于雪碧图标库里没有的字形。 */
    svg?: string
    danger?: boolean
    onSelect(): void
  }

let menu: HTMLElement | null = null
let menuAnchor: HTMLElement | null = null
let menuPointerClose: ((event: PointerEvent) => void) | null = null
let menuKeyClose: ((event: KeyboardEvent) => void) | null = null

function entryButton(entry: Exclude<MenuEntry, { separator: true }>): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = entry.danger ? 'wvg-menu-item wvg-danger' : 'wvg-menu-item'
  button.setAttribute('role', 'menuitem')
  const icon = entry.svg ?? (entry.icon === undefined ? '' : svgIcon(entry.icon, 16))
  button.innerHTML = `<span class="wvg-menu-icon">${icon}</span><span class="wvg-menu-label"></span>`
  const label = button.querySelector<HTMLElement>('.wvg-menu-label')
  if (label !== null) label.textContent = entry.label
  button.addEventListener('click', () => {
    closeMenu()
    entry.onSelect()
  })
  return button
}

function separator(): HTMLElement {
  const element = document.createElement('div')
  element.className = 'wvg-menu-separator'
  element.setAttribute('role', 'separator')
  return element
}

/** 在 (x, y) 处打开菜单，并把关闭后的焦点还给 `anchor`。 */
export function openMenu(anchor: HTMLElement, ariaLabel: string, entries: readonly MenuEntry[], x: number, y: number): void {
  closeMenu()
  const panel = document.createElement('div')
  panel.className = 'wvg-menu'
  panel.setAttribute('role', 'menu')
  panel.setAttribute('aria-label', ariaLabel)
  for (const entry of entries) panel.append(entry.separator === true ? separator() : entryButton(entry))

  menuAnchor = anchor
  anchor.closest<HTMLElement>('.wvg-group')?.classList.add('wvg-menu-open')
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
  panel.querySelector<HTMLButtonElement>('.wvg-menu-item')?.focus()
}

/** 关闭当前菜单（若有），并把焦点还给触发元素。 */
export function closeMenu(): void {
  const openHeaders = [...document.querySelectorAll<HTMLElement>('.wvg-group.wvg-menu-open')]
  if (menuPointerClose !== null) document.removeEventListener('pointerdown', menuPointerClose, true)
  if (menuKeyClose !== null) document.removeEventListener('keydown', menuKeyClose, true)
  menuPointerClose = null
  menuKeyClose = null
  const anchor = menuAnchor
  menuAnchor = null
  menu?.remove()
  menu = null
  // 归还焦点期间要让只在悬停时出现的触发按钮保持可见；焦点落位后由
  // :focus-within 接管，类名移除也不会消失。
  if (anchor?.isConnected) anchor.focus()
  openHeaders.forEach((header) => header.classList.remove('wvg-menu-open'))
}
