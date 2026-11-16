/**
 * Modal dialogs: a shared shell (header, body, actions, close/Escape/backdrop
 * wiring) plus the two dialogs this plugin needs — naming a group and
 * confirming a deletion.
 */
import { svgIcon } from './ui.ts'

let modal: HTMLElement | null = null
let modalKeyHandler: ((event: KeyboardEvent) => void) | null = null

interface DialogParts {
  dialog: HTMLElement
  error: HTMLElement
  ok: HTMLButtonElement
  close(): void
}

/** Build the shared modal shell; callers fill the body and the confirm action. */
function createDialog(title: string, bodyHTML: string, confirmLabel: string, confirmClass: string): DialogParts {
  closeModal()
  const overlay = document.createElement('div')
  overlay.className = 'wvg-overlay'
  overlay.innerHTML = `<div class="wvg-dialog" role="dialog" aria-modal="true" tabindex="-1"><div class="wvg-dialog-content"><div class="wvg-dialog-header"><h2 class="wvg-dialog-title"></h2><button type="button" class="wvg-dialog-close" aria-label="关闭">${svgIcon('dsw-icon-close-outline-regular', 14)}</button></div><div class="wvg-dialog-body">${bodyHTML}<div class="wvg-error" role="alert"></div></div></div><div class="wvg-dialog-actions"><button type="button" class="wvg-button wvg-outline" data-wvg-cancel>取消</button><button type="button" class="wvg-button ${confirmClass}" data-wvg-ok></button></div></div>`
  const dialog = overlay.querySelector<HTMLElement>('.wvg-dialog')!
  dialog.setAttribute('aria-label', title)
  dialog.querySelector<HTMLElement>('.wvg-dialog-title')!.textContent = title
  const ok = dialog.querySelector<HTMLButtonElement>('[data-wvg-ok]')!
  ok.textContent = confirmLabel
  const close = (): void => closeModal()
  dialog.querySelector<HTMLElement>('[data-wvg-cancel]')!.addEventListener('click', close)
  dialog.querySelector<HTMLElement>('.wvg-dialog-close')!.addEventListener('click', close)
  overlay.addEventListener('pointerdown', (event) => {
    if (event.target === overlay) close()
  })
  document.body.append(overlay)
  modal = overlay
  modalKeyHandler = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') close()
  }
  document.addEventListener('keydown', modalKeyHandler)
  return { dialog, error: dialog.querySelector<HTMLElement>('.wvg-error')!, ok, close }
}

/**
 * Ask for a group name. `submit` returns an error message to keep the dialog
 * open, or null when the change was applied.
 */
export function openNameDialog(
  title: string,
  initial: string,
  confirmLabel: string,
  submit: (name: string) => Promise<string | null>,
): void {
  const { dialog, error, ok, close } = createDialog(
    title,
    '<input class="wvg-input" type="text" maxlength="80" aria-label="分组名称" />',
    confirmLabel,
    'wvg-primary',
  )
  const input = dialog.querySelector<HTMLInputElement>('.wvg-input')!
  input.value = initial
  let busy = false
  const initialTrimmed = initial.trim()
  const syncOk = (): void => {
    if (busy) return
    const value = input.value.trim()
    ok.disabled = value === '' || (initialTrimmed !== '' && value === initialTrimmed)
  }
  syncOk()
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
  input.addEventListener('input', syncOk)
  ok.addEventListener('click', () => { void confirm() })
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault()
      void confirm()
    }
  })
  window.requestAnimationFrame(() => {
    input.focus()
    input.select()
  })
}

/** Ask for confirmation before a destructive action. */
export function openConfirmDialog(title: string, message: string, confirm: () => Promise<void>): void {
  const { dialog, error, ok, close } = createDialog(
    title,
    '<div class="wvg-dialog-message"></div>',
    '删除',
    'wvg-danger',
  )
  dialog.querySelector<HTMLElement>('.wvg-dialog-message')!.textContent = message
  let busy = false
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
  ok.addEventListener('click', () => { void run() })
  window.requestAnimationFrame(() => {
    dialog.querySelector<HTMLButtonElement>('[data-wvg-cancel]')?.focus()
  })
}

/** Close the open dialog, if any. */
export function closeModal(): void {
  if (modalKeyHandler !== null) document.removeEventListener('keydown', modalKeyHandler)
  modalKeyHandler = null
  modal?.remove()
  modal = null
}
