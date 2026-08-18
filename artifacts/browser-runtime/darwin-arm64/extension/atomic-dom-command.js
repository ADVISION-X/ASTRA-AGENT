const commandBindings = (command) => `
const selector = ${JSON.stringify(command.selector)};
const expected = ${JSON.stringify(command.identity)};
const expectedText = ${JSON.stringify(command.kind === "click_dom_target" ? command.expectedText ?? "" : "")};
const approvedText = ${JSON.stringify(command.kind === "fill_dom_target" ? command.approvedText : "")};
const clearBeforeType = ${JSON.stringify(command.kind === "fill_dom_target" ? command.clearBeforeType : false)};
const commandKind = ${JSON.stringify(command.kind)};
`;
const identityPrimitives = `
const clip = (value) => String(value || "").replace(/\\s+/g, " ").trim().slice(0, 240);
const labelText = (el) => {
  if (el.id) {
    const label = document.querySelector("label[for='" + CSS.escape(el.id) + "']");
    if (label) return clip(label.textContent);
  }
  const parent = el.closest("label");
  return parent ? clip(parent.textContent) : "";
};
const identityOf = (el) => ({
  tagName: el.tagName.toLowerCase(),
  type: clip(el.getAttribute("type") || el.tagName.toLowerCase()) || undefined,
  role: clip(el.getAttribute("role")) || undefined,
  ariaLabel: clip(el.getAttribute("aria-label") || el.getAttribute("label")) || undefined,
  labelText: labelText(el) || undefined,
  placeholder: clip(el.getAttribute("placeholder")) || undefined,
  name: clip(el.getAttribute("name")) || undefined,
  id: clip(el.getAttribute("id")) || undefined,
  visibleText: clip((el.tagName.toLowerCase() === "input" && ["submit", "button"].includes((el.getAttribute("type") || "").toLowerCase()) ? el.value : "") || el.innerText || el.textContent || el.getAttribute("label")) || undefined,
  testId: clip(el.getAttribute("data-testid") || el.getAttribute("data-automation-id") || el.getAttribute("data-test-tag")) || undefined,
});
const matchesExpectedIdentity = (actual) => Object.entries(expected)
  .every(([key, value]) => value === undefined || actual[key] === value);
const visibleEnabled = (el) => {
  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0
    && !el.disabled && el.getAttribute("aria-disabled") !== "true";
};
`;
const exactTargetResolution = `
const parts = selector.split(">>>").map((part) => part.trim()).filter(Boolean);
let matches = [];
if (parts.length === 1) matches = Array.from(document.querySelectorAll(parts[0]));
if (parts.length === 2) {
  const hosts = Array.from(document.querySelectorAll(parts[0]));
  if (hosts.length === 1 && hosts[0].shadowRoot) matches = Array.from(hosts[0].shadowRoot.querySelectorAll(parts[1]));
}
if (matches.length === 0) throw new Error("TARGET_NOT_FOUND:atomic DOM selector did not resolve");
if (matches.length !== 1) throw new Error("TARGET_AMBIGUOUS:atomic DOM selector resolved multiple elements");
const host = matches[0];
if (!matchesExpectedIdentity(identityOf(host))) throw new Error("TARGET_IDENTITY_CHANGED:atomic DOM identity no longer matches");
if (!visibleEnabled(host)) throw new Error("TARGET_NOT_INTERACTABLE:atomic DOM target is hidden or disabled");
`;
const exactClickMutation = `
if (commandKind === "click_dom_target") {
  const text = clip(host.innerText || host.textContent || host.getAttribute("aria-label") || host.getAttribute("label") || host.value);
  if (expectedText && !text.toLowerCase().includes(expectedText.toLowerCase())) throw new Error("TARGET_IDENTITY_CHANGED:atomic DOM text no longer matches");
  host.focus();
  host.click();
  return { ok: true, action: "click", tagName: host.tagName.toLowerCase() };
}
`;
const exactFillReceiver = `
const editors = host.shadowRoot
  ? Array.from(host.shadowRoot.querySelectorAll("input, textarea, [contenteditable='true']")).filter(visibleEnabled)
  : [host].filter(visibleEnabled);
if (editors.length !== 1) throw new Error("TARGET_AMBIGUOUS:atomic DOM fill requires one editable receiver");
const editor = editors[0];
const password = (editor.getAttribute("type") || "").toLowerCase() === "password";
const editable = editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement || editor.isContentEditable;
if (password || !editable) throw new Error("TARGET_NOT_INTERACTABLE:atomic DOM fill receiver is forbidden or not editable");
`;
const fillValue = `const valueOf = (node) => node.isContentEditable ? String(node.textContent || "") : String(node.value || "");`;
const fillFocusCheck = `
const activeEditor = host.shadowRoot ? host.shadowRoot.activeElement : document.activeElement;
if (activeEditor !== editor) throw new Error("TARGET_IDENTITY_CHANGED:atomic DOM fill receiver lost focus");
`;
export const atomicDomExpression = (command) => `(() => {
${commandBindings(command)}
${identityPrimitives}
${exactTargetResolution}
${exactClickMutation}
throw new Error("BROWSER_COMMAND_FAILED:fill_dom_target requires the governed keyboard lifecycle");
})()`;
export const atomicDomFillPreparationExpression = (command, marker) => `(() => {
${commandBindings(command)}
${identityPrimitives}
${exactTargetResolution}
${exactFillReceiver}
${fillValue}
editor.focus();
if (editor.isContentEditable) {
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(!clearBeforeType);
  selection?.removeAllRanges();
  selection?.addRange(range);
} else if (clearBeforeType) {
  editor.select();
} else {
  editor.setSelectionRange(editor.value.length, editor.value.length);
}
Object.defineProperty(editor, "__grasseyeAtomicFillMarker__", {
  value: ${JSON.stringify(marker)}, configurable: true, enumerable: false, writable: false,
});
${fillFocusCheck}
return { ok: true, initialValue: valueOf(editor) };
})()`;
export const atomicDomFillVerificationExpression = (command, marker, expectedValue, requireAcceptedState) => `(() => {
${commandBindings(command)}
${identityPrimitives}
${exactTargetResolution}
${exactFillReceiver}
${fillValue}
if (editor.__grasseyeAtomicFillMarker__ !== ${JSON.stringify(marker)}) {
  throw new Error("TARGET_IDENTITY_CHANGED:atomic DOM fill receiver object changed");
}
${fillFocusCheck}
const actual = valueOf(editor);
if (actual !== ${JSON.stringify(expectedValue)}) {
  throw new Error("TARGET_VALUE_MISMATCH:atomic DOM fill did not retain exact approved text");
}
if (${JSON.stringify(requireAcceptedState)}) {
  const rejected = [host, editor].some((node) => {
    const state = String(node.getAttribute("state") || "").toLowerCase();
    const invalid = node.getAttribute("aria-invalid") === "true";
    const errorClass = Array.from(node.classList).some((name) => name.toLowerCase() === "error");
    return state === "error" || invalid || errorClass;
  });
  if (rejected) throw new Error("TARGET_COMPONENT_REJECTED:atomic DOM fill was not accepted by the component");
  delete editor.__grasseyeAtomicFillMarker__;
}
return { ok: true, action: "fill", valueLength: actual.length };
})()`;
export const runAtomicDomFillKeyboardCommand = async (command, marker, driver) => {
    const prepared = await driver.evaluate(atomicDomFillPreparationExpression(command, marker));
    let expectedValue = prepared.initialValue;
    if (command.clearBeforeType) {
        await driver.pressBackspace();
        expectedValue = "";
        await driver.evaluate(atomicDomFillVerificationExpression(command, marker, expectedValue, false));
    }
    for (const character of command.approvedText) {
        await driver.evaluate(atomicDomFillVerificationExpression(command, marker, expectedValue, false));
        await driver.typeCharacter(character);
        expectedValue += character;
        await driver.evaluate(atomicDomFillVerificationExpression(command, marker, expectedValue, false));
    }
    await driver.evaluate(atomicDomFillVerificationExpression(command, marker, expectedValue, true));
};
