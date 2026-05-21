import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import { DomSnapshotSchema, ReadDomSnapshotInputSchema } from "../schema.js";
import type { DomSnapshot, ReadDomSnapshotInput } from "../schema.js";

function buildSnapshotScriptTextPrimitives(maxTextLengthPerNode: number): string {
  return `
const limit = ${maxTextLengthPerNode};
const clip = (value) => String(value || "").replace(/\\s+/g, " ").trim().slice(0, limit);
const attr = (el, name) => clip(el.getAttribute(name) || "");
const isHidden = (el) => {
  const style = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return style.display === "none" || style.visibility === "hidden" || rect.width === 0 || rect.height === 0;
};
`;
}

function buildSnapshotScriptSelectorPrimitive(): string {
  return `
const selectorFor = (el) => {
  const testId = el.getAttribute("data-testid") || el.getAttribute("data-automation-id");
  if (testId) return "[data-testid='" + CSS.escape(testId) + "'],[data-automation-id='" + CSS.escape(testId) + "']";
  if (el.id) return "#" + CSS.escape(el.id);
  const type = (el.getAttribute("type") || "").toLowerCase();
  const value = el.getAttribute("value");
  if (el.tagName.toLowerCase() === "input" && (type === "submit" || type === "button") && value) {
    return "input[type='" + CSS.escape(type) + "'][value='" + CSS.escape(value) + "']";
  }
  const name = el.getAttribute("name");
  if (name) return el.tagName.toLowerCase() + "[name='" + CSS.escape(name) + "']";
  const role = el.getAttribute("role");
  if (role) return el.tagName.toLowerCase() + "[role='" + CSS.escape(role) + "']";
  const componentLabel = el.getAttribute("label");
  if (componentLabel && el.tagName.toLowerCase().includes("-")) {
    return el.tagName.toLowerCase() + "[label='" + CSS.escape(componentLabel) + "']";
  }
  const parent = el.parentElement;
  if (!parent) return el.tagName.toLowerCase();
  const sameTag = Array.from(parent.children).filter((child) => child.tagName === el.tagName);
  const index = sameTag.indexOf(el) + 1;
  const parentSelector = parent.id ? "#" + CSS.escape(parent.id) : parent.tagName.toLowerCase();
  return parentSelector + " > " + el.tagName.toLowerCase() + ":nth-of-type(" + index + ")";
};
`;
}

function buildSnapshotScriptLabelPrimitives(): string {
  return `
const labelText = (el) => {
  if (el.id) {
    const label = document.querySelector("label[for='" + CSS.escape(el.id) + "']");
    if (label) return clip(label.textContent);
  }
  const parent = el.closest("label");
  if (parent) return clip(parent.textContent);
  return "";
};
const nearbyText = (el) => clip([el.previousElementSibling?.textContent, el.parentElement?.textContent].filter(Boolean).join(" "));
`;
}

function buildSnapshotScriptPrimitives(maxTextLengthPerNode: number): string {
  return [
    buildSnapshotScriptTextPrimitives(maxTextLengthPerNode),
    buildSnapshotScriptSelectorPrimitive(),
    buildSnapshotScriptLabelPrimitives(),
  ].join("");
}

function buildSnapshotScriptBaseSection(): string {
  return `
const base = (el) => ({
  tagName: el.tagName.toLowerCase(),
  type: attr(el, "type") || undefined,
  role: attr(el, "role") || undefined,
  ariaLabel: attr(el, "aria-label") || attr(el, "label") || undefined,
  labelText: labelText(el) || undefined,
  placeholder: attr(el, "placeholder") || undefined,
  name: attr(el, "name") || undefined,
  id: attr(el, "id") || undefined,
  visibleText: clip((el.tagName.toLowerCase() === "input" && (attr(el, "type") === "submit" || attr(el, "type") === "button") ? el.value : "") || el.innerText || el.textContent || attr(el, "label")) || undefined,
  nearbyText: nearbyText(el) || undefined,
  disabled: Boolean(el.disabled || el.getAttribute("aria-disabled") === "true"),
  hidden: isHidden(el),
  selectorCandidate: selectorFor(el),
  formId: el.form?.id || undefined,
  testId: attr(el, "data-testid") || attr(el, "data-automation-id") || undefined
});
const visible = (item) => !item.hidden;
`;
}

