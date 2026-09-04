export const GPT_ATTACHMENT_CONTROL_SELECTOR =
  "button#composer-plus-btn[data-testid='composer-plus-btn'][aria-haspopup='menu']";
export const GPT_ATTACHMENT_ACTIVE_MENU_SCOPE_SELECTOR =
  "#thread-bottom div.popover[aria-busy='false']";
export const GPT_UPLOAD_FROM_COMPUTER_SELECTOR = "div.__menu-item[tabindex='0'] span";
export const GPT_UPLOAD_FROM_COMPUTER_LABEL = "从电脑上传";
export const GPT_FILE_INPUT_SELECTOR = "#upload-files";
export const GPT_COMPOSER_FORM_SELECTOR = "form:has(#prompt-textarea)";
export const GPT_ATTACHMENT_REGION_SELECTOR = `${GPT_COMPOSER_FORM_SELECTOR} [class*='grid-area:header']`;
export const GPT_ATTACHMENT_ITEM_SELECTOR = `${GPT_ATTACHMENT_REGION_SELECTOR} [role='group'][aria-label]`;
export const GPT_ATTACHMENT_READY_ICON_SELECTOR =
  `${GPT_ATTACHMENT_ITEM_SELECTOR} svg[data-testid='library-file-icon']`;
export const GPT_ATTACHMENT_UPLOAD_SPINNER_SELECTOR =
  `${GPT_ATTACHMENT_ITEM_SELECTOR} svg[class*='animate-spin']`;
