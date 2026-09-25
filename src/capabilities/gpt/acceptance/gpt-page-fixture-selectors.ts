export const GPT_ATTACHMENT_CONTROL_SELECTOR =
  "button[aria-label='添加文件等内容']";
export const GPT_ATTACHMENT_ACTIVE_MENU_SCOPE_SELECTOR =
  "[data-composer-overlay-floating-ui='true']";
export const GPT_COMPOSER_FORM_SELECTOR = "form[data-chatgpt-composer]";
export const GPT_ATTACHMENT_PENDING_ACTION_SELECTOR = "[role='group'][aria-label] button.cursor-wait";

export const GPT_PROFILE_TRIGGER_SELECTOR = "form[data-chatgpt-composer] button[aria-label='选择 ChatGPT 模型'][aria-haspopup='menu']";
const GPT_PROFILE_REASONING_CONTROL_SELECTOR = "[role='menuitem'][data-reasoning-slider='true']";
export const GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR = `${GPT_PROFILE_REASONING_CONTROL_SELECTOR}:not([aria-disabled='true'])`;
export const GPT_PROFILE_REASONING_VALUE_SELECTOR = "[data-model-picker-power-slider] [role='slider']";
