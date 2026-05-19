type WorkbenchHealthEntry = {
  id: string;
  groupId: string;
  label: string;
  status: "active" | "degraded";
  tone: "good" | "green" | "yellow" | "red" | "warn" | "danger";
  detail?: string | undefined;
  missionRuntimeAvailable?: boolean | undefined;
  failureReason?: string | undefined;
  actionableMessage?: string | undefined;
  ownerResponsible?: string | undefined;
};

type WorkbenchEvidenceEntry = {
  id: string;
  primary: string;
  secondary: string | null;
  detail: string | null;
  [key: string]: unknown;
};

type WorkbenchRuntimeProofEntry = {
  step: string;
  message: string;
  createdAt: string;
  status: string;
  [key: string]: unknown;
};

type WorkbenchCandidateEntry = {
  id: string;
  useCase: string;
  category: string;
  evidenceCount: number;
  reviewStatus: "pending" | "approved" | "rejected" | "skipped" | "archived" | "hold";
  [key: string]: unknown;
};

type WorkbenchReviewQueueEntry = {
  id: string;
  reviewStatus: string;
  [key: string]: unknown;
};

type WorkbenchRuntimeSummaryView = {
  runtimeStatus: "idle" | "running" | "paused" | "stopped" | "review_required" | "completed" | "failed" | "unknown";
  reviewReason: string | null;
  lastAiFailureReason: string | null;
  currentStep: string | null;
  totalSeenCount: number;
  evidencePacketCount: number;
  browseRecordCount: number;
  candidateCount: number;
};

type WorkbenchBrowserSummaryView = {
  loginState: "logged-in" | "logged-out" | "unknown";
};

type WorkbenchAuditSummaryView = {
  totals: { passed: number; inspectors: number } | null;
  lastGeneratedAt: string | null;
};

type WorkbenchMissionView = {
  missionId: string | null;
  status: "idle" | "running" | "paused" | "stopped" | "review_required" | "completed" | "unknown";
  currentPlatform: string | null;
  userRequirementSummary: string | null;
  startedAt: string | null;
  updatedAt: string;
  lastStopReason: string | null;
  reviewRequiredReason: string | null;
  matchedEvidenceCount: number;
  lastActionFailureCount: number;
  failureReason?: string | null | undefined;
  endedAt?: string | null | undefined;
  humanGoal?: string | null | undefined;
  requestedPlatform?: string | null | undefined;
  targetBindingId?: string | null | undefined;
  reviewStatus?: string | null | undefined;
  currentRoundIndex?: number | null | undefined;
  lastHumanCommand?: string | null | undefined;
};

export type WorkbenchCommanderMissionDashboardView = {
  mission: WorkbenchMissionView | null;
  runtime: WorkbenchRuntimeSummaryView;
  browser: WorkbenchBrowserSummaryView;
  health: WorkbenchHealthEntry[];
  capabilityRoster: { groupId: string; status: "active" }[];
  candidates: WorkbenchCandidateEntry[];
  reviewQueue: WorkbenchReviewQueueEntry[];
  evidencePackets: WorkbenchEvidenceEntry[];
  browseRecord: never[];
  failedRecords: never[];
  runtimeProof: WorkbenchRuntimeProofEntry[] | null;
  auditSummary: WorkbenchAuditSummaryView;
};
