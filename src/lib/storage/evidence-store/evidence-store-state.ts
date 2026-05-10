import { z } from "zod";

import {
  ActionLogSchema,
  AdvancedAIExportSetSchema,
  AgentRoundSchema,
  BrowseLedgerEntrySchema,
  ImageEvidenceSchema,
  OcrTextResultSchema,
  ProductDiscoveryEvidencePacketSchema,
  ProductLeadRecordSchema,
  ProductOpportunityCandidateSchema,
  RoundLifecycleEventSchema,
  RoundStructuralLogSchema,
  StoredAiResultSchema,
  StructuredActionLogSchema,
  StructuredRuntimeEventSchema,
  TaskRunSchema,
} from "./evidence-store-models.js";

export const PersistedStateSchema = z.object({
  taskRuns: z.array(TaskRunSchema),
  agentRounds: z.array(AgentRoundSchema),
  videoEvidence: z.array(ImageEvidenceSchema),
  commentEvidence: z.array(ImageEvidenceSchema),
  ocrResults: z.array(OcrTextResultSchema),
  aiResults: z.array(StoredAiResultSchema),
  actionLogs: z.array(ActionLogSchema),
  structuredRuntimeEvents: z.array(StructuredRuntimeEventSchema).default([]),
  structuredActionLogs: z.array(StructuredActionLogSchema).default([]),
  productLeadRecords: z.array(ProductLeadRecordSchema).default([]),
  candidates: z.array(ProductOpportunityCandidateSchema),
  evidencePackets: z.array(ProductDiscoveryEvidencePacketSchema).default([]),
  browseLedgerEntries: z.array(BrowseLedgerEntrySchema).default([]),
  roundLifecycleEvents: z.array(RoundLifecycleEventSchema).default([]),
  roundStructuralLogs: z.array(RoundStructuralLogSchema).default([]),
  advancedAiExports: z.array(AdvancedAIExportSetSchema).default([]),
});

export type PersistedState = z.infer<typeof PersistedStateSchema>;

const PERSISTED_LOG_TOKEN_MIGRATIONS = new Map<string, string>([
  ["scroll_next_video", "click_next_video"],
  ["scroll_next_video_started", "click_next_video_started"],
  ["scroll_next_video_completed", "click_next_video_completed"],
]);

const migratePersistedLogTokenString = (value: string): { normalized: unknown; migrated: boolean } => {
  const replacement = PERSISTED_LOG_TOKEN_MIGRATIONS.get(value);
  return replacement ? { normalized: replacement, migrated: true } : { normalized: value, migrated: false };
};

const migratePersistedLogTokenArray = (value: unknown[]): { normalized: unknown; migrated: boolean } => {
  let migrated = false;
  const normalized = value.map((entry) => {
    const result = migratePersistedLogTokens(entry);
    migrated ||= result.migrated;
    return result.normalized;
  });

  return migrated ? { normalized, migrated: true } : { normalized: value, migrated: false };
};

const migratePersistedLogTokenObject = (value: Record<string, unknown>): { normalized: unknown; migrated: boolean } => {
  let migrated = false;
  const normalizedEntries = Object.entries(value).map(([key, entryValue]) => {
    const result = migratePersistedLogTokens(entryValue);
    migrated ||= result.migrated;
    return [key, result.normalized] as const;
  });

  return migrated
    ? { normalized: Object.fromEntries(normalizedEntries), migrated: true }
    : { normalized: value, migrated: false };
};

function migratePersistedLogTokens(value: unknown): { normalized: unknown; migrated: boolean } {
  if (typeof value === "string") {
    return migratePersistedLogTokenString(value);
  }

  if (Array.isArray(value)) {
    return migratePersistedLogTokenArray(value);
  }

  if (typeof value !== "object" || value === null) {
    return { normalized: value, migrated: false };
  }

  return migratePersistedLogTokenObject(value as Record<string, unknown>);
}

export function normalizePersistedState(value: unknown): { normalized: unknown; migrated: boolean } {
  if (typeof value !== "object" || value === null) {
    return { normalized: value, migrated: false };
  }

  return migratePersistedLogTokens(value);
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
    productLeadRecords: [],
    candidates: [],
    evidencePackets: [],
    browseLedgerEntries: [],
    roundLifecycleEvents: [],
    roundStructuralLogs: [],
    advancedAiExports: [],
  };
}