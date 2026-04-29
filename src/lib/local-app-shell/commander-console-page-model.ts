import type { Locale } from "../localization/dictionaries.js";

import type {
  CommanderCandidateView,
  CommanderMissionDashboardView,
  CommanderRecordSummaryView,
  CommanderRuntimeProofTimelineEntry,
} from "../../capabilities/commander-console/index.js";

export type CommanderConsolePageMetric = {
  label: string;
  value: string;
  tone?: "normal" | "good" | "warn" | "danger" | "muted";
};

export type CommanderConsolePageRecord = {
  id: string;
  primary: string;
  secondary: string;
  detail: string;
};

export type CommanderConsolePageLog = {
  createdAt: string;
  step: string;
  status: string;
  message: string;
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

export type CommanderConsolePageModel = {
  missionSummary: string;
  missionStatus: string;
  missionMetrics: CommanderConsolePageMetric[];
  runtimeMetrics: CommanderConsolePageMetric[];
  browserMetrics: CommanderConsolePageMetric[];
  healthMetrics: CommanderConsolePageMetric[];
  auditSummary: {
    phase: string;
    activeDomains: number;
    totals: string;
    generatedAt: string;
  };
  candidates: CommanderConsolePageCandidate[];
  reviewQueue: CommanderConsolePageRecord[];
  evidencePackets: CommanderConsolePageRecord[];
  browseLedger: CommanderConsolePageRecord[];
  failedRecords: CommanderConsolePageRecord[];
  runtimeProof: CommanderConsolePageLog[];
};

function formatMissionSummary(dashboard: CommanderMissionDashboardView, locale: Locale): string {
  if (!dashboard.mission.missionId) {
    return locale === "zh" ? "当前没有活动任务，指挥台处于待命状态。" : "No active mission is running. Commander Console is standing by.";
  }

  return locale === "zh"
    ? `任务 ${dashboard.mission.missionId} 正在 ${dashboard.mission.status}，目标为 ${dashboard.mission.humanGoal || "未填写"}。`
    : `Mission ${dashboard.mission.missionId} is ${dashboard.mission.status} with goal ${dashboard.mission.humanGoal || "unspecified"}.`;
}

function formatTotals(dashboard: CommanderMissionDashboardView): string {
  if (!dashboard.auditSummary.totals) {
    return "not available";
  }

  const totals = dashboard.auditSummary.totals;
  return `inspectors ${totals.inspectors} / pass ${totals.passed} / fail ${totals.failed} / block ${totals.blocking}`;
}

function mapRecord(record: CommanderRecordSummaryView): CommanderConsolePageRecord {
  return {
    id: record.id,
    primary: record.primary,
    secondary: record.secondary,
    detail: record.detail,
  };
}

function mapRuntimeProof(entry: CommanderRuntimeProofTimelineEntry): CommanderConsolePageLog {
  return {
    createdAt: entry.createdAt,
    step: entry.step,
    status: entry.status,
    message: entry.message,
  };
}

function mapCandidate(candidate: CommanderCandidateView): CommanderConsolePageCandidate {
  return {
    id: candidate.id,
    category: candidate.category,
    useCase: candidate.useCase,
    score: Number.isFinite(candidate.score) ? candidate.score.toFixed(2) : String(candidate.score),
    purchaseIntent: candidate.purchaseIntent,
    reviewStatus: candidate.reviewStatus,
    evidenceCount: candidate.evidenceCount,
    notes: candidate.notes,
    createdAt: candidate.createdAt,
  };
}

export function buildCommanderConsolePageModel(dashboard: CommanderMissionDashboardView, locale: Locale): CommanderConsolePageModel {
  return {
    missionSummary: formatMissionSummary(dashboard, locale),
    missionStatus: dashboard.mission.status,
    missionMetrics: [
      { label: "mission", value: dashboard.mission.missionId ?? "none", tone: dashboard.mission.missionId ? "normal" : "muted" },
      { label: "goal", value: dashboard.mission.humanGoal || "unspecified", tone: dashboard.mission.humanGoal ? "normal" : "muted" },
      { label: "platform", value: dashboard.mission.requestedPlatform ?? "unassigned", tone: dashboard.mission.requestedPlatform ? "normal" : "muted" },
      { label: "map", value: dashboard.mission.selectedMapId ?? "unassigned", tone: dashboard.mission.selectedMapId ? "normal" : "muted" },
      { label: "round", value: String(dashboard.mission.currentRoundIndex) },
      { label: "last command", value: dashboard.mission.lastHumanCommand ?? "none", tone: dashboard.mission.lastHumanCommand ? "normal" : "muted" },
    ],
    runtimeMetrics: [
      { label: "status", value: dashboard.runtime.runtimeStatus },
      { label: "step", value: dashboard.runtime.currentStep ?? "none", tone: dashboard.runtime.currentStep ? "normal" : "muted" },
      { label: "review", value: dashboard.runtime.reviewReason ?? "none", tone: dashboard.runtime.reviewReason ? "warn" : "muted" },
      { label: "seen", value: String(dashboard.runtime.totalSeenCount) },
      { label: "candidates", value: String(dashboard.runtime.candidateCount) },
      { label: "ai failure", value: dashboard.runtime.lastAiFailureReason ?? "none", tone: dashboard.runtime.lastAiFailureReason ? "danger" : "muted" },
    ],
    browserMetrics: [
      { label: "mode", value: dashboard.browser.browserMode },
      { label: "profile", value: dashboard.browser.browserProfileRef },
      { label: "profile status", value: dashboard.browser.browserProfileStatus },
      { label: "login", value: dashboard.browser.loginState },
      { label: "execution", value: dashboard.browser.executionMode },
      { label: "viewport", value: dashboard.browser.viewport },
    ],
    healthMetrics: dashboard.health.map((entry) => ({ label: entry.label, value: entry.detail, tone: entry.tone })),
    auditSummary: {
      phase: dashboard.auditSummary.phase,
      activeDomains: dashboard.auditSummary.activeCapabilityDomains.length,
      totals: formatTotals(dashboard),
      generatedAt: dashboard.auditSummary.lastGeneratedAt ?? dashboard.auditSummary.lastRunGeneratedAt ?? "not available",
    },
    candidates: dashboard.candidates.map(mapCandidate),
    reviewQueue: dashboard.reviewQueue.map(mapRecord),
    evidencePackets: dashboard.evidencePackets.map(mapRecord),
    browseLedger: dashboard.browseLedger.map(mapRecord),
    failedRecords: dashboard.failedRecords.map(mapRecord),
    runtimeProof: dashboard.runtimeProof.map(mapRuntimeProof),
  };
}