import type { CommanderConsoleAbilityGroup, CommanderConsoleInput, CreateCommanderConsoleAbilityGroupInput } from "./contract.js";
import { createSystemCommanderClock } from "./runtime/commander-clock.js";
import { executeCommanderConsoleChild, type CommanderConsoleChildContext } from "./runtime/commander-console-executor.js";
import { getCommanderConsoleChild, listCommanderConsoleChildMetadata } from "./registry.js";
import { CommanderConsoleInputSchema } from "./schema.js";
import { buildCommanderConsoleResult } from "./runtime/commander-result-builder.js";
import { buildCommanderRuntimeProof } from "./runtime/commander-proof-builder.js";
import { commanderFlag } from "./shared/commander-proof.js";

function buildInvalidInputResult(input: {
  rawInput: unknown;
  errorMessage: string;
  context: CommanderConsoleChildContext;
}) {
  const startedAt = input.context.clock.nowIso();
  const startedMs = input.context.clock.monotonicNowMs();
  const endedAt = input.context.clock.nowIso();
  const endedMs = input.context.clock.monotonicNowMs();
  const childCapabilityId = (
    typeof input.rawInput === "object"
    && input.rawInput !== null
    && "childCapabilityId" in input.rawInput
    && typeof (input.rawInput as { childCapabilityId?: unknown }).childCapabilityId === "string"
  )
    ? (input.rawInput as { childCapabilityId: string }).childCapabilityId
    : "invalid-child-capability";
  const operatorRef = (
    typeof input.rawInput === "object"
    && input.rawInput !== null
    && "operatorRef" in input.rawInput
    && typeof (input.rawInput as { operatorRef?: unknown }).operatorRef === "string"
  )
    ? (input.rawInput as { operatorRef: string }).operatorRef
    : input.context.defaultOperatorRef;
  const runtimeProof = buildCommanderRuntimeProof({
    child: {
      childCapabilityId,
      childKind: "read",
      boundaryDecision: "blocked",
      readModelSource: null,
    },
    operatorRef,
    startedAt,
    endedAt,
    durationMs: input.context.clock.elapsedMs(startedMs, endedMs),
    outcome: {
      status: "failed",
      output: null,
      failureReason: input.errorMessage,
      reviewRequiredReason: null,
      inputRef: "commander_console:invalid_input",
      outputRef: null,
      commandId: null,
      readRequestId: null,
      runId: null,
      missionId: null,
      traceId: null,
      commandEnvelopeRef: null,
      resultEnvelopeRef: null,
      readModelSource: null,
      targetRecordRef: null,
      evidenceRefs: [],
      dataQualityFlags: [commanderFlag("input_schema_failed", "fatal", input.errorMessage)],
      boundaryDecision: "blocked",
      commandDecision: null,
      readDecision: "blocked-by-read-gate",
      transportDecision: null,
      hardStopDecision: null,
      policyDecision: "blocked",
    },
  });
  return buildCommanderConsoleResult({
    childCapabilityId,
    status: "failed",
    output: null,
    failureReason: input.errorMessage,
    reviewRequiredReason: null,
    runtimeProof,
  });
}

export function createCommanderConsoleAbilityGroup(input: CreateCommanderConsoleAbilityGroupInput): CommanderConsoleAbilityGroup {
  const context: CommanderConsoleChildContext = {
    ...input,
    clock: input.clock ?? createSystemCommanderClock(),
  };

  return {
    listChildAbilityIds() {
      return listCommanderConsoleChildMetadata().map((child) => child.childCapabilityId);
    },
    async execute(executionInput: CommanderConsoleInput) {
      const parsedInput = CommanderConsoleInputSchema.safeParse(executionInput);
      if (!parsedInput.success) {
        return buildInvalidInputResult({
          rawInput: executionInput,
          errorMessage: parsedInput.error.issues[0]?.message ?? "Commander Console input failed validation.",
          context,
        });
      }

      const child = getCommanderConsoleChild(parsedInput.data.childCapabilityId);
      return executeCommanderConsoleChild({
        child,
        executionInput: parsedInput.data,
        context,
      });
    },
  };
}