// src/host-manual.ts
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";

// src/core/types.ts
var DEFAULT_GROUP = "\u9ED8\u8BA4";

// src/host-manual.ts
function defaultManualPath() {
  const home = process.env.DSH_HOME !== void 0 && process.env.DSH_HOME !== "" ? process.env.DSH_HOME : resolve(homedir(), ".dsh");
  return resolve(home, "workspace-virtual-groups.manual.json");
}
function parseManualGroups(raw) {
  if (raw === void 0 || raw === null) return { categories: [], assignments: {} };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("workspace-virtual-groups.manual.json: top-level value must be a mapping");
  }
  const source = raw;
  const categories = [];
  if (source.categories !== void 0) {
    if (!Array.isArray(source.categories)) {
      throw new Error("workspace-virtual-groups.manual.json: categories must be a list");
    }
    const seen = /* @__PURE__ */ new Set();
    for (const entry of source.categories) {
      if (typeof entry !== "string" || entry.trim() === "") {
        throw new Error("workspace-virtual-groups.manual.json: each manual category must be a non-empty string");
      }
      const name2 = entry.trim();
      if (name2 === DEFAULT_GROUP) {
        throw new Error(`workspace-virtual-groups.manual.json: the built-in group "${name2}" is reserved`);
      }
      if (seen.has(name2)) {
        throw new Error(`workspace-virtual-groups.manual.json: duplicate manual category "${name2}"`);
      }
      seen.add(name2);
      categories.push(name2);
    }
  }
  const assignments = {};
  if (source.assignments !== void 0) {
    if (typeof source.assignments !== "object" || source.assignments === null || Array.isArray(source.assignments)) {
      throw new Error("workspace-virtual-groups.manual.json: assignments must be a mapping");
    }
    for (const [workspaceId, category] of Object.entries(source.assignments)) {
      if (workspaceId.trim() === "") {
        throw new Error("workspace-virtual-groups.manual.json: assignment keys must be non-empty");
      }
      if (category === null) {
        assignments[workspaceId] = null;
        continue;
      }
      if (typeof category !== "string" || category.trim() === "") {
        throw new Error(`workspace-virtual-groups.manual.json: assignment "${workspaceId}" must be a category name or null`);
      }
      assignments[workspaceId] = category.trim();
    }
  }
  const manual = { categories, assignments };
  if (source.mode !== void 0) {
    if (source.mode !== "virtual" && source.mode !== "official") {
      throw new Error('workspace-virtual-groups.manual.json: mode must be "virtual" or "official"');
    }
    manual.mode = source.mode;
  }
  if (source.categoryOrder !== void 0) {
    manual.categoryOrder = parseStringList(source.categoryOrder, "categoryOrder");
  }
  return manual;
}
function parseStringList(value, field) {
  if (!Array.isArray(value)) {
    throw new Error(`workspace-virtual-groups.manual.json: ${field} must be a list`);
  }
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const entry of value) {
    if (typeof entry !== "string" || entry.trim() === "") {
      throw new Error(`workspace-virtual-groups.manual.json: ${field} entries must be non-empty strings`);
    }
    const trimmed = entry.trim();
    if (seen.has(trimmed)) {
      throw new Error(`workspace-virtual-groups.manual.json: ${field} has duplicate entry "${trimmed}"`);
    }
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}
function validateManualGroups(manual) {
  const groups = new Set(manual.categories);
  for (const [workspaceId, category] of Object.entries(manual.assignments)) {
    if (category === null) continue;
    if (!groups.has(category)) {
      throw new Error(`workspace-virtual-groups.manual.json: assignment "${workspaceId}" references unknown group "${category}"`);
    }
  }
  for (const key of manual.categoryOrder ?? []) {
    if (!groups.has(key)) {
      throw new Error(`workspace-virtual-groups.manual.json: categoryOrder references unknown group "${key}"`);
    }
  }
}
async function readManualGroups(path) {
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return { categories: [], assignments: {} };
    throw error;
  }
  return parseManualGroups(JSON.parse(text));
}
async function writeManualGroups(path, manual) {
  const json = `${JSON.stringify(manual, null, 2)}
`;
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  const handle = await open(tmp, "w");
  try {
    await handle.writeFile(json, "utf8");
    await handle.sync();
  } catch (error) {
    await handle.close().catch(() => {
    });
    await unlink(tmp).catch(() => {
    });
    throw error;
  }
  await handle.close();
  try {
    await rename(tmp, path);
  } catch (error) {
    await unlink(tmp).catch(() => {
    });
    throw error;
  }
}

// src/index.ts
var name = "dsh-workspace-virtual-groups";
var inject = ["webServer"];
var MAX_MANUAL_BODY_BYTES = 64 * 1024;
var HttpError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
function writeError(res, status, message) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(message);
}
async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) throw new HttpError(413, "request body too large");
    chunks.push(buffer);
  }
  if (chunks.length === 0) throw new HttpError(400, "empty request body");
  return Buffer.concat(chunks).toString("utf8");
}
function apply(ctx) {
  const manualPath = defaultManualPath();
  ctx.effect(() => ctx.webServer.register({
    kind: "exact",
    path: "/workspace-virtual-groups/manual",
    handler: async (req, res) => {
      if (req.method === "GET" || req.method === "HEAD") {
        let manual2;
        try {
          manual2 = await readManualGroups(manualPath);
        } catch (error) {
          writeError(res, 500, `workspace-virtual-groups: failed to read manual overlay: ${error instanceof Error ? error.message : String(error)}`);
          return;
        }
        const body2 = JSON.stringify(manual2);
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-cache",
          "Content-Length": Buffer.byteLength(body2)
        });
        res.end(req.method === "HEAD" ? void 0 : body2);
        return;
      }
      if (req.method !== "PUT") {
        writeError(res, 405, "method not allowed");
        return;
      }
      let raw;
      try {
        raw = JSON.parse(await readBody(req, MAX_MANUAL_BODY_BYTES));
      } catch (error) {
        const status = error instanceof HttpError ? error.status : 400;
        writeError(res, status, `workspace-virtual-groups: ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
      let manual;
      try {
        manual = parseManualGroups(raw);
        validateManualGroups(manual);
      } catch (error) {
        writeError(res, 400, `workspace-virtual-groups: ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
      try {
        await writeManualGroups(manualPath, manual);
      } catch (error) {
        writeError(res, 500, `workspace-virtual-groups: failed to write manual overlay: ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
      const body = JSON.stringify({ ok: true });
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Length": Buffer.byteLength(body)
      });
      res.end(body);
    }
  }), "dsh-workspace-virtual-groups: /workspace-virtual-groups/manual route");
}
export {
  apply,
  inject,
  name
};
