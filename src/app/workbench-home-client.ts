import { WORKBENCH_HOME_SKILL_MAP_CLIENT } from "./workbench-home-skill-map-client.js";

const WORKBENCH_HOME_CLIENT = `
const state = { skill: "xuanxue-ai-production" };

${WORKBENCH_HOME_SKILL_MAP_CLIENT}
const qs = (selector) => document.querySelector(selector);
const setText = (selector, value) => {
  const node = qs(selector);
  if (node) node.textContent = value ?? "-";
};
const setRegionState = (stateName) => {
  setText("[data-runtime-console-state]", stateName || "ready");
};
const clearRuntimeEmptyState = () => {
  qs("[data-runtime-empty-state]")?.remove();
};
const writeActivity = (message, tone = "ready") => {
  const list = qs("[data-activity-log]");
  if (!list) return;
  clearRuntimeEmptyState();
  const node = document.createElement("button");
  node.type = "button";
  node.className = "runtime-event " + tone + "-state";
  node.dataset.runtimeEvent = tone;
  node.textContent = new Date().toLocaleTimeString() + " " + message;
  node.addEventListener("click", () => openInspector({
    kind: "runtime event",
    title: tone,
    payload: { Message: message, Status: tone, Time: new Date().toISOString() },
  }));
  list.prepend(node);
  setRegionState(tone);
};
const readJson = async (url, options) => {
  const response = await fetch(url, options);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(payload.failureReason || payload.error || response.statusText);
  return payload;
};
const renderInspectorValue = (value) => {
  if (Array.isArray(value)) {
    const list = document.createElement("ul");
    list.className = "inspector-list";
    for (const entry of value.length > 0 ? value : ["not_available"]) {
      const item = document.createElement("li");
      item.textContent = String(entry);
      list.append(item);
    }
    return list;
  }
  const span = document.createElement("span");
  span.textContent = value === undefined || value === null || value === ""
    ? "not_available"
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
  return span;
};
const openInspector = ({ kind, title, payload }) => {
  document.body.classList.remove("inspector-collapsed");
  setText("[data-inspector-title]", title || "Detail");
  setText("[data-inspector-kind]", kind || "detail");
  const body = qs("[data-inspector-body]");
  if (!body) return;
  body.innerHTML = "";
  const section = document.createElement("section");
  section.className = "detail-section";
  const heading = document.createElement("h3");
  heading.textContent = title || "Detail";
  const grid = document.createElement("div");
  grid.className = "detail-grid inspector-detail-grid";
  const entries = payload && typeof payload === "object" && !Array.isArray(payload)
    ? Object.entries(payload)
    : [["Value", payload]];
  for (const [key, value] of entries) {
    const row = document.createElement("div");
    const label = document.createElement("b");
    label.textContent = key;
    row.append(label, renderInspectorValue(value));
    grid.append(row);
  }
  section.append(heading, grid);
  body.replaceChildren(section);
};
const resetInspector = () => {
  document.body.classList.add("inspector-collapsed");
  setText("[data-inspector-title]", "No selection");
  setText("[data-inspector-kind]", "empty");
};
const showSkill = (skill) => {
  state.skill = skill;
  document.body.dataset.activeSkill = skill;
  setText("[data-current-skill]", skillLabels[skill] || skill);
  resetInspector();
  document.querySelectorAll("[data-skill-id]").forEach((item) => {
    item.setAttribute("aria-pressed", String(item.dataset.skillId === skill));
  });
  document.querySelectorAll("[data-skill-workspace]").forEach((workspace) => {
    workspace.classList.toggle("hidden", workspace.dataset.skillWorkspace !== skill);
  });
};
const refreshShell = async () => {
  try {
    const [health, mode] = await Promise.all([readJson("/api/health"), readJson("/api/mode")]);
    setText("[data-health-status]", health.status || "ready");
    setText("[data-mode-status]", mode.mode?.platformTarget || mode.mode?.mode || "local");
    writeActivity("shell refreshed", "completed");
  } catch (error) {
    writeActivity("shell refresh failed: " + error.message, "failed");
  }
};
const openBrowserPairing = async () => {
  try {
    const pairing = await readJson("/api/browser-authority/pairing", { cache: "no-store" });
    if (pairing.authority === "present") {
      openInspector({
        kind: "browser authority",
        title: "浏览器扩展已经完成认证",
        payload: { "下一步": "切换到目标 HTTPS 标签页并在扩展中认领当前标签页。" },
      });
      return;
    }
    if (typeof pairing.pairingSecret !== "string" || !/^[a-f0-9]{64}$/.test(pairing.pairingSecret)) {
      throw new Error("BROWSER_PAIRING_SECRET_UNAVAILABLE");
    }
    await navigator.clipboard.writeText(pairing.pairingSecret);
    openInspector({
      kind: "browser authority",
      title: "一次性配对密钥已复制",
      payload: {
        "第 1 步": "打开 GrassEye Browser Authority 扩展。",
        "第 2 步": "粘贴密钥并完成配对。",
        "第 3 步": "切换到目标 HTTPS 标签页并认领。",
      },
    });
  } catch (error) {
    writeActivity("browser pairing preparation failed: " + error.message, "failed");
  }
};
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-skill-id]").forEach((item) => {
    item.addEventListener("click", () => showSkill(item.dataset.skillId));
  });
  qs("[data-sidebar-toggle]")?.addEventListener("click", () => document.body.classList.toggle("sidebar-collapsed"));
  qs("[data-inspector-toggle]")?.addEventListener("click", () => document.body.classList.toggle("inspector-collapsed"));
  qs("[data-refresh-shell]")?.addEventListener("click", refreshShell);
  qs("[data-browser-pairing]")?.addEventListener("click", openBrowserPairing);
  showSkill("xuanxue-ai-production");
  refreshShell();
});
`;

export const renderWorkbenchHomeClient = (): string => WORKBENCH_HOME_CLIENT;
