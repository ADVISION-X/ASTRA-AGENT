import type { ScreenshotAbilityInput, ScreenshotChildRegistryEntry, ScreenshotSourceProof } from "../contract.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";

export function runScreenshotSourceGate(input: {
  request: ScreenshotAbilityInput;
  registryEntry: ScreenshotChildRegistryEntry;
}): {
  decision: { status: "passed" | "failed"; reason: string | null };
  sourceProof: ScreenshotSourceProof | null;
  failure: ReturnType<typeof createScreenshotFailure> | null;
} {
  const request = input.request;

  if (request.childCapabilityId === "capture-browser-viewport" && request.source.kind !== "browser_viewport") {
    return {
      decision: { status: "failed", reason: "browser_viewport_source_required" },
      sourceProof: null,
      failure: createScreenshotFailure({
        code: "source_policy_violation",
        message: "capture-browser-viewport requires source.kind=browser_viewport.",
      }),
    };
  }

  if (request.childCapabilityId === "capture-desktop-screen" && request.source.kind !== "desktop_screen") {
    return {
      decision: { status: "failed", reason: "desktop_screen_source_required" },
      sourceProof: null,
      failure: createScreenshotFailure({
        code: "source_policy_violation",
        message: "capture-desktop-screen requires source.kind=desktop_screen.",
      }),
    };
  }

  if (input.registryEntry.requiresSourceProof) {
    if (request.source.kind !== "stored_image") {
      return {
        decision: { status: "failed", reason: "stored_image_source_required" },
        sourceProof: null,
        failure: createScreenshotFailure({
          code: "source_policy_violation",
          message: `${request.childCapabilityId} requires source.kind=stored_image.`,
        }),
      };
    }

    if (!request.source.sourceProof.sourceStorageRef || request.source.sourceProof.sourceStorageRef !== request.source.sourceStorageRef) {
      return {
        decision: { status: "failed", reason: "source_proof_storage_mismatch" },
        sourceProof: null,
        failure: createScreenshotFailure({
          code: "source_policy_violation",
          message: "Stored image sourceProof must match sourceStorageRef.",
        }),
      };
    }

    return {
      decision: { status: "passed", reason: null },
      sourceProof: request.source.sourceProof,
      failure: null,
    };
  }

  return {
    decision: { status: "passed", reason: null },
    sourceProof: request.sourceProof,
    failure: null,
  };
}
