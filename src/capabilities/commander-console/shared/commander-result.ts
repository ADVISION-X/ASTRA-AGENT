import type { z } from "zod";

import type { CommanderCommandType } from "../contract.js";
import type { CommanderConsoleResultSchema, CommanderConsoleStatusSchema } from "../schema.js";
import type {
  CommanderIdempotencyDecisionSchema,
  CommanderTimeoutDecisionSchema,
} from "./commander-schema-foundation.js";
import type {
  CommanderBoundaryDecisionSchema,
  CommanderCommandDecisionSchema,
  CommanderHardStopDecisionSchema,
  CommanderPolicyDecisionSchema,
  CommanderReadDecisionSchema,
  CommanderReadModelSourceSchema,
  CommanderTargetRecordRefSchema,
  CommanderTransportDecisionSchema,
} from "./commander-schema-base.js";
import type { CommanderDataQualityFlag, CommanderEvidenceRef } from "./commander-proof.js";
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
  commandId: string | null;
  readRequestId: string | null;
  runId: string | null;
  missionId: string | null;
  traceId: string | null;
  commandEnvelopeRef: string | null;
  resultEnvelopeRef: string | null;
  readModelSource: z.infer<typeof CommanderReadModelSourceSchema> | null;
  targetRecordRef: z.infer<typeof CommanderTargetRecordRefSchema> | null;
  evidenceRefs: CommanderEvidenceRef[];
  dataQualityFlags: CommanderDataQualityFlag[];
  boundaryDecision: z.infer<typeof CommanderBoundaryDecisionSchema>;
  commandDecision: z.infer<typeof CommanderCommandDecisionSchema> | null;
  readDecision: z.infer<typeof CommanderReadDecisionSchema> | null;
  transportDecision: z.infer<typeof CommanderTransportDecisionSchema> | null;
  hardStopDecision: z.infer<typeof CommanderHardStopDecisionSchema> | null;
  timeoutDecision?: z.infer<typeof CommanderTimeoutDecisionSchema> | null;
  idempotencyDecision?: z.infer<typeof CommanderIdempotencyDecisionSchema> | null;
  policyDecision: z.infer<typeof CommanderPolicyDecisionSchema>;
};

export type CommanderCommandResultStatus = "accepted" | "failed" | "review_required";

export type CommanderHumanCommandResult = {
  commandId: string;
  commandType: CommanderCommandType;
  status: CommanderCommandResultStatus;
  envelopeRef: string | null;
  mission: CommanderMissionView;
  failureReason: string | null;
};

export type CommanderReviewDecisionResult = {
  commandId: string;
  commandType: Extract<CommanderCommandType, "mark-review-required">;
  status: CommanderCommandResultStatus;
  envelopeRef: string | null;
  targetRecordId: string;
  failureReason: string | null;
};

export type CommanderInspectRecordResult = CommanderRecordDetailView;