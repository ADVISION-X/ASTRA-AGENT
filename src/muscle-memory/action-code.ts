const MUSCLE_MEMORY_ACTION_CODES = [
  "SAVE_LEAD",
  "PRESS_KEY",
  "CLICK_CELL",
  "REOPEN_ENTRY_PAGE",
  "WAIT_SHORT",
  "STOP_REVIEW_REQUIRED",
  "CAPTURE_SCREEN",
  "PREPARE_VISUAL_INPUT",
  "LIKE_CURRENT_VIDEO",
  "NEXT_VIDEO",
  "FOCUS_CURRENT_SURFACE",
] as const;

const MUSCLE_MEMORY_AI_ALLOWED_ACTION_CODES = [
  "SAVE_LEAD",
  "PRESS_KEY",
  "CLICK_CELL",
  "REOPEN_ENTRY_PAGE",
  "WAIT_SHORT",
  "STOP_REVIEW_REQUIRED",
  "CAPTURE_SCREEN",
  "PREPARE_VISUAL_INPUT",
  "LIKE_CURRENT_VIDEO",
  "NEXT_VIDEO",
] as const;

type MuscleMemoryActionCode = (typeof MUSCLE_MEMORY_ACTION_CODES)[number];
type MuscleMemoryAiAllowedActionCode = (typeof MUSCLE_MEMORY_AI_ALLOWED_ACTION_CODES)[number];

function isMuscleMemoryActionCode(value: unknown): value is MuscleMemoryActionCode {
  return typeof value === "string" && (MUSCLE_MEMORY_ACTION_CODES as readonly string[]).includes(value);
}

function isMuscleMemoryAiAllowedActionCode(value: unknown): value is MuscleMemoryAiAllowedActionCode {
  return typeof value === "string" && (MUSCLE_MEMORY_AI_ALLOWED_ACTION_CODES as readonly string[]).includes(value);
}

export {
  MUSCLE_MEMORY_ACTION_CODES,
  MUSCLE_MEMORY_AI_ALLOWED_ACTION_CODES,
  isMuscleMemoryActionCode,
  isMuscleMemoryAiAllowedActionCode,
};

export type {
  MuscleMemoryActionCode,
  MuscleMemoryAiAllowedActionCode,
};