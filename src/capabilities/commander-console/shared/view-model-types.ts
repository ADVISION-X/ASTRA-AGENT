import type { Locale } from "../../../lib/localization/dictionaries.js";
import type { CommanderHealthSummary } from "./health-summary.js";

export type CommanderMissionView = {
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

export type CommanderRuntimeSummaryView = {
  runtimeStatus: string;
  currentStep: string | null;
  reviewReason: string | null;
  totalSeenCount: number;
  evidencePacketCount: number;
  browseLedgerCount: number;
  candidateCount: number;
  lastAiFailureReason: string | null;
};

export type CommanderBrowserSummaryView = {
  browserMode: string;
  browserExecutable: string | null;
  browserProfileRef: string;
  browserProfileStatus: string;
  loginState: string;
  executionMode: string;
  geometryGuard: string;
  viewport: string;
  calibration: string;
};

export type CommanderCapabilityRosterEntry = {
  abilityGroupId: string;
  displayName: string;
  currentStrength: string;
  purpose: string;
};

export type CommanderCandidateView = {
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

export type CommanderRecordSummaryView = {
  id: string;
  primary: string;
  secondary: string;
  detail: string;
};

export type CommanderRuntimeProofEntry = {
  id: string;
  createdAt: string;
  step: string;
  status: string;
  message: string;
};

export type CommanderAuditSummary = {
  phase: string;
  activeCapabilityDomains: string[];
  lastGeneratedAt: string | null;
  lastRunGeneratedAt: string | null;
  totals: {
    inspectors: number;
    passed: number;
    failed: number;
    blocking: number;
  } | null;
};

export type CommanderRecordDetailView = {
  recordType: "candidate" | "evidence-packet" | "browse-ledger" | "failed-record" | "runtime-event" | "mission" | "not-found";
  recordId: string | null;
  title: string;
  summary: string;
  details: string[];
  status: string | null;
  createdAt: string | null;
};

export type CommanderMissionDashboard = {
  mission: CommanderMissionView;
  runtime: CommanderRuntimeSummaryView;
  browser: CommanderBrowserSummaryView;
  health: CommanderHealthSummary[];
  capabilityRoster: CommanderCapabilityRosterEntry[];
  candidates: CommanderCandidateView[];
  reviewQueue: CommanderRecordSummaryView[];
  evidencePackets: CommanderRecordSummaryView[];
  browseLedger: CommanderRecordSummaryView[];
  failedRecords: CommanderRecordSummaryView[];
  runtimeProof: CommanderRuntimeProofEntry[];
  auditSummary: CommanderAuditSummary;
};

export type CommanderMetricTone = "normal" | "good" | "warn" | "danger" | "muted";

export type CommanderConsolePageMetric = {
  label: string;
  value: string;
  tone?: CommanderMetricTone;
};

export type CommanderConsolePageCandidate = {
  id: string;
  category: string;
  useCase: string;
  score: string;
  purchaseIntent: string;
  reviewStatus: string;
  evidenceCount: number;
  notes: string[];
  createdAt: string;
};

export type CommanderConsolePageRecord = {
  id: string;
  primary: string;
  secondary: string;
  detail: string;
};

export type CommanderConsolePageLog = {
  id: string;
  createdAt: string;
  step: string;
  status: string;
  message: string;
};

export type CommanderConsolePageAuditSummary = {
  phase: string;
  activeDomains: number;
  totals: string;
  generatedAt: string;
};

export type CommanderConsolePageModel = {
  locale: Locale;
  missionStatus: string;
  missionSummary: string;
  missionMetrics: CommanderConsolePageMetric[];
  runtimeMetrics: CommanderConsolePageMetric[];
  browserMetrics: CommanderConsolePageMetric[];
  healthMetrics: CommanderConsolePageMetric[];
  candidates: CommanderConsolePageCandidate[];
  reviewQueue: CommanderConsolePageRecord[];
  evidencePackets: CommanderConsolePageRecord[];
  browseLedger: CommanderConsolePageRecord[];
  failedRecords: CommanderConsolePageRecord[];
  runtimeProof: CommanderConsolePageLog[];
  auditSummary: CommanderConsolePageAuditSummary;
};
