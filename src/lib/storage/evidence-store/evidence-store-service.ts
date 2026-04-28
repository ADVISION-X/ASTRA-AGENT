import { createId } from "../../../lib/local-runtime/ids.js";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { StructuredLogBus } from "../../../lib/local-runtime/structured-log-bus.js";
import { JsonStateStore } from "../../../lib/storage/json-state-store.js";
import { ImageEvidenceSchema, type EvidenceRef, type ImageEvidence, OcrTextResult, OcrTextResultSchema } from "../../../types/evidence.js";
import {
  type AdvancedAIExportSet,
  type BrowseLedgerEntry,
  type ProductDiscoveryEvidencePacket,
  type RoundLifecycleEvent,
  type RoundStructuralLog,
  BrowseLedgerEntrySchema,
  ProductDiscoveryEvidencePacketSchema,
} from "../../../types/evidence-packet.js";
import { AiAbilityResultSchema } from "../../../capabilities/ai/schema-validation.js";
import type { AiAbilityResult } from "../../../capabilities/ai/contract.js";
import { ActionLogSchema, type ActionLog } from "../../../types/platform-action.js";
import type { ProductOpportunityCandidate } from "../../../types/product-opportunity.js";
import type { AgentRound, ReviewDisposition, RuntimeStatus, TaskRun } from "../../../types/task-run.js";
import { StructuredActionLogSchema, StructuredRuntimeEventSchema, type StructuredActionLog, type StructuredRuntimeEvent } from "../../../types/structured-log.js";
import { type ImageEvidenceInput } from "./evidence-store-artifacts.js";
import { buildAdvancedAiExportSet } from "./evidence-delivery-summary.js";
import { persistImageArtifact } from "./evidence-store-artifacts.js";
import { deleteCandidateRecord, exportCandidateSummariesRecord, getOperatorSnapshotRecord, resetLocalStoreRecord, setCandidateDispositionRecord, type OperatorSnapshotRecord } from "./evidence-store-maintenance.js";
import {
  createTaskRunRecord,
  hasSeenVideoVisitRecord,
  listStructuredActionLogRecords,
  listStructuredRuntimeEventRecords,
  saveActionLogRecord,
  saveAgentRoundRecord,
  saveAiResultRecord,
  saveCandidateRecord,
  saveRoundLifecycleEventRecord,
  saveRoundStructuralLogRecord,
  updateTaskRunRecord,
} from "./evidence-store-records.js";
import { toActionEvidenceRef, toAiEvidenceRef, toCandidateEvidenceRef, toEvidencePacketRef, toEvidenceRef } from "./evidence-store-refs.js";
import { PersistedStateSchema, createInitialState, normalizePersistedState, type PersistedState } from "./evidence-store-state.js";

export class EvidenceStoreService {
  private readonly stateStore: JsonStateStore<PersistedState>;
  private readonly artifactsDir: string;

  constructor(
    private readonly dataDir: string,
    private readonly structuredLogBus?: StructuredLogBus,
  ) {
    this.artifactsDir = path.join(this.dataDir, "artifacts");
    this.stateStore = new JsonStateStore(path.join(this.dataDir, "state.json"), createInitialState);
  }

  private buildRecordsContext() {
    return {
      artifactsDir: this.artifactsDir,
      stateStore: this.stateStore,
      ...(this.structuredLogBus ? { structuredLogBus: this.structuredLogBus } : {}),
      init: () => this.init(),
      listState: () => this.listState(),
    };
  }

  private buildMaintenanceContext() {
    return {
      artifactsDir: this.artifactsDir,
      dataDir: this.dataDir,
      stateStore: this.stateStore,
      init: () => this.init(),
      listState: () => this.listState(),
    };
  }

  async init(): Promise<void> {
    await mkdir(this.artifactsDir, { recursive: true });
    await this.stateStore.init();
  }

  getDataDir(): string {
    return this.dataDir;
  }

  async getHealth(): Promise<{ ok: boolean; detail: string }> {
    await this.init();
    return {
      ok: true,
      detail: `local evidence store ready at ${this.dataDir}`
    };
  }

