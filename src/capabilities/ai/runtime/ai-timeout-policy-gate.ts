import type { ParsedAiAbilityInput } from "../contract.js";
import { resolveAiRuntimeTimeoutMs } from "./local-ai-runtime-policy.js";

export function resolveAiTimeoutPolicy(request: ParsedAiAbilityInput): { decision: "allow"; timeoutMs: number; reason: null } {
  return {
    decision: "allow",
    timeoutMs: resolveAiRuntimeTimeoutMs(request.taskType),
    reason: null,
  };
}
