export const GPT_MORE_ACTIONS_BUTTON_LABEL = "更多操作";
export const gptMoreActionsButtonSelector = (assistantTurnId: string): string =>
  `[data-testid="${assistantTurnId}"]:has([data-message-author-role='assistant']) button[aria-label='${GPT_MORE_ACTIONS_BUTTON_LABEL}']`;

export const GPT_ATTACHMENT_CONTROL_SELECTOR =
  "button#composer-plus-btn[data-testid='composer-plus-btn'][aria-haspopup='menu']";
export const GPT_ATTACHMENT_ACTIVE_MENU_SCOPE_SELECTOR =
  "#thread-bottom div.popover[aria-busy='false']";
export const GPT_COMPOSER_FORM_SELECTOR = "form:has(#prompt-textarea)";
export const GPT_ATTACHMENT_PENDING_ACTION_SELECTOR = "[role='group'][aria-label] button.cursor-wait";

export const GPT_PROFILE_TRIGGER_SELECTOR = "main button[aria-haspopup='menu'][data-tone='neutral']:not([aria-label])";
export const GPT_PROFILE_POPUP_SELECTOR = "[role='menu']:has([data-testid='composer-model-picker-slider-simple-view'])";
export const GPT_PROFILE_SIMPLE_PANEL_SELECTOR = "[data-testid='composer-model-picker-slider-simple-view'][data-active='true']:not([inert])";
export const GPT_PROFILE_REASONING_CONTROL_SELECTOR = "[role='menuitem'][aria-label='能力']";
export const GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR = `${GPT_PROFILE_REASONING_CONTROL_SELECTOR}:not([aria-disabled='true'])`;
export const GPT_PROFILE_REASONING_VALUE_SELECTOR = "[data-model-reasoning-effort-slider] [role='slider']";
export const reasoningTierUiLabel = Object.freeze({
  fast: "极速",
  medium: "中",
  high: "高",
  extra_high: "极高",
  pro_standard: "Pro",
});
export const reasoningTierUiValue = Object.freeze({
  fast: 0,
  medium: 1,
  high: 2,
  extra_high: 3,
  pro_standard: 4,
});

export const GPT_MODEL_SELECTION_V2_ENTRY_INNER_SELECTOR =
  "[role='menuitem'][aria-label='选择模型']";
export const GPT_MODEL_SELECTION_V2_OPENABLE_ENTRY_INNER_SELECTOR =
  `${GPT_MODEL_SELECTION_V2_ENTRY_INNER_SELECTOR}[aria-expanded='false'][aria-hidden='false']`;
export const GPT_MODEL_SELECTION_V2_OPENABLE_ENTRY_SELECTOR =
  `${GPT_PROFILE_POPUP_SELECTOR} ${GPT_MODEL_SELECTION_V2_OPENABLE_ENTRY_INNER_SELECTOR}`;
export const GPT_MODEL_SELECTION_V2_PANEL_SELECTOR =
  "[data-testid='composer-model-picker-slider-advanced-view'][data-active='true']:not([inert])";
export const GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR =
  `${GPT_MODEL_SELECTION_V2_PANEL_SELECTOR} [role='menuitemradio']`;
