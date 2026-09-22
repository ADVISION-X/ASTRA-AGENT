export const GPT_PROFILE_REASONING_CONTROL_SELECTOR = "[role='menuitem'][aria-label='能力']";
export const GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR = `${GPT_PROFILE_REASONING_CONTROL_SELECTOR}:not([aria-disabled='true'])`;
export const GPT_PROFILE_REASONING_VALUE_SELECTOR = "[data-model-reasoning-effort-slider] [role='slider']";
export const reasoningTierUiValue = Object.freeze({
  fast: 0,
  medium: 1,
  high: 2,
  extra_high: 3,
  pro_standard: 4,
});
