import type { GptExecutionProfile } from "../../capabilities/gpt/index.js";
import { productResultValidation as v, type ProductPluginOutput } from "../../mediator/product-plugin-contract.js";

export interface ManuscriptReviewInput {
  readonly facts: Readonly<Record<string, unknown>>;
  readonly profile: GptExecutionProfile;
}
export const parseManuscriptReviewResult = (raw: string, evidence: readonly string[]): ProductPluginOutput => {
  const payload = v.parseJsonObject(raw, "S08_RESULT", "astra-s08-output.v1");
  if (Object.hasOwn(payload, "resolved_issues")) {
    for (const item of v.array(payload.resolved_issues, "S08_RESOLVED_ISSUES_INVALID")) {
      const closure = v.object(item, "S08_ISSUE_CLOSURE_INVALID");
      v.exact(closure, ["issue_id", "object_ref", "object_version", "repaired_ref", "check_ref"], "S08_ISSUE_CLOSURE_FIELDS_INVALID");
      for (const key of ["issue_id", "object_ref", "object_version"]) v.text(closure[key], "S08_ISSUE_CLOSURE_IDENTITY_INVALID");
      for (const key of ["repaired_ref", "check_ref"]) {
        const ref = v.object(closure[key], "S08_ISSUE_CLOSURE_REF_INVALID");
        v.exact(ref, ["ref", "version", "sha256", "bytes"], "S08_ISSUE_CLOSURE_REF_INVALID");
        v.text(ref.ref, "S08_ISSUE_CLOSURE_REF_INVALID");
        v.text(ref.version, "S08_ISSUE_CLOSURE_REF_INVALID");
        v.hash(ref.sha256, "S08_ISSUE_CLOSURE_REF_INVALID");
        if (!Number.isSafeInteger(ref.bytes) || Number(ref.bytes) <= 0) v.fail("S08_ISSUE_CLOSURE_REF_INVALID");
      }
    }
  }
  if (!["continue", "supplement", "rework", "blocked"].includes(String(payload.decision))) v.fail("S08_DECISION_INVALID");
  for (const key of ["issues", "unresolved", "outputs", "coverage"]) v.array(payload[key], `S08_${key}_INVALID`);
  v.object(payload.resources, "S08_RESOURCES_INVALID");
  v.object(payload.body, "S08_BODY_INVALID");
  return { payload, evidence_refs: evidence };
};
