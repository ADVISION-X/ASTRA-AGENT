import {
  AdvancedAIExportSetSchema,
  BrowseSummarySchema,
  type AdvancedAIExportSet,
  type BrowseSessionSummary,
  type ProductDiscoveryEvidencePacket,
  type RoundStructuralLog,
} from "../../../types/evidence-packet.js";

const BLOCKED_OUTCOMES = new Set([
  "blocked_login",
  "blocked_captcha",
  "blocked_safety_page",
  "local_ai_unavailable",
  "invalid_ai_output",
  "geometry_mismatch",
  "review_required",
  "failed_with_reason",
]);

const countWhere = <TItem>(items: TItem[], predicate: (item: TItem) => boolean): number => items.filter(predicate).length;

function buildBrowseSummary(input: {
  sessionId: string;
  roundLogs: RoundStructuralLog[];
  evidencePackets: ProductDiscoveryEvidencePacket[];
}): BrowseSessionSummary {
  const { sessionId, roundLogs, evidencePackets } = input;
  const exportPacketCount = countWhere(evidencePackets, (packet) => packet.exportForAdvancedAI.included);

  return BrowseSummarySchema.parse({
    sessionId,
    totalSeenCount: roundLogs.length,
    productYesCount: countWhere(roundLogs, (log) => log.productPresenceDecision === "product_yes_high_confidence"),
    productNoCount: countWhere(roundLogs, (log) => log.productPresenceDecision === "product_no_high_confidence"),
    uncertainCount: countWhere(roundLogs, (log) => log.productPresenceDecision === "product_uncertain"),
    duplicateCount: countWhere(roundLogs, (log) => log.roundOutcome === "skipped_duplicate"),
    unstableCount: countWhere(roundLogs, (log) => log.roundOutcome === "skipped_unstable_video"),
    blockedCount: countWhere(roundLogs, (log) => BLOCKED_OUTCOMES.has(log.roundOutcome)),
    evidencePacketCount: evidencePackets.length,
    exportPacketCount,
    startedAt: roundLogs[0]?.startTime ?? new Date(0).toISOString(),
    endedAt: roundLogs[roundLogs.length - 1]?.endTime ?? new Date(0).toISOString(),
  });
}

export function buildAdvancedAiExportSet(input: {
  sessionId: string;
  roundLogs: RoundStructuralLog[];
  evidencePackets: ProductDiscoveryEvidencePacket[];
}): AdvancedAIExportSet {
  const { sessionId, roundLogs, evidencePackets } = input;
  const summary = buildBrowseSummary({ sessionId, roundLogs, evidencePackets });
  const evidencePacketIds = evidencePackets
    .filter((packet) => packet.exportForAdvancedAI.included)
    .map((packet) => packet.packetId);

  return AdvancedAIExportSetSchema.parse({
    exportId: `advanced_ai_export_${sessionId}`,
    exportVersion: "evidence-packet-export.v1",
    sessionId,
    evidencePacketIds,
    packetCount: evidencePacketIds.length,
    browseSummary: summary,
    excludedBrowseLedgerByDefault: true,
  });
}