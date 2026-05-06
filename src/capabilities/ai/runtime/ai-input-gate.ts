import type { AiChildCapabilityId, ParsedAiAbilityInput } from "../contract.js";
import { AiInputSchema } from "../schema.js";
import { routeAiTaskToChild } from "../task-router.js";
import { resolveAiInputProofSummary } from "../shared/ai-input-proof-registry.js";

export function parseAiExecutorInput(input: ParsedAiAbilityInput, childCapabilityId: AiChildCapabilityId): { ok: true; request: ParsedAiAbilityInput } | { ok: false; reason: string } {
  const parsed = AiInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "input_schema_invalid" };
  }

  if (routeAiTaskToChild(parsed.data.taskType) !== childCapabilityId) {
    return { ok: false, reason: "task_type_mismatch" };
  }

  if (parsed.data.taskType === "product_presence_judgment") {
    const promptInputRef = parsed.data.inputRefs[0]?.id ?? null;
    if (!promptInputRef) {
      return { ok: false, reason: "ai_input_ref_missing" };
    }
    if (!resolveAiInputProofSummary(promptInputRef)) {
      return { ok: false, reason: "ai_input_artifact_missing" };
    }
  }

  return { ok: true, request: parsed.data };
}
