export const WORK_MODE_SELECTOR = "[role='group'][aria-label='撰写器模式'] > button:nth-of-type(2)";
export const WORK_MODE_QUERIES = Object.freeze([
  { queryId: "work", selector: WORK_MODE_SELECTOR, textEquals: "工作", maxMatches: 2, fields: ["ariaPressed" as const] },
  { queryId: "chat", selector: "[role='group'][aria-label='撰写器模式'] > button:first-of-type",
    textEquals: "聊天", maxMatches: 2, fields: ["ariaPressed" as const] },
]);
export const WORK_ROOT_QUERIES = Object.freeze([
  { queryId: "composer", selector: "form[data-chatgpt-composer] [data-composer-markdown][role='textbox']",
    maxMatches: 2, fields: ["exactEditableTextHash" as const] },
  { queryId: "user", selector: "[data-turn-key]:has([data-chatgpt-search-unit-key$=':user'])", maxMatches: 2, fields: [] },
  { queryId: "assistant", selector: "[data-turn-key]:has([data-chatgpt-search-unit-key$=':assistant'])", maxMatches: 2, fields: [] },
  { queryId: "attachments", selector: ":is(button, div[role='button']).composer-attachment-surface[aria-label]",
    scope: { selector: "form[data-chatgpt-composer]" }, maxMatches: 2, fields: [] },
  { queryId: "generating", selector: "form[data-chatgpt-composer] button[aria-label='停止']", maxMatches: 2, fields: [] },
  ...WORK_MODE_QUERIES,
]);
