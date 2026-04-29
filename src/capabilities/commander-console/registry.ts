import type { CommanderConsoleChildAbilityId } from "./contract.js";
import type { CommanderConsoleChildDefinition } from "./runtime/commander-console-executor.js";
import { APPROVE_CANDIDATE_CHILD } from "./children/approve-candidate/implementation.js";
import { EMERGENCY_STOP_CHILD } from "./children/emergency-stop/implementation.js";
import { INSPECT_RECORD_DETAIL_CHILD } from "./children/inspect-record-detail/implementation.js";
import { ISSUE_HUMAN_COMMAND_CHILD } from "./children/issue-human-command/implementation.js";
import { MARK_REVIEW_REQUIRED_CHILD } from "./children/mark-review-required/implementation.js";
import { PAUSE_MISSION_CHILD } from "./children/pause-mission/implementation.js";
import { REJECT_CANDIDATE_CHILD } from "./children/reject-candidate/implementation.js";
import { RESUME_MISSION_CHILD } from "./children/resume-mission/implementation.js";
import { SHOW_AUDIT_SUMMARY_CHILD } from "./children/show-audit-summary/implementation.js";
import { SHOW_BROWSE_LEDGER_CHILD } from "./children/show-browse-ledger/implementation.js";
import { SHOW_CAPABILITY_HEALTH_CHILD } from "./children/show-capability-health/implementation.js";
import { SHOW_CAPABILITY_ROSTER_CHILD } from "./children/show-capability-roster/implementation.js";
import { SHOW_EVIDENCE_PACKETS_CHILD } from "./children/show-evidence-packets/implementation.js";
import { SHOW_FAILED_RECORDS_CHILD } from "./children/show-failed-records/implementation.js";
import { SHOW_MISSION_DASHBOARD_CHILD } from "./children/show-mission-dashboard/implementation.js";
import { SHOW_OPERATIONAL_MAP_PROGRESS_CHILD } from "./children/show-operational-map-progress/implementation.js";
import { SHOW_REVIEW_QUEUE_CHILD } from "./children/show-review-queue/implementation.js";
import { SHOW_RUNTIME_PROOF_TIMELINE_CHILD } from "./children/show-runtime-proof-timeline/implementation.js";
import { STOP_MISSION_CHILD } from "./children/stop-mission/implementation.js";

const COMMANDER_CONSOLE_CHILDREN = [
  ISSUE_HUMAN_COMMAND_CHILD,
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
  PAUSE_MISSION_CHILD,
  RESUME_MISSION_CHILD,
  STOP_MISSION_CHILD,
  EMERGENCY_STOP_CHILD,
  APPROVE_CANDIDATE_CHILD,
  REJECT_CANDIDATE_CHILD,
  MARK_REVIEW_REQUIRED_CHILD,
  INSPECT_RECORD_DETAIL_CHILD,
];

const COMMANDER_CONSOLE_CHILD_MAP = new Map(
  COMMANDER_CONSOLE_CHILDREN.map((child) => [child.childCapabilityId, child]),
);

export function listCommanderConsoleChildren(): CommanderConsoleChildDefinition<unknown, unknown>[] {
  return [...COMMANDER_CONSOLE_CHILDREN];
}

export function getCommanderConsoleChild(childCapabilityId: CommanderConsoleChildAbilityId): CommanderConsoleChildDefinition<unknown, unknown> {
  const child = COMMANDER_CONSOLE_CHILD_MAP.get(childCapabilityId);
  if (!child) {
    throw new Error(`Commander Console child ${childCapabilityId} is not registered.`);
  }

  return child;
}
