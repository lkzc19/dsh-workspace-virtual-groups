/**
 * dsh-workspace-virtual-groups 的运行时分组叠加层：侧边栏创建的分组和每个
 * 工作区的归属。存放在插件自己的 JSON sidecar
 * （`$DSH_HOME/workspace-virtual-groups.manual.json`），写入是原子的
 * （临时文件 + fsync + rename）。
 *
 * 浏览器通过 PUT 整体写回（幂等，后写覆盖先写）；读取容忍未知字段，
 * 写入边界才校验归属和排序引用的分组是否存在。
 */
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { homedir } from 'node:os'
import { DEFAULT_GROUP, type ManualGroups } from './core/types.ts'

/** 叠加层的默认位置：`$DSH_HOME/workspace-virtual-groups.manual.json`。 */
export function defaultManualPath(): string {
  const home = process.env.DSH_HOME !== undefined && process.env.DSH_HOME !== ''
    ? process.env.DSH_HOME
    : resolve(homedir(), '.dsh')
  return resolve(home, 'workspace-virtual-groups.manual.json')
}

/**
 * 把原始叠加层文档解析并校验成 ManualGroups。
 * 这里只校验类型；分组引用在写入边界（validateManualGroups）才检查，因为读取
 * 必须容忍手工改过的文件。
 * @param raw - 已解析的 JSON 值。
 * @returns 规整后的叠加层。
 * @throws 形状不合法时抛出（顶层不是映射、分组名非法或重复、使用内置分组名、
 * 归属值非法）。
 */
export function parseManualGroups(raw: unknown): ManualGroups {
  if (raw === undefined || raw === null) return { categories: [], assignments: {} }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('workspace-virtual-groups.manual.json: top-level value must be a mapping')
  }
  const source = raw as Record<string, unknown>

  const categories: string[] = []
  if (source.categories !== undefined) {
    if (!Array.isArray(source.categories)) {
      throw new Error('workspace-virtual-groups.manual.json: categories must be a list')
    }
    const seen = new Set<string>()
    for (const entry of source.categories) {
      if (typeof entry !== 'string' || entry.trim() === '') {
        throw new Error('workspace-virtual-groups.manual.json: each manual category must be a non-empty string')
      }
      const name = entry.trim()
      if (name === DEFAULT_GROUP) {
        throw new Error(`workspace-virtual-groups.manual.json: the built-in group "${name}" is reserved`)
      }
      if (seen.has(name)) {
        throw new Error(`workspace-virtual-groups.manual.json: duplicate manual category "${name}"`)
      }
      seen.add(name)
      categories.push(name)
    }
  }

  const assignments: Record<string, string | null> = {}
  if (source.assignments !== undefined) {
    if (typeof source.assignments !== 'object' || source.assignments === null || Array.isArray(source.assignments)) {
      throw new Error('workspace-virtual-groups.manual.json: assignments must be a mapping')
    }
    for (const [workspaceId, category] of Object.entries(source.assignments)) {
      if (workspaceId.trim() === '') {
        throw new Error('workspace-virtual-groups.manual.json: assignment keys must be non-empty')
      }
      if (category === null) {
        assignments[workspaceId] = null
        continue
      }
      if (typeof category !== 'string' || category.trim() === '') {
        throw new Error(`workspace-virtual-groups.manual.json: assignment "${workspaceId}" must be a category name or null`)
      }
      assignments[workspaceId] = category.trim()
    }
  }

  const manual: ManualGroups = { categories, assignments }
  if (source.mode !== undefined) {
    if (source.mode !== 'virtual' && source.mode !== 'official') {
      throw new Error('workspace-virtual-groups.manual.json: mode must be "virtual" or "official"')
    }
    manual.mode = source.mode
  }
  if (source.categoryOrder !== undefined) {
    manual.categoryOrder = parseStringList(source.categoryOrder, 'categoryOrder')
  }
  if (source.parents !== undefined) {
    if (typeof source.parents !== 'object' || source.parents === null || Array.isArray(source.parents)) {
      throw new Error('workspace-virtual-groups.manual.json: parents must be a mapping')
    }
    const parents: Record<string, string> = {}
    for (const [child, parent] of Object.entries(source.parents)) {
      if (typeof child !== 'string' || child.trim() === '') {
        throw new Error('workspace-virtual-groups.manual.json: parent keys must be non-empty')
      }
      if (typeof parent !== 'string' || parent.trim() === '') {
        throw new Error(`workspace-virtual-groups.manual.json: parent of "${child}" must be a group name`)
      }
      const childName = child.trim()
      const parentName = parent.trim()
      if (childName === DEFAULT_GROUP) {
        throw new Error(`workspace-virtual-groups.manual.json: the built-in group "${childName}" cannot be nested`)
      }
      parents[childName] = parentName
    }
    manual.parents = parents
  }

  return manual
}

