export const GPT_COMPOSER_FORM_SELECTOR = "form:has(#prompt-textarea)";
export const GPT_ATTACHMENT_ITEM_SELECTOR = "[role='group'][aria-label]";
export const GPT_ATTACHMENT_UPLOAD_SPINNER_SELECTOR =
  `${GPT_ATTACHMENT_ITEM_SELECTOR} svg[class*='animate-spin']`;
export const GPT_ATTACHMENT_PENDING_ACTION_SELECTOR =
  `${GPT_ATTACHMENT_ITEM_SELECTOR} button.cursor-wait`;
