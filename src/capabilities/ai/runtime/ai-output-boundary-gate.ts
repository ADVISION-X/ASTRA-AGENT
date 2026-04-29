import { AiForbiddenActionOutputFieldSchema } from "../schema.js";
import { collectForbiddenActionTerms } from "../shared/ai-policy.js";

export function evaluateAiOutputBoundary(output: unknown): { decision: "allow" | "review_required" | "blocked"; reason: string | null; flags: string[] } {
  const schemaCheck = AiForbiddenActionOutputFieldSchema.safeParse(output);
  const flags = collectForbiddenActionTerms(output);
  if (!schemaCheck.success) {
    flags.push("schema_level_action_output");
  }
  if (flags.length === 0) {
    return { decision: "allow", reason: null, flags: [] };
  }

  return {
    decision: "blocked",
    reason: "output_boundary_blocked",
    flags,
  };
}
