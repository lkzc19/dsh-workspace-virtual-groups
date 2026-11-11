/**
 * Build the host half as a self-contained ESM module. js-yaml is inlined so the
 * installed plugin has no runtime node_modules requirements beyond Node itself
 * and the DSH web server service.
 */
import { readFile, writeFile } from 'node:fs/promises'
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
  legalComments: 'eof',
  logLevel: 'info',
})

// esbuild labels each bundled module with its path. Remove dependency paths so
// the committed bundle is reproducible and does not leak the build machine.
const outputPath = resolve(ROOT, OUTFILE)
const code = await readFile(outputPath, 'utf8')
const cleaned = code.replace(/^\/\/ .*node_modules.*\n/gm, '')
if (cleaned !== code) await writeFile(outputPath, cleaned)
