/**
 * Small DOM helpers shared by the layer's modules: sprite icons and the layer
 * glyph, kept apart so menus, dialogs and the list layer all build markup the
 * same way.
 */

/** Inline sprite reference for one DSH icon id. */
export function svgIcon(id: string, size: number): string {
  return `<svg width="${size}" height="${size}" aria-hidden="true"><use href="#${id}"></use></svg>`
}

/** Layer glyph: the new-group button and the "add group" menu row. */
export const LAYER_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round" data-wvg-layer="1" aria-hidden="true"><path d="M8 1.8 14 5 8 8.2 2 5 8 1.8Z"></path><path d="M2 8 8 11.2 14 8"></path><path d="M2 11 8 14.2 14 11"></path></svg>'
