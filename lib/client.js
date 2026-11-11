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
var DEFAULT_GROUP = "\u9ED8\u8BA4";
var LEGACY_DEFAULT_GROUP = "\u9ED8\u8BA4\u5DE5\u4F5C\u533A";
var TOP_LEVEL_ORDER_KEY = "__topLevel__";

// src/core/grouping.ts
function effectiveCategories(manual) {
  const entries = [{ key: DEFAULT_GROUP, source: "builtin" }];
  const seen = /* @__PURE__ */ new Set([DEFAULT_GROUP, LEGACY_DEFAULT_GROUP]);
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
function displayCategoryKeys(manual) {
  return effectiveCategories(manual).map((entry) => entry.key);
}
function resolveCategory(manual, workspaceId) {
  const assignment = manual?.assignments[workspaceId];
  if (assignment === void 0 || assignment === null) return DEFAULT_GROUP;
  if (assignment === DEFAULT_GROUP || assignment === LEGACY_DEFAULT_GROUP) return DEFAULT_GROUP;
  return manual?.categories.includes(assignment) ? assignment : DEFAULT_GROUP;
}
function takenCategoryNames(manual) {
  const taken = new Set(displayCategoryKeys(manual));
  taken.add(UNCATEGORIZED_LABEL);
  taken.add(DEFAULT_GROUP);
  taken.add(LEGACY_DEFAULT_GROUP);
  return taken;
}
function moveBefore(list, id, beforeId) {
  const rest = list.filter((x) => x !== id);
  if (beforeId === void 0) return [...rest, id];
  const index = rest.indexOf(beforeId);
  if (index === -1) return [...rest, id];
  rest.splice(index, 0, id);
  return rest;
}
function moveAfter(list, id, afterId) {
  const rest = list.filter((x) => x !== id);
  if (afterId === void 0) return [...rest, id];
  const index = rest.indexOf(afterId);
  if (index === -1) return [...rest, id];
  rest.splice(index + 1, 0, id);
  return rest;
}

// inline-css:/Users/lkzc19/Projects/dsh-plugins/dsh-workspace/src/client/styles.css
var styles_default = "/* Virtual group labels are the ONLY new visual element. Official project and\n   session rows keep their own classes, fonts, spacing, icons and actions.\n   Menus and dialogs mirror DSH's own section labels, context menu and modal\n   metrics instead of inventing a separate visual language. */\n\n.wvg-list {\n  display: flex !important;\n  flex-direction: column;\n}\n\n/* Section label: same 36px row / 14px tertiary label as the official sidebar\n   section header, plus a chevron and a group action button. */\n.wvg-group {\n  position: relative;\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  height: 36px;\n  flex: none;\n  padding: 0 8px 0 12px;\n  border-radius: 12px;\n  color: var(--dsw-alias-label-tertiary, #81858c);\n  font: inherit;\n  font-size: 14px;\n  font-weight: 400;\n  line-height: 20px;\n  cursor: pointer;\n  user-select: none;\n}\n\n.wvg-group[data-wvg-default='0'] {\n  margin-top: 4px;\n}\n\n.wvg-group:hover {\n  background: var(--dsw-bg-hover, rgba(127, 127, 127, 0.12));\n}\n\n.wvg-group.wvg-drop {\n  background: var(--dsw-bg-selected, rgba(74, 144, 217, 0.18));\n}\n\n.wvg-chevron {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 14px;\n  height: 14px;\n  flex: none;\n  color: var(--dsw-alias-label-tertiary, #81858c);\n}\n\n.wvg-chevron svg {\n  transition: transform 120ms ease;\n}\n\n.wvg-group[aria-expanded='true'] .wvg-chevron svg {\n  transform: rotate(90deg);\n}\n\n.wvg-label {\n  flex: 1;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n/* Match the workspace row's hover-only 24px action button. */\n.wvg-more:not([data-wvg-native-icon]) {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 24px;\n  height: 24px;\n  flex: none;\n  margin: 0;\n  padding: 0;\n  border: none;\n  border-radius: var(--dsw-radius-xs, 6px);\n  background: transparent;\n  color: var(--dsw-alias-label-tertiary, #81858c);\n  cursor: pointer;\n}\n\n@media (hover: hover) {\n  .wvg-more:not([data-wvg-native-icon]):hover {\n    color: var(--dsw-alias-label-primary, #0f1115);\n  }\n}\n\n.wvg-group .wvg-more {\n  display: none;\n  margin: 0;\n}\n\n@media (hover: hover) {\n  .wvg-group:hover .wvg-more,\n  .wvg-group.wvg-menu-open .wvg-more,\n  .wvg-group:focus-within .wvg-more {\n    display: inline-flex;\n  }\n}\n\n@media (hover: none) {\n  .wvg-group .wvg-more {\n    display: inline-flex;\n  }\n}\n\n.wvg-group[draggable='true'] {\n  cursor: grab;\n}\n\n.wvg-group[draggable='true']:active {\n  cursor: grabbing;\n}\n\n.wvg-group.wvg-dragging {\n  opacity: 0.45;\n}\n\n.wvg-group.wvg-insert-before::before,\n.wvg-group.wvg-insert-after::after {\n  content: '';\n  position: absolute;\n  left: 2px;\n  right: 2px;\n  height: 2px;\n  border-radius: 1px;\n  background: var(--dsw-accent, #4a90d9);\n  pointer-events: none;\n  z-index: 2;\n}\n\n.wvg-group.wvg-insert-before::before {\n  top: -2px;\n}\n\n.wvg-group.wvg-insert-after::after {\n  bottom: -2px;\n}\n\n/* Context menu: 16px radius surface, 4px padding, 12px rows, 13px labels. */\n.wvg-menu {\n  position: fixed;\n  z-index: 1100;\n  min-width: 144px;\n  padding: 4px;\n  border: none;\n  border-radius: 16px;\n  background: var(--dsw-alias-bg-layer-2, var(--dsw-bg-1, #fff));\n  box-shadow:\n    0 0 0 0.5px rgba(0, 0, 0, 0.04),\n    0 3px 8px 0 rgba(0, 0, 0, 0.04),\n    0 0 20px 0 rgba(0, 0, 0, 0.05);\n}\n\n.wvg-menu-item {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  width: 100%;\n  min-height: 32px;\n  box-sizing: border-box;\n  padding: 6px 8px;\n  border: none;\n  border-radius: 12px;\n  background: transparent;\n  color: var(--dsw-alias-label-primary, var(--dsw-fg-1, inherit));\n  font: inherit;\n  font-size: 13px;\n  line-height: 20px;\n  text-align: left;\n  cursor: pointer;\n}\n\n.wvg-menu-item:hover {\n  background: var(--dsw-bg-hover, rgba(127, 127, 127, 0.12));\n}\n\n.wvg-menu-icon {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 16px;\n  height: 16px;\n  flex: none;\n  color: var(--dsw-fg-2, inherit);\n}\n\n.wvg-menu-label {\n  flex: 1;\n  min-width: 0;\n}\n\n.wvg-menu-item.wvg-danger {\n  color: var(--dsw-alias-label-danger, #d64545);\n}\n\n.wvg-menu-item.wvg-danger .wvg-menu-icon {\n  color: currentColor;\n}\n\n\n.wvg-menu-separator {\n  height: 1px;\n  margin: 4px 8px;\n  background: var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.15));\n}\n\n/* Modal: 380px / 28px radius surface and 36px buttons, matching DSH dialogs. */\n.wvg-overlay {\n  position: fixed;\n  inset: 0;\n  z-index: 1400;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  box-sizing: border-box;\n  padding: 24px;\n  background: transparent;\n}\n\n.wvg-dialog {\n  display: flex;\n  flex-direction: column;\n  gap: 20px;\n  box-sizing: border-box;\n  width: 380px;\n  max-width: 100%;\n  padding: 0 0 24px;\n  overflow: hidden;\n  border: none;\n  border-radius: 28px;\n  background: var(--dsw-alias-bg-layer-2, #2c2c2e);\n  color: var(--dsw-alias-label-primary, #f9fafb);\n  box-shadow:\n    0 0 0 0.5px var(--dsw-alias-border-l4, rgba(255, 255, 255, 0.2)),\n    0 3px 8px 0 rgba(0, 0, 0, 0.04),\n    0 0 20px 0 rgba(0, 0, 0, 0.05);\n  font: inherit;\n}\n\n.wvg-dialog-content {\n  display: flex;\n  flex-direction: column;\n  gap: 20px;\n}\n\n.wvg-dialog-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  box-sizing: border-box;\n  min-height: 62px;\n  padding: 22px 14px 12px 24px;\n}\n\n.wvg-dialog-title {\n  min-width: 0;\n  margin: 0;\n  color: var(--dsw-alias-label-primary, #f9fafb);\n  font-size: 16px;\n  font-weight: 500;\n  line-height: 24px;\n}\n\n.wvg-dialog-close {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 28px;\n  height: 28px;\n  flex: none;\n  box-sizing: border-box;\n  padding: 1px 6px;\n  border: none;\n  border-radius: 8px;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary, #cfd3d6);\n  cursor: pointer;\n}\n\n.wvg-dialog-close:hover {\n  background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.08));\n}\n\n.wvg-dialog-body {\n  display: flex;\n  flex-direction: column;\n  padding: 0 24px;\n}\n\n.wvg-dialog-message {\n  margin: 0;\n  padding: 0;\n  color: var(--dsw-alias-label-secondary, #cfd3d6);\n  font-size: 14px;\n  line-height: 22px;\n}\n\n.wvg-input {\n  display: block;\n  box-sizing: border-box;\n  width: 100%;\n  height: 44px;\n  margin: 0;\n  padding: 7px 14px;\n  border: 1px solid var(--dsw-alias-border-l4, rgba(255, 255, 255, 0.2));\n  border-radius: 16px;\n  outline: none;\n  background: transparent;\n  color: var(--dsw-alias-label-primary, #f9fafb);\n  font: inherit;\n  font-size: 14px;\n  line-height: 22px;\n}\n\n.wvg-error {\n  min-height: 0;\n  margin: 8px 0 0;\n  color: var(--dsw-alias-state-error-primary, #d64545);\n  font-size: 12px;\n  line-height: 18px;\n}\n\n.wvg-error:empty {\n  display: none;\n  margin: 0;\n}\n\n.wvg-dialog-actions {\n  display: flex;\n  align-items: center;\n  justify-content: flex-end;\n  gap: 8px;\n  padding: 0 24px;\n}\n\n.wvg-button {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  box-sizing: border-box;\n  height: 36px;\n  padding: 0 14px;\n  border: none;\n  border-radius: 12px;\n  background: transparent;\n  color: var(--dsw-alias-label-primary, #f9fafb);\n  font: inherit;\n  font-size: 14px;\n  line-height: 22px;\n  cursor: pointer;\n}\n\n.wvg-button.wvg-outline {\n  border: 1px solid transparent;\n  box-shadow: inset 0 0 0 1px var(--dsw-alias-border-l3, rgba(255, 255, 255, 0.16));\n}\n\n.wvg-button:hover {\n  background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.08));\n}\n\n.wvg-button.wvg-primary {\n  background: var(--dsw-alias-label-primary, #f9fafb);\n  color: var(--dsw-alias-label-inverse, #0f1115);\n}\n\n.wvg-button.wvg-primary:hover {\n  background: var(--dsw-alias-label-primary, #f9fafb);\n  opacity: 0.9;\n}\n\n.wvg-button.wvg-danger {\n  background: var(--dsw-alias-state-error-primary, #d64545);\n  color: #fff;\n}\n\n.wvg-button:disabled {\n  opacity: 0.4;\n  cursor: default;\n}\n\n.wvg-button:focus-visible,\n.wvg-dialog-close:focus-visible {\n  outline: 2px solid var(--dsw-alias-state-business-primary, #7aaaff);\n  outline-offset: 2px;\n}\n\n.wvg-toast {\n  position: fixed;\n  bottom: 24px;\n  left: 50%;\n  z-index: 1500;\n  max-width: min(440px, calc(100vw - 32px));\n  padding: 8px 12px;\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-inverse, #222);\n  color: var(--dsw-alias-label-inverse, #fff);\n  font-size: 13px;\n  line-height: 20px;\n  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.24);\n  transform: translateX(-50%);\n}\n\n";

// src/client/dom-groups.ts
var MIME = "application/x-dsh-workspace-virtual-groups";
var GROUP_MIME = "application/x-dsh-workspace-virtual-group";
var LAYER_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round" data-wvg-layer="1" aria-hidden="true"><path d="M8 1.8 14 5 8 8.2 2 5 8 1.8Z"></path><path d="M2 8 8 11.2 14 8"></path><path d="M2 11 8 14.2 14 11"></path></svg>';
var GROUPING = {
  workspace: {
    icon: "dsw-icon-folder-close-regular",
    labels: ["\u6309\u5DE5\u4F5C\u533A", "By workspace"]
  },
  tree: {
    icon: "dsw-icon-workspace-tree-outline-regular",
    labels: ["\u6309\u5DE5\u4F5C\u533A\u6811", "By workspace tree"]
  },
  flatList: {
    icon: "dsw-icon-flat-list-outline-regular",
    labels: ["\u5355\u5217\u8868", "Flat list"]
  }
};
var OFFICIAL_GROUPING_ICONS = new Set(
  Object.values(GROUPING).map((entry) => entry.icon)
);
var OFFICIAL_GROUPING_LABELS = new Set(
  Object.values(GROUPING).flatMap((entry) => entry.labels)
);
var MANUAL_ROUTE = "/workspace-virtual-groups/manual";
var COLLAPSED_KEY = "dsh.workspace.virtual-groups.collapsed.v1";
var GROUP_INDENT = "20px";
var EMPTY_MANUAL = {
  categories: [],
  assignments: {},
  categoryOrder: [],
  workspaceOrder: {},
  mode: "virtual"
};
function normalizeManual(manual) {
  if (manual === void 0) return EMPTY_MANUAL;
  const categories = [...new Set(manual.categories)].filter((name) => name !== DEFAULT_GROUP && name !== LEGACY_DEFAULT_GROUP);
  const categorySet = new Set(categories);
  const assignments = Object.fromEntries(
    Object.entries(manual.assignments).map(([id, category]) => [
      id,
      category === null || category === DEFAULT_GROUP || category === LEGACY_DEFAULT_GROUP || !categorySet.has(category) ? null : category
    ])
  );
  const workspaceOrder = {};
  for (const [key, ids] of Object.entries(manual.workspaceOrder ?? {})) {
    const normalizedKey = key === DEFAULT_GROUP || key === LEGACY_DEFAULT_GROUP ? TOP_LEVEL_ORDER_KEY : key;
    if (normalizedKey === TOP_LEVEL_ORDER_KEY || categorySet.has(normalizedKey)) {
      workspaceOrder[normalizedKey] = ids;
    }
  }
  return {
    categories,
    assignments,
    categoryOrder: (manual.categoryOrder ?? []).filter((key) => categorySet.has(key)),
    workspaceOrder,
    mode: manual.mode === "official" ? "official" : "virtual"
  };
}
async function loadState() {
  const response = await fetch(MANUAL_ROUTE, { cache: "no-cache" });
  if (response.ok) return normalizeManual(await response.json());
  if (response.status !== 404 && response.status !== 405) {
    throw new Error(`manual request failed: ${response.status}`);
  }
  const legacy = await fetch("/workspace-virtual-groups/config", { cache: "no-cache" });
  if (!legacy.ok) throw new Error(`manual request failed: ${response.status}`);
  const body = await legacy.json();
  return normalizeManual(body.manual);
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
  let manual = EMPTY_MANUAL;
  let loaded = false;
  let list = null;
  let viewMode = "virtual";
  let suppressViewModeClick = false;
  let lastSelectedExtra = [];
  let lastCheckHTML = null;
  let addingWorkspace = false;
  let frame = 0;
  let menu = null;
  let menuAnchor = null;
  let menuPointerClose = null;
  let menuKeyClose = null;
  let modal = null;
  let modalKeyHandler = null;
  let toastTimer = 0;
  let dragId = null;
  let draggingGroup = null;
  let saveQueue = Promise.resolve();
  const groupedHeaders = /* @__PURE__ */ new Map();
  const collapsed = readCollapsed();
  const originalIndent = /* @__PURE__ */ new WeakMap();
  const viewMenuMeta = /* @__PURE__ */ new WeakMap();
  const headerActionsMeta = /* @__PURE__ */ new WeakMap();
  const headerActionsTracked = /* @__PURE__ */ new Set();
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
  function openCreateGroupDialog() {
    openNameDialog("\u65B0\u5EFA\u5206\u7EC4", "", "\u521B\u5EFA", async (name) => {
      const taken = takenCategoryNames(manual);
      if (name === "" || name === DEFAULT_GROUP || name === LEGACY_DEFAULT_GROUP || name === UNCATEGORIZED_LABEL) return "\u8BE5\u540D\u79F0\u4E0D\u53EF\u7528";
      if (taken.has(name)) return "\u5DF2\u5B58\u5728\u540C\u540D\u5206\u7EC4";
      await persist({ ...manual, categories: [...manual.categories, name] });
      return null;
    });
  }
  function restoreLegacyAddButton() {
    document.querySelectorAll("button[data-wvg-add-group]").forEach((button) => {
      delete button.dataset.wvgAddGroup;
      button.setAttribute("aria-label", "\u6DFB\u52A0\u5DE5\u4F5C\u533A");
      button.setAttribute("aria-keyshortcuts", "Alt+Meta+O");
      const svg = button.querySelector("svg");
      const use = button.querySelector("use");
      if (svg !== null) svg.setAttribute("data-icon", "dsw-icon-project-add-outline-regular");
      if (use !== null) use.setAttribute("href", "#dsw-icon-project-add-outline-regular");
    });
  }
  function officialAddButton() {
    const use = document.querySelector('use[href="#dsw-icon-project-add-outline-regular"]');
    const button = use?.closest("button");
    return button instanceof HTMLButtonElement ? button : null;
  }
  function restoreHeaderActions(actions) {
    if (actions === null) return;
    const original = headerActionsMeta.get(actions);
    if (original === void 0) return;
    actions.style.width = original.width;
    actions.style.minWidth = original.minWidth;
    actions.style.overflow = original.overflow;
    headerActionsMeta.delete(actions);
    headerActionsTracked.delete(actions);
  }
  function removeNewGroupButtons() {
    document.querySelectorAll("[data-wvg-new-group]").forEach((node) => {
      const actions = node.parentElement;
      node.remove();
      restoreHeaderActions(actions);
    });
    for (const actions of [...headerActionsTracked]) restoreHeaderActions(actions);
  }
  function ensureNewGroupButton() {
    restoreLegacyAddButton();
    if (viewMode !== "virtual") {
      removeNewGroupButtons();
      return;
    }
    const add = officialAddButton();
    if (add === null) {
      removeNewGroupButtons();
      return;
    }
    let button = document.querySelector("button[data-wvg-new-group]");
    if (button !== null && button.dataset.wvgVersion !== "2") {
      const oldActions = button.parentElement;
      button.remove();
      restoreHeaderActions(oldActions);
      button = null;
    }
    if (button === null || !button.isConnected) {
      button = add.cloneNode(true);
      button.dataset.wvgNewGroup = "1";
      button.dataset.wvgVersion = "2";
      add.after(button);
    }
    if (button.previousElementSibling !== add) add.after(button);
    button.setAttribute("aria-label", "\u65B0\u5EFA\u5206\u7EC4");
    button.removeAttribute("aria-keyshortcuts");
    button.removeAttribute("aria-expanded");
    if (button.querySelector('svg[data-wvg-layer="1"]') === null) button.innerHTML = LAYER_ICON;
    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      openCreateGroupDialog();
    };
    const actions = button.parentElement;
    if (actions !== null) {
      if (!headerActionsMeta.has(actions)) {
        headerActionsMeta.set(actions, {
          width: actions.style.width,
          minWidth: actions.style.minWidth,
          overflow: actions.style.overflow
        });
        headerActionsTracked.add(actions);
      }
      actions.style.width = "max-content";
      actions.style.minWidth = "max-content";
      actions.style.overflow = "visible";
    }
  }
  function groupingIcon(button) {
    const svg = button.querySelector(":scope > span svg[data-icon]");
    return svg?.getAttribute("data-icon") ?? null;
  }
  function groupingLabel(button) {
    return (button.textContent ?? "").trim();
  }
  function isOfficialGroupingButton(button) {
    const icon = groupingIcon(button);
    if (icon !== null && OFFICIAL_GROUPING_ICONS.has(icon)) return true;
    return OFFICIAL_GROUPING_LABELS.has(groupingLabel(button));
  }
  function findGroupingButton(menu2, group) {
    const buttons = [...menu2.querySelectorAll('button[role="menuitem"]')];
    const labels = group.labels;
    return buttons.find((button) => groupingIcon(button) === group.icon) ?? buttons.find((button) => labels.includes(groupingLabel(button))) ?? null;
  }
  function virtualGroupingLabel(menu2) {
    const workspace = findGroupingButton(menu2, GROUPING.workspace);
    const label = workspace === null ? "" : groupingLabel(workspace);
    return label.includes("\u6309") || label.includes("\u5DE5\u4F5C\u533A") ? "\u6309\u865A\u62DF\u5206\u7EC4" : "Virtual groups";
  }
  function findViewOptionsMenu() {
    for (const menu2 of document.querySelectorAll('[role="menu"]')) {
      if (menu2.className.includes("viewOptionsMenu")) return menu2;
      if ([...menu2.querySelectorAll('button[role="menuitem"]')].some(isOfficialGroupingButton)) {
        return menu2;
      }
    }
    return null;
  }
  function closeViewOptions() {
    if (findViewOptionsMenu() === null) return;
    const use = document.querySelector('use[href="#dsw-icon-sliders-two-outline-regular"]');
    const trigger = use?.closest("button");
    if (trigger instanceof HTMLButtonElement) trigger.click();
    else document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  }
  function ensureViewOptions() {
    const menu2 = findViewOptionsMenu();
    if (menu2 === null) return;
    const isOfficial = isOfficialGroupingButton;
    let ours = menu2.querySelector("button[data-wvg-view-virtual]");
    if (ours === null) {
      const tree = findGroupingButton(menu2, GROUPING.tree);
      const wrap = tree?.parentElement;
      if (tree === null || wrap === void 0 || wrap === null) return;
      const official = [...menu2.querySelectorAll('button[role="menuitem"]')].filter(isOfficial);
      const unselected = official.find((button2) => button2.querySelector(":scope > svg") === null) ?? tree;
      const selected = official.find((button2) => button2.querySelector(":scope > svg") !== null);
      const baseClass = unselected.className;
      const selectedExtra = selected === void 0 ? [] : [...selected.classList].filter((name) => !unselected.classList.contains(name));
      const checkHTML = selected?.querySelector(":scope > svg")?.outerHTML ?? null;
      if (selectedExtra.length > 0) lastSelectedExtra = selectedExtra;
      if (checkHTML !== null) lastCheckHTML = checkHTML;
      const clone = wrap.cloneNode(true);
      clone.dataset.wvgViewWrap = "1";
      const button = clone.querySelector('button[role="menuitem"]');
      if (button === null) return;
      button.dataset.wvgViewVirtual = "1";
      button.className = baseClass;
      const label = [...button.querySelectorAll(":scope > span")].find((span) => span.querySelector("svg") === null && (span.textContent ?? "").trim() !== "");
      if (label !== void 0) label.textContent = virtualGroupingLabel(menu2);
      const icon = button.querySelector('[class*="itemIcon"]') ?? [...button.querySelectorAll("span")].find((span) => span.querySelector("svg") !== null);
      if (icon !== void 0) icon.innerHTML = LAYER_ICON;
      button.querySelector(":scope > svg")?.remove();
      wrap.after(clone);
      viewMenuMeta.set(button, {
        baseClass,
        selectedExtra: selectedExtra.length > 0 ? selectedExtra : lastSelectedExtra,
        check: checkHTML ?? lastCheckHTML
      });
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        activateVirtualMode(menu2);
      });
      ours = button;
    }
    if (menu2.dataset.wvgModeListener !== "1") {
      menu2.dataset.wvgModeListener = "1";
      menu2.addEventListener("click", (event) => {
        if (suppressViewModeClick) return;
        const button = event.target?.closest('button[role="menuitem"]');
        if (button === null || button === void 0) return;
        if (!isOfficial(button)) return;
        setViewMode("official");
      }, true);
    }
    const meta = viewMenuMeta.get(ours) ?? { baseClass: ours.className, selectedExtra: lastSelectedExtra, check: lastCheckHTML };
    if (viewMode === "virtual") {
      for (const button of menu2.querySelectorAll('button[role="menuitem"]')) {
        if (button === ours || !isOfficial(button)) continue;
        if (meta.selectedExtra.length > 0) button.classList.remove(...meta.selectedExtra);
        button.querySelector(":scope > svg")?.remove();
      }
      ours.className = meta.selectedExtra.length > 0 ? `${meta.baseClass} ${meta.selectedExtra.join(" ")}` : meta.baseClass;
      if (meta.check !== null && ours.querySelector(":scope > svg") === null) {
        const holder = document.createElement("template");
        holder.innerHTML = meta.check;
        const check = holder.content.firstElementChild;
        if (check !== null) ours.append(check);
      }
    } else {
      ours.className = meta.baseClass;
      ours.querySelector(":scope > svg")?.remove();
    }
  }
  function setViewMode(mode) {
    if (!loaded) return;
    if (viewMode === mode) {
      schedule();
      return;
    }
    viewMode = mode;
    manual = { ...manual, mode };
    schedule();
    void persist(manual).catch((reason) => {
      showToast(reason instanceof Error ? reason.message : String(reason));
    });
  }
  function activateVirtualMode(menu2) {
    setViewMode("virtual");
    const byWorkspace = findGroupingButton(menu2, GROUPING.workspace);
    if (byWorkspace === null) {
      closeViewOptions();
      return;
    }
    suppressViewModeClick = true;
    byWorkspace.click();
    window.setTimeout(() => {
      suppressViewModeClick = false;
      if (menu2.isConnected) closeViewOptions();
    }, 0);
  }
  function createGroupHeader(key) {
    const header = document.createElement("div");
    header.className = "wvg-group";
    header.dataset.wvgGroup = key;
    header.dataset.wvgDefault = key === DEFAULT_GROUP ? "1" : "0";
    header.setAttribute("role", "treeitem");
    header.setAttribute("aria-expanded", "true");
    header.setAttribute("aria-label", key);
    header.draggable = key !== DEFAULT_GROUP;
    header.innerHTML = `<span class="wvg-chevron">${svgIcon("dsw-icon-triangle-right-fill-regular", 14)}</span><span class="wvg-label"></span><button type="button" class="wvg-more" aria-label="\u5206\u7EC4\u64CD\u4F5C" aria-haspopup="menu">${svgIcon("dsw-icon-ellipsis-outline-regular", 16)}</button>`;
    header.querySelector(".wvg-more")?.setAttribute("aria-label", `\u5206\u7EC4\u201C${key}\u201D\u7684\u64CD\u4F5C`);
    header.addEventListener("dragstart", (event) => {
      if (key === DEFAULT_GROUP) {
        event.preventDefault();
        return;
      }
      if (event.target?.closest(".wvg-more") !== null) {
        event.preventDefault();
        return;
      }
      draggingGroup = key;
      try {
        event.dataTransfer?.setData(GROUP_MIME, key);
        if (event.dataTransfer !== null) event.dataTransfer.effectAllowed = "move";
      } catch {
      }
      header.classList.add("wvg-dragging");
    });
    header.addEventListener("dragend", () => {
      clearDrag();
    });
    header.addEventListener("click", (event) => {
      if (event.target?.closest(".wvg-more") !== null) return;
      toggleGroup(key);
    });
    header.addEventListener("contextmenu", (event) => {
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
  function applyNativeIconClasses() {
    const rowAction = document.querySelector('[data-row-key^="workspace:"] [data-context-menu-trigger]');
    const nativeClass = rowAction?.className ?? officialAddButton()?.className ?? "";
    if (nativeClass === "") return;
    document.querySelectorAll(".wvg-more").forEach((button) => {
      const previous = button.dataset.wvgNativeClass ?? "";
      if (previous === nativeClass) return;
      for (const name of previous.split(/\s+/).filter(Boolean)) button.classList.remove(name);
      button.classList.add(...nativeClass.split(/\s+/).filter(Boolean));
      button.dataset.wvgNativeClass = nativeClass;
      button.dataset.wvgNativeIcon = "1";
    });
  }
  function reconcile() {
    if (disposed) return;
    if (!loaded) {
      cleanupList();
      removeNewGroupButtons();
      return;
    }
    ensureViewOptions();
    ensureNewGroupButton();
    if (viewMode !== "virtual") {
      cleanupList();
      return;
    }
    const nextList = findList();
    if (nextList !== list) {
      cleanupList();
      list = nextList;
    }
    if (list === null) return;
    const sections = sectionsOf(list);
    if (sections.length === 0) {
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
      const key = workspaceId === void 0 ? DEFAULT_GROUP : resolveCategory(manual, workspaceId);
      const bucket = members.get(key);
      if (bucket === void 0) members.set(key, [section]);
      else bucket.push(section);
    }
    const groups = effectiveCategories(manual);
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
    applyNativeIconClasses();
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
    draggingGroup = null;
    document.querySelectorAll(".wvg-group.wvg-dragging, .wvg-group.wvg-drop, .wvg-group.wvg-insert-before, .wvg-group.wvg-insert-after").forEach((header) => header.classList.remove("wvg-dragging", "wvg-drop", "wvg-insert-before", "wvg-insert-after"));
  }
  function onGroupDragOver(event, header) {
    if (draggingGroup !== null) {
      const key = header.dataset.wvgGroup ?? "";
      if (key === DEFAULT_GROUP || key === draggingGroup) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer !== null) event.dataTransfer.dropEffect = "move";
      const rect = header.getBoundingClientRect();
      const before = event.clientY < rect.top + rect.height / 2;
      document.querySelectorAll(".wvg-group.wvg-insert-before, .wvg-group.wvg-insert-after").forEach((node) => node.classList.remove("wvg-insert-before", "wvg-insert-after"));
      header.classList.add(before ? "wvg-insert-before" : "wvg-insert-after");
      return;
    }
    if (dragId === null) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer !== null) event.dataTransfer.dropEffect = "move";
    header.classList.add("wvg-drop");
  }
  function onGroupDragLeave(event, header) {
    if (event.relatedTarget instanceof Node && header.contains(event.relatedTarget)) return;
    header.classList.remove("wvg-drop", "wvg-insert-before", "wvg-insert-after");
  }
  function onGroupDrop(event, key, header) {
    if (draggingGroup !== null) {
      if (key === DEFAULT_GROUP || key === draggingGroup) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = header.getBoundingClientRect();
      const before = event.clientY < rect.top + rect.height / 2;
      const dragged = draggingGroup;
      clearDrag();
      void reorderGroup(dragged, key, before);
      return;
    }
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
  async function addWorkspaceToGroup(key) {
    if (addingWorkspace) return;
    addingWorkspace = true;
    try {
      const path = await ctx.uiWorkspace.pickDirectory();
      if (path === null) return;
      const workspace = await ctx.workspaces.create({ path });
      collapsed.delete(key);
      writeCollapsed(collapsed);
      await persist({
        ...manual,
        assignments: { ...manual.assignments, [workspace.workspaceId]: key === DEFAULT_GROUP ? null : key }
      });
      try {
        ctx.uiWorkspace.startSession(workspace.workspaceId);
      } catch (reason) {
        showToast(reason instanceof Error ? reason.message : String(reason));
      }
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : String(reason));
    } finally {
      addingWorkspace = false;
    }
  }
  async function reorderGroup(draggedKey, targetKey, before) {
    if (draggedKey === targetKey || targetKey === DEFAULT_GROUP) return;
    const order = effectiveCategories(manual).map((entry) => entry.key).filter((key) => key !== DEFAULT_GROUP);
    const categoryOrder = before ? moveBefore(order, draggedKey, targetKey) : moveAfter(order, draggedKey, targetKey);
    try {
      await persist({ ...manual, categoryOrder });
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : String(reason));
    }
  }
  async function moveToGroup(workspaceId, key) {
    const current = resolveCategory(manual, workspaceId);
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
  function requestDeleteGroup(key) {
    openConfirmDialog("\u5220\u9664\u5206\u7EC4", `\u5220\u9664\u540E\uFF0C\u8BE5\u5206\u7EC4\u5185\u7684\u9879\u76EE\u4F1A\u79FB\u5230\u300C${DEFAULT_GROUP}\u300D\u3002`, async () => {
      await deleteGroup(key);
    });
  }
  function menuItem(label, icon, danger = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = danger ? "wvg-menu-item wvg-danger" : "wvg-menu-item";
    button.setAttribute("role", "menuitem");
    button.innerHTML = `<span class="wvg-menu-icon">${svgIcon(icon, 16)}</span><span class="wvg-menu-label"></span>`;
    const text = button.querySelector(".wvg-menu-label");
    if (text !== null) text.textContent = label;
    return button;
  }
  function openGroupMenu(key, anchor, x, y) {
    closeMenu();
    menuAnchor = anchor;
    anchor.closest(".wvg-group")?.classList.add("wvg-menu-open");
    const panel = document.createElement("div");
    panel.className = "wvg-menu";
    panel.setAttribute("role", "menu");
    panel.setAttribute("aria-label", `\u5206\u7EC4\u201C${key}\u201D\u7684\u64CD\u4F5C`);
    const addWorkspace = menuItem("\u6DFB\u52A0\u5DE5\u4F5C\u533A", "dsw-icon-project-add-outline-regular");
    addWorkspace.addEventListener("click", () => {
      closeMenu();
      void addWorkspaceToGroup(key);
    });
    panel.append(addWorkspace);
    if (key !== DEFAULT_GROUP) {
      const rename = menuItem("\u91CD\u547D\u540D\u5206\u7EC4", "dsw-icon-edit-outline-regular");
      rename.addEventListener("click", () => {
        closeMenu();
        openNameDialog("\u91CD\u547D\u540D\u5206\u7EC4", key, "\u91CD\u547D\u540D", async (name) => {
          if (name === "" || name === DEFAULT_GROUP || name === LEGACY_DEFAULT_GROUP || name === UNCATEGORIZED_LABEL) return "\u8BE5\u540D\u79F0\u4E0D\u53EF\u7528";
          if (name === key) return null;
          if (takenCategoryNames(manual).has(name)) return "\u5DF2\u5B58\u5728\u540C\u540D\u5206\u7EC4";
          await renameGroup(key, name);
          return null;
        });
      });
      const separator = document.createElement("div");
      separator.className = "wvg-menu-separator";
      separator.setAttribute("role", "separator");
      const remove = menuItem("\u5220\u9664\u5206\u7EC4", "dsw-icon-trash-outline-regular", true);
      remove.addEventListener("click", () => {
        closeMenu();
        requestDeleteGroup(key);
      });
      panel.append(rename, separator, remove);
    }
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
    panel.querySelector(".wvg-menu-item")?.focus();
  }
  function closeMenu() {
    const openHeaders = [...document.querySelectorAll(".wvg-group.wvg-menu-open")];
    if (menuPointerClose !== null) document.removeEventListener("pointerdown", menuPointerClose, true);
    if (menuKeyClose !== null) document.removeEventListener("keydown", menuKeyClose, true);
    menuPointerClose = null;
    menuKeyClose = null;
    const anchor = menuAnchor;
    menuAnchor = null;
    menu?.remove();
    menu = null;
    if (anchor?.isConnected) anchor.focus();
    openHeaders.forEach((header) => header.classList.remove("wvg-menu-open"));
  }
  async function renameGroup(from, name) {
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
    await persist({
      ...manual,
      categories: manual.categories.map((key) => key === from ? name : key),
      assignments,
      workspaceOrder,
      categoryOrder
    });
  }
  async function deleteGroup(key) {
    if (key === DEFAULT_GROUP) return;
    const assignments = { ...manual.assignments };
    for (const [workspaceId, category] of Object.entries(assignments)) {
      if (category === key) assignments[workspaceId] = null;
    }
    const workspaceOrder = { ...manual.workspaceOrder };
    delete workspaceOrder[key];
    await persist({
      ...manual,
      categories: manual.categories.filter((entry) => entry !== key),
      assignments,
      workspaceOrder,
      categoryOrder: manual.categoryOrder.filter((entry) => entry !== key)
    });
  }
  function openNameDialog(title, initial, confirmLabel, submit) {
    closeModal();
    const overlay = document.createElement("div");
    overlay.className = "wvg-overlay";
    overlay.innerHTML = `<div class="wvg-dialog" role="dialog" aria-modal="true" tabindex="-1"><div class="wvg-dialog-content"><div class="wvg-dialog-header"><h2 class="wvg-dialog-title"></h2><button type="button" class="wvg-dialog-close" aria-label="\u5173\u95ED">${svgIcon("dsw-icon-close-outline-regular", 14)}</button></div><div class="wvg-dialog-body"><input class="wvg-input" type="text" maxlength="80" aria-label="\u5206\u7EC4\u540D\u79F0" /><div class="wvg-error" role="alert"></div></div></div><div class="wvg-dialog-actions"><button type="button" class="wvg-button wvg-outline" data-wvg-cancel>\u53D6\u6D88</button><button type="button" class="wvg-button wvg-primary" data-wvg-ok></button></div></div>`;
    const dialog = overlay.querySelector(".wvg-dialog");
    dialog.setAttribute("aria-label", title);
    dialog.querySelector(".wvg-dialog-title").textContent = title;
    const input = dialog.querySelector(".wvg-input");
    input.value = initial;
    const error = dialog.querySelector(".wvg-error");
    const ok = dialog.querySelector("[data-wvg-ok]");
    ok.textContent = confirmLabel;
    let busy = false;
    const initialTrimmed = initial.trim();
    const syncOk = () => {
      if (busy) return;
      const value = input.value.trim();
      ok.disabled = value === "" || initialTrimmed !== "" && value === initialTrimmed;
    };
    syncOk();
    const close = () => closeModal();
    const confirm = async () => {
      if (busy || ok.disabled) return;
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
        syncOk();
      }
    };
    dialog.querySelector("[data-wvg-cancel]").addEventListener("click", close);
    dialog.querySelector(".wvg-dialog-close").addEventListener("click", close);
    input.addEventListener("input", syncOk);
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
    overlay.innerHTML = `<div class="wvg-dialog" role="dialog" aria-modal="true" tabindex="-1"><div class="wvg-dialog-content"><div class="wvg-dialog-header"><h2 class="wvg-dialog-title"></h2><button type="button" class="wvg-dialog-close" aria-label="\u5173\u95ED">${svgIcon("dsw-icon-close-outline-regular", 14)}</button></div><div class="wvg-dialog-body"><div class="wvg-dialog-message"></div><div class="wvg-error" role="alert"></div></div></div><div class="wvg-dialog-actions"><button type="button" class="wvg-button wvg-outline" data-wvg-cancel>\u53D6\u6D88</button><button type="button" class="wvg-button wvg-danger" data-wvg-ok>\u5220\u9664</button></div></div>`;
    const dialog = overlay.querySelector(".wvg-dialog");
    dialog.setAttribute("aria-label", title);
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
    dialog.querySelector(".wvg-dialog-close").addEventListener("click", close);
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
    window.requestAnimationFrame(() => {
      dialog.querySelector("[data-wvg-cancel]")?.focus();
    });
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
  void loadState().then((state) => {
    if (disposed) return;
    manual = state;
    viewMode = manual.mode;
    loaded = true;
    schedule();
  }).catch((reason) => {
    if (disposed) return;
    loaded = false;
    console.warn("workspace virtual groups: manual overlay unavailable:", reason);
    showToast("\u5206\u7EC4\u6570\u636E\u52A0\u8F7D\u5931\u8D25\uFF0C\u865A\u62DF\u5206\u7EC4\u5DF2\u6682\u65F6\u505C\u7528\u3002\u8BF7\u5237\u65B0\u91CD\u8BD5\u3002");
    schedule();
  });
  const OBSERVED_SELECTOR = [
    '[role="tree"]',
    '[role="menu"]',
    '[class*="viewOptionsMenu"]',
    '[class*="sectionHeader"]',
    '[class*="headerActions"]',
    "[data-wvg-new-group]",
    "[data-wvg-view-wrap]"
  ].join(",");
  const mutationRelevant = (record) => {
    if (record.target instanceof Element && record.target.closest(OBSERVED_SELECTOR) !== null) return true;
    for (const node of record.addedNodes) {
      if (node instanceof Element && (node.matches(OBSERVED_SELECTOR) || node.querySelector(OBSERVED_SELECTOR) !== null)) return true;
    }
    for (const node of record.removedNodes) {
      if (node instanceof Element && (node.matches(OBSERVED_SELECTOR) || node.querySelector(OBSERVED_SELECTOR) !== null)) return true;
    }
    return !(record.target instanceof Element);
  };
  const observer = new MutationObserver((records) => {
    if (records.some(mutationRelevant)) schedule();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("dragstart", onDocumentDragStart, true);
  document.addEventListener("dragend", onDocumentDragEnd, true);
  schedule();
  return () => {
    disposed = true;
    observer.disconnect();
    document.removeEventListener("dragstart", onDocumentDragStart, true);
    document.removeEventListener("dragend", onDocumentDragEnd, true);
    if (frame !== 0) window.cancelAnimationFrame(frame);
    window.clearTimeout(toastTimer);
    closeMenu();
    closeViewOptions();
    closeModal();
    cleanupList();
    restoreLegacyAddButton();
    removeNewGroupButtons();
    document.querySelectorAll("[data-wvg-view-wrap]").forEach((node) => node.remove());
    style.remove();
  };
}

// src/client/index.ts
var inject = ["workspaces", "uiWorkspace"];
function apply(ctx) {
  ctx.effect(
    () => mountWorkspaceVirtualGroups(ctx),
    "dsh-workspace-virtual-groups: sidebar grouping layer"
  );
}
return module.exports; } });
//# sourceMappingURL=client.js.map
