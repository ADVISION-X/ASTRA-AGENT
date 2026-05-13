type AiRuntimeHealth = {
  overallStatus: "ready" | "degraded" | "unavailable";
  implementationStatus: string;
  detail: string;
  lastTaskType?: string | null;
  lastInvocationStatus?: string | null;
};

type AppShellComponentName =
  | "console"
  | "agent"
  | "browserController"
  | "dataStore";

type MissionReadinessComponentName =
  | "mission"
  | "browserController"
  | "localAi"
  | "dataStore";

type RuntimeComponentHealth<TName extends string = string> = {
  name: TName;
  ok: boolean;
  detail: string;
  ownerResponsible?: string;
  actionableMessage?: string;
  severity?: "info" | "warning" | "blocked";
  source?: string;
};

type RuntimeHealthReport = {
  kind: "app-shell-health";
  status: "ready" | "failed";
  actionableMessage: string;
  generatedAt: string;
  components: RuntimeComponentHealth<AppShellComponentName>[];
};

type MissionReadinessReport = {
  kind: "mission-readiness";
  status: "ready" | "degraded";
  actionableMessage: string;
  generatedAt: string;
  components: RuntimeComponentHealth<MissionReadinessComponentName>[];
  primaryBlockingReason: RuntimeComponentHealth<MissionReadinessComponentName> | null;
  blockingReasons: RuntimeComponentHealth<MissionReadinessComponentName>[];
  warnings: RuntimeComponentHealth<MissionReadinessComponentName>[];
};

type RuntimePageReadyStatus =
  | "idle"
  | "opening_target_page"
  | "waiting_page_ready"
  | "page_ready"
  | "navigation_failed"
  | "review_required";

type RuntimeRoundStep =
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

type RuntimeDeliveryState = {
  currentRoundStep: RuntimeRoundStep;
  currentUrl: string;
  targetUrl: string | null;
  surfaceReadyStatus: RuntimePageReadyStatus;
  lastNavigationError: string | null;
  lastStopReason: string | null;
  reviewRequiredReason: string | null;
  geometryGuardStatus: string;
  viewport: string;
  calibration: string;
  localAiStatus: string;
  localAiHealth: AiRuntimeHealth | null;
  lastAiTaskType: string | null;
  lastAiFailureReason: string | null;
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

type BrowseRuntimeSnapshot = {
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
  streamReadyStatus: string;
  videoStableStatus: string;
  currentVideoVisitId: string | null;
  geometryStatus: string;
  latestVideoEvidenceId: string | null;
  latestAIResult: {
    id: string;
    taskType: string;
    confidence: number;
    status?: string;
    summary?: string | null;
  } | null;
  localAiHealthStatus?: string | null;
  latestAiFailureReason?: string | null;
  latestFailureEventType?: string | null;
  latestFailureEventMessage?: string | null;
  latestSamplingStrategy?: string | null;
  latestSamplingFailureReason?: string | null;
  latestMissingFrames?: Array<{ frameLabel: string; unavailableReason: string }>;
  latestProductPresenceDecision: string | null;
  latestBrowseRecordEntryId: string | null;
  latestEvidencePacketId: string | null;
  latestRuntimeActionEventId: string | null;
  latestActionLogId: string | null;
  latestRoundOutcome: string | null;
  reviewRequiredReason: string | null;
  counters: {
    totalSeenCount: number;
    productYesCount: number;
    productNoCount: number;
    ambiguousCount: number;
    duplicateCount: number;
    evidencePacketCount: number;
    browseRecordCount: number;
  };
};export type { AppShellComponentName, MissionReadinessComponentName, RuntimeComponentHealth, RuntimeHealthReport, MissionReadinessReport, RuntimePageReadyStatus, RuntimeRoundStep, RuntimeDeliveryState, BrowseRuntimeSnapshot };