function buildSnapshotScriptCollections(includeFrames: boolean): string {
  return `
const inputs = Array.from(document.querySelectorAll("input, textarea, select, kat-input"))
  .map((el) => ({...base(el), type: (attr(el, "type") || el.tagName.toLowerCase()), valuePreview: el.type === "password" || el.type === "hidden" ? undefined : clip(el.value)}))
  .filter((item) => item.type !== "hidden").filter(visible);
const buttons = Array.from(document.querySelectorAll("button, kat-button, [role='button'], input[type='button'], input[type='submit']"))
  .map(base).filter(visible);
const links = Array.from(document.querySelectorAll("a[href]")).map((el) => {
  let hrefHost;
  try { hrefHost = new URL(el.href).host || undefined; } catch {}
  return {...base(el), hrefHost};
}).filter(visible);
const fileInputs = Array.from(document.querySelectorAll("input[type='file']")).map((el) => ({...base(el), type: "file", accept: attr(el, "accept") || undefined}));
const summarizeCandidates = (selector, candidateKind, maxCount) => Array.from(document.querySelectorAll(selector))
  .map((el) => ({...base(el), candidateKind}))
  .filter((item) => !item.hidden && Boolean(item.visibleText || item.ariaLabel || item.nearbyText))
  .slice(0, maxCount);
const dropdownTriggers = summarizeCandidates("[role='combobox'], [aria-haspopup='listbox'], [aria-expanded], .ant-select-selector, .el-select__input, .arco-select-view, .select2-selection, select", "dropdown-trigger", 80);
const overlays = summarizeCandidates("dialog, [role='dialog'], [aria-modal='true'], [class*='modal'], [class*='drawer'], [class*='cookie'], [class*='consent'], [class*='banner']", "overlay", 40);
const loadingIndicators = summarizeCandidates("[aria-busy='true'], [class*='skeleton'], [class*='spinner'], [class*='loading'], [role='progressbar']", "loading-indicator", 40);
const stickyElements = Array.from(document.querySelectorAll("header, nav, [style*='position: fixed'], [style*='position: sticky']"))
  .map((el) => ({...base(el), candidateKind: "sticky-element"}))
  .filter((item) => !item.hidden)
  .slice(0, 40);
const forms = Array.from(document.querySelectorAll("form")).map((el) => ({
  selectorCandidate: selectorFor(el),
  id: attr(el, "id") || undefined,
  name: attr(el, "name") || undefined,
  labelText: clip(el.getAttribute("aria-label") || el.querySelector("legend")?.textContent || "") || undefined,
  inputCount: el.querySelectorAll("input, textarea, select").length,
  buttonCount: el.querySelectorAll("button, [role='button'], input[type='submit']").length
}));
const dialogs = Array.from(document.querySelectorAll("dialog, [role='dialog'], [aria-modal='true']")).map(base).filter(visible);
const frames = ${includeFrames ? "Array.from(document.querySelectorAll('iframe, frame')).map((el) => { let srcHost; try { srcHost = new URL(el.src).host || undefined; } catch {} return {selectorCandidate: selectorFor(el), title: attr(el, 'title') || undefined, name: attr(el, 'name') || undefined, srcHost}; })" : "[]"};
const tableRows = summarizeCandidates("tr", "table-row", 80);
const roleRows = summarizeCandidates("[role='row']", "role-row", 80);
const genericClickableElements = summarizeCandidates("[onclick], [tabindex], [role='button'], [role='link']", "clickable", 80);
const textBlocks = summarizeCandidates("td, th, div, span, p, li", "text-block", 120);
`;
}

function buildSnapshotScriptResultSection(): string {
  return `
const rawPageText = String(document.body?.innerText || "").replace(/\\s+/g, " ").trim();
const pageText = clip(rawPageText);
const detectedStates = [];
if (/sign\\s*in|log\\s*in|password|session expired/i.test(rawPageText)) detectedStates.push("login_required");
if (/captcha|verification code|two[- ]?factor|2fa|otp/i.test(rawPageText)) detectedStates.push("captcha_or_2fa_required");
if (/file attached|attachment added|file selected/i.test(rawPageText)) detectedStates.push("file_selected");
if (/success|successful|completed|submitted|saved|done|完成|成功|已提交/i.test(rawPageText)) detectedStates.push("success_message");
if (/failed|invalid|error|unable|cannot|失败|无效|错误|无法/i.test(rawPageText)) detectedStates.push("error_message");
if (overlays.some((item) => /cookie|consent|gdpr|同意|隐私/i.test([item.visibleText, item.ariaLabel, item.nearbyText].filter(Boolean).join(" ")))) detectedStates.push("cookie-consent-overlay");
if (overlays.some((item) => /promo|offer|subscribe|discount|营销|优惠/i.test([item.visibleText, item.ariaLabel, item.nearbyText].filter(Boolean).join(" ")))) detectedStates.push("promotional-overlay");
if (dialogs.length > 0) detectedStates.push("modal-dialog");
if (overlays.some((item) => /drawer|side-panel|侧边/i.test([item.visibleText, item.ariaLabel, item.nearbyText].filter(Boolean).join(" ")))) detectedStates.push("drawer-panel");
if (loadingIndicators.length > 0 || /loading|加载中/i.test(rawPageText)) detectedStates.push("loading-skeleton");
if (/no data|empty|暂无|无数据/i.test(rawPageText)) detectedStates.push("empty-state");
if (/rate limit|too many requests|限流/i.test(rawPageText)) detectedStates.push("rate-limited");
return {url: location.href, title: document.title, forms, inputs, buttons, links, fileInputs, dialogs, frames, textBlocks, tableRows, roleRows, genericClickableElements, dropdownTriggers, overlays, loadingIndicators, stickyElements, detectedStates: Array.from(new Set(detectedStates)), capturedAt: new Date().toISOString()};
`;
}

function buildSnapshotScript(maxTextLengthPerNode: number, includeFrames: boolean): string {
  return [
    buildSnapshotScriptPrimitives(maxTextLengthPerNode),
    buildSnapshotScriptBaseSection(),
    buildSnapshotScriptCollections(includeFrames),
    buildSnapshotScriptResultSection(),
  ].join("");
}

export async function readDomSnapshotOnce(
  browser: BrowserController,
  input: ReadDomSnapshotInput = {},
): Promise<DomSnapshot> {
  const parsed = ReadDomSnapshotInputSchema.parse(input);
  const raw = await browser.evaluateActiveTab<unknown>({
    description: "read governed DOM structural summary from active tab",
    script: buildSnapshotScript(parsed.maxTextLengthPerNode, parsed.includeFrames),
  });
  return DomSnapshotSchema.parse(raw);
}
