import type { AiExecutionContext, ParsedAiAbilityInput } from "../contract.js";

export async function evaluateAiRuntimeHealthGate(input: {
  request: ParsedAiAbilityInput;
  context: AiExecutionContext;
}): Promise<{ decision: "allow" | "review_required" | "blocked"; reason: string | null; modelHealthBefore: string | null }> {
  if (input.request.taskType === "schema_validation_only") {
    return { decision: "allow", reason: null, modelHealthBefore: null };
  }

  const health = await input.context.runtime.getRuntimeHealth();
  const modelHealthBefore = JSON.stringify({
    overallStatus: health.overallStatus,
    dependencies: health.dependencies,
    lastInvocationStatus: health.lastInvocationStatus,
  });

  if (health.overallStatus === "unavailable") {
    return { decision: "blocked", reason: "runtime_health_unavailable", modelHealthBefore };
  }
  if (health.overallStatus === "degraded") {
    return { decision: "review_required", reason: "runtime_health_degraded", modelHealthBefore };
  }
  return { decision: "allow", reason: null, modelHealthBefore };
}
