import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import { DomSnapshotSchema, ReadDomSnapshotInputSchema } from "../schema.js";
import type { DomSnapshot, ReadDomSnapshotInput } from "../schema.js";

function buildSnapshotScript(maxTextLengthPerNode: number, includeFrames: boolean): string {
  return `
const limit = ${maxTextLengthPerNode};
const clip = (value) => String(value || "").replace(/\\s+/g, " ").trim().slice(0, limit);
const attr = (el, name) => clip(el.getAttribute(name) || "");
const isHidden = (el) => {
  const style = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return style.display === "none" || style.visibility === "hidden" || rect.width === 0 || rect.height === 0;
};
const selectorFor = (el) => {
  const testId = el.getAttribute("data-testid") || el.getAttribute("data-automation-id");
  if (testId) return "[data-testid='" + CSS.escape(testId) + "'],[data-automation-id='" + CSS.escape(testId) + "']";
  if (el.id) return "#" + CSS.escape(el.id);
  const name = el.getAttribute("name");
  if (name) return el.tagName.toLowerCase() + "[name='" + CSS.escape(name) + "']";
  const role = el.getAttribute("role");
  if (role) return el.tagName.toLowerCase() + "[role='" + CSS.escape(role) + "']";
  const parent = el.parentElement;
  if (!parent) return el.tagName.toLowerCase();
  const sameTag = Array.from(parent.children).filter((child) => child.tagName === el.tagName);
  const index = sameTag.indexOf(el) + 1;
  const parentSelector = parent.id ? "#" + CSS.escape(parent.id) : parent.tagName.toLowerCase();
  return parentSelector + " > " + el.tagName.toLowerCase() + ":nth-of-type(" + index + ")";
};
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
const base = (el) => ({
  tagName: el.tagName.toLowerCase(),
  type: attr(el, "type") || undefined,
  role: attr(el, "role") || undefined,
  ariaLabel: attr(el, "aria-label") || undefined,
  labelText: labelText(el) || undefined,
  placeholder: attr(el, "placeholder") || undefined,
  name: attr(el, "name") || undefined,
  id: attr(el, "id") || undefined,
  visibleText: clip(el.innerText || el.textContent) || undefined,
  nearbyText: nearbyText(el) || undefined,
  disabled: Boolean(el.disabled || el.getAttribute("aria-disabled") === "true"),
  hidden: isHidden(el),
  selectorCandidate: selectorFor(el),
  formId: el.form?.id || undefined,
  testId: attr(el, "data-testid") || attr(el, "data-automation-id") || undefined
});
const visible = (item) => !item.hidden;
const inputs = Array.from(document.querySelectorAll("input, textarea, select"))
  .map((el) => ({...base(el), type: (attr(el, "type") || el.tagName.toLowerCase()), valuePreview: el.type === "password" || el.type === "hidden" ? undefined : clip(el.value)}))
  .filter((item) => item.type !== "hidden").filter(visible);
const buttons = Array.from(document.querySelectorAll("button, [role='button'], input[type='button'], input[type='submit']"))
  .map(base).filter(visible);
const links = Array.from(document.querySelectorAll("a[href]")).map((el) => {
  let hrefHost;
  try { hrefHost = new URL(el.href).host || undefined; } catch {}
  return {...base(el), hrefHost};
}).filter(visible);
const fileInputs = Array.from(document.querySelectorAll("input[type='file']")).map((el) => ({...base(el), type: "file", accept: attr(el, "accept") || undefined})).filter(visible);
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
const summarizeCandidates = (selector, candidateKind, maxCount) => Array.from(document.querySelectorAll(selector))
  .map((el) => ({...base(el), candidateKind}))
  .filter((item) => !item.hidden && Boolean(item.visibleText || item.ariaLabel || item.nearbyText))
  .slice(0, maxCount);
const tableRows = summarizeCandidates("tr", "table-row", 80);
const roleRows = summarizeCandidates("[role='row']", "role-row", 80);
const genericClickableElements = summarizeCandidates("[onclick], [tabindex], [role='button'], [role='link']", "clickable", 80);
const textBlocks = summarizeCandidates("td, th, div, span, p, li", "text-block", 120);
const pageText = clip(document.body?.innerText || "");
const detectedStates = [];
if (/sign\\s*in|log\\s*in|password|session expired/i.test(pageText)) detectedStates.push("login_required");
if (/captcha|verification code|two[- ]?factor|2fa|otp/i.test(pageText)) detectedStates.push("captcha_or_2fa_required");
if (/file attached|invoice attached|attachment added/i.test(pageText)) detectedStates.push("file_attached");
if (/invoice uploaded successfully|upload completed|submitted successfully/i.test(pageText)) detectedStates.push("upload_success");
return {url: location.href, title: document.title, forms, inputs, buttons, links, fileInputs, dialogs, frames, textBlocks, tableRows, roleRows, genericClickableElements, detectedStates: Array.from(new Set(detectedStates)), capturedAt: new Date().toISOString()};
`;
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
