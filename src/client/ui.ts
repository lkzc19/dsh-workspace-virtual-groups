/**
 * 图层各模块共用的小型 DOM 工具：雪碧图标与层叠字形。单独成文件，让菜单、
 * 对话框和列表层用同一种方式拼标记。
 */

/** 引用 DSH 雪碧图标库里某个图标的行内 SVG。 */
export function svgIcon(id: string, size: number): string {
  return `<svg width="${size}" height="${size}" aria-hidden="true"><use href="#${id}"></use></svg>`
}

/** 层叠字形：新建分组按钮与菜单里的「添加分组」共用。 */
export const LAYER_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round" data-wvg-layer="1" aria-hidden="true"><path d="M8 1.8 14 5 8 8.2 2 5 8 1.8Z"></path><path d="M2 8 8 11.2 14 8"></path><path d="M2 11 8 14.2 14 11"></path></svg>'