  async listState(): Promise<PersistedState> {
    const rawState = await this.stateStore.read();
    const normalizedState = normalizePersistedState(rawState);
    const parsedState = PersistedStateSchema.parse(normalizedState.normalized);
    if (normalizedState.migrated) {
      await this.stateStore.write(parsedState);
    }
    return parsedState;
  }

  async createTaskRun(platformId: string, maxRounds: number): Promise<TaskRun> {
    return createTaskRunRecord(this.buildRecordsContext(), platformId, maxRounds);
  }

  async updateTaskRunStatus(taskRunId: string, status: RuntimeStatus, note?: string): Promise<TaskRun> {
    return updateTaskRunRecord(this.buildRecordsContext(), taskRunId, status, note);
  }

  async saveAgentRound(round: AgentRound): Promise<AgentRound> {
    return saveAgentRoundRecord(this.buildRecordsContext(), round);
  }

  async hasSeenVideoVisit(taskRunId: string, videoVisitId: string): Promise<boolean> {
    return hasSeenVideoVisitRecord(this.buildRecordsContext(), taskRunId, videoVisitId);
  }

  async saveImageEvidence(input: ImageEvidenceInput): Promise<ImageEvidence> {
    await this.init();
    const id = createId(input.kind === "video-screenshot" ? "video" : "comment");
    const createdAt = new Date().toISOString();
    const filePath = await persistImageArtifact({ artifactsDir: this.artifactsDir, evidenceId: id, title: input.summary, ...(input.contentLines ? { contentLines: input.contentLines } : {}), ...(input.sourceFilePath ? { sourceFilePath: input.sourceFilePath } : {}) });
    const record = ImageEvidenceSchema.parse({ id, taskRunId: input.taskRunId, roundId: input.roundId, platformId: input.platformId, sourceId: input.sourceId, sourceUrl: input.sourceUrl, kind: input.kind, summary: input.summary, filePath, regionLabel: input.regionLabel, regionType: input.regionType, width: input.width, height: input.height, createdAt });
    const state = await this.listState();
    if (input.kind === "video-screenshot") state.videoEvidence.push(record);
    else state.commentEvidence.push(record);
    await this.stateStore.write(state);
    return record;
  }

  async saveOcrResult(input: OcrTextResult): Promise<OcrTextResult> {
    const state = await this.listState();
    const parsed = OcrTextResultSchema.parse(input);
    state.ocrResults.push(parsed);
    await this.stateStore.write(state);
    return parsed;
  }

  async saveAiResult(input: AiAbilityResult): Promise<AiAbilityResult> {
    const state = await this.listState();
    const parsed = AiAbilityResultSchema.parse(input);
    state.aiResults.push(parsed);
    await this.stateStore.write(state);
    return parsed;
  }

  async saveActionLog(input: ActionLog): Promise<ActionLog> {
    return saveActionLogRecord(this.buildRecordsContext(), input);
  }

  async saveStructuredRuntimeEvent(input: StructuredRuntimeEvent): Promise<StructuredRuntimeEvent> {
    const state = await this.listState();
    const parsed = StructuredRuntimeEventSchema.parse(input);
    state.structuredRuntimeEvents.push(parsed);
    await this.stateStore.write(state);
    this.structuredLogBus?.emitRuntimeEvent(parsed);
    return parsed;
  }

  async saveStructuredActionLog(input: StructuredActionLog): Promise<StructuredActionLog> {
    const state = await this.listState();
    const parsed = StructuredActionLogSchema.parse(input);
    state.structuredActionLogs.push(parsed);
    await this.stateStore.write(state);
    this.structuredLogBus?.emitActionLog(parsed);
    return parsed;
  }

  async listStructuredRuntimeEvents(tail = 200): Promise<StructuredRuntimeEvent[]> {
    return listStructuredRuntimeEventRecords(this.buildRecordsContext(), tail);
  }

  async listStructuredActionLogs(tail = 200): Promise<StructuredActionLog[]> {
    return listStructuredActionLogRecords(this.buildRecordsContext(), tail);
  }

  async saveCandidate(input: ProductOpportunityCandidate): Promise<ProductOpportunityCandidate> {
    return saveCandidateRecord(this.buildRecordsContext(), input);
  }

