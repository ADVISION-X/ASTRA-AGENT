import type { z } from "zod";

import type { CommanderCommandChildContract } from "../../contract.js";
import { CommanderEvidencePolicySchema } from "../../schema.js";
import { StopMissionBoundaryPolicySchema, StopMissionInputSchema, StopMissionOutputSchema, StopMissionProofPolicySchema, StopMissionReadinessSchema } from "./schema.js";

export const STOP_MISSION_CHILD_ID = "stop-mission";

export const STOP_MISSION_CONTRACT: CommanderCommandChildContract = {
  childCapabilityId: STOP_MISSION_CHILD_ID,
  childKind: "command",
  purpose: "Issue a governed stop-mission command without escalating to the emergency hard path.",
  allowedCaller: "commander-console",
  boundaryDecision: "command-transport-only",
  ownedCommandType: "stop-mission",
  readModelSource: null,
  requiresOperatorRef: true,
  hardStopPriority: null,
  maxDurationMs: 60_000,
  idempotencyPolicy: "dedupe-command",
  boundaryPolicy: StopMissionBoundaryPolicySchema.parse({
    allowedCaller: "commander-console",
    boundaryDecision: "command-transport-only",
    ownedCommandType: "stop-mission",
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
  proofPolicy: StopMissionProofPolicySchema.parse({
    requiresRuntimeProof: true,
    requiresGovernedReceipt: true,
    requiresStructuredEvidenceRefs: true,
    requiresFailureReceipt: true,
    requiresTransportDecision: true,
    requiresReadDecision: false,
    requiresHardStopDecision: false,
  }),
  readiness: StopMissionReadinessSchema.parse({
    requiresCommandTransport: true,
    requiresReadModel: false,
    requiresHardPath: false,
  }),
};

export type StopMissionInput = z.infer<typeof StopMissionInputSchema>;
export type StopMissionOutput = z.infer<typeof StopMissionOutputSchema>;