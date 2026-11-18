/**
 * 把浏览器侧打成 DSH 的 lazy-CJS 模块加载产物。
 *
 * 官方客户端包用 tsdown 构建；本仓库保留一条极小的 esbuild 流水线，让没有
 * 单体仓库工具链的检出也能重新生成 lib/client.js。external 恰好是外壳冻结的
 * 平台模块表里本插件用到的那几行；其余本地模块一律内联。
 */
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { build } = require(process.env.ESBUILD_PATH ?? 'esbuild')

const ROOT = resolve(import.meta.dirname, '..')
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-store',
]

/** 把 `./styles.css?inline` 解析成导出 CSS 文本的 JS 模块。 */
const inlineCss = {
  name: 'inline-css',
  setup(build) {
    build.onResolve({ filter: /\.css\?inline$/ }, (args) => {
      const source = args.path.slice(0, -'?inline'.length)
      return { path: resolve(dirname(args.importer), source), namespace: 'inline-css' }
    })
    build.onLoad({ filter: /.*/, namespace: 'inline-css' }, async (args) => {
      const css = await readFile(args.path, 'utf8')
      return { contents: `export default ${JSON.stringify(css)};`, loader: 'js' }
    })
  },
}

await build({
  absWorkingDir: ROOT,
  entryPoints: ['src/client/index.ts'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  sourcemap: true,
  legalComments: 'none',
  charset: 'utf8',
  jsx: 'automatic',
  external: CLIENT_EXTERNALS,
  plugins: [inlineCss],
  banner: {
    js: 'window.__ModuleLoader__.load({ id: "@lkzc19/dsh-workspace-virtual-groups", factory: (require) => { var module = { exports: {} }; var exports = module.exports;',
  },
  footer: {
    js: 'return module.exports; } });',
  },
  logLevel: 'info',
})
