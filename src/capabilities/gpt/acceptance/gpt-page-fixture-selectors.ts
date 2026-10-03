export const GPT_ATTACHMENT_ACTIVE_MENU_SCOPE_SELECTOR =
  "[data-composer-overlay-floating-ui='true']";
export const GPT_COMPOSER_FORM_SELECTOR = "form[data-chatgpt-composer]";
export const GPT_ATTACHMENT_PENDING_ACTION_SELECTOR = "button.composer-attachment-surface[aria-label].cursor-wait";

const GPT_PROFILE_REASONING_CONTROL_SELECTOR = "[role='menuitem'][data-reasoning-slider='true']";
export const GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR = `${GPT_PROFILE_REASONING_CONTROL_SELECTOR}:not([aria-disabled='true'])`;
export const GPT_PROFILE_REASONING_VALUE_SELECTOR = "[data-model-picker-power-slider] [role='slider']";
