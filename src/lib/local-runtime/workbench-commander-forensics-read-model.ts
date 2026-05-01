import type { ForensicsReadModelPort } from "../../capabilities/commander-console/ports/forensics-read-model-port.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";

const toCommanderReviewStatus = (
  reviewStatus: "approve" | "reject" | "hold" | "pending" | "archived",
): "approved" | "rejected" | "hold" | "pending" | "archived" => {
  if (reviewStatus === "approve") {
    return "approved";
  }
  if (reviewStatus === "reject") {
    return "rejected";
  }
  return reviewStatus;
};

export const createForensicsReadModel = (
  runtime: WorkbenchRuntime,
): ForensicsReadModelPort => ({
  listCandidates: async () => (await runtime.evidenceStore.getOperatorSnapshot()).candidates.map((candidate) => ({ id: candidate.id, category: candidate.category, useCase: candidate.useCase, score: candidate.score, purchaseIntent: candidate.purchaseIntent, reviewStatus: toCommanderReviewStatus(candidate.reviewStatus), evidenceCount: candidate.evidenceRefs.length, notes: candidate.notes, createdAt: candidate.createdAt, updatedAt: candidate.updatedAt })),
  listReviewQueue: async () => (await runtime.evidenceStore.getOperatorSnapshot()).candidates.filter((candidate) => candidate.reviewStatus === "pending" || candidate.reviewStatus === "hold").map((candidate) => ({ id: candidate.id, primary: candidate.category, secondary: candidate.useCase, detail: candidate.reviewStatus })),
  listEvidencePackets: async (limit = 50) => (await runtime.evidenceStore.getOperatorSnapshot()).evidencePackets.slice(-limit).reverse().map((packet) => ({ id: packet.packetId, primary: packet.roundId, secondary: packet.roundOutcome, detail: packet.candidate.candidateId ?? "no_candidate" })),
  listBrowseLedger: async (limit = 50) => (await runtime.evidenceStore.getOperatorSnapshot()).browseLedgerEntries.slice(-limit).reverse().map((entry) => ({ id: entry.roundId, primary: entry.videoVisitId, secondary: entry.browseOutcome, detail: entry.productPresenceDecision })),
  listFailedRecords: async (limit = 50) => (await runtime.evidenceStore.getOperatorSnapshot()).structuredRuntimeEvents.filter((event) => event.status === "failed" || event.status === "review_required").slice(-limit).reverse().map((event) => ({ id: event.eventId, primary: event.eventType, secondary: event.step, detail: event.failureReason ?? event.reviewRequiredReason ?? event.reason ?? "runtime failure" })),
  inspectRecordDetail: async (recordId: string) => {
    const state = await runtime.evidenceStore.getOperatorSnapshot();
    const candidate = state.candidates.find((item) => item.id === recordId);
    if (candidate) return { recordType: "candidate" as const, recordId: candidate.id, title: `${candidate.category} / ${candidate.useCase}`, summary: candidate.reviewStatus, details: candidate.notes, status: candidate.reviewStatus, createdAt: candidate.createdAt };
    const packet = state.evidencePackets.find((item) => item.packetId === recordId);
    if (packet) return { recordType: "evidence-packet" as const, recordId: packet.packetId, title: packet.roundId, summary: packet.roundOutcome, details: [packet.candidate.candidateId ?? "no_candidate"], status: packet.roundOutcome, createdAt: packet.capturedAt };
    const ledger = state.browseLedgerEntries.find((item) => item.roundId === recordId);
    if (ledger) return { recordType: "browse-ledger" as const, recordId: ledger.roundId, title: ledger.videoVisitId, summary: ledger.browseOutcome, details: [ledger.productPresenceDecision], status: ledger.browseOutcome, createdAt: ledger.observedAt };
    const runtimeEvent = state.structuredRuntimeEvents.find((item) => item.eventId === recordId);
    if (runtimeEvent) return { recordType: "runtime-event" as const, recordId: runtimeEvent.eventId, title: runtimeEvent.eventType, summary: runtimeEvent.step, details: [runtimeEvent.failureReason ?? runtimeEvent.reviewRequiredReason ?? runtimeEvent.reason ?? runtimeEvent.status], status: runtimeEvent.status, createdAt: runtimeEvent.createdAt };
    return { recordType: "not-found" as const, recordId, title: "Record not found", summary: `No governed record matches ${recordId}`, details: [], status: null, createdAt: null };
  },
});