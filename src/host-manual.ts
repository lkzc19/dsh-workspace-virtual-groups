/**
 * Runtime grouping overlay for dsh-workspace-virtual-groups: manual groups
 * created in the sidebar UI and per-workspace assignments. Stored in a
 * plugin-owned JSON sidecar (`$DSH_HOME/workspace-virtual-groups.manual.json`),
 * and writes are atomic (temp file + fsync + rename).
 *
 * The browser PUT route writes the whole overlay (idempotent, last write
 * wins); reads tolerate hand-edited content while the write boundary checks
 * that assignments and ordering reference existing manual groups.
 */
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { homedir } from 'node:os'
import { DEFAULT_GROUP, LEGACY_DEFAULT_GROUP, TOP_LEVEL_ORDER_KEY, UNCATEGORIZED_LABEL, type ManualGroups } from './core/types.ts'

/** Default overlay location: `$DSH_HOME/workspace-virtual-groups.manual.json`. */
export function defaultManualPath(): string {
  const home = process.env.DSH_HOME !== undefined && process.env.DSH_HOME !== ''
    ? process.env.DSH_HOME
    : resolve(homedir(), '.dsh')
  return resolve(home, 'workspace-virtual-groups.manual.json')
}

/**
 * Parse + shape-validate a raw overlay document into a ManualGroups.
 * Validates types only — category references are checked at the write boundary
 * (validateManualGroups), because reads must tolerate hand-edited files or
 * files written by an older plugin version.
 * @param raw - parsed JSON value.
 * @returns the normalized overlay.
 * @throws when the shape is malformed (non-mapping, bad names, duplicates,
 * the reserved uncategorized label, bad assignment/order values).
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
      // Older overlays occasionally stored the built-in default group as a
      // normal category. Fold it away instead of failing the whole read.
      if (name === DEFAULT_GROUP || name === LEGACY_DEFAULT_GROUP) continue
      if (name === UNCATEGORIZED_LABEL) {
        throw new Error(`workspace-virtual-groups.manual.json: manual category name "${name}" is reserved`)
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
      const name = category.trim()
      assignments[workspaceId] = name === DEFAULT_GROUP || name === LEGACY_DEFAULT_GROUP || name === UNCATEGORIZED_LABEL
        ? null
        : name
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
    manual.categoryOrder = parseStringList(source.categoryOrder, 'categoryOrder', true)
  }
  if (source.workspaceOrder !== undefined) {
    if (typeof source.workspaceOrder !== 'object' || source.workspaceOrder === null || Array.isArray(source.workspaceOrder)) {
      throw new Error('workspace-virtual-groups.manual.json: workspaceOrder must be a mapping')
    }
    const workspaceOrder: Record<string, string[]> = {}
    for (const [categoryKey, ids] of Object.entries(source.workspaceOrder)) {
      if (categoryKey.trim() === '') {
        throw new Error('workspace-virtual-groups.manual.json: workspaceOrder keys must be non-empty')
      }
      workspaceOrder[categoryKey] = parseStringList(ids, `workspaceOrder["${categoryKey}"]`, true)
    }
    manual.workspaceOrder = workspaceOrder
  }

  return manual
}

/** Parse a list of non-empty strings, optionally de-duplicated. */
function parseStringList(value: unknown, field: string, unique: boolean): string[] {
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
    if (unique && seen.has(trimmed)) {
      throw new Error(`workspace-virtual-groups.manual.json: ${field} has duplicate entry "${trimmed}"`)
    }
    seen.add(trimmed)
    result.push(trimmed)
  }
  return result
}

/**
 * Validate that assignments and ordering reference existing manual groups
 * (write boundary only). Legacy default labels are already folded to null by
 * `parseManualGroups`.
 * @param manual - parsed overlay.
 * @throws when the overlay references groups that do not exist.
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
  for (const key of Object.keys(manual.workspaceOrder ?? {})) {
    if (key === TOP_LEVEL_ORDER_KEY) continue
    if (!groups.has(key)) {
      throw new Error(`workspace-virtual-groups.manual.json: workspaceOrder references unknown group "${key}"`)
    }
  }
}

/** Read + parse the overlay file. A missing file yields an empty overlay. */
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
 * Atomically replace the overlay file: write a same-directory temp file,
 * fsync it, then rename over the target. A crash never leaves a torn JSON at
 * the real path (readers see either the old or the new file).
 * @param path - target file path.
 * @param manual - overlay to persist.
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
