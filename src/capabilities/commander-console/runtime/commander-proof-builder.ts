import type { z } from "zod";

import { createId } from "../../../lib/local-runtime/ids.js";

import type { CommanderDispatchChildId } from "../contract.js";
import { RuntimeProofSchema } from "../schema.js";
import type { CommanderRuntimeProof } from "../shared/commander-proof.js";
import type { CommanderExecutionOutcome } from "../shared/commander-result.js";

export function buildCommanderRuntimeProof(input: {
  child: {
    childCapabilityId: CommanderDispatchChildId;
    childKind: "command" | "read";
    boundaryDecision: "command-transport-only" | "read-port-only" | "blocked";
    readModelSource: z.infer<typeof import("../schema.js").CommanderReadModelSourceSchema> | null;
  };
  operatorRef: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  outcome: CommanderExecutionOutcome<unknown>;
}): CommanderRuntimeProof {
  return RuntimeProofSchema.parse({
    proofId: createId("commander_proof"),
    runId: input.outcome.runId,
    missionId: input.outcome.missionId,
    traceId: input.outcome.traceId,
    abilityGroupId: "commander-console",
    childCapabilityId: input.child.childCapabilityId,
    childKind: input.child.childKind,
    commandId: input.outcome.commandId,
    readRequestId: input.outcome.readRequestId,
    operatorRef: input.operatorRef,
    inputRef: input.outcome.inputRef,
    outputRef: input.outcome.outputRef,
    commandEnvelopeRef: input.outcome.commandEnvelopeRef,
    resultEnvelopeRef: input.outcome.resultEnvelopeRef,
    readModelSource: input.outcome.readModelSource ?? input.child.readModelSource,
    targetRecordRef: input.outcome.targetRecordRef,
    evidenceRefs: input.outcome.evidenceRefs,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: input.durationMs,
    status: input.outcome.status,
    failureReason: input.outcome.failureReason,
    reviewRequiredReason: input.outcome.reviewRequiredReason,
    boundaryDecision: input.outcome.boundaryDecision,
    commandDecision: input.outcome.commandDecision,
    readDecision: input.outcome.readDecision,
    transportDecision: input.outcome.transportDecision,
    hardStopDecision: input.outcome.hardStopDecision,
    timeoutDecision: input.outcome.timeoutDecision ?? "not-applicable",
    idempotencyDecision: input.outcome.idempotencyDecision ?? "not-applicable",
    policyDecision: input.outcome.policyDecision,
    dataQualityFlags: input.outcome.dataQualityFlags,
  });
}