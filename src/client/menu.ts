/**
 * Context menu used by group headers.
 *
 * One menu is open at a time; opening a new one closes the previous. Clicks
 * outside and Escape close it, and focus returns to the trigger so the
 * hover-only action button stays visible.
 */
import { svgIcon } from './ui.ts'

/** One row of a menu: an action, or a separator line. */
export type MenuEntry =
  | { separator: true }
  | {
    separator?: false
    label: string
    /** DSH sprite icon id. */
    icon?: string
    /** Inline SVG markup, for glyphs the sprite does not have. */
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

/** Open a menu anchored at `anchor`, positioned at (x, y). */
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

/** Close the open menu, if any, and restore focus to its trigger. */
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
  // Keep the hover-only trigger visible while returning focus to it; once focus
  // lands, :focus-within keeps it visible after the class is removed.
  if (anchor?.isConnected) anchor.focus()
  openHeaders.forEach((header) => header.classList.remove('wvg-menu-open'))
}
