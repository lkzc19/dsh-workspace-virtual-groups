/**
 * dsh-workspace-virtual-groups 的宿主侧：提供并持久化手动分组叠加层。
 *
 * 路由：
 * - `GET /workspace-virtual-groups/manual` — 当前叠加层（分组、归属、排序、
 *   模式），直接从插件的 sidecar 读取。
 * - `PUT /workspace-virtual-groups/manual` — 整体替换叠加层，校验后原子写入
 *   插件自己的 JSON sidecar。
 *
 * 不触碰官方的 workspace.json 与会话存储。
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

/** 插件在 cordis.yml 行里的标识。 */
export const name = '@lkzc19/dsh-workspace-virtual-groups'

/** 挂载前必须就绪的服务：webserver 路由。 */
export const inject = ['webServer']

/** PUT 体积上限：叠加层很小，超出只能是客户端的问题。 */
const MAX_MANUAL_BODY_BYTES = 64 * 1024

/** 带 HTTP 状态码的错误，最终映射为纯文本 4xx/5xx 响应。 */
class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

/** 按给定状态码写出纯文本错误响应。 */
function writeError(res: ServerResponse, status: number, message: string): void {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end(message)
}

/** 读取请求体为 UTF-8 文本，超过上限则拒绝。 */
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

/** 插件主体：挂载叠加层的读写路由。 */
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
}
