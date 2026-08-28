import {
  GPT_TURN_FLOW_VERSION,
  type GptChildCapabilityId,
  type GptChildCapabilityIntent,
  type GptChildCapabilityResult,
  type GptExecutionContext,
} from "./contract.js";

export type GptTurnMode = "fresh" | "continuation";
export type GptTurnOutputKind = "text" | "generated_image";

export type GptTurnFlowStep = Readonly<{
  childCapabilityId: GptChildCapabilityId;
  when: "fresh" | "continuation" | "always" | "attachments" | "text" | "generated_image";
}>;

export const GPT_TURN_FLOW = Object.freeze([
  { childCapabilityId: "prepare_clean_gpt_chat", when: "fresh" },
  { childCapabilityId: "focus_exact_gpt_conversation", when: "continuation" },
  { childCapabilityId: "verify_gpt_conversation_identity", when: "continuation" },
  { childCapabilityId: "open_gpt_execution_profile", when: "always" },
  { childCapabilityId: "ensure_exact_gpt_model", when: "always" },
  { childCapabilityId: "ensure_exact_gpt_reasoning_tier", when: "always" },
  { childCapabilityId: "close_gpt_execution_profile", when: "always" },
  { childCapabilityId: "open_gpt_attachment_control", when: "attachments" },
  { childCapabilityId: "attach_approved_gpt_files_once", when: "attachments" },
  { childCapabilityId: "reconcile_gpt_attachment_set", when: "always" },
  { childCapabilityId: "write_exact_gpt_prompt", when: "always" },
  { childCapabilityId: "reconcile_gpt_draft", when: "always" },
  { childCapabilityId: "submit_exact_gpt_turn_once", when: "always" },
  { childCapabilityId: "reconcile_gpt_turn_submission", when: "always" },
  { childCapabilityId: "wait_for_stable_gpt_text", when: "text" },
  { childCapabilityId: "checkpoint_gpt_text_response", when: "text" },
  { childCapabilityId: "wait_for_stable_gpt_image", when: "generated_image" },
  { childCapabilityId: "checkpoint_gpt_generated_image", when: "generated_image" },
] satisfies readonly GptTurnFlowStep[]);

export type GptTurnResumePoint = Readonly<{
  stepIndex: number;
  childCapabilityId: GptChildCapabilityId;
  status: "success" | "failed";
  mutationState: "no" | "dispatched" | "confirmed";
}>;

export type GptTurnExecutionResult = Readonly<{
  completed: boolean;
  lastStepIndex: number;
  failure: GptChildCapabilityResult | null;
}>;

export type GptTurnExecutionInput = Readonly<{
  executionId: string;
  inputHash: `sha256:${string}`;
  pluginStepId: string;
  mode: GptTurnMode;
  hasAttachments: boolean;
  outputKind: GptTurnOutputKind;
  resume: GptTurnResumePoint | null;
  context: GptExecutionContext;
  inputFor(step: GptTurnFlowStep, reconcileOnly: boolean): Readonly<Record<string, unknown>>;
  dispatch(intent: GptChildCapabilityIntent, context: GptExecutionContext): Promise<GptChildCapabilityResult>;
  checkpoint(input: Readonly<{
    step: GptTurnFlowStep;
    stepIndex: number;
    reconcileOnly: boolean;
    result: GptChildCapabilityResult;
  }>): Promise<void> | void;
}>;

const enabled = (
  step: GptTurnFlowStep,
  mode: GptTurnMode,
  hasAttachments: boolean,
  outputKind: GptTurnOutputKind,
): boolean => step.when === "always"
  || step.when === mode
  || (step.when === "attachments" && hasAttachments)
  || step.when === outputKind;

const assertResumePoint = (resume: GptTurnResumePoint | null): void => {
  if (!resume) return;
  const step = GPT_TURN_FLOW[resume.stepIndex];
  if (!step || step.childCapabilityId !== resume.childCapabilityId) {
    throw new Error("GPT_TURN_CHECKPOINT_FLOW_DRIFT");
  }
};

/** The one product-neutral owner of GPT provider-page step order. */
export class GptTurnExecutor {
  public async execute(input: GptTurnExecutionInput): Promise<GptTurnExecutionResult> {
    assertResumePoint(input.resume);
    const start = input.resume?.status === "success"
      ? input.resume.stepIndex + 1
      : input.resume?.stepIndex ?? 0;
    let lastStepIndex = start - 1;
    for (let stepIndex = start; stepIndex < GPT_TURN_FLOW.length; stepIndex += 1) {
      const step = GPT_TURN_FLOW[stepIndex]!;
      if (!enabled(step, input.mode, input.hasAttachments, input.outputKind)) continue;
      const reconcileOnly = input.resume?.status === "failed"
        && input.resume.stepIndex === stepIndex
        && input.resume.mutationState !== "no";
      const intent: GptChildCapabilityIntent = Object.freeze({
        childCapabilityId: step.childCapabilityId,
        executionId: `${input.executionId}:${stepIndex}:${step.childCapabilityId}`,
        flowVersion: GPT_TURN_FLOW_VERSION,
        stepIndex,
        inputHash: input.inputHash,
        pluginStepId: input.pluginStepId,
        actionOrdinal: stepIndex + 1,
        input: input.inputFor(step, reconcileOnly),
      });
      const result = await input.dispatch(intent, input.context);
      await input.checkpoint({ step, stepIndex, reconcileOnly, result });
      lastStepIndex = stepIndex;
      if (result.status !== "success") {
        return Object.freeze({ completed: false, lastStepIndex, failure: result });
      }
    }
    return Object.freeze({ completed: true, lastStepIndex, failure: null });
  }
}
