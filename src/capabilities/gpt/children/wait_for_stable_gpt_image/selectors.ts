export const GPT_USER_TURN_SELECTOR = "[data-testid^='conversation-turn-'][data-turn='user']";
export const GPT_ASSISTANT_TURN_SELECTOR = "[data-testid^='conversation-turn-'][data-turn='assistant']";
export const GPT_GENERATING_STOP_SELECTOR = "#composer-submit-button[data-testid='stop-button']";
export const GPT_RATE_LIMIT_ROOT_SELECTOR = "[data-testid='modal-conversation-history-rate-limit']";
export const GPT_RATE_LIMIT_DIALOG_SELECTOR = `${GPT_RATE_LIMIT_ROOT_SELECTOR} [role='dialog']`;
export const GPT_RATE_LIMIT_HEADING_SELECTOR = `${GPT_RATE_LIMIT_DIALOG_SELECTOR} h2`;
export const GPT_RATE_LIMIT_ACK_SELECTOR = `${GPT_RATE_LIMIT_DIALOG_SELECTOR} button`;
export const GPT_RATE_LIMIT_HEADING_TEXT = "请求过于频繁";
export const GPT_RATE_LIMIT_ACK_TEXT = "明白了";
