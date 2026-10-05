export const GPT_COMPOSER_SELECTOR = "form[data-chatgpt-composer] [data-composer-markdown][role='textbox']";
export const GPT_EMPTY_COMPOSER_SELECTOR =
  `${GPT_COMPOSER_SELECTOR}[contenteditable='true']:has(> p[data-empty-paragraph='true'] > br.ProseMirror-trailingBreak)`;
export const GPT_SEND_SELECTOR = "form[data-chatgpt-composer] button[type='submit'][aria-label='发送']";
export const GPT_USER_TURN_SELECTOR =
  "[data-turn-key]:has([data-chatgpt-search-unit-key$=':user'])";
export const GPT_COMPOSER_FORM_SELECTOR = "form[data-chatgpt-composer]";
export const GPT_ATTACHMENT_ITEM_SELECTOR = ":is(button, div[role='button']).composer-attachment-surface[aria-label]";
