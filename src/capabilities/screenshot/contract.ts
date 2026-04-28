import type { BrowserCaptureResult, BrowserController } from "../../lib/browser/browser-controller.js";

export const SCREENSHOT_ABILITY_GROUP_ID = "screenshot";
export const DEFAULT_AI_INPUT_MAX_WIDTH = 768;

export type ScreenshotAbilityGroupId = typeof SCREENSHOT_ABILITY_GROUP_ID;
export type ScreenshotChildCapabilityId =
  | "capture-browser-viewport"
  | "capture-desktop-screen"
  | "capture-region"
  | "optimize-lossless"
  | "prepare-ai-input";

export type ScreenshotAbilityStatus = "success" | "failed" | "review_required";
export type ScreenshotImageKind = "evidence_original" | "evidence_optimized" | "ai_input";
export type ScreenshotCoordinateSpace =
  | "browser_viewport_pixels"
  | "desktop_screen_pixels"
  | "source_image_pixels"
  | "ai_input_pixels";
export type ScreenshotEvidencePolicy = "evidence_original" | "evidence_optimized" | "ai_input" | "all";

export type ScreenshotBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  sourceScreenshotEvidenceId: string;
  sourceStorageRef: string;
  coordinateSpace: Exclude<ScreenshotCoordinateSpace, "ai_input_pixels">;
};

export type ScreenshotScaleMapping = {
  sourceScreenshotEvidenceId: string | null;
  sourceStorageRef: string | null;
  sourceCoordinateSpace: Exclude<ScreenshotCoordinateSpace, "ai_input_pixels"> | null;
  cropOffsetX: number;
  cropOffsetY: number;
  scaleX: number;
  scaleY: number;
};

export type ScreenshotSource =
  | {
      kind: "browser_viewport";
      pageUrl?: string | null;
      pageTitle?: string | null;
    }
  | {
      kind: "desktop_screen";
      screenId?: string | null;
    }
  | {
      kind: "stored_image";
      storageRef: string;
      sourceScreenshotEvidenceId?: string | null;
      coordinateSpace?: Exclude<ScreenshotCoordinateSpace, "ai_input_pixels">;
    };

export type ScreenshotAbilityInput = {
  childCapabilityId: ScreenshotChildCapabilityId;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  source: ScreenshotSource;
  region: ScreenshotBoundingBox | null;
  requestedBy: string;
  purpose: string;
  maxAiWidth: number | null;
  preservePixels: boolean;
  evidencePolicy: ScreenshotEvidencePolicy;
  contentLines: string[];
};

export type ScreenshotAbilityResult = {
  status: ScreenshotAbilityStatus;
  abilityGroupId: ScreenshotAbilityGroupId;
  childCapabilityId: ScreenshotChildCapabilityId;
  evidenceId: string | null;
  storageRef: string | null;
  pageUrl: string | null;
  pageTitle: string | null;
  width: number | null;
  height: number | null;
  originalWidth: number | null;
  originalHeight: number | null;
  imageKind: ScreenshotImageKind | null;
  coordinateSpace: ScreenshotCoordinateSpace | null;
  scaleMapping: ScreenshotScaleMapping | null;
  sourceScreenshotEvidenceId: string | null;
  screenId: string | null;
  sourceHash: string | null;
  outputHash: string | null;
  failureReason: string | null;
  dataQualityFlags: string[];
  createdAt: string;
  durationMs: number;
  browserCapture: BrowserCaptureResult | null;
};

export type ScreenshotAbilityContext = {
  browserController: BrowserController;
  outputRootDir: string;
  defaultAiMaxWidth: number;
};

export interface ScreenshotChildCapability {
  readonly abilityGroupId: ScreenshotAbilityGroupId;
  readonly childCapabilityId: ScreenshotChildCapabilityId;

  execute(
    input: ScreenshotAbilityInput,
    context: ScreenshotAbilityContext,
  ): Promise<ScreenshotAbilityResult>;
}

export interface ScreenshotAbilityGroup {
  listChildCapabilityIds(): ScreenshotChildCapabilityId[];
  execute(input: ScreenshotAbilityInput): Promise<ScreenshotAbilityResult>;
  captureBrowserViewport(
    input: Omit<ScreenshotAbilityInput, "childCapabilityId" | "source"> & {
      source?: Extract<ScreenshotSource, { kind: "browser_viewport" }>;
    },
  ): Promise<ScreenshotAbilityResult>;
  captureDesktopScreen(
    input: Omit<ScreenshotAbilityInput, "childCapabilityId" | "source"> & {
      source?: Extract<ScreenshotSource, { kind: "desktop_screen" }>;
    },
  ): Promise<ScreenshotAbilityResult>;
  captureRegion(input: Omit<ScreenshotAbilityInput, "childCapabilityId">): Promise<ScreenshotAbilityResult>;
  optimizeLossless(input: Omit<ScreenshotAbilityInput, "childCapabilityId">): Promise<ScreenshotAbilityResult>;
  prepareAiInput(input: Omit<ScreenshotAbilityInput, "childCapabilityId">): Promise<ScreenshotAbilityResult>;
}