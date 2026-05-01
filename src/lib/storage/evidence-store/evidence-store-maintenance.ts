import { rm } from "node:fs/promises";
import path from "node:path";

import type { JsonStateStore } from "../../../lib/storage/json-state-store.js";
import {
  ProductOpportunityCandidateSchema,
  type ActionLog,
  type AgentRound,
  type EvidenceRef,
  type ProductDiscoveryEvidencePacket,
  type ProductOpportunityCandidate,
  type ReviewDisposition,
  type StoredAiResult,
  type StructuredActionLog,
  type StructuredRuntimeEvent,
  type TaskRun,
} from "./evidence-store-models.js";
import type { PersistedState } from "./evidence-store-state.js";

type EvidenceStoreMaintenanceContext = {
  artifactsDir: string;
  dataDir: string;
  stateStore: JsonStateStore<PersistedState>;
  init: () => Promise<void>;
  listState: () => Promise<PersistedState>;
};

function detachRoundCandidate(state: PersistedState, roundId: string): void {
  state.agentRounds = state.agentRounds.map((item) => item.id === roundId ? { ...item, candidateId: undefined, note: "candidate and evidence deleted by operator", updatedAt: new Date().toISOString() } : item);
}

function removeRoundScopedState(state: PersistedState, candidate: ProductOpportunityCandidate): Array<{ filePath: string }> {
  const roundId = candidate.roundId;
  const evidenceToDelete = [...state.videoEvidence.filter((item) => item.roundId === roundId), ...state.commentEvidence.filter((item) => item.roundId === roundId)];
  state.candidates = state.candidates.filter((item) => item.id !== candidate.id);
  state.videoEvidence = state.videoEvidence.filter((item) => item.roundId !== roundId);
  state.commentEvidence = state.commentEvidence.filter((item) => item.roundId !== roundId);
  state.ocrResults = state.ocrResults.filter((item) => item.roundId !== roundId);
  state.aiResults = state.aiResults.filter((item) => !item.evidenceRefs.some((ref: EvidenceRef) => candidate.evidenceRefs.some((candidateRef: EvidenceRef) => candidateRef.id === ref.id)));
  state.actionLogs = state.actionLogs.filter((item) => item.roundId !== roundId);
  state.structuredRuntimeEvents = state.structuredRuntimeEvents.filter((item) => item.roundId !== roundId);
  state.structuredActionLogs = state.structuredActionLogs.filter((item) => item.roundId !== roundId);
  state.evidencePackets = state.evidencePackets.filter((item) => item.roundId !== roundId);
  state.browseLedgerEntries = state.browseLedgerEntries.filter((item) => item.roundId !== roundId);
  state.roundLifecycleEvents = state.roundLifecycleEvents.filter((item) => item.roundId !== roundId);
  state.roundStructuralLogs = state.roundStructuralLogs.filter((item) => item.roundId !== roundId);
  state.advancedAiExports = state.advancedAiExports.filter((item) => item.sessionId !== candidate.taskRunId);
  return evidenceToDelete;
}

export async function setCandidateDispositionRecord(ctx: EvidenceStoreMaintenanceContext, candidateId: string, disposition: ReviewDisposition, note?: string): Promise<ProductOpportunityCandidate> {
  const state = await ctx.listState();
  const candidate = state.candidates.find((item) => item.id === candidateId);
  if (!candidate) throw new Error(`Candidate not found: ${candidateId}`);
  candidate.reviewStatus = disposition;
  candidate.updatedAt = new Date().toISOString();
  if (note && note.trim().length > 0) candidate.notes.push(note.trim());
  await ctx.stateStore.write(state);
  return ProductOpportunityCandidateSchema.parse(candidate);
}

export async function deleteCandidateRecord(ctx: EvidenceStoreMaintenanceContext, candidateId: string): Promise<void> {
  const state = await ctx.listState();
  const candidate = state.candidates.find((item) => item.id === candidateId);
  if (!candidate) return;
  const evidenceToDelete = removeRoundScopedState(state, candidate);
  detachRoundCandidate(state, candidate.roundId);
  for (const evidence of evidenceToDelete) {
    await rm(evidence.filePath, { force: true });
  }
  await ctx.stateStore.write(state);
}

export async function getOperatorSnapshotRecord(ctx: EvidenceStoreMaintenanceContext): Promise<PersistedState> {
  return ctx.listState();
}

export async function exportCandidateSummariesRecord(ctx: EvidenceStoreMaintenanceContext): Promise<Array<{
  id: string;
  sourceVideoId: string;
  category: string;
  useCase: string;
  reviewStatus: ProductOpportunityCandidate["reviewStatus"];
  evidenceRefs: EvidenceRef[];
}>> {
  const state = await ctx.listState();
  return state.candidates.map((candidate) => ({ id: candidate.id, sourceVideoId: candidate.sourceVideoId, category: candidate.category, useCase: candidate.useCase, reviewStatus: candidate.reviewStatus, evidenceRefs: candidate.evidenceRefs }));
}

export async function resetLocalStoreRecord(ctx: EvidenceStoreMaintenanceContext): Promise<void> {
  await rm(path.join(ctx.dataDir, "state.json"), { force: true });
  await rm(ctx.artifactsDir, { recursive: true, force: true });
  await ctx.init();
}

export type OperatorSnapshotRecord = {
  taskRuns: TaskRun[];
  agentRounds: AgentRound[];
  actionLogs: ActionLog[];
  structuredRuntimeEvents: StructuredRuntimeEvent[];
  structuredActionLogs: StructuredActionLog[];
  candidates: ProductOpportunityCandidate[];
  videoEvidence: PersistedState["videoEvidence"];
  commentEvidence: PersistedState["commentEvidence"];
  aiResults: StoredAiResult[];
  ocrResults: PersistedState["ocrResults"];
  evidencePackets: ProductDiscoveryEvidencePacket[];
  browseLedgerEntries: PersistedState["browseLedgerEntries"];
  roundLifecycleEvents: PersistedState["roundLifecycleEvents"];
  roundStructuralLogs: PersistedState["roundStructuralLogs"];
  advancedAiExports: PersistedState["advancedAiExports"];
};