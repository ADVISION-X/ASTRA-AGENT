import type { GptChildCapabilityId, GptChildInputMap, GptChildOutputMap } from "../contract.js";
import type {
  ProductGptCallInput,
  ProductGptChildResult,
  ProductGptTools,
} from "../product-api.js";

const hash = `sha256:${"a".repeat(64)}` as const;
type ChildCall<K extends GptChildCapabilityId> = Readonly<{ child: K; input: GptChildInputMap[K] }>;

const validWriteCall: ChildCall<"write_exact_gpt_prompt"> = {
  child: "write_exact_gpt_prompt",
  input: { prompt: "approved prompt" },
};
const validSubmitCall: ProductGptCallInput<"submit_exact_gpt_turn_once"> = {
  child: "submit_exact_gpt_turn_once",
  productStepId: "acceptance-step",
  callId: "submit",
  actionOrdinal: 1,
  input: { files: [], promptHash: hash },
};
const validWriteSuccess: Readonly<{
  status: "success";
  value: GptChildOutputMap["write_exact_gpt_prompt"];
}> = {
  status: "success",
  value: { length: 15, prefix: "approved prompt", suffix: "approved prompt", hash },
};

// @ts-expect-error a write Child cannot receive the clean-chat input.
const wrongChildInput: ChildCall<"write_exact_gpt_prompt"> = { child: "write_exact_gpt_prompt", input: { timeoutMs: 1 } };
// @ts-expect-error exact input rejects an extra field.
const extraInputField: ChildCall<"write_exact_gpt_prompt"> = { child: "write_exact_gpt_prompt", input: { prompt: "approved", timeoutMs: 1 } };
// @ts-expect-error submit requires the exact attachment set.
const missingSubmitFiles: ProductGptCallInput<"submit_exact_gpt_turn_once"> = { child: "submit_exact_gpt_turn_once", productStepId: "step", callId: "call", actionOrdinal: 1, input: { promptHash: hash } };
// @ts-expect-error handler/public success cannot return another Child's value.
const wrongWriteOutput: GptChildOutputMap["write_exact_gpt_prompt"] = { state: "profile-popup-open" };

declare const publicResult: ProductGptChildResult<"write_exact_gpt_prompt">;
declare const publicTools: ProductGptTools;
// @ts-expect-error settled conversation rename is internal cleanup and cannot enter Product tools.
void publicTools.execute<"rename_settled_gpt_conversation">(undefined as never);
const exactHash: `sha256:${string}` = publicResult.value.hash;
void [validWriteCall, validSubmitCall, validWriteSuccess, wrongChildInput,
  extraInputField, missingSubmitFiles, wrongWriteOutput, exactHash];
