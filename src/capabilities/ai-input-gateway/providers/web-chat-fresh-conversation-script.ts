import { WEB_CHAT_SELECTOR_SCRIPT_PRELUDE } from "./web-chat-selector-prelude.js";

export const CHATGPT_FRESH_CONVERSATION_SCRIPT = `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
const composer = resolveComposerInput();
const assistantCount = document.querySelectorAll('[data-message-author-role="assistant"]').length;
const pageUrl = new URL(location.href);
const isFreshPath = pageUrl.host === "chatgpt.com" && (pageUrl.pathname === "/" || pageUrl.pathname === "");
const isFreshConversation = Boolean(composer) && isFreshPath && assistantCount === 0;
return {
  status: isFreshConversation ? "success" : "pending",
  message: isFreshConversation
    ? "ChatGPT fresh conversation established"
    : "ChatGPT fresh conversation pending",
  pageUrl: location.href,
  assistantCount,
  isFreshPath,
  composerReady: Boolean(composer),
};
`;