/** 解析一组去重且非空的字符串。 */
function parseStringList(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`workspace-virtual-groups.manual.json: ${field} must be a list`)
  }
  const seen = new Set<string>()
  const result: string[] = []
  for (const entry of value) {
    if (typeof entry !== 'string' || entry.trim() === '') {
      throw new Error(`workspace-virtual-groups.manual.json: ${field} entries must be non-empty strings`)
    }
    const trimmed = entry.trim()
    if (seen.has(trimmed)) {
      throw new Error(`workspace-virtual-groups.manual.json: ${field} has duplicate entry "${trimmed}"`)
    }
    seen.add(trimmed)
    result.push(trimmed)
  }
  return result
}

/**
 * 校验归属、排序与父级引用都指向已存在的分组（仅写入边界）。
 * @param manual - 已解析的叠加层。
 * @throws 引用了不存在的分组时抛出。
 */
export function validateManualGroups(manual: ManualGroups): void {
  const groups = new Set(manual.categories)
  for (const [workspaceId, category] of Object.entries(manual.assignments)) {
    if (category === null) continue
    if (!groups.has(category)) {
      throw new Error(`workspace-virtual-groups.manual.json: assignment "${workspaceId}" references unknown group "${category}"`)
    }
  }
  for (const key of manual.categoryOrder ?? []) {
    if (!groups.has(key)) {
      throw new Error(`workspace-virtual-groups.manual.json: categoryOrder references unknown group "${key}"`)
    }
  }
  const parents = manual.parents ?? {}
  for (const [child, parent] of Object.entries(parents)) {
    if (!groups.has(child)) {
      throw new Error(`workspace-virtual-groups.manual.json: parents reference unknown group "${child}"`)
    }
    if (parent !== DEFAULT_GROUP && !groups.has(parent)) {
      throw new Error(`workspace-virtual-groups.manual.json: parent "${parent}" of "${child}" is not a group`)
    }
  }
  // 嵌套分组构成森林；一旦成环，任何遍历都无法终止，因此在写入时直接拒绝，
  // 浏览器侧就不必再防。
  for (const child of Object.keys(parents)) {
    const seen = new Set<string>([child])
    let cursor = parents[child]
    while (cursor !== undefined) {
      if (seen.has(cursor)) {
        throw new Error(`workspace-virtual-groups.manual.json: parents contain a cycle through "${child}"`)
      }
      seen.add(cursor)
      cursor = parents[cursor]
    }
  }
}

/** 读取并解析叠加层文件；文件不存在时返回空的叠加层。 */
export async function readManualGroups(path: string): Promise<ManualGroups> {
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { categories: [], assignments: {} }
    throw error
  }
  return parseManualGroups(JSON.parse(text))
}

/**
 * 原子地替换叠加层文件：先写同目录的临时文件、fsync，再 rename 覆盖目标。
 * 即使进程崩溃，真实路径上也不会出现半截 JSON（读取方只会看到旧文件或新文件）。
 * @param path - 目标文件路径。
 * @param manual - 要持久化的叠加层。
 */
export async function writeManualGroups(path: string, manual: ManualGroups): Promise<void> {
  const json = `${JSON.stringify(manual, null, 2)}\n`
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
  const handle = await open(tmp, 'w')
  try {
    await handle.writeFile(json, 'utf8')
    await handle.sync()
  } catch (error) {
    await handle.close().catch(() => {})
    await unlink(tmp).catch(() => {})
    throw error
  }
  await handle.close()
  try {
    await rename(tmp, path)
  } catch (error) {
    await unlink(tmp).catch(() => {})
    throw error
  }
}
