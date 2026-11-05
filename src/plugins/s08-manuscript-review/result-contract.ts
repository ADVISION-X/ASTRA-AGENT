import type { GptExecutionProfile } from "../../capabilities/gpt/index.js";
import { productResultValidation as v, type ProductPluginOutput } from "../../mediator/product-plugin-contract.js";

export interface ManuscriptReviewInput {
  readonly facts: Readonly<Record<string, unknown>>;
  readonly profile: GptExecutionProfile;
}
export const parseManuscriptReviewResult = (raw: string, evidence: readonly string[]): ProductPluginOutput => {
  const payload = v.parseJsonObject(raw, "S08_RESULT");
  v.exact(payload, ["schema_version", "workspace", "decision", "issues", "unresolved", "outputs", "coverage", "resources", "body"], "S08_RESULT_FIELDS_INVALID");
  if (payload.schema_version !== "astra-s08-output.v1") v.fail("S08_RESULT_SCHEMA_INVALID");
  if (!["continue", "supplement", "rework", "blocked"].includes(String(payload.decision))) v.fail("S08_DECISION_INVALID");
  for (const key of ["issues", "unresolved", "outputs", "coverage"]) v.array(payload[key], `S08_${key}_INVALID`);
  v.object(payload.resources, "S08_RESOURCES_INVALID");
  v.object(payload.body, "S08_BODY_INVALID");
  return { payload, evidence_refs: evidence };
};
