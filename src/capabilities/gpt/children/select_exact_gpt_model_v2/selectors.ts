export const GPT_PROFILE_POPUP_SELECTOR = "[role='menu']:has([data-testid='composer-model-picker-slider-simple-view'])";
export const GPT_PROFILE_SIMPLE_PANEL_SELECTOR = "[data-testid='composer-model-picker-slider-simple-view'][data-active='true']:not([inert])";
export const GPT_MODEL_SELECTION_V2_ENTRY_INNER_SELECTOR =
  "[role='menuitem'][aria-label='选择模型']";
export const GPT_MODEL_SELECTION_V2_OPENABLE_ENTRY_INNER_SELECTOR =
  `${GPT_MODEL_SELECTION_V2_ENTRY_INNER_SELECTOR}[aria-expanded='false'][aria-hidden='false']`;
export const GPT_MODEL_SELECTION_V2_PANEL_SELECTOR =
  "[data-testid='composer-model-picker-slider-advanced-view'][data-active='true']:not([inert])";
export const GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR =
  `${GPT_MODEL_SELECTION_V2_PANEL_SELECTOR} [role='menuitemradio']`;
