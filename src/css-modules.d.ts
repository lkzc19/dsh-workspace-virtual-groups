/** `*.css?inline` 虚拟模块的类型声明（编译后的 CSS 文本）。 */
declare module '*.css?inline' {
  const css: string
  export default css
}
