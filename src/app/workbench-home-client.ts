import { WORKBENCH_HOME_SKILL_MAP_CLIENT } from "./workbench-home-skill-map-client.js";

const WORKBENCH_HOME_CLIENT = `
${WORKBENCH_HOME_SKILL_MAP_CLIENT}
const qs = (selector) => document.querySelector(selector);
const setText = (selector, value) => { const node = qs(selector); if (node) node.textContent = value ?? "-"; };
const readJson = async (url, options) => {
  const response = await fetch(url, options);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(payload.failureReason || payload.error || response.statusText);
  return payload;
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
  for (const [key, value] of Object.entries(payload && typeof payload === "object" ? payload : { Value: payload })) {
    const row = document.createElement("div");
    const label = document.createElement("b");
    const text = document.createElement("span");
    label.textContent = key;
    text.textContent = value && typeof value === "object" ? JSON.stringify(value, null, 2) : String(value ?? "-");
    row.append(label, text);
    grid.append(row);
  }
  section.append(heading, grid);
  body.append(section);
};
const writeActivity = (message, tone = "ready") => {
  const list = qs("[data-activity-log]");
  if (!list) return;
  const node = document.createElement("button");
  node.type = "button";
  node.className = "runtime-event " + tone + "-state";
  node.textContent = new Date().toLocaleTimeString() + " " + message;
  list.prepend(node);
  setText("[data-runtime-console-state]", tone);
};
const showSkill = (skill) => {
  document.body.dataset.activeSkill = skill;
  setText("[data-current-skill]", skillLabels[skill] || skill);
  document.querySelectorAll("[data-skill-id]").forEach((item) => item.setAttribute("aria-pressed", String(item.dataset.skillId === skill)));
  document.querySelectorAll("[data-skill-workspace]").forEach((workspace) => workspace.classList.toggle("hidden", workspace.dataset.skillWorkspace !== skill));
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
      openInspector({ kind: "browser authority", title: "浏览器扩展已经完成认证", payload: { "下一步": "认领需要用于玄学 AI 的 HTTPS 标签页。" } });
      return;
    }
    if (typeof pairing.pairingSecret !== "string") throw new Error("BROWSER_PAIRING_SECRET_UNAVAILABLE");
    await navigator.clipboard.writeText(pairing.pairingSecret);
    openInspector({ kind: "browser authority", title: "一次性配对密钥已复制", payload: { "一次性配对密钥": pairing.pairingSecret } });
  } catch (error) {
    writeActivity("browser pairing preparation failed: " + error.message, "failed");
  }
};
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-skill-id]").forEach((item) => item.addEventListener("click", () => showSkill(item.dataset.skillId)));
  document.querySelectorAll("[data-sidebar-toggle]").forEach((item) => item.addEventListener("click", () => document.body.classList.toggle("sidebar-collapsed")));
  qs("[data-inspector-toggle]")?.addEventListener("click", () => document.body.classList.toggle("inspector-collapsed"));
  qs("[data-console-toggle]")?.addEventListener("click", () => document.body.classList.toggle("console-collapsed"));
  qs("[data-refresh-shell]")?.addEventListener("click", refreshShell);
  qs("[data-browser-pairing]")?.addEventListener("click", openBrowserPairing);
  showSkill("xuanxue-ai-production");
  refreshShell();
});
`;

export const renderWorkbenchHomeClient = (): string => WORKBENCH_HOME_CLIENT;
