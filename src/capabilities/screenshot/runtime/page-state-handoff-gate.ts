import type { ScreenshotAbilityInput } from "../contract.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";
import type { ScreenshotChildRegistryEntry } from "./screenshot-child-contract.js";

function buildPageStateHandoffFailure(input: {
  status: "failed" | "review_required";
  reason: string;
  code: "page_state_missing" | "page_state_invalid";
  message: string;
  pageStateProofRef: string | null;
}) {
  return {
    decision: { status: input.status, reason: input.reason },
    pageStateProofRef: input.pageStateProofRef,
    failure: createScreenshotFailure({
      code: input.code,
      message: input.message,
    }),
  };
}

function resolvePageStateHandoffGate(input: {
  request: ScreenshotAbilityInput;
  registryEntry: ScreenshotChildRegistryEntry;
}) {
  if (!input.registryEntry.requiresPageStateProof) {
    return {
      decision: { status: "not_applicable" as const, reason: null },
      pageStateProofRef: input.request.pageStateProof?.proofRef ?? null,
      failure: null,
    };
  }

  const pageStateProof = input.request.pageStateProof;
  if (!pageStateProof) {
    if (input.request.capturePolicy.allowFirstCaptureWithoutPageStateProof) {
      return buildPageStateHandoffFailure({
        status: "review_required",
        reason: "bootstrap_capture_without_page_state_proof",
        code: "page_state_missing",
        message: "Screenshot bootstrap capture without pageStateProof is review_required and non-authoritative.",
        pageStateProofRef: null,
      });
    }

    return buildPageStateHandoffFailure({
      status: "review_required",
      reason: "page_state_proof_required",
      code: "page_state_missing",
      message: "Screenshot browser viewport capture requires pageStateProof under current policy.",
      pageStateProofRef: null,
    });
  }

  if (pageStateProof.status !== "approved") {
    return buildPageStateHandoffFailure({
      status: "review_required",
      reason: `page_state_observation:${pageStateProof.status}`,
      code: "page_state_invalid",
      message: `Screenshot page state handoff received non-authoritative pageStateProof status=${pageStateProof.status}.`,
      pageStateProofRef: pageStateProof.proofRef,
    });
  }

  return {
    decision: { status: "passed" as const, reason: null },
    pageStateProofRef: pageStateProof.proofRef,
    failure: null,
  };
}

export function runPageStateHandoffGate(input: {
  request: ScreenshotAbilityInput;
  registryEntry: ScreenshotChildRegistryEntry;
}): {
  decision: { status: "passed" | "failed" | "review_required" | "not_applicable"; reason: string | null };
  pageStateProofRef: string | null;
  failure: ReturnType<typeof createScreenshotFailure> | null;
} {
  return resolvePageStateHandoffGate(input);
}
