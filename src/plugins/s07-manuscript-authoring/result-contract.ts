import type { GptExecutionProfile } from "../../capabilities/gpt/index.js";
import { productResultValidation as v, type ProductPluginOutput } from "../../mediator/product-plugin-contract.js";

export interface ManuscriptAuthoringInput {
  readonly facts: Readonly<Record<string, unknown>>;
  readonly profile: GptExecutionProfile;
}
export const parseManuscriptAuthoringResult = (raw: string, evidence: readonly string[]): ProductPluginOutput => {
  const payload = v.parseJsonObject(raw, "S07_RESULT");
  v.exact(payload, ["schema_version", "workspace", "decision", "issues", "unresolved", "outputs", "coverage", "resources", "body"], "S07_RESULT_FIELDS_INVALID");
  if (payload.schema_version !== "astra-s07-output.v1") v.fail("S07_RESULT_SCHEMA_INVALID");
  if (!["continue", "supplement", "rework", "blocked"].includes(String(payload.decision))) v.fail("S07_DECISION_INVALID");
  for (const key of ["issues", "unresolved", "outputs", "coverage"]) v.array(payload[key], `S07_${key}_INVALID`);
  v.object(payload.resources, "S07_RESOURCES_INVALID");
  v.object(payload.body, "S07_BODY_INVALID");
  return { payload, evidence_refs: evidence };
};
