export const GPT_PROFILE_TRIGGER_SELECTOR = "main button[aria-haspopup='menu'][data-tone='neutral']:not([aria-label])";
export const GPT_PROFILE_POPUP_SELECTOR = "[role='menu']:has([data-testid='composer-model-picker-slider-simple-view'])";
export const GPT_PROFILE_SIMPLE_PANEL_SELECTOR = "[data-testid='composer-model-picker-slider-simple-view'][data-active='true']:not([inert])";
export const GPT_PROFILE_REASONING_CONTROL_SELECTOR = "[role='menuitem'][aria-label='能力']";
export const GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR = `${GPT_PROFILE_REASONING_CONTROL_SELECTOR}:not([aria-disabled='true'])`;
export const GPT_PROFILE_REASONING_VALUE_SELECTOR = "[data-model-reasoning-effort-slider] [role='slider']";
