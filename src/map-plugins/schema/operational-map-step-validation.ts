import { z } from "zod";

type StepValue = {
  stepKind: "ability" | "ai" | "review" | "finalize";
  targetAbilityGroupId?: string | null;
  promptContractId?: string | null;
  postActionVerification?: {
    required: true;
  } | null;
};

const ACTION_TARGET_ABILITY_GROUP_IDS = new Set(["open", "mouse-click", "mouse-scroll", "text-input"]);

const addIssue = (context: z.RefinementCtx, path: string, message: string): void => {
  context.addIssue({ code: z.ZodIssueCode.custom, message, path: [path] });
};

const validatePostActionVerificationPolicy = (value: StepValue, context: z.RefinementCtx): void => {
  const targetAbilityGroupId = value.targetAbilityGroupId ?? null;
  const requiresPostActionVerification = targetAbilityGroupId !== null && ACTION_TARGET_ABILITY_GROUP_IDS.has(targetAbilityGroupId);

  if (requiresPostActionVerification && value.postActionVerification === null) {
    addIssue(context, "postActionVerification", "State-changing action step must declare postActionVerification policy.");
  }

  if (!requiresPostActionVerification && value.postActionVerification !== null) {
    addIssue(context, "postActionVerification", "Only open, mouse-click, mouse-scroll, and text-input steps may declare postActionVerification policy.");
  }
};

const validateAiStep = (value: StepValue, context: z.RefinementCtx): void => {
  if (value.targetAbilityGroupId !== "ai") {
    addIssue(context, "targetAbilityGroupId", "AI step must target ai ability group.");
  }
  if (!value.promptContractId) {
    addIssue(context, "promptContractId", "AI step must declare promptContractId.");
  }
  validatePostActionVerificationPolicy(value, context);
};

const validateAbilityStep = (value: StepValue, context: z.RefinementCtx): void => {
  if (!value.targetAbilityGroupId) {
    addIssue(context, "targetAbilityGroupId", "Ability step must declare a non-null targetAbilityGroupId.");
  }
  if (value.targetAbilityGroupId === "ai") {
    addIssue(context, "targetAbilityGroupId", "Non-AI step must not target ai ability group.");
  }
  validatePostActionVerificationPolicy(value, context);
};

const validateNonTargetStep = (value: StepValue, context: z.RefinementCtx): void => {
  if (value.targetAbilityGroupId !== null) {
    addIssue(context, "targetAbilityGroupId", "Review/finalize steps must not target ability groups.");
  }
  if (value.postActionVerification !== null) {
    addIssue(context, "postActionVerification", "Review/finalize steps must not declare postActionVerification policy.");
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