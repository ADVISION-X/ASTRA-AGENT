import type { ZodType } from "zod";
import type { z } from "zod";

import type { AuditReadModelPort } from "./ports/audit-read-model-port.js";
import type { CapabilityHealthReadModelPort } from "./ports/capability-health-read-model-port.js";
import type { CommanderClockPort } from "./ports/commander-clock-port.js";
import type { CommanderHumanCommand, CommandTransportPort } from "./ports/command-transport-port.js";
import type { ForensicsReadModelPort } from "./ports/forensics-read-model-port.js";
import type { OrchestrationMissionReadModel } from "./ports/mission-read-model-port.js";
import type { RuntimeProofReadModelPort } from "./ports/runtime-proof-read-model-port.js";
import type {
  CommanderBoundaryPolicy,
  CommanderEvidencePolicy,
  CommanderProofPolicy,
  CommanderReadiness,
} from "./shared/commander-command-policy.js";
import type { CommanderRuntimeProof } from "./shared/commander-proof.js";
import type { CommanderConsoleResult as GovernedCommanderConsoleResult } from "./shared/commander-result.js";
import type { CommanderAuditSummary, CommanderMissionView } from "./shared/commander-view-types.js";
import type {
  CommanderCommandChildAbilityIdSchema,
  CommanderCommandTypeSchema,
  CommanderConsoleChildAbilityIdSchema,
  CommanderConsoleInputSchema,
  CommanderConsoleResultSchema,
  CommanderDispatchChildIdSchema,
  CommanderReadChildAbilityIdSchema,
  CommanderTargetRecordRefSchema,
  HumanCommandInputSchema,
  RuntimeProofSchema,
} from "./schema.js";

export const COMMANDER_CONSOLE_ABILITY_GROUP_ID = "commander-console";

export type CommanderConsoleAbilityGroupId = typeof COMMANDER_CONSOLE_ABILITY_GROUP_ID;
export type CommanderConsoleChildAbilityId = z.infer<typeof CommanderConsoleChildAbilityIdSchema>;
export type CommanderCommandChildAbilityId = z.infer<typeof CommanderCommandChildAbilityIdSchema>;
export type CommanderReadChildAbilityId = z.infer<typeof CommanderReadChildAbilityIdSchema>;
export type CommanderDispatchChildId = z.infer<typeof CommanderDispatchChildIdSchema>;
export type CommanderCommandType = z.infer<typeof CommanderCommandTypeSchema>;
export type CommanderTargetRecordRef = z.infer<typeof CommanderTargetRecordRefSchema>;
export type CommanderHumanCommandInput = z.infer<typeof HumanCommandInputSchema>;
export type CommanderHumanCommandEnvelope = CommanderHumanCommand;
export type CommanderConsoleInput = z.infer<typeof CommanderConsoleInputSchema>;
export type CommanderConsolePublicResult = z.infer<typeof CommanderConsoleResultSchema>;
export type CommanderConsoleRuntimeProof = z.infer<typeof RuntimeProofSchema>;

export type CreateCommanderConsoleAbilityGroupInput = {
  commandTransport: CommandTransportPort;
  missionReadModel: OrchestrationMissionReadModel;
  forensicsReadModel: ForensicsReadModelPort;
  capabilityHealthReadModel: CapabilityHealthReadModelPort;
  auditReadModel: AuditReadModelPort;
  runtimeProofReadModel: RuntimeProofReadModelPort;
  defaultOperatorRef: string;
  clock?: CommanderClockPort;
};

export interface CommanderConsoleAbilityGroup {
  listChildAbilityIds(): CommanderConsoleChildAbilityId[];
  execute(input: CommanderConsoleInput): Promise<GovernedCommanderConsoleResult>;
}

export interface CommanderChildContractBase {
  childCapabilityId: CommanderConsoleChildAbilityId;
  childKind: "command" | "read";
  purpose: string;
  allowedCaller: "commander-console";
  boundaryDecision: "command-transport-only" | "read-port-only";
  ownedCommandType: CommanderCommandType | null;
  readModelSource: z.infer<typeof import("./schema.js").CommanderReadModelSourceSchema> | null;
  requiresOperatorRef: true;
  hardStopPriority: z.infer<typeof import("./schema.js").CommanderCommandPrioritySchema> | null;
  maxDurationMs: number;
  idempotencyPolicy: z.infer<typeof import("./schema.js").CommanderIdempotencyPolicySchema>;
  boundaryPolicy: CommanderBoundaryPolicy;
  evidencePolicy: CommanderEvidencePolicy;
  proofPolicy: CommanderProofPolicy;
  readiness: CommanderReadiness;
}

export interface CommanderCommandChildContract extends CommanderChildContractBase {
  childCapabilityId: CommanderCommandChildAbilityId;
  childKind: "command";
  boundaryDecision: "command-transport-only";
  ownedCommandType: CommanderCommandType;
  readModelSource: null;
}

export interface CommanderReadChildContract extends CommanderChildContractBase {
  childCapabilityId: CommanderReadChildAbilityId;
  childKind: "read";
  boundaryDecision: "read-port-only";
  ownedCommandType: null;
  readModelSource: z.infer<typeof import("./schema.js").CommanderReadModelSourceSchema>;
  hardStopPriority: null;
}

export type CommanderChildContract = CommanderCommandChildContract | CommanderReadChildContract;

export interface CommanderConsoleChildRuntimeInput<TInput> {
  operatorRef: string;
  input: TInput;
}

export type CommanderChildInputSchema<TInput> = ZodType<TInput>;
export type CommanderChildOutputSchema<TOutput> = ZodType<TOutput>;

export type CommanderConsoleResult<TOutput = unknown> = GovernedCommanderConsoleResult<TOutput>;
export type CommanderConsoleViewSeed = {
  mission: CommanderMissionView;
  auditSummary: CommanderAuditSummary;
  proof: CommanderRuntimeProof;
};