import type {
  CommanderCandidateView,
  CommanderRecordDetailView,
  CommanderRecordSummaryView,
} from "../shared/commander-view-types.js";

export interface CommanderReviewReadModelPort {
  listCandidates(): Promise<CommanderCandidateView[]>;
  listReviewQueue(): Promise<CommanderRecordSummaryView[]>;
}

export interface CommanderEvidenceReadModelPort {
  listEvidencePackets(limit?: number): Promise<CommanderRecordSummaryView[]>;
  listBrowseLedger(limit?: number): Promise<CommanderRecordSummaryView[]>;
  listFailedRecords(limit?: number): Promise<CommanderRecordSummaryView[]>;
}

export interface CommanderRecordInspectionPort {
  inspectRecordDetail(recordId: string): Promise<CommanderRecordDetailView>;
}

export interface ForensicsReadModelPort extends CommanderReviewReadModelPort, CommanderEvidenceReadModelPort, CommanderRecordInspectionPort {}