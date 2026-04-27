import type { BrowseLedgerEntry, BrowseSessionSummary, ProductDiscoveryEvidencePacket, RoundLifecycleEvent, RoundStructuralLog } from "../../types/evidence-packet.js";
import type { BrowserStateSnapshot } from "../browser/browser-controller.js";
import type { LocalAiTaskResult } from "../../types/local-ai.js";
import type { StructuredActionLog, StructuredRuntimeEvent } from "../../types/structured-log.js";
import type { RuntimeDeliveryState } from "../../types/runtime.js";

type OperatorStateSnapshot = {
  aiResults: LocalAiTaskResult[];
  evidencePackets: ProductDiscoveryEvidencePacket[];
  browseLedgerEntries: BrowseLedgerEntry[];
  structuredRuntimeEvents: StructuredRuntimeEvent[];
  roundLifecycleEvents: RoundLifecycleEvent[];
  roundStructuralLogs: RoundStructuralLog[];
  structuredActionLogs: StructuredActionLog[];
  advancedAiExports: Array<{ browseSummary: BrowseSessionSummary }>;
};

type AgentSnapshot = {
  currentTask: { status: string } | null;
  deliveryState: RuntimeDeliveryState;
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

const getLatestBy = <TItem>(items: TItem[], predicate: (item: TItem) => boolean): TItem | null => {
  const filtered = items.filter(predicate);
  return filtered.length > 0 ? filtered[filtered.length - 1] ?? null : null;
};

const resolvePageSafetyState = (latestDecision: string | null, deliveryState: RuntimeDeliveryState): string => {
  if (latestDecision === "blocked_login") {
    return "blocked_login";
  }
  if (latestDecision === "blocked_captcha") {
    return "blocked_captcha";
  }
  if (latestDecision === "blocked_safety_page") {
    return "blocked_safety_page";
  }
  if (latestDecision === "unknown_ui") {
    return "unknown_ui";
  }
  if (deliveryState.pageReadyStatus === "review_required") {
    return "review_required";
  }
  return "ready";
};

const resolveVideoStableStatus = (events: StructuredRuntimeEvent[]): string => {
  const latest = getLatestBy(events, (item) => item.step === "wait_video_stable");
  if (!latest) {
    return "unknown";
  }
  return latest.status === "success" ? "stable" : latest.status;
};

export function buildBrowseRuntimeSnapshot(input: {
  agentSnapshot: AgentSnapshot;
  browserSnapshot: BrowserStateSnapshot;
  stateSnapshot: OperatorStateSnapshot;
}): BrowseRuntimeSnapshot {
  const { agentSnapshot, browserSnapshot, stateSnapshot } = input;
  const latestRoundLog = stateSnapshot.roundStructuralLogs[stateSnapshot.roundStructuralLogs.length - 1] ?? null;
  const latestBrowseLedgerEntry = stateSnapshot.browseLedgerEntries[stateSnapshot.browseLedgerEntries.length - 1] ?? null;
  const latestEvidencePacket = stateSnapshot.evidencePackets[stateSnapshot.evidencePackets.length - 1] ?? null;
  const latestStructuredActionLog = stateSnapshot.structuredActionLogs[stateSnapshot.structuredActionLogs.length - 1] ?? null;
  const latestAiResult = stateSnapshot.aiResults[stateSnapshot.aiResults.length - 1] ?? null;
  const latestBrowseSummary = stateSnapshot.advancedAiExports[stateSnapshot.advancedAiExports.length - 1]?.browseSummary ?? null;
  const latestLifecycleVideo = getLatestBy(stateSnapshot.structuredRuntimeEvents, (item) => item.videoVisitId !== null);

  return {
    runtimeStatus: agentSnapshot.currentTask?.status ?? "idle",
    browserMode: browserSnapshot.browserMode,
    browserExecutable: browserSnapshot.browserExecutable,
    browserProfileRef: browserSnapshot.browserProfileRef,
    browserProfileStatus: browserSnapshot.profileStatus,
    browserProfileDirectory: browserSnapshot.profileDirectory,
    browserProfileProvisioning: browserSnapshot.profileProvisioning,
    browserProfileVerificationStatus: browserSnapshot.profileVerificationStatus,
    browserProfileVerificationReason: browserSnapshot.profileVerificationReason,
    loginState: browserSnapshot.loginState,
    lastLoginCheckAt: browserSnapshot.lastLoginCheckAt,
    loginRequiredReason: browserSnapshot.loginRequiredReason,
    currentStep: agentSnapshot.deliveryState.currentRoundStep,
    currentUrl: agentSnapshot.deliveryState.currentUrl,
    targetUrl: agentSnapshot.deliveryState.targetUrl,
    pageSafetyState: resolvePageSafetyState(latestRoundLog?.productPresenceDecision ?? null, agentSnapshot.deliveryState),
    feedReadyStatus: agentSnapshot.deliveryState.pageReadyStatus,
    videoStableStatus: resolveVideoStableStatus(stateSnapshot.structuredRuntimeEvents),
    currentVideoVisitId: latestLifecycleVideo?.videoVisitId ?? latestRoundLog?.videoVisitId ?? null,
    geometryStatus: agentSnapshot.deliveryState.geometryGuardStatus,
    latestVideoEvidenceId: agentSnapshot.deliveryState.latestScreenshotEvidenceId,
    latestAIResult: latestAiResult
      ? {
          id: latestAiResult.id,
          taskType: latestAiResult.taskType,
          confidence: latestAiResult.confidence,
        }
      : null,
    latestProductPresenceDecision: latestRoundLog?.productPresenceDecision ?? null,
    latestBrowseLedgerEntryId: latestBrowseLedgerEntry?.roundId ?? null,
    latestEvidencePacketId: latestEvidencePacket?.packetId ?? null,
    latestStructuredActionLogId: latestStructuredActionLog?.actionLogId ?? null,
    latestActionLogId: agentSnapshot.deliveryState.latestActionLogId,
    latestRoundOutcome: latestRoundLog?.roundOutcome ?? null,
    reviewRequiredReason: agentSnapshot.deliveryState.reviewRequiredReason,
    counters: {
      totalSeenCount: latestBrowseSummary?.totalSeenCount ?? stateSnapshot.roundStructuralLogs.length,
      productYesCount: latestBrowseSummary?.productYesCount ?? stateSnapshot.roundStructuralLogs.filter((item) => item.productPresenceDecision === "product_yes_high_confidence").length,
      productNoCount: latestBrowseSummary?.productNoCount ?? stateSnapshot.roundStructuralLogs.filter((item) => item.productPresenceDecision === "product_no_high_confidence").length,
      uncertainCount: latestBrowseSummary?.uncertainCount ?? stateSnapshot.roundStructuralLogs.filter((item) => item.productPresenceDecision === "product_uncertain").length,
      duplicateCount: latestBrowseSummary?.duplicateCount ?? stateSnapshot.roundStructuralLogs.filter((item) => item.roundOutcome === "skipped_duplicate").length,
      evidencePacketCount: stateSnapshot.evidencePackets.length,
      browseLedgerCount: stateSnapshot.browseLedgerEntries.length,
    },
  };
}