import { z } from "zod";

type StepValue = {
  stepKind: "ability" | "ai" | "review" | "finalize";
  targetAbilityGroupId?: string | null;
  promptContractId?: string | null;
};

const addIssue = (context: z.RefinementCtx, path: string, message: string): void => {
  context.addIssue({ code: z.ZodIssueCode.custom, message, path: [path] });
};

const validateAiStep = (value: StepValue, context: z.RefinementCtx): void => {
  if (value.targetAbilityGroupId !== "ai") {
    addIssue(context, "targetAbilityGroupId", "AI step must target ai ability group.");
  }
  if (!value.promptContractId) {
    addIssue(context, "promptContractId", "AI step must declare promptContractId.");
  }
};

const validateAbilityStep = (value: StepValue, context: z.RefinementCtx): void => {
  if (!value.targetAbilityGroupId) {
    addIssue(context, "targetAbilityGroupId", "Ability step must declare a non-null targetAbilityGroupId.");
  }
  if (value.targetAbilityGroupId === "ai") {
    addIssue(context, "targetAbilityGroupId", "Non-AI step must not target ai ability group.");
  }
};

const validateNonTargetStep = (value: StepValue, context: z.RefinementCtx): void => {
  if (value.targetAbilityGroupId !== null) {
    addIssue(context, "targetAbilityGroupId", "Review/finalize steps must not target ability groups.");
  }
};

export const validateMapPluginOperationalMapStep = (value: StepValue, context: z.RefinementCtx): void => {
  if (value.stepKind === "ai") {
    validateAiStep(value, context);
    return;
  }
  if (value.stepKind === "ability") {
    validateAbilityStep(value, context);
    return;
  }
  validateNonTargetStep(value, context);
};