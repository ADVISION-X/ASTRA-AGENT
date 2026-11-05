import type { GptExecutionProfile } from "../../capabilities/gpt/index.js";
import { productResultValidation as v, type ProductPluginOutput } from "../../mediator/product-plugin-contract.js";

export interface ResearchBriefInput {
  readonly facts: Readonly<Record<string, unknown>>;
  readonly profile: GptExecutionProfile;
}
export const parseResearchBriefResult = (raw: string, evidence: readonly string[]): ProductPluginOutput => {
  const payload = v.parseJsonObject(raw, "S01_RESULT");
  v.exact(payload, ["schema_version", "submission_id", "project_id", "input_version", "tier", "disposition", "outline", "scope", "method", "materials", "premises", "preserve_boundaries", "limitations", "missing_items", "executable_scope"], "S01_RESULT_FIELDS_INVALID");
  if (payload.schema_version !== "astra-research-brief.v1") v.fail("S01_RESULT_SCHEMA_INVALID");
  for (const key of ["outline", "premises", "limitations", "missing_items"]) v.stringArray(payload[key], `S01_${key}_INVALID`);
  v.array(payload.materials, "S01_MATERIALS_INVALID");
  if (!["feasible", "needs_input"].includes(String(payload.disposition))) v.fail("S01_DISPOSITION_INVALID");
  return { payload, evidence_refs: evidence };
};
