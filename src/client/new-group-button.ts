/**
 * The layer-icon "new group" button beside the official add-workspace button.
 *
 * The official header-actions container is sized for two 28px buttons and
 * clips overflow, so a third button needs the container widened — and the
 * original sizing put back when the button goes away.
 */
import { LAYER_ICON } from './ui.ts'

export interface NewGroupButtonHost {
  /** Virtual grouping active? The button only exists in that mode. */
  isVirtual(): boolean
  /** Open the create-group dialog. */
  onCreate(): void
}

/** Official header-actions sizing before this layer widened it. */
const originalSizing = new WeakMap<HTMLElement, { width: string; minWidth: string; overflow: string }>()
/** Containers this layer widened, so an unmount can restore all of them. */
const widened = new Set<HTMLElement>()

/** The official add-workspace button, located by its sprite icon. */
export function officialAddButton(): HTMLButtonElement | null {
  const use = document.querySelector<SVGUseElement>('use[href="#dsw-icon-project-add-outline-regular"]')
  const button = use?.closest('button')
  return button instanceof HTMLButtonElement ? button : null
}

function restoreSizing(actions: HTMLElement | null): void {
  if (actions === null) return
  const original = originalSizing.get(actions)
  if (original === undefined) return
  actions.style.width = original.width
  actions.style.minWidth = original.minWidth
  actions.style.overflow = original.overflow
  originalSizing.delete(actions)
  widened.delete(actions)
}

/** Remove every injected button and restore the containers it widened. */
export function removeNewGroupButtons(): void {
  document.querySelectorAll<HTMLElement>('[data-wvg-new-group]').forEach((node) => {
    const actions = node.parentElement
    node.remove()
    restoreSizing(actions)
  })
  for (const actions of [...widened]) restoreSizing(actions)
}

/** Keep exactly one layer-icon button in place, or none outside virtual mode. */
export function ensureNewGroupButton(host: NewGroupButtonHost): void {
  if (!host.isVirtual()) {
    removeNewGroupButtons()
    return
  }
  const add = officialAddButton()
  if (add === null) {
    removeNewGroupButtons()
    return
  }
  let button = document.querySelector<HTMLButtonElement>('button[data-wvg-new-group]')
  if (button === null || !button.isConnected) {
    button = add.cloneNode(true) as HTMLButtonElement
    button.dataset.wvgNewGroup = '1'
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
    host.onCreate()
  }
  const actions = button.parentElement
  if (actions === null) return
  if (!originalSizing.has(actions)) {
    originalSizing.set(actions, {
      width: actions.style.width,
      minWidth: actions.style.minWidth,
      overflow: actions.style.overflow,
    })
    widened.add(actions)
  }
  actions.style.width = 'max-content'
  actions.style.minWidth = 'max-content'
  actions.style.overflow = 'visible'
}
