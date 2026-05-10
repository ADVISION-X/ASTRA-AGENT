import type { ScreenshotAbilityInput } from "../contract.js";

const PRODUCT_PRESENCE_CAPTURE_STEP_ID = "capture-current-video-viewport" as const;
const PRODUCT_PRESENCE_PREPARE_STEP_ID = "prepare-current-video-ai-input" as const;
const PRODUCT_PRESENCE_LIGHTWEIGHT_MAX_AI_WIDTH = 720;
const PRODUCT_PRESENCE_LIGHTWEIGHT_MAX_DURATION_MS = 1500;

type ScreenshotLightweightProfile = "default" | "observation_lightweight";

function resolveRequestedMaxAiWidth(request: ScreenshotAbilityInput): number | null {
  return request.maxAiWidth ?? request.capturePolicy.maxAiWidth ?? null;
}

function usesProductPresenceLightweightPolicy(request: ScreenshotAbilityInput): boolean {
  const requestedMaxAiWidth = resolveRequestedMaxAiWidth(request);

  return request.capturePolicy.evidencePolicy === "ai_input"
    && request.capturePolicy.preservePixels === false
    && request.capturePolicy.maxDurationMs <= PRODUCT_PRESENCE_LIGHTWEIGHT_MAX_DURATION_MS
    && requestedMaxAiWidth !== null
    && requestedMaxAiWidth <= PRODUCT_PRESENCE_LIGHTWEIGHT_MAX_AI_WIDTH;
}

export function isProductPresenceLightweightObservation(request: ScreenshotAbilityInput): boolean {
  if (!usesProductPresenceLightweightPolicy(request)) {
    return false;
  }

  return (
    (request.childCapabilityId === "capture-browser-viewport" && request.stepId === PRODUCT_PRESENCE_CAPTURE_STEP_ID)
    || (request.childCapabilityId === "prepare-ai-input" && request.stepId === PRODUCT_PRESENCE_PREPARE_STEP_ID)
  );
}

export function resolveScreenshotCaptureProfile(request: ScreenshotAbilityInput): ScreenshotLightweightProfile {
  return request.childCapabilityId === "capture-browser-viewport" && isProductPresenceLightweightObservation(request)
    ? "observation_lightweight"
    : "default";
}

export function resolveScreenshotAiInputEncodeProfile(request: ScreenshotAbilityInput): ScreenshotLightweightProfile {
  return request.childCapabilityId === "prepare-ai-input" && isProductPresenceLightweightObservation(request)
    ? "observation_lightweight"
    : "default";
}