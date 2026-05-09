import type { WorkbenchAiDebugEvent } from "./workbench-ai-debug-support.js";

const AI_DEBUG_REASON_PREFIXES = {
  AI_INPUT_REQUEST_DEBUG: "AI input request parsed for",
  AI_PROMPT_REQUEST_DEBUG: "AI prompt request prepared for",
  AI_REQUEST_DEBUG: "AI model request started for",
  AI_INPUT_DEBUG_REJECTED: "AI input debug rejected for",
  AI_RESPONSE_DEBUG: "AI response captured for",
  AI_RAW_RESPONSE_DEBUG: "Raw AI response captured for",
  AI_NORMALIZED_RESPONSE_DEBUG: "Normalized AI response captured for",
} as const;

export const resolveAiDebugReason = (input: WorkbenchAiDebugEvent): string | null => {
  const prefix = AI_DEBUG_REASON_PREFIXES[input.eventType as keyof typeof AI_DEBUG_REASON_PREFIXES];
  return prefix ? `${prefix} ${input.taskType}.` : input.failureReason;
};