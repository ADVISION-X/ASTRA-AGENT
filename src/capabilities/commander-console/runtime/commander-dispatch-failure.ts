import { createId } from "../../../lib/local-runtime/ids.js";
import { commanderFlag } from "../shared/commander-proof.js";
import type { CommanderExecutionOutcome } from "../shared/commander-result.js";

export function createMissingChildOutcome(childCapabilityId: string, operatorRef: string): CommanderExecutionOutcome<null> {
  return {
    status: "failed",
    output: null,
    failureReason: `Commander Console child ${childCapabilityId} is not registered.`,
    reviewRequiredReason: null,
    inputRef: createId("commander_dispatch_failure_input"),
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
    dataQualityFlags: [
      commanderFlag(
        "dispatch_child_missing",
        "fatal",
        `Commander Console child ${childCapabilityId} is not registered for operator ${operatorRef}.`,
      ),
    ],
    boundaryDecision: "blocked",
    commandDecision: null,
    readDecision: null,
    transportDecision: null,
    hardStopDecision: null,
    policyDecision: "blocked",
  };
}

export function describeCommanderUnhandledError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "Commander Console execution failed with an unknown error.";
}