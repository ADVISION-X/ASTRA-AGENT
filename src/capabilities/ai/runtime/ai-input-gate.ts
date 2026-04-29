import type { AiChildCapabilityId, ParsedAiAbilityInput } from "../contract.js";
import { AiInputSchema } from "../schema.js";
import { routeAiTaskToChild } from "../task-router.js";

export function parseAiExecutorInput(input: ParsedAiAbilityInput, childCapabilityId: AiChildCapabilityId): { ok: true; request: ParsedAiAbilityInput } | { ok: false; reason: string } {
  const parsed = AiInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "input_schema_invalid" };
  }

  if (routeAiTaskToChild(parsed.data.taskType) !== childCapabilityId) {
    return { ok: false, reason: "task_type_mismatch" };
  }

  return { ok: true, request: parsed.data };
}
