import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { createId } from "../../lib/local-runtime/ids.js";
import { JsonStateStore } from "../../lib/storage/json-state-store.js";
import { ImageEvidenceSchema, OcrTextResultSchema, type EvidenceRef, type ImageEvidence, type OcrTextResult } from "../../types/evidence.js";
import {
  AdvancedAIExportSetSchema,
  BrowseLedgerEntrySchema,
  ProductDiscoveryEvidencePacketSchema,
  RoundLifecycleEventSchema,
  RoundStructuralLogSchema,
  type AdvancedAIExportSet,
  type BrowseLedgerEntry,
  type ProductDiscoveryEvidencePacket,
  type RoundLifecycleEvent,
  type RoundStructuralLog,
} from "../../types/evidence-packet.js";
import { ActionLogSchema, type ActionLog } from "../../types/platform-action.js";
import { ProductOpportunityCandidateSchema, type ProductOpportunityCandidate } from "../../types/product-opportunity.js";
import { AgentRoundSchema, TaskRunSchema, type AgentRound, type ReviewDisposition, type RuntimeStatus, type TaskRun } from "../../types/task-run.js";
import { LocalAiTaskResultSchema, type LocalAiTaskResult } from "../../types/local-ai.js";
import { StructuredActionLogSchema, StructuredRuntimeEventSchema, type StructuredActionLog, type StructuredRuntimeEvent } from "../../types/structured-log.js";
import { buildAdvancedAiExportSet } from "./evidence-delivery-summary.js";

const PersistedStateSchema = z.object({
  taskRuns: z.array(TaskRunSchema),
  agentRounds: z.array(AgentRoundSchema),
  videoEvidence: z.array(ImageEvidenceSchema),
  commentEvidence: z.array(ImageEvidenceSchema),
  ocrResults: z.array(OcrTextResultSchema),
  aiResults: z.array(LocalAiTaskResultSchema),
  actionLogs: z.array(ActionLogSchema),
  structuredRuntimeEvents: z.array(StructuredRuntimeEventSchema).default([]),
  structuredActionLogs: z.array(StructuredActionLogSchema).default([]),
  candidates: z.array(ProductOpportunityCandidateSchema),
  evidencePackets: z.array(ProductDiscoveryEvidencePacketSchema).default([]),
  browseLedgerEntries: z.array(BrowseLedgerEntrySchema).default([]),
  roundLifecycleEvents: z.array(RoundLifecycleEventSchema).default([]),
  roundStructuralLogs: z.array(RoundStructuralLogSchema).default([]),
  advancedAiExports: z.array(AdvancedAIExportSetSchema).default([]),
});

type PersistedState = z.infer<typeof PersistedStateSchema>;

