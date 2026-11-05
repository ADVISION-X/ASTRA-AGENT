import type { GptExecutionProfile } from "../../capabilities/gpt/index.js";
import { productResultValidation as v, type ProductPluginOutput } from "../../mediator/product-plugin-contract.js";

export interface UserDialogueInput {
  readonly facts: Readonly<Record<string, unknown>>;
  readonly profile: GptExecutionProfile;
}
export const parseUserDialogueResult = (raw: string, evidence: readonly string[], publicDialogue: boolean): ProductPluginOutput => {
  const payload = v.parseJsonObject(raw, "C01_RESULT");
  if (!publicDialogue) {
    v.exact(payload, ["schema_version", "missing_items"], "C01_RESULT_FIELDS_INVALID");
    if (payload.schema_version !== "astra-c01-output.v1") v.fail("C01_RESULT_SCHEMA_INVALID");
    v.stringArray(payload.missing_items, "C01_MISSING_ITEMS_INVALID");
  }
  return { payload, evidence_refs: evidence };
};
