import type { PlatformAdapter } from "../../../lib/local-runtime/platform-runtime-contract.js";
import type { RoundLifecycleStep } from "../../../types/evidence-packet.js";
import type { RuntimeDeliveryState } from "../../../types/runtime.js";

const REVIEW_REQUIRED_FAILURE_MARKERS = [
  "silent default managed profile is forbidden for real-platform proof",
  "operator verified browser profile is required before opening the real platform",
] as const;

export const STEP_TIMEOUT_MS = {
  open_target_page: 15_000,
  wait_video_stable: 20_000,
  record_video_evidence: 20_000,
  ask_ai_product_presence: 90_000,
  scroll_next_video: 10_000,
} as const;

const SINGLE_FRAME_FALLBACK_REASON = "multi_frame_capture_not_implemented";

const SINGLE_FRAME_FALLBACK_MISSING_FRAMES = [
  { frameLabel: "frame_6s", unavailableReason: SINGLE_FRAME_FALLBACK_REASON },
  { frameLabel: "frame_10s", unavailableReason: SINGLE_FRAME_FALLBACK_REASON },
] as const;

export class StepTimeoutError extends Error {
  readonly currentStep: RoundLifecycleStep;
  readonly taskRunId: string;
  readonly roundId: string;
  readonly durationMs: number;
  readonly videoVisitId: string | null;
  readonly reviewRequiredReason: string;

  constructor(input: {
    currentStep: RoundLifecycleStep;
    taskRunId: string;
    roundId: string;
    durationMs: number;
    videoVisitId: string | null;
    reviewRequiredReason: string;
  }) {
    super(input.reviewRequiredReason);
    this.name = "StepTimeoutError";
    this.currentStep = input.currentStep;
    this.taskRunId = input.taskRunId;
    this.roundId = input.roundId;
    this.durationMs = input.durationMs;
    this.videoVisitId = input.videoVisitId;
    this.reviewRequiredReason = input.reviewRequiredReason;
  }
}

export function createInitialDeliveryState(): RuntimeDeliveryState {
  return {
    currentRoundStep: "idle",
    currentUrl: "about:blank",
    targetUrl: null,
    pageReadyStatus: "idle",
    lastNavigationError: null,
    lastStopReason: null,
    reviewRequiredReason: null,
    geometryGuardStatus: "Not calibrated",
    viewport: "unknown",
    calibration: "Calibration required",
    localAiStatus: "idle",
    localAiHealth: null,
    lastAiTaskType: null,
    lastAiFailureReason: null,
    latestScreenshotEvidenceId: null,
    latestScreenshotPath: null,
    latestAiResultId: null,
    latestAiResultSummary: null,
    latestActionLogId: null,
    latestActionResult: null,
    latestRoundTraceStep: null,
    latestRoundTraceStatus: null,
    latestRoundTraceDetail: null,
    noCandidateReason: null,
    lastError: null,
  };
}

export function buildSingleFrameFallbackDetails(): {
  samplingStrategy: "single_frame_fallback";
  expectedFrameCount: 3;
  validFrameCount: 1;
  fallbackReason: string;
  missingFrames: Array<{ frameLabel: "frame_6s" | "frame_10s"; unavailableReason: string }>;
} {
  return {
    samplingStrategy: "single_frame_fallback",
    expectedFrameCount: 3,
    validFrameCount: 1,
    fallbackReason: SINGLE_FRAME_FALLBACK_REASON,
    missingFrames: [...SINGLE_FRAME_FALLBACK_MISSING_FRAMES],
  };
}

export function isReviewRequiredFailure(message: string): boolean {
  return REVIEW_REQUIRED_FAILURE_MARKERS.some((marker) => message.includes(marker));
}

export function refreshDeliveryStateFromAdapter(deliveryState: RuntimeDeliveryState, adapter: PlatformAdapter): void {
  const runtimeDiagnostics = adapter.getRuntimeDiagnostics();
  const operatorMode = adapter.getOperatorModeInfo();
  deliveryState.currentUrl = runtimeDiagnostics.currentUrl;
  deliveryState.targetUrl = runtimeDiagnostics.targetUrl;
  deliveryState.pageReadyStatus = runtimeDiagnostics.pageReadyStatus;
  deliveryState.lastNavigationError = runtimeDiagnostics.lastNavigationError;
  deliveryState.geometryGuardStatus = operatorMode.geometryGuard;
  deliveryState.viewport = operatorMode.viewport;
  deliveryState.calibration = operatorMode.calibration;
}