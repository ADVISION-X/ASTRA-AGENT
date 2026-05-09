type CommanderMissionView = {
  missionId: string | null;
  humanGoal: string;
  status: string;
  missionRunRef: string | null;
  currentRoundIndex: number;
  requestedPlatform: string | null;
  selectedMapId: string | null;
  lastHumanCommand: string | null;
  reviewRequiredReason: string | null;
  failureReason: string | null;
  startedAt: string | null;
  updatedAt: string | null;
  endedAt: string | null;
};

type CommanderRuntimeSummaryView = {
  runtimeStatus: string;
  currentStep: string | null;
  reviewReason: string | null;
  totalSeenCount: number;
  evidencePacketCount: number;
  browseLedgerCount: number;
  candidateCount: number;
  lastAiFailureReason: string | null;
};

type CommanderBrowserSummaryView = {
  dataMode: string;
  platformId: string;
  platformLabel: string;
  realPlatformConnection: string;
  browserMode: string;
  browserExecutable: string | null;
  browserProfileRef: string;
  browserProfileStatus: string;
  browserProfileDirectory: string;
  browserProfileProvisioning: string;
  browserProfileVerificationStatus: string;
  browserProfileVerificationReason: string;
  loginState: string;
  lastLoginCheckAt: string | null;
  loginRequiredReason: string | null;
  reviewRequiredReason: string | null;
  storeScope: string;
  executionMode: string;
  fallbackMode: string;
  geometryGuard: string;
  viewport: string;
  calibration: string;
  orientation: string;
};

type CommanderCapabilityHealthEntry = {
  id: string;
  label: string;
  tone: "normal" | "good" | "warn" | "danger" | "muted";
  detail: string;
  ownerResponsible?: string | null;
  actionableMessage?: string | null;
  failureReason?: string | null;
  missionRuntimeAvailable?: boolean;
  checkedAt?: string | null;
};

type CommanderCapabilityRosterEntry = {
  abilityGroupId: string;
  displayName: string;
  currentStrength: string;
  purpose: string;
};

type CommanderCandidateView = {
  id: string;
  category: string;
  useCase: string;
  score: number;
  purchaseIntent: string;
  reviewStatus: string;
  evidenceCount: number;
  notes: string[];
  createdAt: string;
  updatedAt: string;
};

type CommanderRecordSummaryView = {
  id: string;
  primary: string;
  secondary: string;
  detail: string;
};

type CommanderRuntimeProofTimelineEntry = {
  id: string;
  createdAt: string;
  step: string;
  status: string;
  message: string;
};

type CommanderAuditSummary = {
  phase: string;
  activeLawDomains: string[];
  lastGeneratedAt: string | null;
  lastRunGeneratedAt: string | null;
  totals: {
    inspectors: number;
    passed: number;
    failed: number;
    blocking: number;
  } | null;
};

type CommanderRecordDetailView = {
  recordType: string;
  recordId: string | null;
  title: string;
  summary: string;
  details: string[];
  status: string | null;
  createdAt: string | null;
};

type CommanderMissionDashboardView = {
  mission: CommanderMissionView;
  runtime: CommanderRuntimeSummaryView;
  browser: CommanderBrowserSummaryView;
  health: CommanderCapabilityHealthEntry[];
  capabilityRoster: CommanderCapabilityRosterEntry[];
  candidates: CommanderCandidateView[];
  reviewQueue: CommanderRecordSummaryView[];
  evidencePackets: CommanderRecordSummaryView[];
  browseLedger: CommanderRecordSummaryView[];
  failedRecords: CommanderRecordSummaryView[];
  runtimeProof: CommanderRuntimeProofTimelineEntry[];
  auditSummary: CommanderAuditSummary;
};

export type {
  CommanderAuditSummary,
  CommanderBrowserSummaryView,
  CommanderCandidateView,
  CommanderCapabilityHealthEntry,
  CommanderCapabilityRosterEntry,
  CommanderMissionDashboardView,
  CommanderMissionView,
  CommanderRecordDetailView,
  CommanderRecordSummaryView,
  CommanderRuntimeProofTimelineEntry,
  CommanderRuntimeSummaryView,
};