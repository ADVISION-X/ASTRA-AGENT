export const GPT_COMPOSER_SELECTOR = "#prompt-textarea";
export const GPT_USER_TURN_SELECTOR =
  "[data-testid^='conversation-turn-']:has([data-message-author-role='user'])";
export const GPT_ASSISTANT_TURN_SELECTOR =
  "[data-testid^='conversation-turn-']:has([data-message-author-role='assistant'])";
export const GPT_GENERATING_STOP_SELECTOR = "#composer-submit-button[data-testid='stop-button']";
export const GPT_COMPOSER_FORM_SELECTOR = "form:has(#prompt-textarea)";
export const GPT_ATTACHMENT_ITEM_SELECTOR = "[role='group'][aria-label]";
