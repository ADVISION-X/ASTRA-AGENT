/**
 * Commander Console Public Types
 *
 * Exports the public interface for the Commander Console ability group.
 * Callers depend on these types; the implementation details are in schema.ts.
 */

import type { z } from "zod";

import type {
  CommanderChildCapabilityId,
  CommanderConsoleInput,
  CommanderConsoleResult,
  CommanderMissionStatusView,
} from "./schema.js";
import type { CommandTransportPort } from "./envelope.js";
import type { CommanderChildContext } from "./children.js";
import type {
  CommanderBoundaryPolicy,
  CommanderEvidencePolicy,
  CommanderProofPolicy,
  CommanderReadiness,
} from "./shared/commander-command-policy.js";
import type {
  CommanderCommandTypeSchema,
  CommanderCommandChildAbilityIdSchema,
  CommanderReadChildAbilityIdSchema,
  CommanderDispatchChildCapabilityIdSchema,
  CommanderTargetRecordRefSchema,
  CommanderBoundaryDecisionSchema,
  CommanderIdempotencyPolicySchema,
  CommanderReadModelSourceSchema,
  CommanderCommandPrioritySchema,
} from "./shared/commander-schema-base.js";
import type { HumanCommandInputSchema } from "./shared/commander-schema-base.js";

export type {
  CommanderChildCapabilityId,
  CommanderConsoleInput,
  CommanderConsoleResult,
  CommanderMissionStatusView,
  CommandTransportPort,
};

// ─── Ability group interface ──────────────────────────────────────────────────

export type CommanderConsoleAbilityGroup = {
  abilityGroupId: "commander-console";
  listChildCapabilityIds(): readonly CommanderChildCapabilityId[];
  execute(input: {
    childCapabilityId: string;
    operatorRef: string;
    input: Record<string, unknown>;
  }): Promise<CommanderConsoleResult>;
};

// ─── Factory input ────────────────────────────────────────────────────────────

export type CreateCommanderConsoleInput = {
  defaultOperatorRef: string;
  commandTransport: CommandTransportPort;
  getMissionStatus: CommanderChildContext["getMissionStatus"];
};

// ─── Clock interface ──────────────────────────────────────────────────────────

export type CommanderClock = {
  nowIso(): string;
  monotonicNowMs(): number;
  elapsedMs(startMs: number, endMs: number): number;
};

export type CreateCommanderConsoleAbilityGroupInput = CreateCommanderConsoleInput & {
  clock?: CommanderClock;
};

// ─── Inferred primitive types from shared schemas ─────────────────────────────

export type CommanderCommandType = z.infer<typeof CommanderCommandTypeSchema>;
export type CommanderCommandChildAbilityId = z.infer<typeof CommanderCommandChildAbilityIdSchema>;
export type CommanderReadChildAbilityId = z.infer<typeof CommanderReadChildAbilityIdSchema>;
export type CommanderDispatchChildId = z.infer<typeof CommanderDispatchChildCapabilityIdSchema>;
export type CommanderTargetRecordRef = z.infer<typeof CommanderTargetRecordRefSchema>;
export type CommanderHumanCommandInput = z.infer<typeof HumanCommandInputSchema>;
export type CommanderBoundaryDecision = z.infer<typeof CommanderBoundaryDecisionSchema>;
export type CommanderIdempotencyPolicy = z.infer<typeof CommanderIdempotencyPolicySchema>;
export type CommanderReadModelSource = z.infer<typeof CommanderReadModelSourceSchema>;
export type CommanderCommandPriority = z.infer<typeof CommanderCommandPrioritySchema>;

// ─── Runtime input wrapper ────────────────────────────────────────────────────

export type CommanderConsoleChildRuntimeInput<TInput> = {
  operatorRef: string;
  input: TInput;
};

// ─── Base child contract ──────────────────────────────────────────────────────

export interface CommanderChildContract {
  childCapabilityId: string;
  childKind: "command" | "read";
  purpose: string;
  allowedCaller: string;
  boundaryDecision: CommanderBoundaryDecision;
  ownedCommandType: CommanderCommandType | null;
  readModelSource: CommanderReadModelSource | null;
  maxDurationMs: number;
  idempotencyPolicy: CommanderIdempotencyPolicy;
  boundaryPolicy: CommanderBoundaryPolicy;
  evidencePolicy: CommanderEvidencePolicy;
  proofPolicy: CommanderProofPolicy;
  readiness: CommanderReadiness;
  hardStopPriority?: CommanderCommandPriority | null | undefined;
}

// ─── Command child contract ───────────────────────────────────────────────────

export interface CommanderCommandChildContract extends CommanderChildContract {
  childKind: "command";
  ownedCommandType: CommanderCommandType;
  requiresOperatorRef: boolean;
  hardStopPriority: CommanderCommandPriority | null;
}

// ─── Read child contract ──────────────────────────────────────────────────────

export interface CommanderReadChildContract extends CommanderChildContract {
  childKind: "read";
}
