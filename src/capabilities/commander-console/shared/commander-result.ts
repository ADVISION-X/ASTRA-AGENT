import type { z } from "zod";

import type { CommanderCommandType } from "../contract.js";
import type { CommanderConsoleResultSchema, CommanderConsoleStatusSchema } from "../schema.js";
import type { CommanderBoundaryDecision } from "./commander-proof.js";
import type { CommanderMissionView, CommanderRecordDetailView } from "./commander-view-types.js";

export type CommanderConsoleStatus = z.infer<typeof CommanderConsoleStatusSchema>;
export type CommanderConsoleResult<TOutput = unknown> = Omit<z.infer<typeof CommanderConsoleResultSchema>, "output"> & {
  output: TOutput | null;
};

export type CommanderExecutionOutcome<TOutput> = {
  status: CommanderConsoleStatus;
  output: TOutput | null;
  failureReason: string | null;
  reviewRequiredReason: string | null;
  inputRef: string;
  outputRef: string | null;
  evidenceRefs: string[];
  dataQualityFlags: string[];
  boundaryDecision: CommanderBoundaryDecision;
};

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
