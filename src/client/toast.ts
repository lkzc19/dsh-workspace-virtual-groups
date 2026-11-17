/**
 * 页面底部的临时错误提示。同一时刻只显示一个，新消息会替换上一条。
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

/** 移除提示与其计时器，供插件卸载时调用。 */
export function disposeToast(): void {
  window.clearTimeout(toastTimer)
  document.querySelectorAll('.wvg-toast').forEach((node) => node.remove())
}
