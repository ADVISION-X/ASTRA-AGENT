export const GPT_COMPOSER_SELECTOR = "#prompt-textarea";
export const GPT_EMPTY_COMPOSER_SELECTOR =
  "#prompt-textarea[contenteditable='true']:has(> p[data-empty-paragraph='true'] > br.ProseMirror-trailingBreak)";
export const GPT_SEND_SELECTOR = "#composer-submit-button[data-testid='send-button']";
export const GPT_USER_TURN_SELECTOR =
  "[data-testid^='conversation-turn-']:has([data-message-author-role='user'])";
export const GPT_COMPOSER_FORM_SELECTOR = "form:has(#prompt-textarea)";
export const GPT_ATTACHMENT_ITEM_SELECTOR = "[role='group'][aria-label]";
