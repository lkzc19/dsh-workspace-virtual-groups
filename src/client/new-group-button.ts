/**
 * 官方「添加工作区」按钮旁边的层叠图标按钮，用来新建分组。
 *
 * 官方的 header-actions 容器按两个 28px 按钮定宽并裁剪溢出，加第三个按钮就得
 * 把容器撑开——按钮消失时再把原始尺寸还原。
 */
import { LAYER_ICON, setStyle } from './ui.ts'

export interface NewGroupButtonHost {
  /** 是否处于虚拟分组模式？按钮只在这种模式下存在。 */
  isVirtual(): boolean
  /** 打开新建分组对话框。 */
  onCreate(): void
}

/** 本层撑开容器之前的官方 header-actions 尺寸。 */
const originalSizing = new WeakMap<HTMLElement, { width: string; minWidth: string; overflow: string }>()
/** 本层撑开过的容器，卸载时据此全部还原。 */
const widened = new Set<HTMLElement>()

/** 官方「添加工作区」按钮，通过它的雪碧图标定位。 */
export function officialAddButton(): HTMLButtonElement | null {
  const use = document.querySelector<SVGUseElement>('use[href="#dsw-icon-project-add-outline-regular"]')
  const button = use?.closest('button')
  return button instanceof HTMLButtonElement ? button : null
}

function restoreSizing(actions: HTMLElement | null): void {
  if (actions === null) return
  const original = originalSizing.get(actions)
  if (original === undefined) return
  setStyle(actions, 'width', original.width)
  setStyle(actions, 'min-width', original.minWidth)
  setStyle(actions, 'overflow', original.overflow)
  originalSizing.delete(actions)
  widened.delete(actions)
}

/** 移除所有注入的按钮，并还原被撑开的容器。 */
export function removeNewGroupButtons(): void {
  document.querySelectorAll<HTMLElement>('[data-wvg-new-group]').forEach((node) => {
    const actions = node.parentElement
    node.remove()
    restoreSizing(actions)
  })
  for (const actions of [...widened]) restoreSizing(actions)
}

/** 保证恰好存在一个层叠图标按钮；非虚拟模式下不保留。 */
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
  if (button.getAttribute('aria-label') !== '新建分组') button.setAttribute('aria-label', '新建分组')
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
  setStyle(actions, 'width', 'max-content')
  setStyle(actions, 'min-width', 'max-content')
  setStyle(actions, 'overflow', 'visible')
}
