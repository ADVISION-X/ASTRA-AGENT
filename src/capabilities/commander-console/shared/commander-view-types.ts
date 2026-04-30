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

type CommanderMissionView = z.infer<typeof CommanderMissionViewSchema>;
type CommanderRuntimeSummaryView = z.infer<typeof CommanderRuntimeSummaryViewSchema>;
type CommanderBrowserSummaryView = z.infer<typeof CommanderBrowserSummaryViewSchema>;
type CommanderCapabilityHealthEntry = z.infer<typeof CommanderCapabilityHealthEntrySchema>;
type CommanderCapabilityRosterEntry = z.infer<typeof CommanderCapabilityRosterEntrySchema>;
type CommanderCandidateView = z.infer<typeof CommanderCandidateViewSchema>;
type CommanderRecordSummaryView = z.infer<typeof CommanderRecordSummaryViewSchema>;
type CommanderRuntimeProofTimelineEntry = z.infer<typeof CommanderRuntimeProofTimelineEntrySchema>;
type CommanderAuditSummary = z.infer<typeof CommanderAuditSummarySchema>;
type CommanderRecordDetailView = z.infer<typeof CommanderRecordDetailViewSchema>;
type CommanderMissionDashboardView = z.infer<typeof CommanderMissionDashboardViewSchema>;
type CommanderCommandReceiptView = z.infer<typeof CommanderCommandReceiptSchema>;

export type {
  CommanderAuditSummary,
  CommanderBrowserSummaryView,
  CommanderCandidateView,
  CommanderCapabilityHealthEntry,
  CommanderCapabilityRosterEntry,
  CommanderCommandReceiptView,
  CommanderMissionDashboardView,
  CommanderMissionView,
  CommanderRecordDetailView,
  CommanderRecordSummaryView,
  CommanderRuntimeProofTimelineEntry,
  CommanderRuntimeSummaryView,
};