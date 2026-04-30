import { InspectRecordDetailInputSchema } from "./inspect-record-detail/schema.js";
import { ShowAuditSummaryInputSchema } from "./show-audit-summary/schema.js";
import { ShowBrowseLedgerInputSchema } from "./show-browse-ledger/schema.js";
import { ShowCapabilityHealthInputSchema } from "./show-capability-health/schema.js";
import { ShowCapabilityRosterInputSchema } from "./show-capability-roster/schema.js";
import { ShowEvidencePacketsInputSchema } from "./show-evidence-packets/schema.js";
import { ShowFailedRecordsInputSchema } from "./show-failed-records/schema.js";
import { ShowMissionDashboardInputSchema } from "./show-mission-dashboard/schema.js";
import { ShowOperationalMapProgressInputSchema } from "./show-operational-map-progress/schema.js";
import { ShowReviewQueueInputSchema } from "./show-review-queue/schema.js";
import { ShowRuntimeProofTimelineInputSchema } from "./show-runtime-proof-timeline/schema.js";

const COMMANDER_READ_CHILD_INPUT_SCHEMAS = {
  "show-mission-dashboard": ShowMissionDashboardInputSchema,
  "show-capability-roster": ShowCapabilityRosterInputSchema,
  "show-capability-health": ShowCapabilityHealthInputSchema,
  "show-operational-map-progress": ShowOperationalMapProgressInputSchema,
  "show-runtime-proof-timeline": ShowRuntimeProofTimelineInputSchema,
  "show-evidence-packets": ShowEvidencePacketsInputSchema,
  "show-browse-ledger": ShowBrowseLedgerInputSchema,
  "show-failed-records": ShowFailedRecordsInputSchema,
  "show-review-queue": ShowReviewQueueInputSchema,
  "show-audit-summary": ShowAuditSummaryInputSchema,
  "inspect-record-detail": InspectRecordDetailInputSchema,
} as const;

export { COMMANDER_READ_CHILD_INPUT_SCHEMAS };