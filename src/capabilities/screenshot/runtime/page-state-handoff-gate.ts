import type { ScreenshotAbilityInput, ScreenshotChildRegistryEntry } from "../contract.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";

export function runPageStateHandoffGate(input: {
  request: ScreenshotAbilityInput;
  registryEntry: ScreenshotChildRegistryEntry;
}): {
  decision: { status: "passed" | "failed" | "review_required" | "not_applicable"; reason: string | null };
  pageStateProofRef: string | null;
  failure: ReturnType<typeof createScreenshotFailure> | null;
} {
  if (!input.registryEntry.requiresPageStateProof) {
    return {
      decision: { status: "not_applicable", reason: null },
      pageStateProofRef: input.request.pageStateProof?.proofRef ?? null,
      failure: null,
    };
  }

  const pageStateProof = input.request.pageStateProof;
  if (!pageStateProof) {
    if (input.request.capturePolicy.allowFirstCaptureWithoutPageStateProof) {
      return {
        decision: { status: "passed", reason: "first_capture_without_page_state_proof" },
        pageStateProofRef: null,
        failure: null,
      };
    }
    return {
      decision: { status: "review_required", reason: "page_state_proof_required" },
      pageStateProofRef: null,
      failure: createScreenshotFailure({
        code: "page_state_missing",
        message: "Screenshot browser viewport capture requires pageStateProof under current policy.",
      }),
    };
  }

  if (pageStateProof.status !== "approved") {
    const failureCode = pageStateProof.status === "stale" ? "page_state_invalid" : "page_state_invalid";
    const status = pageStateProof.status === "wrong_domain" ? "failed" : "review_required";
    return {
      decision: { status, reason: pageStateProof.status },
      pageStateProofRef: pageStateProof.proofRef,
      failure: createScreenshotFailure({
        code: failureCode,
        message: `Screenshot page state handoff rejected status=${pageStateProof.status}.`,
      }),
    };
  }

  return {
    decision: { status: "passed", reason: null },
    pageStateProofRef: pageStateProof.proofRef,
    failure: null,
  };
}
