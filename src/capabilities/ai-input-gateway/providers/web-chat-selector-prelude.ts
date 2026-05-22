export const WEB_CHAT_SELECTOR_SCRIPT_PRELUDE = `
const clip = (value) => String(value || "").replace(/\\s+/g, " ").trim();
const bodyText = clip(document.body?.innerText || "");
const hasProviderComposerChrome = Boolean(document.querySelector("div#prompt-textarea[contenteditable='true'][role='textbox'], #composer-submit-button, #composer-plus-btn"));
if (!hasProviderComposerChrome && /captcha|verify|verification|2fa|two-factor|login|sign in|log in/i.test(bodyText)) {
  return {status: "review_required", message: "provider requires login or security verification", pageUrl: location.href};
}
const selectorFor = (el) => {
  if (!(el instanceof Element)) return null;
  const id = el.getAttribute("id");
  if (id) return "#" + CSS.escape(id);
  const name = el.getAttribute("name");
  if (name) return el.tagName.toLowerCase() + "[name='" + CSS.escape(name) + "']";
  return null;
};
const isVisible = (node) => {
  if (!(node instanceof HTMLElement)) return false;
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
};
const resolveComposerInput = () => {
  const chatGptComposer = document.querySelector("div#prompt-textarea[contenteditable='true'][role='textbox']");
  if (chatGptComposer instanceof HTMLElement && chatGptComposer.isContentEditable && isVisible(chatGptComposer)) {
    return chatGptComposer;
  }
  const geminiComposer = document.querySelector("rich-textarea div[contenteditable='true'][role='textbox'], div.ql-editor[contenteditable='true'][role='textbox']");
  if (geminiComposer instanceof HTMLElement && geminiComposer.isContentEditable && isVisible(geminiComposer)) {
    return geminiComposer;
  }
  return null;
};
`;
