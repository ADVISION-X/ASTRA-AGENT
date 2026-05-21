import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import { DOM_SCHEMAS } from "../schema.js";
import type { DomActionResult } from "../../../types/dom-automation.js";
import type { SelectOptionInput } from "../../../types/dom-automation-inputs.js";
import {
  buildDomActionOutcome,
  buildDomFailureResult,
  buildDomReviewRequiredResult,
} from "./dom-action-result.js";
import { captureDomEvidenceRef } from "./dom-evidence.js";

type SelectCheck = Pick<DomActionResult, "status" | "message">;

const buildSelectScript = (input: SelectOptionInput): string => `
const selector = ${JSON.stringify(input.elementRef.selector)};
const optionText = ${JSON.stringify(input.approvedOptionText)};
const matchMode = ${JSON.stringify(input.matchMode)};
const matches = Array.from(document.querySelectorAll(selector));
if (matches.length === 0) return {status: "not_found", message: "select target not found"};
if (matches.length > 1) return {status: "ambiguous", message: "selector matched multiple select targets"};
const target = matches[0];
const norm = (value) => String(value || "").replace(/\\s+/g, " ").trim().toLowerCase();
const optionMatches = (value) => matchMode === "exact" ? norm(value) === norm(optionText) : norm(value).includes(norm(optionText));
if (target.tagName.toLowerCase() === "select") {
  const options = Array.from(target.options);
  const found = options.filter((option) => optionMatches(option.textContent) || optionMatches(option.value));
  if (found.length === 0) return {status: "not_found", message: "approved option was not found"};
  if (found.length > 1 && !found.some((option) => norm(option.textContent) === norm(optionText))) {
    return {status: "ambiguous", message: "approved option matched multiple native options"};
  }
  const selected = found.find((option) => norm(option.textContent) === norm(optionText)) || found[0];
  target.value = selected.value;
  target.dispatchEvent(new Event("input", {bubbles: true}));
  target.dispatchEvent(new Event("change", {bubbles: true}));
  const reflected = Array.from(target.selectedOptions).some((option) => optionMatches(option.textContent) || optionMatches(option.value));
  return reflected ? {status: "success", message: "native select option verified"} : {status: "failed", message: "selection-not-reflected"};
}
target.click();
await new Promise((resolve) => setTimeout(resolve, 120));
const optionSelector = "[role='option'], option, li, [class*='option'], [class*='select-item'], [class*='dropdown-item']";
const options = Array.from(document.querySelectorAll(optionSelector)).filter((el) => {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && optionMatches(el.innerText || el.textContent || el.getAttribute("aria-label"));
});
if (options.length === 0) return {status: "not_found", message: "approved option was not found in custom dropdown"};
if (options.length > 1 && matchMode === "contains") return {status: "ambiguous", message: "approved option matched multiple custom dropdown options"};
options[0].click();
await new Promise((resolve) => setTimeout(resolve, 150));
const reflectedText = norm(target.innerText || target.textContent || target.value || target.getAttribute("aria-label"));
return reflectedText.includes(norm(optionText))
  ? {status: "success", message: "custom dropdown selection verified"}
  : {status: "failed", message: "selection-not-reflected"};
`;

export async function selectOptionOnce(
  browser: BrowserController,
  rawInput: SelectOptionInput,
): Promise<DomActionResult> {
  const input = DOM_SCHEMAS.SelectOptionInput.parse(rawInput) as SelectOptionInput;
  const allowedKinds = new Set(["select", "combobox", "dropdown-trigger"]);
  if (!allowedKinds.has(input.elementRef.targetKind)) {
    return buildDomReviewRequiredResult("select target kind is not selectable", "DOM select requires select, combobox, or dropdown-trigger.");
  }
  if (input.approvedOptionList && !input.approvedOptionList.includes(input.approvedOptionText)) {
    return buildDomReviewRequiredResult("approved option is outside approvedOptionList", "DOM select refuses unapproved option text.");
  }
  const beforeEvidenceRef = await captureDomEvidenceRef(browser, "dom-select-before");
  if (!beforeEvidenceRef) return buildDomReviewRequiredResult("before-select evidence capture failed", "DOM select requires before evidence.");
  const result = await browser.evaluateActiveTab<SelectCheck>({
    description: `select approved option for ${input.selectPurpose}`,
    script: `(async () => {${buildSelectScript(input)}})()`,
  });
  const afterEvidenceRef = await captureDomEvidenceRef(browser, "dom-select-after");
  if (!afterEvidenceRef) return buildDomFailureResult("after-select evidence capture failed", { beforeEvidenceRef });
  return buildDomActionOutcome(result, beforeEvidenceRef, afterEvidenceRef);
}