  async saveEvidencePacket(input: ProductDiscoveryEvidencePacket): Promise<ProductDiscoveryEvidencePacket> {
    const state = await this.listState();
    const parsed = ProductDiscoveryEvidencePacketSchema.parse(input);
    const existingIndex = state.evidencePackets.findIndex((item) => item.roundId === parsed.roundId);
    if (existingIndex >= 0) state.evidencePackets[existingIndex] = parsed;
    else state.evidencePackets.push(parsed);
    await this.stateStore.write(state);
    return parsed;
  }

  async saveBrowseLedgerEntry(input: BrowseLedgerEntry): Promise<BrowseLedgerEntry> {
    const state = await this.listState();
    const parsed = BrowseLedgerEntrySchema.parse(input);
    const existingIndex = state.browseLedgerEntries.findIndex((item) => item.roundId === parsed.roundId);
    if (existingIndex >= 0) state.browseLedgerEntries[existingIndex] = parsed;
    else state.browseLedgerEntries.push(parsed);
    await this.stateStore.write(state);
    return parsed;
  }

  async saveRoundLifecycleEvent(input: RoundLifecycleEvent): Promise<RoundLifecycleEvent> {
    return saveRoundLifecycleEventRecord(this.buildRecordsContext(), input);
  }

  async saveRoundStructuralLog(input: RoundStructuralLog): Promise<RoundStructuralLog> {
    return saveRoundStructuralLogRecord(this.buildRecordsContext(), input);
  }

  async rebuildAdvancedAiExportSet(sessionId: string): Promise<AdvancedAIExportSet> {
    const state = await this.listState();
    const roundLogs = state.roundStructuralLogs.filter((item) => item.sessionId === sessionId);
    const roundIds = new Set(roundLogs.map((item) => item.roundId));
    const evidencePackets = state.evidencePackets.filter((item) => roundIds.has(item.roundId));
    const exportSet = buildAdvancedAiExportSet({ sessionId, roundLogs, evidencePackets });
    const existingIndex = state.advancedAiExports.findIndex((item) => item.sessionId === sessionId);
    if (existingIndex >= 0) state.advancedAiExports[existingIndex] = exportSet;
    else state.advancedAiExports.push(exportSet);
    await this.stateStore.write(state);
    return exportSet;
  }

  async setCandidateDisposition(candidateId: string, disposition: ReviewDisposition, note?: string): Promise<ProductOpportunityCandidate> {
    return setCandidateDispositionRecord(this.buildMaintenanceContext(), candidateId, disposition, note);
  }

  async deleteCandidate(candidateId: string): Promise<void> {
    return deleteCandidateRecord(this.buildMaintenanceContext(), candidateId);
  }

  async getOperatorSnapshot(): Promise<OperatorSnapshotRecord> {
    return getOperatorSnapshotRecord(this.buildMaintenanceContext());
  }

  async exportCandidateSummaries(): Promise<Array<{
    id: string;
    sourceVideoId: string;
    category: string;
    useCase: string;
    reviewStatus: ProductOpportunityCandidate["reviewStatus"];
    evidenceRefs: EvidenceRef[];
  }>> {
    return exportCandidateSummariesRecord(this.buildMaintenanceContext());
  }

  async resetLocalStore(): Promise<void> {
    return resetLocalStoreRecord(this.buildMaintenanceContext());
  }

  toEvidenceRef(evidence: ImageEvidence): EvidenceRef {
    return toEvidenceRef(evidence);
  }

  toAiEvidenceRef(result: { taskType: string; id?: string; createdAt?: string; runtimeProof?: { outputRefs?: string[] } }): EvidenceRef {
    return toAiEvidenceRef(result);
  }

  toActionEvidenceRef(actionLog: ActionLog): EvidenceRef {
    return toActionEvidenceRef(actionLog);
  }

  toCandidateEvidenceRef(candidate: ProductOpportunityCandidate): EvidenceRef {
    return toCandidateEvidenceRef(candidate);
  }

  toEvidencePacketRef(packet: ProductDiscoveryEvidencePacket): EvidenceRef {
    return toEvidencePacketRef(packet);
  }
}