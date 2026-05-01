import { ZodIssueCode, type RefinementCtx } from "zod";

type PageStateRuntimeProofLike = {
  status: "success" | "failed" | "review_required";
  decision: "proceed" | "block" | "review_required" | "fail";
  outputRef: string | null;
  diagnosticPayloadRef: string | null;
};

type PageStateAbilityResultLike = {
  status: "success" | "failed" | "review_required";
  decision: "proceed" | "block" | "review_required" | "fail";
  runtimeProof: PageStateRuntimeProofLike;
  output: unknown;
  diagnosticPayloadRef: string | null;
};

const addIssue = (ctx: RefinementCtx, path: string[], message: string): void => {
  ctx.addIssue({ code: ZodIssueCode.custom, message, path });
};

const validatePageStateRuntimeProofSuccess = (proof: PageStateRuntimeProofLike, ctx: RefinementCtx): void => { if (proof.decision !== "proceed") addIssue(ctx, ["decision"], "success proof must proceed"); if (!proof.outputRef) addIssue(ctx, ["outputRef"], "success proof must retain outputRef"); };

const validatePageStateRuntimeProofFailure = (proof: PageStateRuntimeProofLike, ctx: RefinementCtx): void => { if (proof.decision === "proceed") addIssue(ctx, ["decision"], "failed or review_required proof cannot proceed"); if (proof.outputRef !== null) addIssue(ctx, ["outputRef"], "failed or review_required proof must null outputRef"); if (!proof.diagnosticPayloadRef) addIssue(ctx, ["diagnosticPayloadRef"], "failed or review_required proof must retain diagnosticPayloadRef"); };

export const validatePageStateRuntimeProof = (proof: PageStateRuntimeProofLike, ctx: RefinementCtx): void => proof.status === "success" ? validatePageStateRuntimeProofSuccess(proof, ctx) : validatePageStateRuntimeProofFailure(proof, ctx);

const validatePageStateAbilityResultProof = (result: PageStateAbilityResultLike, ctx: RefinementCtx): void => { if (result.runtimeProof.status !== result.status) addIssue(ctx, ["runtimeProof", "status"], "runtime proof status must match result status"); if (result.runtimeProof.decision !== result.decision) addIssue(ctx, ["runtimeProof", "decision"], "runtime proof decision must match result decision"); };

const validatePageStateAbilityResultSuccess = (result: PageStateAbilityResultLike, ctx: RefinementCtx): void => { if (!result.output) addIssue(ctx, ["output"], "success result must include output"); if (result.decision !== "proceed") addIssue(ctx, ["decision"], "success result must proceed"); };

const validatePageStateAbilityResultFailure = (result: PageStateAbilityResultLike, ctx: RefinementCtx): void => { if (result.output !== null) addIssue(ctx, ["output"], "failed or review_required result must null output"); if (result.decision === "proceed") addIssue(ctx, ["decision"], "failed or review_required result cannot proceed"); if (!result.diagnosticPayloadRef) addIssue(ctx, ["diagnosticPayloadRef"], "failed or review_required result must retain diagnosticPayloadRef"); };

export const validatePageStateAbilityResult = (result: PageStateAbilityResultLike, ctx: RefinementCtx): void => { validatePageStateAbilityResultProof(result, ctx); result.status === "success" ? validatePageStateAbilityResultSuccess(result, ctx) : validatePageStateAbilityResultFailure(result, ctx); };