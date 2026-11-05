import type { GptExecutionProfile } from "../../capabilities/gpt/index.js";
import { productResultValidation as v, type ProductPluginOutput } from "../../mediator/product-plugin-contract.js";

export interface MaterialAcquisitionInput {
  readonly facts: Readonly<Record<string, unknown>>;
  readonly profile: GptExecutionProfile;
}
export const parseMaterialAcquisitionResult = (raw: string, evidence: readonly string[]): ProductPluginOutput => {
  const payload = v.parseJsonObject(raw, "S03_RESULT", "astra-s03-output.v1");
  if (Object.hasOwn(payload, "resolved_issues")) v.fail("S03_RESULT_FIELDS_INVALID");
  if (!["continue", "supplement", "rework", "blocked"].includes(String(payload.decision))) v.fail("S03_DECISION_INVALID");
  for (const key of ["issues", "unresolved", "outputs", "coverage"]) v.array(payload[key], `S03_${key}_INVALID`);
  v.object(payload.resources, "S03_RESOURCES_INVALID");
  v.object(payload.body, "S03_BODY_INVALID");
  return { payload, evidence_refs: evidence };
};
