export const GPT_COMPOSER_SELECTOR = "form[data-chatgpt-composer] [data-composer-markdown][role='textbox']";
const GPT_CHAT_MODE_GROUP_SELECTOR = "[role='group'][aria-label='撰写器模式']";
export const GPT_CHAT_MODE_CHAT_SELECTOR =
  `${GPT_CHAT_MODE_GROUP_SELECTOR} > button:first-of-type`;
export const GPT_CHAT_MODE_WORK_SELECTOR =
  `${GPT_CHAT_MODE_GROUP_SELECTOR} > button:nth-of-type(2)`;
export const GPT_USER_TURN_SELECTOR =
  "[data-turn-key]:has([data-chatgpt-search-unit-key$=':user'])";
export const GPT_ASSISTANT_TURN_SELECTOR =
  "[data-turn-key]:has([data-chatgpt-search-unit-key$=':assistant'])";
export const GPT_GENERATING_STOP_SELECTOR = "form[data-chatgpt-composer] button[aria-label='停止']";
export const GPT_COMPOSER_FORM_SELECTOR = "form[data-chatgpt-composer]";
export const GPT_ATTACHMENT_ITEM_SELECTOR = "button.composer-attachment-surface[aria-label]";
