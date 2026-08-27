export const GPT_PROFILE_TRIGGER_SELECTOR = "main button[aria-haspopup='menu']:not([aria-label])";
export const GPT_PROFILE_POPUP_SELECTOR = "[role='menu']";
export const GPT_PROFILE_DIAGNOSTIC_SELECTOR = [
  "[data-testid*='model']",
  "[id*='model']",
  "[data-testid*='switcher']",
  "[id*='switcher']",
  "[aria-label*='模型']",
  "[aria-label*='GPT']",
  "[aria-label*='ChatGPT']",
  "[aria-haspopup]",
].join(",");
export const GPT_ADVANCED_CLOSED_SELECTOR = "[role='menuitem'][aria-label='显示高级选项']";
export const GPT_MODEL_SUBMENU_SELECTOR = "[role='menuitem'][aria-haspopup='menu']";
export const GPT_PROFILE_CHOICE_SELECTOR = "[role='menuitemradio']";
export const GPT_MODEL_LABEL = "模型";
export const GPT_REASONING_LABEL = "推理强度";

export const reasoningTierUiLabel = Object.freeze({
  medium: "中",
  high: "高",
  extra_high: "极高",
  pro_standard: "Pro",
  pro_extended: "Pro",
});
