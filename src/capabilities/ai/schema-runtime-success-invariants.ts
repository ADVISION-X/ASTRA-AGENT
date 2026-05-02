import type { z } from "zod";

export function validateAiRuntimeProofSuccessInvariants(input: {
  status: string;
  rawOutputRef: string | null;
  rawOutputHash: string | null;
}, context: z.RefinementCtx) {
  if (input.status === "success" && input.rawOutputRef === null) {
    context.addIssue({ code: "custom", message: "success proof requires rawOutputRef", path: ["rawOutputRef"] });
  }
  if (input.status === "success" && input.rawOutputHash === null) {
    context.addIssue({ code: "custom", message: "success proof requires rawOutputHash", path: ["rawOutputHash"] });
  }
}

export function validateAiRuntimeExecutionOutputSuccessInvariants(input: {
  createdAt: string | null;
  rawOutputRef: string | null;
  rawOutputHash: string | null;
}, context: z.RefinementCtx) {
  if (input.createdAt !== null && input.rawOutputRef === null) {
    context.addIssue({ code: "custom", message: "runtime success requires rawOutputRef", path: ["rawOutputRef"] });
  }
  if (input.createdAt !== null && input.rawOutputHash === null) {
    context.addIssue({ code: "custom", message: "runtime success requires rawOutputHash", path: ["rawOutputHash"] });
  }
}

export function validateAiResultSuccessInvariants(input: {
  status: string;
  rawOutputRef: string | null;
  runtimeProof: { rawOutputRef: string | null; rawOutputHash: string | null };
}, context: z.RefinementCtx) {
  validateAiResultRawOutputRef(input, context);
  validateAiResultRuntimeProofRequirements(input, context);
  validateAiResultRuntimeProofMatch(input, context);
}

function validateAiResultRawOutputRef(input: {
  status: string;
  rawOutputRef: string | null;
}, context: z.RefinementCtx) {
  if (input.status === "success" && input.rawOutputRef === null) {
    context.addIssue({ code: "custom", message: "success result requires rawOutputRef", path: ["rawOutputRef"] });
  }
}

function validateAiResultRuntimeProofRequirements(input: {
  status: string;
  runtimeProof: { rawOutputRef: string | null; rawOutputHash: string | null };
}, context: z.RefinementCtx) {
  if (input.status === "success" && input.runtimeProof.rawOutputRef === null) {
    context.addIssue({ code: "custom", message: "success result requires runtimeProof.rawOutputRef", path: ["runtimeProof", "rawOutputRef"] });
  }
  if (input.status === "success" && input.runtimeProof.rawOutputHash === null) {
    context.addIssue({ code: "custom", message: "success result requires runtimeProof.rawOutputHash", path: ["runtimeProof", "rawOutputHash"] });
  }
}

function validateAiResultRuntimeProofMatch(input: {
  status: string;
  rawOutputRef: string | null;
  runtimeProof: { rawOutputRef: string | null };
}, context: z.RefinementCtx) {
  if (input.status === "success" && input.runtimeProof.rawOutputRef !== input.rawOutputRef) {
    context.addIssue({ code: "custom", message: "runtimeProof.rawOutputRef must match result.rawOutputRef", path: ["runtimeProof", "rawOutputRef"] });
  }
}