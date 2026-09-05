export const GPT_COMPOSER_SELECTOR = "#prompt-textarea";
export const GPT_USER_TURN_SELECTOR = "[data-testid^='conversation-turn-'][data-turn='user']";
export const GPT_ASSISTANT_TURN_SELECTOR = "[data-testid^='conversation-turn-'][data-turn='assistant']";
export const GPT_GENERATING_STOP_SELECTOR = "#composer-submit-button[data-testid='stop-button']";
export const GPT_CHECKPOINT_ACTIONS_MENU_SELECTOR =
  "[role='menu']:has([role='menuitem'][aria-haspopup='menu'])";
export const GPT_OPEN_FORK_ACTION_SELECTOR = "[role='menuitem'][aria-haspopup='menu'][tabindex='0']";
export const GPT_OPEN_FORK_ACTION_TEXT = "打开新分支";
export const GPT_FORK_DESTINATION_MENU_SELECTOR = "[role='menu'][data-side='right']";
export const GPT_FORK_TO_NEW_CHAT_SELECTOR = "[role='menuitem'][tabindex='0']";
export const GPT_FORK_TO_NEW_CHAT_TEXT = "分支到新聊天";
const GPT_MORE_ACTIONS_BUTTON_LABEL = "更多操作";
export const GPT_COMPOSER_FORM_SELECTOR = "form:has(#prompt-textarea)";
export const GPT_ATTACHMENT_ITEM_SELECTOR = "[role='group'][aria-label]";
export const gptMoreActionsButtonSelector = (assistantTurnId: string): string =>
  `[data-testid="${assistantTurnId}"][data-turn='assistant'] button[aria-label='${GPT_MORE_ACTIONS_BUTTON_LABEL}'][aria-haspopup='menu']`;
