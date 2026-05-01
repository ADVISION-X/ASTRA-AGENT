import type { ScreenshotAbilityInput, ScreenshotSourceProof } from "../contract.js";
import type { ScreenshotChildRegistryEntry } from "./screenshot-child-contract.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";
import {
  buildScreenshotSourceFailure,
  hasStoredImageSource,
  resolveStoredImageSourceGate,
  type ScreenshotSourceGateResult,
} from "./screenshot-stored-image-source-gate.js";

function resolveScreenshotSourceKindFailure(request: ScreenshotAbilityInput) {
  if (request.childCapabilityId === "capture-browser-viewport" && request.source.kind !== "browser_viewport") {
    return buildScreenshotSourceFailure({
      reason: "browser_viewport_source_required",
      message: "capture-browser-viewport requires source.kind=browser_viewport.",
    });
  }

  if (request.childCapabilityId === "capture-desktop-screen" && request.source.kind !== "desktop_screen") {
    return buildScreenshotSourceFailure({
      reason: "desktop_screen_source_required",
      message: "capture-desktop-screen requires source.kind=desktop_screen.",
    });
  }

  return null;
}

async function resolveScreenshotSourceGate(input: {
  request: ScreenshotAbilityInput;
  registryEntry: ScreenshotChildRegistryEntry;
  context: ScreenshotRuntimeContext;
}): Promise<ScreenshotSourceGateResult> {
  const sourceKindFailure = resolveScreenshotSourceKindFailure(input.request);
  if (sourceKindFailure) {
    return sourceKindFailure;
  }

  if (!input.registryEntry.requiresSourceProof) {
    return {
      decision: { status: "passed" as const, reason: null },
      sourceProof: input.request.sourceProof,
      failure: null,
    };
  }

  if (!hasStoredImageSource(input.request)) {
    return buildScreenshotSourceFailure({
      reason: "stored_image_source_required",
      message: `${input.request.childCapabilityId} requires source.kind=stored_image.`,
    });
  }

  return resolveStoredImageSourceGate({
    request: input.request,
    context: input.context,
  });
}

export async function runScreenshotSourceGate(input: {
  request: ScreenshotAbilityInput;
  registryEntry: ScreenshotChildRegistryEntry;
  context: ScreenshotRuntimeContext;
}): Promise<ScreenshotSourceGateResult> {
  return resolveScreenshotSourceGate(input);
}
