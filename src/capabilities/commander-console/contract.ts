import type { RequestedPlatformId } from "../orchestration/contract.js";
import type { AuditReadModelPort } from "./ports/audit-read-model-port.js";
import type { CapabilityHealthReadModelPort } from "./ports/capability-health-read-model-port.js";
import type {
  CommandTransportPort,
  CommanderTargetRecordRef,
} from "./ports/command-transport-port.js";
import type { ForensicsReadModelPort } from "./ports/forensics-read-model-port.js";
import type { OrchestrationMissionReadModel } from "./ports/mission-read-model-port.js";
import type { RuntimeProofReadModelPort } from "./ports/runtime-proof-read-model-port.js";
import type { CommanderCommandType } from "./shared/command-policy.js";
import type {
  CommanderHumanCommandResult,
  CommanderInspectRecordResult,
  CommanderReviewDecisionResult,
} from "./shared/commander-result.js";
import type {
  CommanderAuditSummary,
  CommanderCapabilityRosterEntry,
  CommanderMissionDashboard,
  CommanderMissionView,
  CommanderRecordSummaryView,
  CommanderRuntimeProofEntry,
} from "./shared/view-model-types.js";

export const COMMANDER_CONSOLE_ABILITY_GROUP_ID = "commander-console";

export type CommanderConsoleAbilityGroupId = typeof COMMANDER_CONSOLE_ABILITY_GROUP_ID;
export type CommanderConsoleChildAbilityId =
  | "issue-human-command"
  | "show-mission-dashboard"
  | "show-capability-roster"
  | "show-capability-health"
  | "show-operational-map-progress"
  | "show-runtime-proof-timeline"
  | "show-evidence-packets"
  | "show-browse-ledger"
  | "show-failed-records"
  | "show-review-queue"
  | "show-audit-summary"
  | "pause-mission"
  | "resume-mission"
  | "stop-mission"
  | "emergency-stop"
  | "approve-candidate"
  | "reject-candidate"
  | "mark-review-required"
  | "inspect-record-detail";

export type CommanderConsoleChildAbility = {
  childAbilityId: CommanderConsoleChildAbilityId;
  parentAbilityGroupId: CommanderConsoleAbilityGroupId;
  displayName: string;
  purpose: string;
  currentStrength: "stub" | "diagnostic" | "runnable" | "verified" | "hardened";
};

export type CommanderHumanCommandInput = {
  commandType: CommanderCommandType;
  targetMissionId?: string | null;
  selectedMapId?: string | null;
  targetRecordRef?: CommanderTargetRecordRef | null;
  requestedPlatformId?: RequestedPlatformId | null;
  humanGoal?: string | null;
  initialPayload?: Record<string, unknown>;
  operatorNote?: string | null;
};

export type CreateCommanderConsoleAbilityGroupInput = {
  commandTransport: CommandTransportPort;
  missionReadModel: OrchestrationMissionReadModel;
  forensicsReadModel: ForensicsReadModelPort;
  capabilityHealthReadModel: CapabilityHealthReadModelPort;
  auditReadModel: AuditReadModelPort;
  runtimeProofReadModel: RuntimeProofReadModelPort;
  operatorRef?: string;
  now?: () => string;
};

export interface CommanderConsoleAbilityGroup {
  listChildAbilityIds(): CommanderConsoleChildAbilityId[];
  issueHumanCommand(input: CommanderHumanCommandInput): Promise<CommanderHumanCommandResult>;
  showMissionDashboard(): Promise<CommanderMissionDashboard>;
  showCapabilityRoster(): Promise<CommanderCapabilityRosterEntry[]>;
  showCapabilityHealth(): Promise<CommanderMissionDashboard["health"]>;
  showOperationalMapProgress(): Promise<CommanderMissionView>;
  showRuntimeProofTimeline(limit?: number): Promise<CommanderRuntimeProofEntry[]>;
  showEvidencePackets(limit?: number): Promise<CommanderRecordSummaryView[]>;
  showBrowseLedger(limit?: number): Promise<CommanderRecordSummaryView[]>;
  showFailedRecords(limit?: number): Promise<CommanderRecordSummaryView[]>;
  showReviewQueue(): Promise<CommanderRecordSummaryView[]>;
  showAuditSummary(): Promise<CommanderAuditSummary>;
  pauseMission(note?: string): Promise<CommanderHumanCommandResult>;
  resumeMission(note?: string): Promise<CommanderHumanCommandResult>;
  stopMission(note?: string): Promise<CommanderHumanCommandResult>;
  emergencyStop(note?: string): Promise<CommanderHumanCommandResult>;
  approveCandidate(candidateId: string, note?: string): Promise<CommanderReviewDecisionResult>;
  rejectCandidate(candidateId: string, note?: string): Promise<CommanderReviewDecisionResult>;
  markReviewRequired(candidateId: string, note?: string): Promise<CommanderReviewDecisionResult>;
  inspectRecordDetail(recordId: string): Promise<CommanderInspectRecordResult>;
}