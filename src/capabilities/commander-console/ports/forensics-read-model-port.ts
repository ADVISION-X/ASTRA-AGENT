import type {
  CommanderCandidateView,
  CommanderRecordDetailView,
  CommanderRecordSummaryView,
} from "../shared/commander-view-types.js";

export interface ForensicsReadModelPort {
  listCandidates(): Promise<CommanderCandidateView[]>;
  listReviewQueue(): Promise<CommanderRecordSummaryView[]>;
  listEvidencePackets(limit?: number): Promise<CommanderRecordSummaryView[]>;
  listBrowseLedger(limit?: number): Promise<CommanderRecordSummaryView[]>;
  listFailedRecords(limit?: number): Promise<CommanderRecordSummaryView[]>;
  inspectRecordDetail(recordId: string): Promise<CommanderRecordDetailView>;
}