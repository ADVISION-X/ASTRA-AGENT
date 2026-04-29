import type { z } from "zod";

import type {
  CommanderAuditSummarySchema,
  CommanderBrowserSummaryViewSchema,
  CommanderCandidateViewSchema,
  CommanderCapabilityHealthEntrySchema,
  CommanderCapabilityRosterEntrySchema,
  CommanderCommandReceiptSchema,
  CommanderMissionDashboardViewSchema,
  CommanderMissionViewSchema,
  CommanderRecordDetailViewSchema,
  CommanderRecordSummaryViewSchema,
  CommanderRuntimeProofTimelineEntrySchema,
  CommanderRuntimeSummaryViewSchema,
} from "./commander-schema-base.js";

export type CommanderMissionView = z.infer<typeof CommanderMissionViewSchema>;
export type CommanderRuntimeSummaryView = z.infer<typeof CommanderRuntimeSummaryViewSchema>;
export type CommanderBrowserSummaryView = z.infer<typeof CommanderBrowserSummaryViewSchema>;
export type CommanderCapabilityHealthEntry = z.infer<typeof CommanderCapabilityHealthEntrySchema>;
export type CommanderCapabilityRosterEntry = z.infer<typeof CommanderCapabilityRosterEntrySchema>;
export type CommanderCandidateView = z.infer<typeof CommanderCandidateViewSchema>;
export type CommanderRecordSummaryView = z.infer<typeof CommanderRecordSummaryViewSchema>;
export type CommanderRuntimeProofTimelineEntry = z.infer<typeof CommanderRuntimeProofTimelineEntrySchema>;
export type CommanderAuditSummary = z.infer<typeof CommanderAuditSummarySchema>;
export type CommanderRecordDetailView = z.infer<typeof CommanderRecordDetailViewSchema>;
export type CommanderMissionDashboardView = z.infer<typeof CommanderMissionDashboardViewSchema>;
export type CommanderCommandReceiptView = z.infer<typeof CommanderCommandReceiptSchema>;