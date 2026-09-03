import type {
  GptChildCall,
  GptChildOutputMap,
  GptChildSuccess,
} from "../index.js";
import type {
  ProductGptCallInput,
  ProductGptChildResult,
} from "../index.js";

const hash = `sha256:${"a".repeat(64)}` as const;

const validWriteCall: GptChildCall<"write_exact_gpt_prompt"> = {
  child: "write_exact_gpt_prompt",
  input: { prompt: "approved prompt" },
};
const validSubmitCall: ProductGptCallInput<"submit_exact_gpt_turn_once"> = {
  child: "submit_exact_gpt_turn_once",
  productStepId: "acceptance-step",
  callId: "submit",
  actionOrdinal: 1,
  input: { files: [], promptHash: hash, turnMarker: "[GRASSEYE:typed]" },
};
const validWriteSuccess: GptChildSuccess<"write_exact_gpt_prompt"> = {
  status: "success",
  value: { length: 15, prefix: "approved prompt", suffix: "approved prompt", hash },
};

// @ts-expect-error a write Child cannot receive the clean-chat input.
const wrongChildInput: GptChildCall<"write_exact_gpt_prompt"> = { child: "write_exact_gpt_prompt", input: { timeoutMs: 1 } };
// @ts-expect-error exact input rejects an extra field.
const extraInputField: GptChildCall<"write_exact_gpt_prompt"> = { child: "write_exact_gpt_prompt", input: { prompt: "approved", timeoutMs: 1 } };
// @ts-expect-error submit requires the exact attachment set.
const missingSubmitFiles: ProductGptCallInput<"submit_exact_gpt_turn_once"> = { child: "submit_exact_gpt_turn_once", productStepId: "step", callId: "call", actionOrdinal: 1, input: { promptHash: hash, turnMarker: "[GRASSEYE:typed]" } };
// @ts-expect-error handler/public success cannot return another Child's value.
const wrongWriteOutput: GptChildOutputMap["write_exact_gpt_prompt"] = { state: "profile-popup-open" };

declare const publicResult: ProductGptChildResult<"write_exact_gpt_prompt">;
const exactHash: `sha256:${string}` = publicResult.value.hash;
void [validWriteCall, validSubmitCall, validWriteSuccess, wrongChildInput,
  extraInputField, missingSubmitFiles, wrongWriteOutput, exactHash];
