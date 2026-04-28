import type { CommanderCommandType } from "./command-policy.js";
import type { CommanderMissionView, CommanderRecordDetailView } from "./view-model-types.js";

export type CommanderCommandResultStatus = "accepted" | "failed";

export type CommanderHumanCommandResult = {
  commandId: string;
  commandType: CommanderCommandType;
  status: CommanderCommandResultStatus;
  envelopeRef: string;
  mission: CommanderMissionView;
  failureReason: string | null;
};

export type CommanderReviewDecisionResult = {
  commandId: string;
  commandType: Extract<CommanderCommandType, "approve-candidate" | "reject-candidate" | "mark-review-required">;
  status: CommanderCommandResultStatus;
  envelopeRef: string;
  targetRecordId: string;
  failureReason: string | null;
};

export type CommanderInspectRecordResult = CommanderRecordDetailView;