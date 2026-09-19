export const GPT_COMPOSER_SELECTOR = "#prompt-textarea";
const GPT_CHAT_MODE_GROUP_SELECTOR = "[role='radiogroup'][aria-label='选择聊天界面']";
export const GPT_CHAT_MODE_CHAT_SELECTOR =
  `${GPT_CHAT_MODE_GROUP_SELECTOR} [role='radio'][data-tpp-toggle-value='chatgpt']`;
export const GPT_CHAT_MODE_WORK_SELECTOR =
  `${GPT_CHAT_MODE_GROUP_SELECTOR} [role='radio'][data-tpp-toggle-value='work']`;
export const GPT_USER_TURN_SELECTOR =
  "[data-testid^='conversation-turn-']:has([data-message-author-role='user'])";
export const GPT_ASSISTANT_TURN_SELECTOR =
  "[data-testid^='conversation-turn-']:has([data-message-author-role='assistant'])";
export const GPT_GENERATING_STOP_SELECTOR = "#composer-submit-button[data-testid='stop-button']";
export const GPT_COMPOSER_FORM_SELECTOR = "form:has(#prompt-textarea)";
export const GPT_ATTACHMENT_ITEM_SELECTOR = "[role='group'][aria-label]";
