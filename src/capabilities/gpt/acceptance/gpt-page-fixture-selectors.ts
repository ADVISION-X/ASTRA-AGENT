export const GPT_ATTACHMENT_CONTROL_SELECTOR =
  "button#composer-plus-btn[data-testid='composer-plus-btn'][aria-haspopup='menu']";
export const GPT_ATTACHMENT_ACTIVE_MENU_SCOPE_SELECTOR =
  "#thread-bottom div.popover[aria-busy='false']";
export const GPT_COMPOSER_FORM_SELECTOR = "form:has(#prompt-textarea)";
export const GPT_ATTACHMENT_PENDING_ACTION_SELECTOR = "[role='group'][aria-label] button.cursor-wait";

export const GPT_PROFILE_TRIGGER_SELECTOR = "main button[aria-haspopup='menu'][data-tone='neutral']:not([aria-label])";
const GPT_PROFILE_REASONING_CONTROL_SELECTOR = "[role='menuitem'][aria-label='能力']";
export const GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR = `${GPT_PROFILE_REASONING_CONTROL_SELECTOR}:not([aria-disabled='true'])`;
export const GPT_PROFILE_REASONING_VALUE_SELECTOR = "[data-model-reasoning-effort-slider] [role='slider']";
