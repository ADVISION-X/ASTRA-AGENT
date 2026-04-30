import { CaptureBrowserViewportInputSchema, CaptureDesktopScreenInputSchema, CaptureRegionInputSchema, OptimizeLosslessInputSchema, PrepareAiInputInputSchema, ScreenshotExecutionOutputSchema } from "./schema.js";
import type { ScreenshotChildCapabilityId } from "./contract.js";
import type { ScreenshotChildRegistryEntry } from "./runtime/screenshot-child-contract.js";

const REGISTRY_ENTRIES = [
  {
    childCapabilityId: "capture-browser-viewport",
    inputSchema: CaptureBrowserViewportInputSchema,
    outputSchema: ScreenshotExecutionOutputSchema,
    requiresBrowserSession: true,
    requiresPageStateProof: true,
    requiresPrivacyApproval: false,
    requiresSourceProof: false,
    requiresArtifactStorage: true,
    maxDurationMs: 8_000,
    idempotencyPolicy: "strict",
    outputImageKind: "evidence_original",
    coordinateSpacePolicy: "browser_viewport_pixels",
  },
  {
    childCapabilityId: "capture-desktop-screen",
    inputSchema: CaptureDesktopScreenInputSchema,
    outputSchema: ScreenshotExecutionOutputSchema,
    requiresBrowserSession: false,
    requiresPageStateProof: false,
    requiresPrivacyApproval: true,
    requiresSourceProof: false,
    requiresArtifactStorage: true,
    maxDurationMs: 8_000,
    idempotencyPolicy: "strict",
    outputImageKind: "evidence_original",
    coordinateSpacePolicy: "desktop_screen_pixels",
  },
  {
    childCapabilityId: "capture-region",
    inputSchema: CaptureRegionInputSchema,
    outputSchema: ScreenshotExecutionOutputSchema,
    requiresBrowserSession: false,
    requiresPageStateProof: false,
    requiresPrivacyApproval: false,
    requiresSourceProof: true,
    requiresArtifactStorage: true,
    maxDurationMs: 8_000,
    idempotencyPolicy: "content-addressed",
    outputImageKind: "evidence_original",
    coordinateSpacePolicy: "source_image_pixels",
  },
  {
    childCapabilityId: "optimize-lossless",
    inputSchema: OptimizeLosslessInputSchema,
    outputSchema: ScreenshotExecutionOutputSchema,
    requiresBrowserSession: false,
    requiresPageStateProof: false,
    requiresPrivacyApproval: false,
    requiresSourceProof: true,
    requiresArtifactStorage: true,
    maxDurationMs: 8_000,
    idempotencyPolicy: "content-addressed",
    outputImageKind: "evidence_optimized",
    coordinateSpacePolicy: "source_image_pixels",
  },
  {
    childCapabilityId: "prepare-ai-input",
    inputSchema: PrepareAiInputInputSchema,
    outputSchema: ScreenshotExecutionOutputSchema,
    requiresBrowserSession: false,
    requiresPageStateProof: false,
    requiresPrivacyApproval: false,
    requiresSourceProof: true,
    requiresArtifactStorage: true,
    maxDurationMs: 8_000,
    idempotencyPolicy: "content-addressed",
    outputImageKind: "ai_input",
    coordinateSpacePolicy: "derived",
  },
] as const satisfies readonly ScreenshotChildRegistryEntry[];

const REGISTRY = new Map<ScreenshotChildCapabilityId, ScreenshotChildRegistryEntry>(
  REGISTRY_ENTRIES.map((entry) => [entry.childCapabilityId, entry]),
);

export function getScreenshotChildRegistryEntry(childCapabilityId: ScreenshotChildCapabilityId): ScreenshotChildRegistryEntry | null {
  return REGISTRY.get(childCapabilityId) ?? null;
}

export function listScreenshotChildren(): ScreenshotChildCapabilityId[] {
  return REGISTRY_ENTRIES.map((entry) => entry.childCapabilityId);
}
