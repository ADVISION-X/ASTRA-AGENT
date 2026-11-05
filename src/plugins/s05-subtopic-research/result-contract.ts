import type { GptExecutionProfile } from "../../capabilities/gpt/index.js";
import { productResultValidation as v, type ProductPluginOutput } from "../../mediator/product-plugin-contract.js";

export interface SubtopicResearchInput {
  readonly facts: Readonly<Record<string, unknown>>;
  readonly profile: GptExecutionProfile;
}
export const parseSubtopicResearchResult = (raw: string, evidence: readonly string[]): ProductPluginOutput => {
  const payload = v.parseJsonObject(raw, "S05_RESULT", "astra-s05-output.v1");
  if (Object.hasOwn(payload, "resolved_issues")) v.fail("S05_RESULT_FIELDS_INVALID");
  if (!["continue", "supplement", "rework", "blocked"].includes(String(payload.decision))) v.fail("S05_DECISION_INVALID");
  for (const key of ["issues", "unresolved", "outputs", "coverage"]) v.array(payload[key], `S05_${key}_INVALID`);
  v.object(payload.resources, "S05_RESOURCES_INVALID");
  v.object(payload.body, "S05_BODY_INVALID");
  return { payload, evidence_refs: evidence };
};