type ImageEvidenceInput = {
  kind: "video-screenshot" | "comment-screenshot";
  taskRunId: string;
  roundId: string;
  platformId: string;
  sourceId: string;
  sourceUrl: string;
  regionLabel: string;
  regionType: string;
  summary: string;
  width: number;
  height: number;
  contentLines?: string[];
  sourceFilePath?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const normalizeLegacyVisionSuggestedAction = (value: unknown): string => {
  switch (value) {
    case "open_comments":
      return "collect_metrics_like_marker_open_comments";
    case "click_not_interested":
      return "click_not_interested_or_scroll_next";
    case "scroll_next":
      return "scroll_next";
    case "operator_review":
      return "review_required";
    default:
      return "skip_or_operator_review";
  }
};

const normalizeLegacyVisionAiResult = (value: unknown): { normalized: unknown; migrated: boolean } => {
  if (!isRecord(value) || value.taskType !== "vision.product_classification") {
    return { normalized: value, migrated: false };
  }

  const result = isRecord(value.result) ? value.result : {};
  const classification = result.classification;
  const isProductVideo = classification === "PRODUCT_VIDEO" ? true : classification === "NON_PRODUCT_VIDEO" ? false : null;
  const confidence = typeof result.confidence === "number" ? result.confidence : typeof value.confidence === "number" ? value.confidence : 0;
  const reason = typeof result.reason === "string" && result.reason.length > 0 ? result.reason : "legacy vision classification result migrated to product presence schema";
  const evidenceRefs = Array.isArray(value.evidenceRefs) ? value.evidenceRefs : [];
  const screenshotEvidenceId = isRecord(evidenceRefs[0]) && typeof evidenceRefs[0].id === "string" ? evidenceRefs[0].id : "legacy_evidence_ref_missing";

  return {
    migrated: true,
    normalized: {
      ...value,
      taskType: "vision.productPresence",
      promptVersion: "v1",
      schemaVersion: "vision.productPresence.schema.v1",
      result: {
        taskType: "vision.productPresence",
        promptId: "vision.productPresence.v1",
        promptVersion: "v1",
        schemaVersion: "vision.productPresence.schema.v1",
        screenshotEvidenceId,
        isProductVideo,
        confidence,
        visibleProductTypes: [],
        evidenceObservations: [reason],
        reason,
        suggestedNextAction: normalizeLegacyVisionSuggestedAction(result.suggestedAction),
        uncertainty: isProductVideo === null ? [reason] : [],
        mustReview: result.suggestedAction === "operator_review",
      },
    },
  };
};

const normalizePersistedState = (value: unknown): { normalized: unknown; migrated: boolean } => {
  if (!isRecord(value) || !Array.isArray(value.aiResults)) {
    return { normalized: value, migrated: false };
  }

  let migrated = false;
  const aiResults = value.aiResults.map((entry) => {
    const normalizedEntry = normalizeLegacyVisionAiResult(entry);
    migrated = migrated || normalizedEntry.migrated;
    return normalizedEntry.normalized;
  });

  return {
    migrated,
    normalized: {
      ...value,
      aiResults,
    },
  };
};

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function createInitialState(): PersistedState {
  return {
    taskRuns: [],
    agentRounds: [],
    videoEvidence: [],
    commentEvidence: [],
    ocrResults: [],
    aiResults: [],
    actionLogs: [],
    structuredRuntimeEvents: [],
    structuredActionLogs: [],
    candidates: [],
    evidencePackets: [],
    browseLedgerEntries: [],
    roundLifecycleEvents: [],
    roundStructuralLogs: [],
    advancedAiExports: [],
  };
}

export class EvidenceStoreService {
  private readonly stateStore: JsonStateStore<PersistedState>;
  private readonly artifactsDir: string;

  constructor(private readonly dataDir: string) {
    this.artifactsDir = path.join(this.dataDir, "artifacts");
    this.stateStore = new JsonStateStore(path.join(this.dataDir, "state.json"), createInitialState);
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
    const state = await this.listState();
    const now = new Date().toISOString();
    const taskRun = TaskRunSchema.parse({
      id: createId("task"),
      platformId,
      status: "running",
      createdAt: now,
      updatedAt: now,
      maxRounds,
      currentRoundIndex: 0
    });
    state.taskRuns.push(taskRun);
    await this.stateStore.write(state);
    return taskRun;
  }

  async updateTaskRunStatus(taskRunId: string, status: RuntimeStatus, note?: string): Promise<TaskRun> {
    const state = await this.listState();
    const taskRun = state.taskRuns.find((item) => item.id === taskRunId);
    if (!taskRun) {
      throw new Error(`TaskRun not found: ${taskRunId}`);
    }

    taskRun.status = status;
    taskRun.updatedAt = new Date().toISOString();
    if (note) {
      taskRun.note = note;
    }
    await this.stateStore.write(state);
    return TaskRunSchema.parse(taskRun);
  }

  async saveAgentRound(round: AgentRound): Promise<AgentRound> {
    const state = await this.listState();
    const parsed = AgentRoundSchema.parse(round);
    const existingIndex = state.agentRounds.findIndex((item) => item.id === parsed.id);
    if (existingIndex >= 0) {
      state.agentRounds[existingIndex] = parsed;
    } else {
      state.agentRounds.push(parsed);
    }

    const taskRun = state.taskRuns.find((item) => item.id === parsed.taskRunId);
    if (taskRun) {
      taskRun.currentRoundIndex = parsed.index;
      taskRun.updatedAt = new Date().toISOString();
    }

    await this.stateStore.write(state);
    return parsed;
  }

  async hasSeenVideoVisit(taskRunId: string, videoVisitId: string): Promise<boolean> {
    const state = await this.listState();
    return state.agentRounds.some((item) => item.taskRunId === taskRunId && item.videoVisitId === videoVisitId);
  }

  async saveImageEvidence(input: ImageEvidenceInput): Promise<ImageEvidence> {
    await this.init();
    const id = createId(input.kind === "video-screenshot" ? "video" : "comment");
    const createdAt = new Date().toISOString();
    const filePath = await this.persistImageArtifact(id, input.summary, input.contentLines, input.sourceFilePath);

    const record = ImageEvidenceSchema.parse({
      id,
      taskRunId: input.taskRunId,
      roundId: input.roundId,
      platformId: input.platformId,
      sourceId: input.sourceId,
      sourceUrl: input.sourceUrl,
      kind: input.kind,
      summary: input.summary,
      filePath,
      regionLabel: input.regionLabel,
      regionType: input.regionType,
      width: input.width,
      height: input.height,
      createdAt
    });

    const state = await this.listState();
    if (input.kind === "video-screenshot") {
      state.videoEvidence.push(record);
    } else {
      state.commentEvidence.push(record);
    }
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

  async saveAiResult(input: LocalAiTaskResult): Promise<LocalAiTaskResult> {
    const state = await this.listState();
    const parsed = LocalAiTaskResultSchema.parse(input);
    state.aiResults.push(parsed);
    await this.stateStore.write(state);
    return parsed;
  }

  async saveActionLog(input: ActionLog): Promise<ActionLog> {
    const state = await this.listState();
    const parsed = ActionLogSchema.parse(input);
    state.actionLogs.push(parsed);
    await this.stateStore.write(state);
    return parsed;
  }

  async saveStructuredRuntimeEvent(input: StructuredRuntimeEvent): Promise<StructuredRuntimeEvent> {
    const state = await this.listState();
    const parsed = StructuredRuntimeEventSchema.parse(input);
    state.structuredRuntimeEvents.push(parsed);
    await this.stateStore.write(state);
    return parsed;
  }

  async saveStructuredActionLog(input: StructuredActionLog): Promise<StructuredActionLog> {
    const state = await this.listState();
    const parsed = StructuredActionLogSchema.parse(input);
    state.structuredActionLogs.push(parsed);
    await this.stateStore.write(state);
    return parsed;
  }

  async saveCandidate(input: ProductOpportunityCandidate): Promise<ProductOpportunityCandidate> {
    const state = await this.listState();
    const parsed = ProductOpportunityCandidateSchema.parse(input);
    const existingIndex = state.candidates.findIndex((item) => item.sourceVideoId === parsed.sourceVideoId);
    if (existingIndex >= 0) {
      state.candidates[existingIndex] = parsed;
    } else {
      state.candidates.push(parsed);
    }
    await this.stateStore.write(state);
    return parsed;
  }

  async saveEvidencePacket(input: ProductDiscoveryEvidencePacket): Promise<ProductDiscoveryEvidencePacket> {
    const state = await this.listState();
    const parsed = ProductDiscoveryEvidencePacketSchema.parse(input);
    const existingIndex = state.evidencePackets.findIndex((item) => item.roundId === parsed.roundId);
    if (existingIndex >= 0) {
      state.evidencePackets[existingIndex] = parsed;
    } else {
      state.evidencePackets.push(parsed);
    }
    await this.stateStore.write(state);
    return parsed;
  }

  async saveBrowseLedgerEntry(input: BrowseLedgerEntry): Promise<BrowseLedgerEntry> {
    const state = await this.listState();
    const parsed = BrowseLedgerEntrySchema.parse(input);
    const existingIndex = state.browseLedgerEntries.findIndex((item) => item.roundId === parsed.roundId);
    if (existingIndex >= 0) {
      state.browseLedgerEntries[existingIndex] = parsed;
    } else {
      state.browseLedgerEntries.push(parsed);
    }
    await this.stateStore.write(state);
    return parsed;
  }

  async saveRoundLifecycleEvent(input: RoundLifecycleEvent): Promise<RoundLifecycleEvent> {
    const state = await this.listState();
    const parsed = RoundLifecycleEventSchema.parse(input);
    state.roundLifecycleEvents.push(parsed);
    await this.stateStore.write(state);
    return parsed;
  }

  async saveRoundStructuralLog(input: RoundStructuralLog): Promise<RoundStructuralLog> {
    const state = await this.listState();
    const parsed = RoundStructuralLogSchema.parse(input);
    const existingIndex = state.roundStructuralLogs.findIndex((item) => item.roundId === parsed.roundId);
    if (existingIndex >= 0) {
      state.roundStructuralLogs[existingIndex] = parsed;
    } else {
      state.roundStructuralLogs.push(parsed);
    }
    await this.stateStore.write(state);
    return parsed;
  }

  async rebuildAdvancedAiExportSet(sessionId: string): Promise<AdvancedAIExportSet> {
    const state = await this.listState();
    const roundLogs = state.roundStructuralLogs.filter((item) => item.sessionId === sessionId);
    const roundIds = new Set(roundLogs.map((item) => item.roundId));
    const evidencePackets = state.evidencePackets.filter((item) => roundIds.has(item.roundId));
    const exportSet = buildAdvancedAiExportSet({
      sessionId,
      roundLogs,
      evidencePackets,
    });
    const existingIndex = state.advancedAiExports.findIndex((item) => item.sessionId === sessionId);
    if (existingIndex >= 0) {
      state.advancedAiExports[existingIndex] = exportSet;
    } else {
      state.advancedAiExports.push(exportSet);
    }
    await this.stateStore.write(state);
    return exportSet;
  }

  async setCandidateDisposition(candidateId: string, disposition: ReviewDisposition, note?: string): Promise<ProductOpportunityCandidate> {
    const state = await this.listState();
    const candidate = state.candidates.find((item) => item.id === candidateId);
    if (!candidate) {
      throw new Error(`Candidate not found: ${candidateId}`);
    }

    candidate.reviewStatus = disposition;
    candidate.updatedAt = new Date().toISOString();
    if (note && note.trim().length > 0) {
      candidate.notes.push(note.trim());
    }

    await this.stateStore.write(state);
    return ProductOpportunityCandidateSchema.parse(candidate);
  }

  async deleteCandidate(candidateId: string): Promise<void> {
    const state = await this.listState();
    const candidate = state.candidates.find((item) => item.id === candidateId);
    if (!candidate) {
      return;
    }

    state.candidates = state.candidates.filter((item) => item.id !== candidateId);
    const roundId = candidate.roundId;
    const evidenceToDelete = [
      ...state.videoEvidence.filter((item) => item.roundId === roundId),
      ...state.commentEvidence.filter((item) => item.roundId === roundId)
    ];

    state.videoEvidence = state.videoEvidence.filter((item) => item.roundId !== roundId);
    state.commentEvidence = state.commentEvidence.filter((item) => item.roundId !== roundId);
    state.ocrResults = state.ocrResults.filter((item) => item.roundId !== roundId);
    state.aiResults = state.aiResults.filter((item) => !item.evidenceRefs.some((ref) => candidate.evidenceRefs.some((candidateRef) => candidateRef.id === ref.id)));
    state.actionLogs = state.actionLogs.filter((item) => item.roundId !== roundId);
    state.structuredRuntimeEvents = state.structuredRuntimeEvents.filter((item) => item.roundId !== roundId);
    state.structuredActionLogs = state.structuredActionLogs.filter((item) => item.roundId !== roundId);
    state.evidencePackets = state.evidencePackets.filter((item) => item.roundId !== roundId);
    state.browseLedgerEntries = state.browseLedgerEntries.filter((item) => item.roundId !== roundId);
    state.roundLifecycleEvents = state.roundLifecycleEvents.filter((item) => item.roundId !== roundId);
    state.roundStructuralLogs = state.roundStructuralLogs.filter((item) => item.roundId !== roundId);
    state.advancedAiExports = state.advancedAiExports.filter((item) => item.sessionId !== candidate.taskRunId);
    state.agentRounds = state.agentRounds.map((item) => {
      if (item.id !== roundId) {
        return item;
      }

      return {
        ...item,
        candidateId: undefined,
        note: "candidate and evidence deleted by operator",
        updatedAt: new Date().toISOString(),
      };
    });

    for (const evidence of evidenceToDelete) {
      await rm(evidence.filePath, { force: true });
    }

    await this.stateStore.write(state);
  }

  async getOperatorSnapshot(): Promise<{
    taskRuns: TaskRun[];
    agentRounds: AgentRound[];
    actionLogs: ActionLog[];
    structuredRuntimeEvents: StructuredRuntimeEvent[];
    structuredActionLogs: StructuredActionLog[];
    candidates: ProductOpportunityCandidate[];
    videoEvidence: ImageEvidence[];
    commentEvidence: ImageEvidence[];
    aiResults: LocalAiTaskResult[];
    ocrResults: OcrTextResult[];
    evidencePackets: ProductDiscoveryEvidencePacket[];
    browseLedgerEntries: BrowseLedgerEntry[];
    roundLifecycleEvents: RoundLifecycleEvent[];
    roundStructuralLogs: RoundStructuralLog[];
    advancedAiExports: AdvancedAIExportSet[];
  }> {
    const state = await this.listState();
    return state;
  }

  async exportCandidateSummaries(): Promise<Array<{
    id: string;
    sourceVideoId: string;
    category: string;
    useCase: string;
    reviewStatus: ProductOpportunityCandidate["reviewStatus"];
    evidenceRefs: EvidenceRef[];
  }>> {
    const state = await this.listState();
    return state.candidates.map((candidate) => ({
      id: candidate.id,
      sourceVideoId: candidate.sourceVideoId,
      category: candidate.category,
      useCase: candidate.useCase,
      reviewStatus: candidate.reviewStatus,
      evidenceRefs: candidate.evidenceRefs,
    }));
  }

  async resetLocalStore(): Promise<void> {
    await rm(path.join(this.dataDir, "state.json"), { force: true });
    await rm(this.artifactsDir, { recursive: true, force: true });
    await this.init();
  }

  toEvidenceRef(evidence: ImageEvidence): EvidenceRef {
    return {
      id: evidence.id,
      kind: evidence.kind,
      summary: evidence.summary,
      filePath: evidence.filePath
    };
  }

  toAiEvidenceRef(result: LocalAiTaskResult): EvidenceRef {
    return {
      id: result.id,
      kind: "ai-result",
      summary: `${result.taskType} result`,
    };
  }

  toActionEvidenceRef(actionLog: ActionLog): EvidenceRef {
    return {
      id: actionLog.id,
      kind: "action-log",
      summary: actionLog.message
    };
  }

  toCandidateEvidenceRef(candidate: ProductOpportunityCandidate): EvidenceRef {
    return {
      id: candidate.id,
      kind: "product-candidate",
      summary: `${candidate.category} candidate`
    };
  }

  toEvidencePacketRef(packet: ProductDiscoveryEvidencePacket): EvidenceRef {
    return {
      id: packet.packetId,
      kind: "evidence-packet",
      summary: `${packet.roundOutcome} packet`
    };
  }

  private createSvgArtifact(title: string, lines: string[]): string {
    const textBlocks = [title, ...lines].map((line, index) => {
      const y = 36 + index * 24;
      return `<text x="24" y="${y}" font-size="16" font-family="monospace">${xmlEscape(line)}</text>`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="${Math.max(220, 60 + textBlocks.length * 24)}" viewBox="0 0 960 ${Math.max(220, 60 + textBlocks.length * 24)}">
  <rect width="960" height="100%" fill="#0d1117" />
  <rect x="16" y="16" width="928" height="${Math.max(188, 28 + textBlocks.length * 24)}" rx="12" fill="#161b22" stroke="#30363d" />
  ${textBlocks.join("\n  ")}
</svg>`;
  }

  private async persistImageArtifact(
    evidenceId: string,
    title: string,
    contentLines?: string[],
    sourceFilePath?: string,
  ): Promise<string> {
    if (sourceFilePath) {
      const sourceExtension = path.extname(sourceFilePath) || ".png";
      const artifactPath = path.join(this.artifactsDir, `${evidenceId}${sourceExtension}`);
      await copyFile(sourceFilePath, artifactPath);
      return artifactPath;
    }

    const artifactPath = path.join(this.artifactsDir, `${evidenceId}.svg`);
    const svg = this.createSvgArtifact(title, contentLines ?? []);
    await writeFile(artifactPath, svg, "utf8");
    return artifactPath;
  }
}