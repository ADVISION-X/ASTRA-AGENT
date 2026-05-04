import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";

import { kernelInspectionConstants } from "./inspection-constants.js";

export type JsonRecord = Record<string, unknown>;

export type ForbiddenPromptKeyHit = {
  key: string;
  path: string;
};

export const REQUIRED_PROHIBITED_ACTIONS = ["click", "scroll", "type", "open_page", "dispatch_action"] as const;
export const FORBIDDEN_MAP_PROMPT_KEYS = new Set(["rawPrompt", "systemPrompt", "userPrompt", "promptText"]);
export const PROMPT_BINDING_ALLOWED_KEYS = new Set([
  "stepId",
  "promptContractId",
  "requiredInputRefs",
  "outputSchemaRef",
  "confidencePolicy",
  "reviewPolicy",
  "failureBranch",
]);

const { REQUIREMENT_ID_003 } = kernelInspectionConstants;

export const createPromptContractRoutingFinding = (input: {
  file: string;
  line: number;
  message: string;
  detail?: string;
}): Finding => createFinding({
  lawId: REQUIREMENT_ID_003,
  file: input.file,
  line: input.line,
  severity: "fatal",
  message: input.message,
  ...(input.detail ? { detail: input.detail } : {}),
});

export const asJsonRecord = (value: unknown): JsonRecord | null => {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return null;
  }

  return value as JsonRecord;
};