export type RuntimeComponentName =
  | "console"
  | "agent"
  | "browserController"
  | "localAi"
  | "dataStore";

export type RuntimeComponentHealth = {
  name: RuntimeComponentName;
  ok: boolean;
  detail: string;
};

export type RuntimeHealthReport = {
  generatedAt: string;
  components: RuntimeComponentHealth[];
};

export type RuntimePageReadyStatus =
  | "idle"
  | "opening_target_page"
  | "waiting_page_ready"
  | "page_ready"
  | "navigation_failed"
  | "review_required";

export type RuntimeRoundStep =
  | "idle"
  | "opening_target_page"
  | "waiting_page_ready"
  | "calibrating_geometry"
  | "observing_current_video"
  | "capturing_video_screenshot"
  | "calling_local_ai"
  | "planning_action"
  | "executing_action"
  | "recording_results"
  | "review_required"
  | "stopped"
  | "completed"
  | "failed";

export type RuntimeDeliveryState = {
  currentRoundStep: RuntimeRoundStep;
  currentUrl: string;
  targetUrl: string | null;
  pageReadyStatus: RuntimePageReadyStatus;
  lastNavigationError: string | null;
  lastStopReason: string | null;
  reviewRequiredReason: string | null;
  geometryGuardStatus: string;
  viewport: string;
  calibration: string;
  localAiStatus: string;
  latestScreenshotEvidenceId: string | null;
  latestScreenshotPath: string | null;
  latestAiResultId: string | null;
  latestAiResultSummary: string | null;
  latestActionLogId: string | null;
  latestActionResult: string | null;
  latestRoundTraceStep: string | null;
  latestRoundTraceStatus: string | null;
  latestRoundTraceDetail: string | null;
  noCandidateReason: string | null;
  lastError: string | null;
};

export type BrowseRuntimeSnapshot = {
  runtimeStatus: string;
  browserMode: string;
  browserExecutable: string | null;
  browserProfileRef: string;
  browserProfileStatus: string;
  browserProfileDirectory: string;
  browserProfileProvisioning: string;
  browserProfileVerificationStatus: string;
  browserProfileVerificationReason: string | null;
  loginState: string;
  lastLoginCheckAt: string | null;
  loginRequiredReason: string | null;
  currentStep: string;
  currentUrl: string;
  targetUrl: string | null;
  pageSafetyState: string;
  feedReadyStatus: string;
  videoStableStatus: string;
  currentVideoVisitId: string | null;
  geometryStatus: string;
  latestVideoEvidenceId: string | null;
  latestAIResult: {
    id: string;
    taskType: string;
    confidence: number;
  } | null;
  latestProductPresenceDecision: string | null;
  latestBrowseLedgerEntryId: string | null;
  latestEvidencePacketId: string | null;
  latestStructuredActionLogId: string | null;
  latestActionLogId: string | null;
  latestRoundOutcome: string | null;
  reviewRequiredReason: string | null;
  counters: {
    totalSeenCount: number;
    productYesCount: number;
    productNoCount: number;
    uncertainCount: number;
    duplicateCount: number;
    evidencePacketCount: number;
    browseLedgerCount: number;
  };
};