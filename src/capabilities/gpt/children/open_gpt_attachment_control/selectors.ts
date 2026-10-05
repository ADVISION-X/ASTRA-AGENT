export const GPT_ATTACHMENT_CONTROL_SELECTOR =
  "button[aria-label='添加文件等内容']";
export const GPT_ATTACHMENT_ACTIVE_MENU_SCOPE_SELECTOR =
  "[data-composer-overlay-floating-ui='true']";
// Keep the three Chrome-observed menu layouts in one uniquely qualified candidate query.
export const GPT_UPLOAD_FROM_COMPUTER_SELECTOR = "[data-mention-list-scroll-area] > div:first-child > button[data-list-navigation-item='true']:first-child, [data-mention-list-scroll-area] > div[data-mention-section-id='chatgpt-actions'] > div[data-mention-section-items='true'] > button[data-list-navigation-item='true']:first-child, [data-mention-list-scroll-area] > div[data-mention-section-id='chatgpt-context'] > div[data-mention-section-items='true'] > button[data-list-navigation-item='true']:first-child";
/** ChatGPT renders this menu item's label across two lines (title + "从电脑上传" subtitle);
 * matching the single word that is stable across that wording is more durable than an exact-text pin. */
export const GPT_UPLOAD_FROM_COMPUTER_KEYWORD = "上传";
export const GPT_COMPOSER_FORM_SELECTOR = "form[data-chatgpt-composer]";
