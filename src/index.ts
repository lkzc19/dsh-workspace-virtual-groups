/**
 * dsh-workspace-virtual-groups host half: serves and persists the manual
 * grouping overlay.
 *
 * Routes:
 * - `GET /workspace-virtual-groups/manual` — current manual overlay (groups +
 *   assignments + ordering + mode), read directly from the plugin sidecar.
 * - `PUT /workspace-virtual-groups/manual` — replace the whole overlay,
 *   validated and written atomically to the plugin-owned JSON sidecar.
 *
 * Core workspace.json / session storage is never touched.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { GroupsContext } from './context-types.ts'
import {
  defaultManualPath,
  parseManualGroups,
  readManualGroups,
  validateManualGroups,
  writeManualGroups,
} from './host-manual.ts'

/** Plugin identity for cordis.yml rows. */
export const name = 'dsh-workspace-virtual-groups'

/** Services required before mounting: the webserver route. */
export const inject = ['webServer']

/** Cap on the PUT body: the overlay is tiny; anything bigger is a client bug. */
const MAX_MANUAL_BODY_BYTES = 64 * 1024

/** Error with an HTTP status, mapped to a plain-text 4xx/5xx response. */
class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

/** Write a plain-text error response with the given status. */
function writeError(res: ServerResponse, status: number, message: string): void {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end(message)
}

/** Collect the request body as UTF-8 text, rejecting oversized bodies. */
async function readBody(req: IncomingMessage, limit: number): Promise<string> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > limit) throw new HttpError(413, 'request body too large')
    chunks.push(buffer)
  }
  if (chunks.length === 0) throw new HttpError(400, 'empty request body')
  return Buffer.concat(chunks).toString('utf8')
}

/** Plugin body: mount the manual-overlay read/write route. */
export function apply(ctx: GroupsContext): void {
  const manualPath = defaultManualPath()

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/workspace-virtual-groups/manual',
    handler: async (req, res) => {
      if (req.method === 'GET' || req.method === 'HEAD') {
        let manual
        try {
          manual = await readManualGroups(manualPath)
        } catch (error) {
          writeError(res, 500, `workspace-virtual-groups: failed to read manual overlay: ${error instanceof Error ? error.message : String(error)}`)
          return
        }
        const body = JSON.stringify(manual)
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Content-Length': Buffer.byteLength(body),
        })
        res.end(req.method === 'HEAD' ? undefined : body)
        return
      }

      if (req.method !== 'PUT') {
        writeError(res, 405, 'method not allowed')
        return
      }

      let raw: unknown
      try {
        raw = JSON.parse(await readBody(req, MAX_MANUAL_BODY_BYTES))
      } catch (error) {
        const status = error instanceof HttpError ? error.status : 400
        writeError(res, status, `workspace-virtual-groups: ${error instanceof Error ? error.message : String(error)}`)
        return
      }

      let manual
      try {
        manual = parseManualGroups(raw)
        validateManualGroups(manual)
      } catch (error) {
        writeError(res, 400, `workspace-virtual-groups: ${error instanceof Error ? error.message : String(error)}`)
        return
      }

      try {
        await writeManualGroups(manualPath, manual)
      } catch (error) {
        writeError(res, 500, `workspace-virtual-groups: failed to write manual overlay: ${error instanceof Error ? error.message : String(error)}`)
        return
      }

      const body = JSON.stringify({ ok: true })
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Length': Buffer.byteLength(body),
      })
      res.end(body)
    },
  }), 'dsh-workspace-virtual-groups: /workspace-virtual-groups/manual route')

  // Deprecated compatibility alias for clients from before the manual-only
  // model. It exposes no rule categories, so the removed auto-classifier is
  // never resurrected.
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/workspace-virtual-groups/config',
    handler: async (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        writeError(res, 405, 'method not allowed')
        return
      }
      let manual
      try {
        manual = await readManualGroups(manualPath)
      } catch (error) {
        writeError(res, 500, `workspace-virtual-groups: failed to read manual overlay: ${error instanceof Error ? error.message : String(error)}`)
        return
      }
      const body = JSON.stringify({ categories: [], manual })
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Content-Length': Buffer.byteLength(body),
      })
      res.end(req.method === 'HEAD' ? undefined : body)
    },
  }), 'dsh-workspace-virtual-groups: legacy /workspace-virtual-groups/config route')
}
