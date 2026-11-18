/**
 * 把宿主侧打成自包含的 ESM 模块：运行时除 Node 本身和 DSH 的 webserver 服务外，
 * 不依赖任何 node_modules。
 */
import { resolve } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { build } = require(process.env.ESBUILD_PATH ?? 'esbuild')

const ROOT = resolve(import.meta.dirname, '..')
const OUTFILE = 'lib/index.js'

await build({
  absWorkingDir: ROOT,
  entryPoints: ['src/index.ts'],
  outfile: OUTFILE,
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'es2022',
  legalComments: 'none',
  charset: 'utf8',
  logLevel: 'info',
})
