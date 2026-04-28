import type { Locale } from "../../lib/localization/dictionaries.js";

import type {
  CommanderConsolePageAuditSummary,
  CommanderConsolePageCandidate,
  CommanderConsolePageLog,
  CommanderConsolePageMetric,
  CommanderMetricTone,
  CommanderConsolePageModel,
  CommanderConsolePageRecord,
  CommanderMissionDashboard,
} from "./shared/view-model-types.js";

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

const formatScore = (value: number): string => `${(value * 100).toFixed(1)}%`;

const toTone = (value: string | boolean | null | undefined): CommanderMetricTone => {
  if (value === true) {
    return "good";
  }
  if (value === false || value === "failed" || value === "error" || value === "unavailable" || value === "blocked") {
    return "danger";
  }
  if (value === "warning" || value === "review_required" || value === "paused") {
    return "warn";
  }
  if (value === null || value === undefined || value === "-") {
    return "muted";
  }
  return "normal";
};

const buildMissionMetrics = (dashboard: CommanderMissionDashboard): CommanderConsolePageMetric[] => [
  { label: "Mission Status", value: dashboard.mission.status, tone: toTone(dashboard.mission.status) },
  { label: "Mission ID", value: dashboard.mission.missionId ?? "-", tone: "muted" },
  { label: "Mission Run", value: dashboard.mission.missionRunRef ?? "-", tone: "muted" },
  { label: "Round Index", value: String(dashboard.mission.currentRoundIndex), tone: "muted" },
  { label: "Requested Platform", value: dashboard.mission.requestedPlatform ?? "-", tone: "muted" },
  { label: "Last Human Command", value: dashboard.mission.lastHumanCommand ?? "-", tone: "muted" },
];

const buildRuntimeMetrics = (dashboard: CommanderMissionDashboard): CommanderConsolePageMetric[] => {
  const lastAiFailure = dashboard.runtime.lastAiFailureReason ?? "-";
  return [
    { label: "Runtime Status", value: dashboard.runtime.runtimeStatus, tone: toTone(dashboard.runtime.runtimeStatus) },
    { label: "Current Step", value: dashboard.runtime.currentStep ?? "-", tone: "muted" },
    { label: "Review Reason", value: dashboard.runtime.reviewReason ?? dashboard.mission.reviewRequiredReason ?? "-", tone: toTone(dashboard.runtime.reviewReason ?? dashboard.mission.reviewRequiredReason) },
    { label: "Total Seen", value: String(dashboard.runtime.totalSeenCount) },
    { label: "Evidence Packets", value: String(dashboard.runtime.evidencePacketCount) },
    { label: "Browse Ledger", value: String(dashboard.runtime.browseLedgerCount) },
    { label: "Candidates", value: String(dashboard.runtime.candidateCount) },
    { label: "Last AI Failure", value: lastAiFailure, tone: toTone(lastAiFailure === "-" ? null : "warning") },
  ];
};

const buildBrowserMetrics = (dashboard: CommanderMissionDashboard): CommanderConsolePageMetric[] => [
  { label: "Browser Mode", value: dashboard.browser.browserMode, tone: "muted" },
  { label: "Profile Ref", value: dashboard.browser.browserProfileRef, tone: "muted" },
  { label: "Profile Status", value: dashboard.browser.browserProfileStatus, tone: toTone(dashboard.browser.browserProfileStatus) },
  { label: "Login State", value: dashboard.browser.loginState, tone: toTone(dashboard.browser.loginState) },
  { label: "Execution Mode", value: dashboard.browser.executionMode, tone: "muted" },
  { label: "Geometry Guard", value: dashboard.browser.geometryGuard, tone: toTone(dashboard.browser.geometryGuard) },
  { label: "Viewport", value: dashboard.browser.viewport, tone: "muted" },
  { label: "Calibration", value: dashboard.browser.calibration, tone: "muted" },
];

const buildHealthMetrics = (dashboard: CommanderMissionDashboard): CommanderConsolePageMetric[] =>
  dashboard.health.map((component) => ({ label: component.label, value: component.detail, tone: component.tone }));

const buildCandidates = (dashboard: CommanderMissionDashboard): CommanderConsolePageCandidate[] =>
  dashboard.candidates
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((candidate) => ({
      id: candidate.id,
      category: candidate.category,
      useCase: candidate.useCase,
      score: formatScore(candidate.score),
      purchaseIntent: candidate.purchaseIntent,
      reviewStatus: candidate.reviewStatus,
      evidenceCount: candidate.evidenceCount,
      notes: candidate.notes,
      createdAt: formatDateTime(candidate.createdAt),
    }));

const buildReviewQueue = (dashboard: CommanderMissionDashboard): CommanderConsolePageRecord[] =>
  dashboard.reviewQueue;

const buildEvidencePackets = (dashboard: CommanderMissionDashboard): CommanderConsolePageRecord[] =>
  dashboard.evidencePackets;

const buildBrowseLedger = (dashboard: CommanderMissionDashboard): CommanderConsolePageRecord[] =>
  dashboard.browseLedger;

const buildFailedRecords = (dashboard: CommanderMissionDashboard): CommanderConsolePageRecord[] =>
  dashboard.failedRecords;

const buildRuntimeProof = (dashboard: CommanderMissionDashboard): CommanderConsolePageLog[] =>
  dashboard.runtimeProof.map((event) => ({
    id: event.id,
    createdAt: formatDateTime(event.createdAt),
    step: event.step,
    status: event.status,
    message: event.message,
  }));

const buildAuditSummary = (dashboard: CommanderMissionDashboard): CommanderConsolePageAuditSummary => ({
  phase: dashboard.auditSummary.phase,
  activeDomains: dashboard.auditSummary.activeCapabilityDomains.length,
  totals: dashboard.auditSummary.totals
    ? `${dashboard.auditSummary.totals.passed}/${dashboard.auditSummary.totals.inspectors} passed · blocking=${dashboard.auditSummary.totals.blocking}`
    : "not available",
  generatedAt: formatDateTime(dashboard.auditSummary.lastGeneratedAt ?? dashboard.auditSummary.lastRunGeneratedAt),
});

export function buildCommanderConsolePageModel(
  dashboard: CommanderMissionDashboard,
  locale: Locale,
): CommanderConsolePageModel {
  return {
    locale,
    missionStatus: dashboard.mission.status,
    missionSummary: dashboard.mission.humanGoal || "No active mission.",
    missionMetrics: buildMissionMetrics(dashboard),
    runtimeMetrics: buildRuntimeMetrics(dashboard),
    browserMetrics: buildBrowserMetrics(dashboard),
    healthMetrics: buildHealthMetrics(dashboard),
    candidates: buildCandidates(dashboard),
    reviewQueue: buildReviewQueue(dashboard),
    evidencePackets: buildEvidencePackets(dashboard),
    browseLedger: buildBrowseLedger(dashboard),
    failedRecords: buildFailedRecords(dashboard),
    runtimeProof: buildRuntimeProof(dashboard),
    auditSummary: buildAuditSummary(dashboard),
  };
}
