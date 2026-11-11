/**
 * Build the browser half as DSH's lazy-CJS module-loader artifact.
 *
 * The official client packages are built by tsdown; this repo keeps a tiny
 * esbuild pipeline so a checkout without the monorepo toolchain can rebuild
 * lib/client.js. Externals are exactly the shell's frozen platform-module
 * table rows this plugin consumes; every other local module is inlined.
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

/** Resolve `./styles.css?inline` to a JS module exporting the CSS text. */
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
  jsx: 'automatic',
  external: CLIENT_EXTERNALS,
  plugins: [inlineCss],
  banner: {
    js: 'window.__ModuleLoader__.load({ id: "dsh-workspace-virtual-groups", factory: (require) => { var module = { exports: {} }; var exports = module.exports;',
  },
  footer: {
    js: 'return module.exports; } });',
  },
  logLevel: 'info',
})
