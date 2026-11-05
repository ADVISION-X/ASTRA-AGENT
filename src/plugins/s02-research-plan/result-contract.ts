import type { GptExecutionProfile } from "../../capabilities/gpt/index.js";
import { productResultValidation as v, type ProductPluginOutput } from "../../mediator/product-plugin-contract.js";

export interface ResearchPlanInput {
  readonly facts: Readonly<Record<string, unknown>>;
  readonly profile: GptExecutionProfile;
}
export const parseResearchPlanResult = (raw: string, evidence: readonly string[]): ProductPluginOutput => {
  const payload = v.parseJsonObject(raw, "S02_RESULT");
  v.exact(payload, ["schema_version", "workspace", "decision", "issues", "unresolved", "outputs", "coverage", "resources", "body"], "S02_RESULT_FIELDS_INVALID");
  if (payload.schema_version !== "astra-s02-output.v1") v.fail("S02_RESULT_SCHEMA_INVALID");
  if (!["continue", "supplement", "rework", "blocked"].includes(String(payload.decision))) v.fail("S02_DECISION_INVALID");
  for (const key of ["issues", "unresolved", "outputs", "coverage"]) v.array(payload[key], `S02_${key}_INVALID`);
  v.object(payload.resources, "S02_RESOURCES_INVALID");
  v.object(payload.body, "S02_BODY_INVALID");
  return { payload, evidence_refs: evidence };
};
