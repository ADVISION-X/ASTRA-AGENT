import type { CommanderConsoleChildAbilityId } from "../contract.js";
import type { CommanderBoundaryDecision } from "../shared/commander-proof.js";
const COMMAND_CHILD_IDS = new Set<CommanderConsoleChildAbilityId>(["issue-human-command","pause-mission","resume-mission","stop-mission","emergency-stop","approve-candidate","reject-candidate","mark-review-required"]);
const READ_CHILD_IDS = new Set<CommanderConsoleChildAbilityId>(["show-mission-dashboard","show-capability-roster","show-capability-health","show-operational-map-progress","show-runtime-proof-timeline","show-evidence-packets","show-browse-ledger","show-failed-records","show-review-queue","show-audit-summary","inspect-record-detail"]);
export function resolveCommanderBoundaryDecision(childCapabilityId: CommanderConsoleChildAbilityId): CommanderBoundaryDecision { if (COMMAND_CHILD_IDS.has(childCapabilityId)) return "command-transport-only"; if (READ_CHILD_IDS.has(childCapabilityId)) return "read-port-only"; return "blocked"; }
