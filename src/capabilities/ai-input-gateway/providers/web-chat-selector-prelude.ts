export const WEB_CHAT_SELECTOR_SCRIPT_PRELUDE = `
const clip = (value) => String(value || "").replace(/\\s+/g, " ").trim();
const bodyText = clip(document.body?.innerText || "");
const hasProviderComposerChrome = Boolean(document.querySelector("#prompt-textarea, #composer-submit-button, #composer-plus-btn"));
if (!hasProviderComposerChrome && /captcha|verify|verification|2fa|two-factor|login|sign in|log in/i.test(bodyText)) {
  return {status: "review_required", message: "provider requires login or security verification", pageUrl: location.href};
}
const selectorFor = (el) => {
  if (!(el instanceof Element)) return null;
  const id = el.getAttribute("id");
  if (id) return "#" + CSS.escape(id);
  const testId = el.getAttribute("data-testid") || el.getAttribute("data-automation-id");
  if (testId) return "[data-testid='" + CSS.escape(testId) + "'],[data-automation-id='" + CSS.escape(testId) + "']";
  const name = el.getAttribute("name");
  if (name) return el.tagName.toLowerCase() + "[name='" + CSS.escape(name) + "']";
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return el.tagName.toLowerCase() + "[aria-label='" + CSS.escape(ariaLabel) + "']";
  const parent = el.parentElement;
  if (!parent) return el.tagName.toLowerCase();
  const sameTag = Array.from(parent.children).filter((child) => child.tagName === el.tagName);
  const index = sameTag.indexOf(el) + 1;
  return parent.tagName.toLowerCase() + " > " + el.tagName.toLowerCase() + ":nth-of-type(" + index + ")";
};
const isVisible = (node) => {
  if (!(node instanceof HTMLElement)) return false;
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
};
const resolveComposerInput = () => {
  const submit = document.querySelector("#composer-submit-button");
  const plus = document.querySelector("#composer-plus-btn");
  const anchors = [submit, plus].filter((node) => node instanceof Element);
  for (const anchor of anchors) {
    let root = anchor;
    for (let depth = 0; depth < 8 && root; depth += 1) {
      const candidate = root.querySelector?.("#prompt-textarea, textarea[name='prompt-textarea'], [contenteditable='true'][role='textbox'], textarea");
      if (candidate instanceof HTMLElement && isVisible(candidate)) return candidate;
      root = root.parentElement;
    }
  }
  const direct = document.querySelector("#prompt-textarea, textarea[name='prompt-textarea']");
  if (direct instanceof HTMLElement && isVisible(direct)) return direct;
  const visibleEditors = Array.from(document.querySelectorAll("[contenteditable='true'][role='textbox'], textarea"))
    .filter((node) => node instanceof HTMLElement && isVisible(node));
  visibleEditors.sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
  return visibleEditors[0] || null;
};
`;
