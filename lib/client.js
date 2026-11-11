window.__ModuleLoader__.load({ id: "dsh-workspace-virtual-groups", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/core/types.ts
var UNCATEGORIZED_LABEL = "\u672A\u5206\u7C7B";
var DEFAULT_GROUP = "\u9ED8\u8BA4\u5DE5\u4F5C\u533A";
var TOP_LEVEL_ORDER_KEY = "__topLevel__";
function normalizePath(path) {
  return path.replace(/[/\\]+$/, "");
}

// src/core/matcher.ts
function ruleMatches(rule, path, title) {
  const normalized = normalizePath(path);
  if (rule.pathPrefix !== void 0 && normalized.startsWith(normalizePath(rule.pathPrefix))) return true;
  if (rule.pathExact !== void 0 && normalized === normalizePath(rule.pathExact)) return true;
  if (rule.nameContains !== void 0 && title.toLowerCase().includes(rule.nameContains.toLowerCase())) return true;
  if (rule.basenameContains !== void 0) {
    const base = path.replace(/[/\\]+$/, "").split(/[/\\]/).pop() ?? "";
    if (base.toLowerCase().includes(rule.basenameContains.toLowerCase())) return true;
  }
  return false;
}
function classify(categories, path, title) {
  for (const category of categories) {
    if (category.rules.some((rule) => ruleMatches(rule, path, title))) return category;
  }
  return void 0;
}
function ruleDisplayName(manual, originalName) {
  return manual?.renamed?.[originalName] ?? originalName;
}
function isHiddenRule(manual, originalName) {
  return manual?.hidden?.includes(originalName) ?? false;
}
function originalRuleNameForDisplay(categories, manual, key) {
  return categories.find((c) => ruleDisplayName(manual, c.name) === key)?.name;
}
function effectiveCategories(config, manual) {
  const entries = [{ key: DEFAULT_GROUP, source: "builtin" }];
  const seen = /* @__PURE__ */ new Set([DEFAULT_GROUP]);
  for (const category of config.categories) {
    if (isHiddenRule(manual, category.name)) continue;
    const key = ruleDisplayName(manual, category.name);
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({ key, source: "rule" });
  }
  for (const name of manual?.categories ?? []) {
    if (seen.has(name)) continue;
    seen.add(name);
    entries.push({ key: name, source: "manual" });
  }
  const order = manual?.categoryOrder;
  if (order === void 0 || order.length === 0) return entries;
  const position = new Map(order.map((key, index) => [key, index]));
  const [defaultEntry, ...rest] = entries;
  rest.sort((a, b) => {
    const pa = position.get(a.key);
    const pb = position.get(b.key);
    if (pa !== void 0 && pb !== void 0) return pa - pb;
    if (pa !== void 0) return -1;
    if (pb !== void 0) return 1;
    return 0;
  });
  return [defaultEntry, ...rest];
}
function displayCategoryKeys(config, manual) {
  return effectiveCategories(config, manual).map((e) => e.key);
}
function resolveCategory(config, manual, workspaceId, path, title) {
  const override = manual?.assignments[workspaceId];
  if (override !== void 0) {
    if (override === null) return DEFAULT_GROUP;
    return displayCategoryKeys(config, manual).includes(override) ? override : DEFAULT_GROUP;
  }
  const matched = classify(config.categories, path, title);
  if (matched === void 0) return DEFAULT_GROUP;
  if (isHiddenRule(manual, matched.name)) return DEFAULT_GROUP;
  return ruleDisplayName(manual, matched.name);
}
function takenCategoryNames(config, manual) {
  const taken = new Set(displayCategoryKeys(config, manual));
  taken.add(UNCATEGORIZED_LABEL);
  taken.add(DEFAULT_GROUP);
  return taken;
}

// inline-css:/Users/lkzc19/Projects/dsh-plugins/dsh-workspace/src/client/styles.css
var styles_default = "/* Virtual group labels are the ONLY new visual element. Official project and\n   session rows keep their own classes, fonts, spacing, icons and actions. */\n\n.wvg-list {\n  display: flex !important;\n  flex-direction: column;\n}\n\n.wvg-group {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  height: 30px;\n  flex: none;\n  padding: 0 8px 0 9px;\n  border-radius: 8px;\n  color: var(--dsw-alias-label-secondary, #6b7280);\n  font: inherit;\n  font-size: 12px;\n  font-weight: 600;\n  line-height: 16px;\n  cursor: pointer;\n  user-select: none;\n}\n\n.wvg-group[data-wvg-default='0'] {\n  margin-top: 6px;\n}\n\n.wvg-group:hover {\n  background: var(--dsw-bg-hover, rgba(127, 127, 127, 0.12));\n}\n\n.wvg-group.wvg-drop {\n  background: var(--dsw-bg-selected, rgba(74, 144, 217, 0.18));\n}\n\n.wvg-chevron {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 14px;\n  height: 14px;\n  flex: none;\n  color: var(--dsw-fg-3, rgba(127, 127, 127, 0.8));\n}\n\n.wvg-chevron svg {\n  transition: transform 120ms ease;\n}\n\n.wvg-group[aria-expanded='true'] .wvg-chevron svg {\n  transform: rotate(90deg);\n}\n\n.wvg-label {\n  flex: 1;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.wvg-more {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 20px;\n  height: 20px;\n  flex: none;\n  padding: 0;\n  border: none;\n  border-radius: 6px;\n  background: transparent;\n  color: var(--dsw-fg-2, inherit);\n  cursor: pointer;\n  opacity: 0;\n}\n\n.wvg-group:hover .wvg-more,\n.wvg-group:focus-within .wvg-more {\n  opacity: 1;\n}\n\n.wvg-more:hover {\n  background: var(--dsw-bg-hover, rgba(127, 127, 127, 0.16));\n}\n\n.wvg-menu {\n  position: fixed;\n  z-index: 1300;\n  min-width: 148px;\n  padding: 4px;\n  border: 1px solid var(--dsw-border, rgba(127, 127, 127, 0.2));\n  border-radius: 8px;\n  background: var(--dsw-alias-bg-layer-2, var(--dsw-bg-1, #fff));\n  box-shadow: var(--dsw-elevation-prominent, 0 12px 36px rgba(0, 0, 0, 0.22));\n}\n\n.wvg-menu-item {\n  display: block;\n  width: 100%;\n  padding: 7px 10px;\n  border: none;\n  border-radius: 6px;\n  background: transparent;\n  color: var(--dsw-alias-label-primary, var(--dsw-fg-1, inherit));\n  font: inherit;\n  font-size: 13px;\n  text-align: left;\n  cursor: pointer;\n}\n\n.wvg-menu-item:hover {\n  background: var(--dsw-bg-hover, rgba(127, 127, 127, 0.12));\n}\n\n.wvg-menu-item.wvg-danger {\n  color: var(--dsw-alias-label-danger, #d64545);\n}\n\n.wvg-overlay {\n  position: fixed;\n  inset: 0;\n  z-index: 1400;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background: rgba(0, 0, 0, 0.26);\n}\n\n.wvg-dialog {\n  width: min(360px, calc(100vw - 32px));\n  padding: 16px;\n  border: 1px solid var(--dsw-border, rgba(127, 127, 127, 0.2));\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-2, var(--dsw-bg-1, #fff));\n  color: var(--dsw-alias-label-primary, var(--dsw-fg-1, #111));\n  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.28);\n  font: inherit;\n}\n\n.wvg-dialog-title {\n  margin-bottom: 12px;\n  font-size: 14px;\n  font-weight: 600;\n}\n\n.wvg-dialog-message {\n  margin-bottom: 12px;\n  color: var(--dsw-alias-label-secondary, #6b7280);\n  font-size: 13px;\n  line-height: 20px;\n}\n\n.wvg-input {\n  box-sizing: border-box;\n  width: 100%;\n  height: 34px;\n  padding: 0 10px;\n  border: 1px solid var(--dsw-border, rgba(127, 127, 127, 0.3));\n  border-radius: 8px;\n  outline: none;\n  background: var(--dsw-bg-1, transparent);\n  color: var(--dsw-alias-label-primary, var(--dsw-fg-1, inherit));\n  font: inherit;\n  font-size: 13px;\n}\n\n.wvg-input:focus {\n  border-color: var(--dsw-accent, #4a90d9);\n}\n\n.wvg-error {\n  min-height: 0;\n  margin-top: 8px;\n  color: var(--dsw-alias-label-danger, #d64545);\n  font-size: 12px;\n  line-height: 16px;\n}\n\n.wvg-dialog-actions {\n  display: flex;\n  justify-content: flex-end;\n  gap: 8px;\n  margin-top: 16px;\n}\n\n.wvg-button {\n  height: 30px;\n  padding: 0 12px;\n  border: 1px solid var(--dsw-border, rgba(127, 127, 127, 0.3));\n  border-radius: 8px;\n  background: transparent;\n  color: var(--dsw-alias-label-primary, var(--dsw-fg-1, inherit));\n  font: inherit;\n  font-size: 12px;\n  cursor: pointer;\n}\n\n.wvg-button:hover {\n  background: var(--dsw-bg-hover, rgba(127, 127, 127, 0.12));\n}\n\n.wvg-button.wvg-primary {\n  border-color: var(--dsw-accent, #4a90d9);\n  background: var(--dsw-accent, #4a90d9);\n  color: #fff;\n}\n\n.wvg-button.wvg-danger {\n  border-color: var(--dsw-alias-label-danger, #d64545);\n  background: var(--dsw-alias-label-danger, #d64545);\n  color: #fff;\n}\n\n.wvg-button:disabled {\n  opacity: 0.6;\n  cursor: default;\n}\n\n.wvg-toast {\n  position: fixed;\n  bottom: 24px;\n  left: 50%;\n  z-index: 1500;\n  max-width: min(440px, calc(100vw - 32px));\n  padding: 8px 12px;\n  border-radius: 8px;\n  background: var(--dsw-alias-bg-inverse, #222);\n  color: var(--dsw-alias-label-inverse, #fff);\n  font-size: 12px;\n  line-height: 18px;\n  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.24);\n  transform: translateX(-50%);\n}\n";

// src/client/dom-groups.ts
var MIME = "application/x-dsh-workspace-virtual-groups";
var CONFIG_ROUTE = "/workspace-virtual-groups/config";
var MANUAL_ROUTE = "/workspace-virtual-groups/manual";
var COLLAPSED_KEY = "dsh.workspace.virtual-groups.collapsed.v1";
var GROUP_INDENT = "20px";
var EMPTY_MANUAL = {
  categories: [],
  assignments: {},
  categoryOrder: [],
  workspaceOrder: {},
  renamed: {},
  hidden: []
};
function normalizeManual(manual) {
  if (manual === void 0) return EMPTY_MANUAL;
  const assignments = Object.fromEntries(
    Object.entries(manual.assignments).map(([id, category]) => [
      id,
      category === DEFAULT_GROUP ? null : category
    ])
  );
  const workspaceOrder = { ...manual.workspaceOrder ?? {} };
  const defaultOrder = workspaceOrder[DEFAULT_GROUP];
  if (defaultOrder !== void 0) {
    workspaceOrder[TOP_LEVEL_ORDER_KEY] = defaultOrder;
    delete workspaceOrder[DEFAULT_GROUP];
  }
  return {
    categories: manual.categories.filter((name) => name !== DEFAULT_GROUP),
    assignments,
    categoryOrder: (manual.categoryOrder ?? []).filter((key) => key !== DEFAULT_GROUP),
    workspaceOrder,
    renamed: manual.renamed ?? {},
    hidden: manual.hidden ?? []
  };
}
async function loadState() {
  const response = await fetch(CONFIG_ROUTE, { cache: "no-cache" });
  if (!response.ok) throw new Error(`config request failed: ${response.status}`);
  const body = await response.json();
  return {
    config: Array.isArray(body.categories) ? body : { categories: [] },
    manual: normalizeManual(body.manual)
  };
}
async function putManual(manual) {
  const response = await fetch(MANUAL_ROUTE, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(manual)
  });
  if (response.ok) return;
  let message = `\u4FDD\u5B58\u5931\u8D25\uFF08${response.status}\uFF09`;
  try {
    const text = await response.text();
    if (text !== "") message = text;
  } catch {
  }
  throw new Error(message);
}
function readCollapsed() {
  try {
    const raw = window.localStorage.getItem(COLLAPSED_KEY);
    if (raw === null) return /* @__PURE__ */ new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((key) => typeof key === "string") : []);
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
function writeCollapsed(collapsed) {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]));
  } catch {
  }
}
function svgIcon(id, size) {
  return `<svg width="${size}" height="${size}" aria-hidden="true"><use href="#${id}"></use></svg>`;
}
function mountWorkspaceVirtualGroups(ctx) {
  const style = document.createElement("style");
  style.dataset.plugin = "dsh-workspace-virtual-groups";
  style.textContent = styles_default;
  document.head.append(style);
  let disposed = false;
  let config = { categories: [] };
  let manual = EMPTY_MANUAL;
  let ready = false;
  let list = null;
  let newGroupButton = null;
  let frame = 0;
  let menu = null;
  let menuPointerClose = null;
  let menuKeyClose = null;
  let modal = null;
  let modalKeyHandler = null;
  let toastTimer = 0;
  let dragId = null;
  let saveQueue = Promise.resolve();
  const groupedHeaders = /* @__PURE__ */ new Map();
  const workspaceMap = /* @__PURE__ */ new Map();
  const collapsed = readCollapsed();
  const originalIndent = /* @__PURE__ */ new WeakMap();
  const workspaceSnapshot = () => ctx.workspaces.list.getSnapshot();
  const workspaceInfo = (id) => workspaceMap.get(id);
  const syncWorkspaces = () => {
    workspaceMap.clear();
    for (const item of workspaceSnapshot().items) {
      workspaceMap.set(item.workspaceId, { path: item.path, title: item.title });
    }
    schedule();
  };
  function schedule() {
    if (disposed || frame !== 0) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      if (!disposed) reconcile();
    });
  }
  function findList() {
    const row = document.querySelector('[data-row-key^="workspace:"]');
    return row?.closest('[role="tree"]') ?? null;
  }
  function sectionsOf(target) {
    return Array.from(target.children).filter(
      (element) => element instanceof HTMLElement && element.querySelector(':scope [data-row-key^="workspace:"]') !== null
    );
  }
  function sectionWorkspaceId(section) {
    const key = section.querySelector('[data-row-key^="workspace:"]')?.getAttribute("data-row-key") ?? "";
    return key.startsWith("workspace:") ? key.slice("workspace:".length) : void 0;
  }
  function markList(target) {
    target.classList.add("wvg-list");
    target.dataset.wvgList = "1";
  }
  function clearSections(target) {
    for (const section of sectionsOf(target)) {
      section.style.order = "";
      section.style.display = "";
      const original = originalIndent.get(section);
      if (original !== void 0 && section.style.getPropertyValue("--dsh-workspace-indent") === GROUP_INDENT) {
        if (original === "") section.style.removeProperty("--dsh-workspace-indent");
        else section.style.setProperty("--dsh-workspace-indent", original);
      }
      originalIndent.delete(section);
      delete section.dataset.wvgIndent;
    }
  }
  function clearHeaders() {
    for (const header of groupedHeaders.values()) header.remove();
    groupedHeaders.clear();
  }
  function cleanupList() {
    if (list === null) return;
    list.classList.remove("wvg-list");
    delete list.dataset.wvgList;
    clearSections(list);
    clearHeaders();
  }
  function ensureNewGroupButton() {
    try {
      const add = document.querySelector('use[href="#dsw-icon-project-add-outline-regular"]')?.closest("button");
      if (newGroupButton !== null && !newGroupButton.isConnected) newGroupButton = null;
      if (add === null || !(add instanceof HTMLElement)) {
        newGroupButton?.remove();
        newGroupButton = null;
        return;
      }
      if (newGroupButton !== null) return;
      const button = add.cloneNode(true);
      button.dataset.wvgNewGroup = "1";
      button.setAttribute("aria-label", "\u65B0\u5EFA\u5206\u7EC4");
      button.removeAttribute("aria-keyshortcuts");
      button.removeAttribute("aria-expanded");
      const svg = button.querySelector("svg");
      if (svg !== null) svg.setAttribute("data-icon", "dsw-icon-folder-open-outline-regular");
      const use = button.querySelector("use");
      if (use !== null) use.setAttribute("href", "#dsw-icon-folder-open-outline-regular");
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openNameDialog("\u65B0\u5EFA\u5206\u7EC4", "", "\u521B\u5EFA", async (name) => {
          const taken = takenCategoryNames(config, manual);
          if (name === "" || name === DEFAULT_GROUP || name === UNCATEGORIZED_LABEL) return "\u8BE5\u540D\u79F0\u4E0D\u53EF\u7528";
          if (taken.has(name)) return "\u5DF2\u5B58\u5728\u540C\u540D\u5206\u7EC4";
          await persist({ ...manual, categories: [...manual.categories, name] });
          return null;
        });
      });
      add.insertAdjacentElement("afterend", button);
      newGroupButton = button;
    } catch (reason) {
      console.warn("workspace virtual groups: new-group button could not mount:", reason);
      newGroupButton = null;
    }
  }
  function createGroupHeader(key) {
    const header = document.createElement("div");
    header.className = "wvg-group";
    header.dataset.wvgGroup = key;
    header.dataset.wvgDefault = key === DEFAULT_GROUP ? "1" : "0";
    header.setAttribute("role", "treeitem");
    header.setAttribute("aria-expanded", "true");
    header.setAttribute("aria-label", key);
    header.innerHTML = `<span class="wvg-chevron">${svgIcon("dsw-icon-triangle-right-fill-regular", 14)}</span><span class="wvg-label"></span>${key === DEFAULT_GROUP ? "" : `<button type="button" class="wvg-more" aria-label="\u5206\u7EC4\u201C${key}\u201D\u7684\u64CD\u4F5C" aria-haspopup="menu">${svgIcon("dsw-icon-ellipsis-outline-regular", 16)}</button>`}`;
    header.addEventListener("click", (event) => {
      if (event.target?.closest(".wvg-more") !== null) return;
      toggleGroup(key);
    });
    header.addEventListener("contextmenu", (event) => {
      if (key === DEFAULT_GROUP) return;
      event.preventDefault();
      openGroupMenu(key, header, event.clientX, event.clientY);
    });
    header.addEventListener("dragover", (event) => onGroupDragOver(event, header));
    header.addEventListener("dragleave", (event) => onGroupDragLeave(event, header));
    header.addEventListener("drop", (event) => onGroupDrop(event, key, header));
    header.querySelector(".wvg-more")?.addEventListener("click", (event) => {
      event.stopPropagation();
      const rect = event.currentTarget.getBoundingClientRect();
      openGroupMenu(key, event.currentTarget, rect.left, rect.bottom + 4);
    });
    return header;
  }
  function reconcile() {
    if (disposed) return;
    ensureNewGroupButton();
    const nextList = findList();
    if (nextList !== list) {
      cleanupList();
      list = nextList;
    }
    if (list === null) return;
    const sections = sectionsOf(list);
    if (!ready || sections.length === 0) {
      cleanupList();
      return;
    }
    for (const section of sections) {
      if (!originalIndent.has(section)) originalIndent.set(section, section.style.getPropertyValue("--dsh-workspace-indent"));
    }
    const inOfficialTree = sections.some((section) => {
      const original = originalIndent.get(section) ?? "";
      if (Number.parseFloat(original) > 0) return true;
      return section.dataset.wvgIndent === "1" && section.style.getPropertyValue("--dsh-workspace-indent") !== GROUP_INDENT;
    });
    if (inOfficialTree) {
      cleanupList();
      return;
    }
    markList(list);
    const members = /* @__PURE__ */ new Map();
    for (const section of sections) {
      const workspaceId = sectionWorkspaceId(section);
      const info = workspaceId === void 0 ? void 0 : workspaceInfo(workspaceId);
      const key = workspaceId === void 0 ? DEFAULT_GROUP : resolveCategory(config, manual, workspaceId, info?.path ?? "", info?.title ?? "");
      const bucket = members.get(key);
      if (bucket === void 0) members.set(key, [section]);
      else bucket.push(section);
    }
    const groups = effectiveCategories(config, manual).filter((entry) => entry.key === DEFAULT_GROUP || entry.source === "manual" || (members.get(entry.key)?.length ?? 0) > 0);
    const visible = /* @__PURE__ */ new Set();
    groups.forEach((entry, groupIndex) => {
      visible.add(entry.key);
      let header = groupedHeaders.get(entry.key);
      if (header === void 0 || !header.isConnected) {
        header = createGroupHeader(entry.key);
        groupedHeaders.set(entry.key, header);
        list.append(header);
      }
      header.style.order = String(groupIndex * 1e5 - 1e3);
      header.setAttribute("aria-expanded", collapsed.has(entry.key) ? "false" : "true");
      const label = header.querySelector(".wvg-label");
      if (label !== null) label.textContent = entry.key;
      const more = header.querySelector(".wvg-more");
      if (more !== null) more.style.display = entry.key === DEFAULT_GROUP ? "none" : "";
      const items = members.get(entry.key) ?? [];
      items.forEach((section, index) => {
        section.style.order = String(groupIndex * 1e5 + index);
        section.style.display = collapsed.has(entry.key) ? "none" : "";
        section.style.setProperty("--dsh-workspace-indent", GROUP_INDENT);
        section.dataset.wvgIndent = "1";
      });
    });
    for (const [key, header] of groupedHeaders) {
      if (visible.has(key)) continue;
      header.remove();
      groupedHeaders.delete(key);
    }
  }
  function toggleGroup(key) {
    if (collapsed.has(key)) collapsed.delete(key);
    else collapsed.add(key);
    writeCollapsed(collapsed);
    schedule();
  }
  function onDragStart(event) {
    const row = event.target?.closest('[data-row-key^="workspace:"]');
    if (row === null) return;
    const key = row.getAttribute("data-row-key") ?? "";
    if (!key.startsWith("workspace:")) return;
    dragId = key.slice("workspace:".length);
    try {
      event.dataTransfer?.setData(MIME, dragId);
      if (event.dataTransfer !== null) event.dataTransfer.effectAllowed = "move";
    } catch {
    }
  }
  function clearDrag() {
    dragId = null;
    document.querySelectorAll(".wvg-group.wvg-drop").forEach((header) => header.classList.remove("wvg-drop"));
  }
  function onGroupDragOver(event, header) {
    if (dragId === null) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer !== null) event.dataTransfer.dropEffect = "move";
    header.classList.add("wvg-drop");
  }
  function onGroupDragLeave(event, header) {
    if (event.relatedTarget instanceof Node && header.contains(event.relatedTarget)) return;
    header.classList.remove("wvg-drop");
  }
  function onGroupDrop(event, key, header) {
    if (dragId === null) return;
    event.preventDefault();
    event.stopPropagation();
    const workspaceId = dragId;
    clearDrag();
    header.classList.remove("wvg-drop");
    void moveToGroup(workspaceId, key);
  }
  function onDocumentDragStart(event) {
    onDragStart(event);
  }
  function onDocumentDragEnd() {
    clearDrag();
  }
  async function moveToGroup(workspaceId, key) {
    const info = workspaceInfo(workspaceId);
    const current = info === void 0 ? DEFAULT_GROUP : resolveCategory(config, manual, workspaceId, info.path, info.title);
    if (current === key) return;
    collapsed.delete(key);
    writeCollapsed(collapsed);
    try {
      await persist({
        ...manual,
        assignments: { ...manual.assignments, [workspaceId]: key === DEFAULT_GROUP ? null : key }
      });
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : String(reason));
    }
  }
  function persist(next) {
    const run = saveQueue.then(async () => {
      await putManual(next);
      manual = next;
      schedule();
    });
    saveQueue = run.catch(() => {
    });
    return run;
  }
  function openGroupMenu(key, anchor, x, y) {
    closeMenu();
    if (key === DEFAULT_GROUP) return;
    const panel = document.createElement("div");
    panel.className = "wvg-menu";
    panel.setAttribute("role", "menu");
    const rename = document.createElement("button");
    rename.type = "button";
    rename.className = "wvg-menu-item";
    rename.textContent = "\u91CD\u547D\u540D\u5206\u7EC4";
    rename.addEventListener("click", () => {
      closeMenu();
      openNameDialog("\u91CD\u547D\u540D\u5206\u7EC4", key, "\u91CD\u547D\u540D", async (name) => {
        if (name === "" || name === DEFAULT_GROUP || name === UNCATEGORIZED_LABEL) return "\u8BE5\u540D\u79F0\u4E0D\u53EF\u7528";
        if (name === key) return null;
        if (takenCategoryNames(config, manual).has(name)) return "\u5DF2\u5B58\u5728\u540C\u540D\u5206\u7EC4";
        await renameGroup(key, name);
        return null;
      });
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "wvg-menu-item wvg-danger";
    remove.textContent = "\u5220\u9664\u5206\u7EC4";
    remove.addEventListener("click", () => {
      closeMenu();
      openConfirmDialog("\u5220\u9664\u5206\u7EC4", `\u5220\u9664\u540E\uFF0C\u8BE5\u5206\u7EC4\u5185\u7684\u9879\u76EE\u4F1A\u79FB\u5230\u300C${DEFAULT_GROUP}\u300D\u3002`, async () => {
        await deleteGroup(key);
      });
    });
    panel.append(rename, remove);
    document.body.append(panel);
    const rect = panel.getBoundingClientRect();
    panel.style.left = `${Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))}px`;
    panel.style.top = `${Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))}px`;
    menu = panel;
    const close = (event) => {
      if (panel.contains(event.target)) return;
      closeMenu();
    };
    menuPointerClose = close;
    window.setTimeout(() => {
      if (menuPointerClose === close) document.addEventListener("pointerdown", close, true);
    }, 0);
    menuKeyClose = (event) => {
      if (event.key === "Escape") closeMenu();
    };
    document.addEventListener("keydown", menuKeyClose, true);
    anchor.focus?.();
  }
  function closeMenu() {
    if (menuPointerClose !== null) document.removeEventListener("pointerdown", menuPointerClose, true);
    if (menuKeyClose !== null) document.removeEventListener("keydown", menuKeyClose, true);
    menuPointerClose = null;
    menuKeyClose = null;
    menu?.remove();
    menu = null;
  }
  async function renameGroup(from, name) {
    const originalRule = originalRuleNameForDisplay(config.categories, manual, from);
    const assignments = Object.fromEntries(
      Object.entries(manual.assignments).map(([id, category]) => [
        id,
        category === from ? name : category
      ])
    );
    const workspaceOrder = Object.fromEntries(
      Object.entries(manual.workspaceOrder).map(([key, ids]) => [key === from ? name : key, ids])
    );
    const categoryOrder = manual.categoryOrder.map((key) => key === from ? name : key);
    const next = {
      ...manual,
      assignments,
      workspaceOrder,
      categoryOrder,
      ...originalRule === void 0 ? { categories: manual.categories.map((key) => key === from ? name : key) } : { renamed: { ...manual.renamed, [originalRule]: name } }
    };
    await persist(next);
  }
  async function deleteGroup(key) {
    if (key === DEFAULT_GROUP) return;
    const originalRule = originalRuleNameForDisplay(config.categories, manual, key);
    const assignments = { ...manual.assignments };
    for (const [workspaceId, info] of workspaceMap) {
      if (resolveCategory(config, manual, workspaceId, info.path, info.title) === key) assignments[workspaceId] = null;
    }
    const workspaceOrder = { ...manual.workspaceOrder };
    delete workspaceOrder[key];
    const categoryOrder = manual.categoryOrder.filter((entry) => entry !== key);
    const next = {
      ...manual,
      assignments,
      workspaceOrder,
      categoryOrder,
      ...originalRule === void 0 ? { categories: manual.categories.filter((entry) => entry !== key) } : {
        renamed: Object.fromEntries(Object.entries(manual.renamed).filter(([original]) => original !== originalRule)),
        hidden: [...manual.hidden, originalRule]
      }
    };
    await persist(next);
  }
  function openNameDialog(title, initial, confirmLabel, submit) {
    closeModal();
    const overlay = document.createElement("div");
    overlay.className = "wvg-overlay";
    overlay.innerHTML = `<div class="wvg-dialog" role="dialog" aria-modal="true"><div class="wvg-dialog-title"></div><input class="wvg-input" type="text" maxlength="80" /><div class="wvg-error" role="alert"></div><div class="wvg-dialog-actions"><button type="button" class="wvg-button" data-wvg-cancel>\u53D6\u6D88</button><button type="button" class="wvg-button wvg-primary" data-wvg-ok></button></div></div>`;
    const dialog = overlay.querySelector(".wvg-dialog");
    dialog.querySelector(".wvg-dialog-title").textContent = title;
    const input = dialog.querySelector(".wvg-input");
    input.value = initial;
    const error = dialog.querySelector(".wvg-error");
    const ok = dialog.querySelector("[data-wvg-ok]");
    ok.textContent = confirmLabel;
    let busy = false;
    const close = () => closeModal();
    const confirm = async () => {
      if (busy) return;
      busy = true;
      ok.disabled = true;
      error.textContent = "";
      try {
        const message = await submit(input.value.trim());
        if (message !== null) {
          error.textContent = message;
          return;
        }
        close();
      } catch (reason) {
        error.textContent = reason instanceof Error ? reason.message : String(reason);
      } finally {
        busy = false;
        ok.disabled = false;
      }
    };
    dialog.querySelector("[data-wvg-cancel]").addEventListener("click", close);
    ok.addEventListener("click", () => {
      void confirm();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.isComposing) {
        event.preventDefault();
        void confirm();
      }
    });
    overlay.addEventListener("pointerdown", (event) => {
      if (event.target === overlay) close();
    });
    document.body.append(overlay);
    modal = overlay;
    modalKeyHandler = (event) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", modalKeyHandler);
    window.requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  }
  function openConfirmDialog(title, message, confirm) {
    closeModal();
    const overlay = document.createElement("div");
    overlay.className = "wvg-overlay";
    overlay.innerHTML = `<div class="wvg-dialog" role="dialog" aria-modal="true"><div class="wvg-dialog-title"></div><div class="wvg-dialog-message"></div><div class="wvg-error" role="alert"></div><div class="wvg-dialog-actions"><button type="button" class="wvg-button" data-wvg-cancel>\u53D6\u6D88</button><button type="button" class="wvg-button wvg-danger" data-wvg-ok>\u5220\u9664</button></div></div>`;
    const dialog = overlay.querySelector(".wvg-dialog");
    dialog.querySelector(".wvg-dialog-title").textContent = title;
    dialog.querySelector(".wvg-dialog-message").textContent = message;
    const error = dialog.querySelector(".wvg-error");
    const ok = dialog.querySelector("[data-wvg-ok]");
    let busy = false;
    const close = () => closeModal();
    const run = async () => {
      if (busy) return;
      busy = true;
      ok.disabled = true;
      error.textContent = "";
      try {
        await confirm();
        close();
      } catch (reason) {
        error.textContent = reason instanceof Error ? reason.message : String(reason);
      } finally {
        busy = false;
        ok.disabled = false;
      }
    };
    dialog.querySelector("[data-wvg-cancel]").addEventListener("click", close);
    ok.addEventListener("click", () => {
      void run();
    });
    overlay.addEventListener("pointerdown", (event) => {
      if (event.target === overlay) close();
    });
    document.body.append(overlay);
    modal = overlay;
    modalKeyHandler = (event) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", modalKeyHandler);
  }
  function closeModal() {
    if (modalKeyHandler !== null) document.removeEventListener("keydown", modalKeyHandler);
    modalKeyHandler = null;
    modal?.remove();
    modal = null;
  }
  function showToast(message) {
    document.querySelectorAll(".wvg-toast").forEach((node) => node.remove());
    const toast = document.createElement("div");
    toast.className = "wvg-toast";
    toast.textContent = message;
    document.body.append(toast);
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.remove(), 3200);
  }
  const stopWorkspaces = ctx.workspaces.list.subscribe(syncWorkspaces);
  syncWorkspaces();
  void loadState().then((state) => {
    if (disposed) return;
    config = state.config;
    manual = state.manual;
    ready = true;
    schedule();
  }).catch((reason) => {
    if (disposed) return;
    ready = true;
    console.warn("workspace virtual groups: config unavailable:", reason);
    schedule();
  });
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("dragstart", onDocumentDragStart, true);
  document.addEventListener("dragend", onDocumentDragEnd, true);
  schedule();
  return () => {
    disposed = true;
    stopWorkspaces();
    observer.disconnect();
    document.removeEventListener("dragstart", onDocumentDragStart, true);
    document.removeEventListener("dragend", onDocumentDragEnd, true);
    if (frame !== 0) window.cancelAnimationFrame(frame);
    window.clearTimeout(toastTimer);
    closeMenu();
    closeModal();
    cleanupList();
    style.remove();
  };
}

// src/client/index.ts
var inject = ["workspaces"];
function apply(ctx) {
  ctx.effect(
    () => mountWorkspaceVirtualGroups(ctx),
    "dsh-workspace-virtual-groups: sidebar grouping layer"
  );
}
return module.exports; } });
//# sourceMappingURL=client.js.map
