import type { z } from "zod";

import type { CommanderCommandChildContract } from "../../contract.js";
import { CommanderEvidencePolicySchema } from "../../schema.js";
import { PauseMissionBoundaryPolicySchema, PauseMissionInputSchema, PauseMissionOutputSchema, PauseMissionProofPolicySchema, PauseMissionReadinessSchema } from "./schema.js";

export const PAUSE_MISSION_CHILD_ID = "pause-mission";

export const PAUSE_MISSION_CONTRACT: CommanderCommandChildContract = {
  childCapabilityId: PAUSE_MISSION_CHILD_ID,
  childKind: "command",
  purpose: "Issue a governed pause-mission command through the command transport seam.",
  allowedCaller: "commander-console",
  boundaryDecision: "command-transport-only",
  ownedCommandType: "pause-mission",
  readModelSource: null,
  requiresOperatorRef: true,
  hardStopPriority: null,
  maxDurationMs: 60_000,
  idempotencyPolicy: "dedupe-command",
  boundaryPolicy: PauseMissionBoundaryPolicySchema.parse({
    allowedCaller: "commander-console",
    boundaryDecision: "command-transport-only",
    ownedCommandType: "pause-mission",
    readModelSource: null,
    requiresOperatorRef: true,
    hardStopPriority: null,
    maxDurationMs: 60_000,
    idempotencyPolicy: "dedupe-command",
  }),
  evidencePolicy: CommanderEvidencePolicySchema.parse({
    sourceAbility: "command-transport",
    targetRecordRequired: false,
    proofRefRequired: false,
    recordTypes: ["mission"],
  }),
  proofPolicy: PauseMissionProofPolicySchema.parse({
    requiresRuntimeProof: true,
    requiresGovernedReceipt: true,
    requiresStructuredEvidenceRefs: true,
    requiresFailureReceipt: true,
    requiresTransportDecision: true,
    requiresReadDecision: false,
    requiresHardStopDecision: false,
  }),
  readiness: PauseMissionReadinessSchema.parse({
    requiresCommandTransport: true,
    requiresReadModel: false,
    requiresHardPath: false,
  }),
};

export type PauseMissionInput = z.infer<typeof PauseMissionInputSchema>;
export type PauseMissionOutput = z.infer<typeof PauseMissionOutputSchema>;