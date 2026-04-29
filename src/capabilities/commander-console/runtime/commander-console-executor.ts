import type { ZodType, z } from "zod";
import type { CommanderConsoleChildAbilityId, CommanderConsoleInput, CreateCommanderConsoleAbilityGroupInput } from "../contract.js";
import type { CommanderReadModelSourceSchema } from "../schema.js";
import { commanderFlag } from "../shared/commander-proof.js";
import type { CommanderExecutionOutcome, CommanderConsoleResult } from "../shared/commander-result.js";
import { createMissingChildOutcome, describeCommanderUnhandledError } from "./commander-dispatch-failure.js";
import { buildCommanderRuntimeProof } from "./commander-proof-builder.js";
import { buildCommanderConsoleResult } from "./commander-result-builder.js";
export type CommanderConsoleChildContext = Omit<CreateCommanderConsoleAbilityGroupInput, "clock"> & { clock: NonNullable<CreateCommanderConsoleAbilityGroupInput["clock"]> };
export type CommanderConsoleChildDefinition<TInput, TOutput> = { childCapabilityId: CommanderConsoleChildAbilityId; childKind: "command" | "read"; inputSchema: ZodType<TInput>; outputSchema: ZodType<TOutput>; allowedCaller: "commander-console"; boundaryDecision: "command-transport-only" | "read-port-only"; ownedCommandType: string | null; readModelSource: z.infer<typeof CommanderReadModelSourceSchema> | null; requiresOperatorRef: boolean; hardStopPriority: "normal" | "emergency" | null; maxDurationMs: number; idempotencyPolicy: "idempotent-read" | "dedupe-command" | "hard-stop-non-dedupe"; purpose: string; execute(input: { operatorRef: string; input: TInput }, context: CommanderConsoleChildContext): Promise<CommanderExecutionOutcome<TOutput>> };
export async function executeCommanderConsoleChild<TInput, TOutput>(input: { child: CommanderConsoleChildDefinition<TInput, TOutput> | null; executionInput: CommanderConsoleInput; context: CommanderConsoleChildContext }): Promise<CommanderConsoleResult<TOutput>> {
  const startedAt = input.context.clock.nowIso(); const startedMs = input.context.clock.monotonicNowMs();
  const child = input.child;
  let outcome: CommanderExecutionOutcome<TOutput>;
  if (!child) outcome = createMissingChildOutcome(input.executionInput.childCapabilityId, input.executionInput.childCapabilityId) as CommanderExecutionOutcome<TOutput>;
  else {
    try { const parsedInput = child.inputSchema.parse(input.executionInput.input); outcome = await child.execute({ operatorRef: input.executionInput.operatorRef, input: parsedInput }, input.context); if (outcome.output !== null) outcome = { ...outcome, output: child.outputSchema.parse(outcome.output), outputRef: outcome.outputRef ?? child.childCapabilityId + ":output" }; }
    catch (error) { const reason = describeCommanderUnhandledError(error); outcome = { status: "failed", output: null, failureReason: reason, reviewRequiredReason: null, inputRef: input.executionInput.childCapabilityId, outputRef: null, commandId: null, readRequestId: child.childKind === "read" ? input.executionInput.childCapabilityId : null, commandEnvelopeRef: null, resultEnvelopeRef: null, targetRecordRef: null, evidenceRefs: [], dataQualityFlags: [commanderFlag("execution_error", "fatal", reason)], boundaryDecision: child.boundaryDecision, commandDecision: child.childKind === "command" ? "blocked-by-command-gate" : null, readDecision: child.childKind === "read" ? "blocked-by-read-gate" : null, transportDecision: child.childKind === "command" ? "not-dispatched" : null, hardStopDecision: child.childCapabilityId === "emergency-stop" ? "hard-stop-dispatch-failed" : null, policyDecision: "blocked" }; }
  }
  const endedAt = input.context.clock.nowIso(); const endedMs = input.context.clock.monotonicNowMs(); const proofChild = child ?? { childCapabilityId: input.executionInput.childCapabilityId, childKind: "read", readModelSource: null } as CommanderConsoleChildDefinition<unknown, TOutput>;
  const runtimeProof = buildCommanderRuntimeProof({ child: proofChild, operatorRef: input.executionInput.operatorRef, startedAt, endedAt, startedMs, endedMs, elapsedMs: input.context.clock.elapsedMs(startedMs, endedMs), outcome });
  return buildCommanderConsoleResult({ childCapabilityId: input.executionInput.childCapabilityId, status: outcome.status, output: outcome.output, failureReason: outcome.failureReason, reviewRequiredReason: outcome.reviewRequiredReason, runtimeProof });
}
