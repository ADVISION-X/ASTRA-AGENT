import { z } from "zod";

import { ImageEvidenceSchema, OcrTextResultSchema } from "../../../types/evidence.js";
import {
  AdvancedAIExportSetSchema,
  BrowseLedgerEntrySchema,
  ProductDiscoveryEvidencePacketSchema,
  RoundLifecycleEventSchema,
  RoundStructuralLogSchema,
} from "../../../types/evidence-packet.js";
import { AiAbilityResultSchema } from "../../../capabilities/ai/schema-validation.js";
import { ActionLogSchema } from "../../../types/platform-action.js";
import { ProductOpportunityCandidateSchema } from "../../../types/product-opportunity.js";
import { AgentRoundSchema, TaskRunSchema } from "../../../types/task-run.js";
import { StructuredActionLogSchema, StructuredRuntimeEventSchema } from "../../../types/structured-log.js";

export const PersistedStateSchema = z.object({
  taskRuns: z.array(TaskRunSchema),
  agentRounds: z.array(AgentRoundSchema),
  videoEvidence: z.array(ImageEvidenceSchema),
  commentEvidence: z.array(ImageEvidenceSchema),
  ocrResults: z.array(OcrTextResultSchema),
  aiResults: z.array(AiAbilityResultSchema),
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

export type PersistedState = z.infer<typeof PersistedStateSchema>;

export function normalizePersistedState(value: unknown): { normalized: unknown; migrated: boolean } {
  if (typeof value !== "object" || value === null) {
    return { normalized: value, migrated: false };
  }

  return {
    migrated: false,
    normalized: value,
  };
}

export function createInitialState(): PersistedState {
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