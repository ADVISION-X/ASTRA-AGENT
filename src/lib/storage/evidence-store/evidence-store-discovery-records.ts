import {
  BrowseLedgerEntrySchema,
  ProductDiscoveryEvidencePacketSchema,
  ProductOpportunityCandidateSchema,
  RoundLifecycleEventSchema,
  RoundStructuralLogSchema,
  type AdvancedAIExportSet,
  type BrowseLedgerEntry,
  type ProductDiscoveryEvidencePacket,
  type ProductOpportunityCandidate,
  type RoundLifecycleEvent,
  type RoundStructuralLog,
} from "./evidence-store-models.js";
import { buildAdvancedAiExportSet } from "./evidence-delivery-summary.js";
import { replaceOrAppend, type EvidenceStoreRecordsContext } from "./evidence-store-record-context.js";

export async function saveCandidateRecord(
  ctx: EvidenceStoreRecordsContext,
  input: ProductOpportunityCandidate,
): Promise<ProductOpportunityCandidate> {
  const state = await ctx.listState();
  const parsed = ProductOpportunityCandidateSchema.parse(input);
  replaceOrAppend(state.candidates, parsed, (item) => item.sourceVideoId === parsed.sourceVideoId);
  await ctx.stateStore.write(state);
  return parsed;
}

export async function saveEvidencePacketRecord(
  ctx: EvidenceStoreRecordsContext,
  input: ProductDiscoveryEvidencePacket,
): Promise<ProductDiscoveryEvidencePacket> {
  const state = await ctx.listState();
  const parsed = ProductDiscoveryEvidencePacketSchema.parse(input);
  replaceOrAppend(state.evidencePackets, parsed, (item) => item.roundId === parsed.roundId);
  await ctx.stateStore.write(state);
  return parsed;
}

export async function saveBrowseLedgerEntryRecord(
  ctx: EvidenceStoreRecordsContext,
  input: BrowseLedgerEntry,
): Promise<BrowseLedgerEntry> {
  const state = await ctx.listState();
  const parsed = BrowseLedgerEntrySchema.parse(input);
  replaceOrAppend(state.browseLedgerEntries, parsed, (item) => item.roundId === parsed.roundId);
  await ctx.stateStore.write(state);
  return parsed;
}

export async function saveRoundLifecycleEventRecord(
  ctx: EvidenceStoreRecordsContext,
  input: RoundLifecycleEvent,
): Promise<RoundLifecycleEvent> {
  const state = await ctx.listState();
  const parsed = RoundLifecycleEventSchema.parse(input);
  state.roundLifecycleEvents.push(parsed);
  await ctx.stateStore.write(state);
  return parsed;
}

export async function saveRoundStructuralLogRecord(
  ctx: EvidenceStoreRecordsContext,
  input: RoundStructuralLog,
): Promise<RoundStructuralLog> {
  const state = await ctx.listState();
  const parsed = RoundStructuralLogSchema.parse(input);
  replaceOrAppend(state.roundStructuralLogs, parsed, (item) => item.roundId === parsed.roundId);
  await ctx.stateStore.write(state);
  return parsed;
}

export async function rebuildAdvancedAiExportSetRecord(
  ctx: EvidenceStoreRecordsContext,
  sessionId: string,
): Promise<AdvancedAIExportSet> {
  const state = await ctx.listState();
  const roundLogs = state.roundStructuralLogs.filter((item) => item.sessionId === sessionId);
  const roundIds = new Set(roundLogs.map((item) => item.roundId));
  const evidencePackets = state.evidencePackets.filter((item) => roundIds.has(item.roundId));
  const exportSet = buildAdvancedAiExportSet({ sessionId, roundLogs, evidencePackets });
  replaceOrAppend(state.advancedAiExports, exportSet, (item) => item.sessionId === sessionId);
  await ctx.stateStore.write(state);
  return exportSet;
}