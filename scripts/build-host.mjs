/**
 * Build the host half as a self-contained ESM module. js-yaml is inlined so the
 * installed plugin has no runtime node_modules requirements beyond Node itself
 * and the DSH web server service.
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { build } = require(process.env.ESBUILD_PATH ?? 'esbuild')

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'es2022',
  legalComments: 'none',
  logLevel: 'info',
})
