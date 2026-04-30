import type { ZodType, z } from "zod";

import type * as CommanderSchema from "./schema.js";
import type {
  AuditReadModelPort,
  CapabilityHealthReadModelPort,
  CommanderClockPort,
  CommandTransportPort,
  ForensicsReadModelPort,
  OrchestrationMissionReadModel,
  RuntimeProofReadModelPort,
} from "./ports/commander-port-types.js";
import type {
  CommanderAuditSummary,
  CommanderBoundaryPolicy,
  CommanderEvidencePolicy,
  CommanderMissionView,
  CommanderProofPolicy,
  CommanderReadiness,
  CommanderRuntimeProof,
  GovernedCommanderConsoleResult,
} from "./shared/commander-contract-support.js";

const COMMANDER_CONSOLE_ABILITY_GROUP_ID = "commander-console";

type CommanderConsoleAbilityGroupId = typeof COMMANDER_CONSOLE_ABILITY_GROUP_ID;
type CommanderConsoleChildAbilityId = z.infer<typeof CommanderSchema.CommanderConsoleChildAbilityIdSchema>;
type CommanderCommandChildAbilityId = z.infer<typeof CommanderSchema.CommanderCommandChildAbilityIdSchema>;
type CommanderReadChildAbilityId = z.infer<typeof CommanderSchema.CommanderReadChildAbilityIdSchema>;
type CommanderDispatchChildId = z.infer<typeof CommanderSchema.CommanderDispatchChildIdSchema>;
type CommanderCommandType = z.infer<typeof CommanderSchema.CommanderCommandTypeSchema>;
type CommanderTargetRecordRef = z.infer<typeof CommanderSchema.CommanderTargetRecordRefSchema>;
type CommanderHumanCommandInput = z.infer<typeof CommanderSchema.HumanCommandInputSchema>;
type CommanderTransportPayload = z.infer<typeof CommanderSchema.CommanderTransportPayloadSchema>;
type CommanderCommandPriority = z.infer<typeof CommanderSchema.CommanderCommandPrioritySchema>;
type RequestedPlatformId = z.infer<typeof CommanderSchema.RequestedPlatformIdSchema>;
type CommanderConsoleInput = z.infer<typeof CommanderSchema.CommanderConsoleInputSchema>;
type CommanderConsolePublicResult = z.infer<typeof CommanderSchema.CommanderConsoleResultSchema>;
type CommanderConsoleRuntimeProof = z.infer<typeof CommanderSchema.RuntimeProofSchema>;

type CommanderHumanCommandEnvelope = {
  commandId: string;
  commandType: CommanderCommandType;
  priority: CommanderCommandPriority;
  operatorRef: string;
  targetMissionId: string | null;
  selectedMapId: string | null;
  targetRecordRef: CommanderTargetRecordRef | null;
  requestedPlatformId: RequestedPlatformId | null;
  humanGoal: string | null;
  maxRounds: number | null;
  maxMinutes: number | null;
  operatorNote: string | null;
  payload: CommanderTransportPayload;
};

type CreateCommanderConsoleAbilityGroupInput = {
  commandTransport: CommandTransportPort;
  missionReadModel: OrchestrationMissionReadModel;
  forensicsReadModel: ForensicsReadModelPort;
  capabilityHealthReadModel: CapabilityHealthReadModelPort;
  auditReadModel: AuditReadModelPort;
  runtimeProofReadModel: RuntimeProofReadModelPort;
  defaultOperatorRef: string;
  clock?: CommanderClockPort;
};

interface CommanderConsoleAbilityGroup {
  listChildAbilityIds(): CommanderConsoleChildAbilityId[];
  execute(input: CommanderConsoleInput): Promise<GovernedCommanderConsoleResult>;
}

interface CommanderChildContractBase {
  childCapabilityId: CommanderConsoleChildAbilityId;
  childKind: "command" | "read";
  purpose: string;
  allowedCaller: "commander-console";
  boundaryDecision: "command-transport-only" | "read-port-only";
  ownedCommandType: CommanderCommandType | null;
  readModelSource: z.infer<typeof CommanderSchema.CommanderReadModelSourceSchema> | null;
  requiresOperatorRef: true;
  hardStopPriority: z.infer<typeof CommanderSchema.CommanderCommandPrioritySchema> | null;
  maxDurationMs: number;
  idempotencyPolicy: z.infer<typeof CommanderSchema.CommanderIdempotencyPolicySchema>;
  boundaryPolicy: CommanderBoundaryPolicy;
  evidencePolicy: CommanderEvidencePolicy;
  proofPolicy: CommanderProofPolicy;
  readiness: CommanderReadiness;
}

interface CommanderCommandChildContract extends CommanderChildContractBase {
  childCapabilityId: CommanderCommandChildAbilityId;
  childKind: "command";
  boundaryDecision: "command-transport-only";
  ownedCommandType: CommanderCommandType;
  readModelSource: null;
}

interface CommanderReadChildContract extends CommanderChildContractBase {
  childCapabilityId: CommanderReadChildAbilityId;
  childKind: "read";
  boundaryDecision: "read-port-only";
  ownedCommandType: null;
  readModelSource: z.infer<typeof CommanderSchema.CommanderReadModelSourceSchema>;
  hardStopPriority: null;
}

type CommanderChildContract = CommanderCommandChildContract | CommanderReadChildContract;

interface CommanderConsoleChildRuntimeInput<TInput> {
  operatorRef: string;
  input: TInput;
}

type CommanderChildInputSchema<TInput> = ZodType<TInput>;
type CommanderChildOutputSchema<TOutput> = ZodType<TOutput>;

type CommanderConsoleResult<TOutput = unknown> = GovernedCommanderConsoleResult<TOutput>;
type CommanderConsoleViewSeed = {
  mission: CommanderMissionView;
  auditSummary: CommanderAuditSummary;
  proof: CommanderRuntimeProof;
};

export { COMMANDER_CONSOLE_ABILITY_GROUP_ID };
export type {
  CommanderChildContract,
  CommanderChildInputSchema,
  CommanderChildOutputSchema,
  CommanderCommandChildContract,
  CommanderCommandChildAbilityId,
  CommanderCommandPriority,
  CommanderCommandType,
  CommanderConsoleAbilityGroup,
  CommanderConsoleAbilityGroupId,
  CommanderConsoleChildAbilityId,
  CommanderConsoleChildRuntimeInput,
  CommanderConsoleInput,
  CommanderConsolePublicResult,
  CommanderConsoleResult,
  CommanderConsoleRuntimeProof,
  CommanderConsoleViewSeed,
  CommanderDispatchChildId,
  CommanderHumanCommandEnvelope,
  CommanderHumanCommandInput,
  CommanderReadChildAbilityId,
  CommanderReadChildContract,
  CommanderTargetRecordRef,
  CommanderTransportPayload,
  CreateCommanderConsoleAbilityGroupInput,
  RequestedPlatformId,
};