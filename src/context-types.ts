/**
 * 本插件用到的 cordis 服务的结构化类型。第三方插件解析不到 DSH 单体仓库里唯一
 * 的 cordis 实例，因此上游的 `declare module` 扩展到不了这个 Context——下面
 * 的成员按本插件实际触碰到的运行时形状手写：
 * - webServer：@deepseek-ai/dsh-host-webserver（WebServer）
 * - effect：DSH 随包提供的 cordis 生命周期助手
 * 与上游的偏差都收敛在这个文件里。
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'

/** 一条具名 webserver 路由（对应 host-webserver 的 WebRoute）。 */
export interface GroupsWebRoute {
  kind: 'exact' | 'prefix'
  path: string
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
}

/** 本插件用到的 webServer 服务面。 */
export interface GroupsWebServer {
  register(route: GroupsWebRoute): () => void
}

/** 补上本插件所需服务的 cordis Context。 */
export interface GroupsContext extends Context {
  webServer: GroupsWebServer
}
