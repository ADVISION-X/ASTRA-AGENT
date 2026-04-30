import { INSPECT_RECORD_DETAIL_CHILD } from "./inspect-record-detail/implementation.js";
import { SHOW_AUDIT_SUMMARY_CHILD } from "./show-audit-summary/implementation.js";
import { SHOW_BROWSE_LEDGER_CHILD } from "./show-browse-ledger/implementation.js";
import { SHOW_CAPABILITY_HEALTH_CHILD } from "./show-capability-health/implementation.js";
import { SHOW_CAPABILITY_ROSTER_CHILD } from "./show-capability-roster/implementation.js";
import { SHOW_EVIDENCE_PACKETS_CHILD } from "./show-evidence-packets/implementation.js";
import { SHOW_FAILED_RECORDS_CHILD } from "./show-failed-records/implementation.js";
import { SHOW_MISSION_DASHBOARD_CHILD } from "./show-mission-dashboard/implementation.js";
import { SHOW_OPERATIONAL_MAP_PROGRESS_CHILD } from "./show-operational-map-progress/implementation.js";
import { SHOW_REVIEW_QUEUE_CHILD } from "./show-review-queue/implementation.js";
import { SHOW_RUNTIME_PROOF_TIMELINE_CHILD } from "./show-runtime-proof-timeline/implementation.js";

const COMMANDER_READ_CHILDREN = [
  SHOW_MISSION_DASHBOARD_CHILD,
  SHOW_CAPABILITY_ROSTER_CHILD,
  SHOW_CAPABILITY_HEALTH_CHILD,
  SHOW_OPERATIONAL_MAP_PROGRESS_CHILD,
  SHOW_RUNTIME_PROOF_TIMELINE_CHILD,
  SHOW_EVIDENCE_PACKETS_CHILD,
  SHOW_BROWSE_LEDGER_CHILD,
  SHOW_FAILED_RECORDS_CHILD,
  SHOW_REVIEW_QUEUE_CHILD,
  SHOW_AUDIT_SUMMARY_CHILD,
  INSPECT_RECORD_DETAIL_CHILD,
] as const;

export { COMMANDER_READ_CHILDREN };