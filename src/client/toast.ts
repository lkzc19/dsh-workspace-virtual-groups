/**
 * Transient error notice shown at the bottom of the page. Only one toast is
 * visible at a time; a new message replaces the previous one.
 */
let toastTimer = 0

export function showToast(message: string): void {
  document.querySelectorAll('.wvg-toast').forEach((node) => node.remove())
  const toast = document.createElement('div')
  toast.className = 'wvg-toast'
  toast.textContent = message
  document.body.append(toast)
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => toast.remove(), 3200)
}

/** Remove the toast and its timer, for plugin unmount. */
export function disposeToast(): void {
  window.clearTimeout(toastTimer)
  document.querySelectorAll('.wvg-toast').forEach((node) => node.remove())
}
