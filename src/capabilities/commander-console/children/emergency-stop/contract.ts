import type { z } from "zod";

import type { CommanderCommandChildContract } from "../../contract.js";
import { CommanderEvidencePolicySchema } from "../../schema.js";
import { EmergencyStopBoundaryPolicySchema, EmergencyStopInputSchema, EmergencyStopOutputSchema, EmergencyStopProofPolicySchema, EmergencyStopReadinessSchema } from "./schema.js";

export const EMERGENCY_STOP_CHILD_ID = "emergency-stop";

export const EMERGENCY_STOP_CONTRACT: CommanderCommandChildContract = {
  childCapabilityId: EMERGENCY_STOP_CHILD_ID,
  childKind: "command",
  purpose: "Issue a hard-path emergency-stop command that cannot degrade into stop-mission semantics.",
  allowedCaller: "commander-console",
  boundaryDecision: "command-transport-only",
  ownedCommandType: "emergency-stop",
  readModelSource: null,
  requiresOperatorRef: true,
  hardStopPriority: "emergency",
  maxDurationMs: 2000,
  idempotencyPolicy: "hard-stop-non-dedupe",
  boundaryPolicy: EmergencyStopBoundaryPolicySchema.parse({
    allowedCaller: "commander-console",
    boundaryDecision: "command-transport-only",
    ownedCommandType: "emergency-stop",
    readModelSource: null,
    requiresOperatorRef: true,
    hardStopPriority: "emergency",
    maxDurationMs: 2000,
    idempotencyPolicy: "hard-stop-non-dedupe",
  }),
  evidencePolicy: CommanderEvidencePolicySchema.parse({
    sourceAbility: "command-transport",
    targetRecordRequired: false,
    proofRefRequired: false,
    recordTypes: ["mission"],
  }),
  proofPolicy: EmergencyStopProofPolicySchema.parse({
    requiresRuntimeProof: true,
    requiresGovernedReceipt: true,
    requiresStructuredEvidenceRefs: true,
    requiresFailureReceipt: true,
    requiresTransportDecision: true,
    requiresReadDecision: false,
    requiresHardStopDecision: true,
  }),
  readiness: EmergencyStopReadinessSchema.parse({
    requiresCommandTransport: true,
    requiresReadModel: false,
    requiresHardPath: true,
  }),
};

export type EmergencyStopInput = z.infer<typeof EmergencyStopInputSchema>;
export type EmergencyStopOutput = z.infer<typeof EmergencyStopOutputSchema>;