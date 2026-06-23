const PICK3_POST_PARSE_MIN_DELAY_MS = 5_000;
const PICK3_POST_PARSE_MAX_DELAY_MS = 30_000;

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const randomPick3PostParseDelayMs = (): number =>
  Math.floor(Math.random() * (PICK3_POST_PARSE_MAX_DELAY_MS - PICK3_POST_PARSE_MIN_DELAY_MS + 1)) + PICK3_POST_PARSE_MIN_DELAY_MS;
