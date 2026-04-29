import { createId } from "../../../lib/local-runtime/ids.js";

import { RuntimeProofSchema } from "../schema.js";
import type { CommanderConsoleChildAbilityId } from "../contract.js";
import type { CommanderBoundaryDecision, CommanderRuntimeProof } from "../shared/commander-proof.js";
import type { CommanderConsoleStatus } from "../shared/commander-result.js";

export function buildCommanderRuntimeProof(input: {
  childCapabilityId: CommanderConsoleChildAbilityId;
  operatorRef: string;
  status: CommanderConsoleStatus;
  startedAt: string;
  endedAt: string;
  inputRef: string;
  outputRef: string | null;
  evidenceRefs: string[];
  dataQualityFlags: string[];
  boundaryDecision: CommanderBoundaryDecision;
  commandId?: string | null;
  readRequestId?: string | null;
}): CommanderRuntimeProof {
  return RuntimeProofSchema.parse({
    abilityGroupId: "commander-console",
    childCapabilityId: input.childCapabilityId,
    commandId: input.commandId ?? null,
    readRequestId: input.readRequestId ?? (input.commandId ? null : createId("commander_read")),
    operatorRef: input.operatorRef,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: Math.max(0, Date.parse(input.endedAt) - Date.parse(input.startedAt)),
    status: input.status,
    inputRef: input.inputRef,
    outputRef: input.outputRef,
    evidenceRefs: input.evidenceRefs,
    dataQualityFlags: input.dataQualityFlags,
    boundaryDecision: input.boundaryDecision,
  });
}