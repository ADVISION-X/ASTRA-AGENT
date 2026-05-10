import {
  ImageEvidenceSchema as ExternalImageEvidenceSchema,
  OcrTextResultSchema as ExternalOcrTextResultSchema,
  type EvidenceRef as ExternalEvidenceRef,
  type ImageEvidence as ExternalImageEvidence,
  type OcrTextResult as ExternalOcrTextResult,
} from "./evidence-store-evidence-types.js";
import {
  AdvancedAIExportSetSchema as ExternalAdvancedAIExportSetSchema,
  BrowseLedgerEntrySchema as ExternalBrowseLedgerEntrySchema,
  ProductDiscoveryEvidencePacketSchema as ExternalProductDiscoveryEvidencePacketSchema,
  RoundLifecycleEventSchema as ExternalRoundLifecycleEventSchema,
  RoundStructuralLogSchema as ExternalRoundStructuralLogSchema,
  type AdvancedAIExportSet as ExternalAdvancedAIExportSet,
  type BrowseLedgerEntry as ExternalBrowseLedgerEntry,
  type ProductDiscoveryEvidencePacket as ExternalProductDiscoveryEvidencePacket,
  type RoundLifecycleEvent as ExternalRoundLifecycleEvent,
  type RoundStructuralLog as ExternalRoundStructuralLog,
} from "./evidence-store-packet-types.js";
import {
  ActionLogSchema as ExternalActionLogSchema,
  type ActionLog as ExternalActionLog,
} from "./evidence-store-action-types.js";
import {
  ProductOpportunityCandidateSchema as ExternalProductOpportunityCandidateSchema,
  type ProductOpportunityCandidate as ExternalProductOpportunityCandidate,
} from "./evidence-store-candidate-types.js";
import {
  ProductLeadRecordSchema as ExternalProductLeadRecordSchema,
  type ProductLeadRecord as ExternalProductLeadRecord,
} from "./evidence-store-product-lead-types.js";
import {
  StoredAiResultSchema as ExternalStoredAiResultSchema,
  type StoredAiResult as ExternalStoredAiResult,
} from "./evidence-store-ai-result-types.js";
import {
  AgentRoundSchema as ExternalAgentRoundSchema,
  TaskRunSchema as ExternalTaskRunSchema,
  type AgentRound as ExternalAgentRound,
  type ReviewDisposition as ExternalReviewDisposition,
  type RuntimeStatus as ExternalRuntimeStatus,
  type TaskRun as ExternalTaskRun,
} from "./evidence-store-task-run-types.js";
import {
  StructuredActionLogSchema as ExternalStructuredActionLogSchema,
  StructuredRuntimeEventSchema as ExternalStructuredRuntimeEventSchema,
  type StructuredActionLog as ExternalStructuredActionLog,
  type StructuredRuntimeEvent as ExternalStructuredRuntimeEvent,
} from "./evidence-store-structured-log-types.js";

const ImageEvidenceSchema = ExternalImageEvidenceSchema;
const OcrTextResultSchema = ExternalOcrTextResultSchema;
const AdvancedAIExportSetSchema = ExternalAdvancedAIExportSetSchema;
const BrowseLedgerEntrySchema = ExternalBrowseLedgerEntrySchema;
const ProductDiscoveryEvidencePacketSchema = ExternalProductDiscoveryEvidencePacketSchema;
const RoundLifecycleEventSchema = ExternalRoundLifecycleEventSchema;
const RoundStructuralLogSchema = ExternalRoundStructuralLogSchema;
const ActionLogSchema = ExternalActionLogSchema;
const ProductOpportunityCandidateSchema = ExternalProductOpportunityCandidateSchema;
const ProductLeadRecordSchema = ExternalProductLeadRecordSchema;
const StoredAiResultSchema = ExternalStoredAiResultSchema;
const AgentRoundSchema = ExternalAgentRoundSchema;
const TaskRunSchema = ExternalTaskRunSchema;
const StructuredActionLogSchema = ExternalStructuredActionLogSchema;
const StructuredRuntimeEventSchema = ExternalStructuredRuntimeEventSchema;

type EvidenceRef = ExternalEvidenceRef;
type ImageEvidence = ExternalImageEvidence;
type OcrTextResult = ExternalOcrTextResult;
type AdvancedAIExportSet = ExternalAdvancedAIExportSet;
type BrowseLedgerEntry = ExternalBrowseLedgerEntry;
type ProductDiscoveryEvidencePacket = ExternalProductDiscoveryEvidencePacket;
type RoundLifecycleEvent = ExternalRoundLifecycleEvent;
type RoundStructuralLog = ExternalRoundStructuralLog;
type ActionLog = ExternalActionLog;
type ProductOpportunityCandidate = ExternalProductOpportunityCandidate;
type ProductLeadRecord = ExternalProductLeadRecord;
type StoredAiResult = ExternalStoredAiResult;
type AgentRound = ExternalAgentRound;
type ReviewDisposition = ExternalReviewDisposition;
type RuntimeStatus = ExternalRuntimeStatus;
type TaskRun = ExternalTaskRun;
type StructuredActionLog = ExternalStructuredActionLog;
type StructuredRuntimeEvent = ExternalStructuredRuntimeEvent;

export {
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
};

export type {
  ActionLog,
  AdvancedAIExportSet,
  AgentRound,
  BrowseLedgerEntry,
  EvidenceRef,
  ImageEvidence,
  OcrTextResult,
  ProductDiscoveryEvidencePacket,
  ProductLeadRecord,
  ProductOpportunityCandidate,
  ReviewDisposition,
  RoundLifecycleEvent,
  RoundStructuralLog,
  RuntimeStatus,
  StoredAiResult,
  StructuredActionLog,
  StructuredRuntimeEvent,
  TaskRun,
};