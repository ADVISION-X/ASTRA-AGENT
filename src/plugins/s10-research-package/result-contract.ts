import type { GptExecutionProfile } from "../../capabilities/gpt/index.js";
import { productResultValidation as v, type ProductPluginOutput } from "../../mediator/product-plugin-contract.js";

export interface ResearchPackageInput {
  readonly facts: Readonly<Record<string, unknown>>;
  readonly profile: GptExecutionProfile;
}
export const parseResearchPackageResult = (raw: string, evidence: readonly string[]): ProductPluginOutput => {
  const payload = v.parseJsonObject(raw, "S10_RESULT");
  v.exact(payload, ["schema_version", "workspace", "decision", "issues", "unresolved", "outputs", "coverage", "resources", "body"], "S10_RESULT_FIELDS_INVALID");
  if (payload.schema_version !== "astra-s10-output.v1") v.fail("S10_RESULT_SCHEMA_INVALID");
  if (!["continue", "supplement", "rework", "blocked"].includes(String(payload.decision))) v.fail("S10_DECISION_INVALID");
  for (const key of ["issues", "unresolved", "outputs", "coverage"]) v.array(payload[key], `S10_${key}_INVALID`);
  v.object(payload.resources, "S10_RESOURCES_INVALID");
  v.object(payload.body, "S10_BODY_INVALID");
  return { payload, evidence_refs: evidence };
};
