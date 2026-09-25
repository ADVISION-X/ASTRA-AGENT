export const GPT_PROFILE_TRIGGER_SELECTOR = "form[data-chatgpt-composer] button[aria-label='选择 ChatGPT 模型'][aria-haspopup='menu']";
export const GPT_PROFILE_POPUP_SELECTOR = "[role='menu'][data-radix-menu-content]:has([data-model-picker-view='simple'])";
export const GPT_PROFILE_SIMPLE_PANEL_SELECTOR = "[data-model-picker-view='simple']:has(> [data-active='true']:not([inert]))";
export const GPT_PROFILE_REASONING_CONTROL_SELECTOR = "[role='menuitem'][data-reasoning-slider='true']";
export const GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR = `${GPT_PROFILE_REASONING_CONTROL_SELECTOR}:not([aria-disabled='true'])`;
export const GPT_PROFILE_REASONING_VALUE_SELECTOR = "[data-model-picker-power-slider] [role='slider']";
