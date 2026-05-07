import type { z } from "zod";

import type { CommanderCommandChildContract } from "../../contract.js";
import { CommanderEvidencePolicySchema } from "../../schema.js";
import { ResumeMissionBoundaryPolicySchema, ResumeMissionInputSchema, ResumeMissionOutputSchema, ResumeMissionProofPolicySchema, ResumeMissionReadinessSchema } from "./schema.js";

export const RESUME_MISSION_CHILD_ID = "resume-mission";

export const RESUME_MISSION_CONTRACT: CommanderCommandChildContract = {
  childCapabilityId: RESUME_MISSION_CHILD_ID,
  childKind: "command",
  purpose: "Issue a governed resume-mission command through the command transport seam.",
  allowedCaller: "commander-console",
  boundaryDecision: "command-transport-only",
  ownedCommandType: "resume-mission",
  readModelSource: null,
  requiresOperatorRef: true,
  hardStopPriority: null,
  maxDurationMs: 60_000,
  idempotencyPolicy: "dedupe-command",
  boundaryPolicy: ResumeMissionBoundaryPolicySchema.parse({
    allowedCaller: "commander-console",
    boundaryDecision: "command-transport-only",
    ownedCommandType: "resume-mission",
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
  proofPolicy: ResumeMissionProofPolicySchema.parse({
    requiresRuntimeProof: true,
    requiresGovernedReceipt: true,
    requiresStructuredEvidenceRefs: true,
    requiresFailureReceipt: true,
    requiresTransportDecision: true,
    requiresReadDecision: false,
    requiresHardStopDecision: false,
  }),
  readiness: ResumeMissionReadinessSchema.parse({
    requiresCommandTransport: true,
    requiresReadModel: false,
    requiresHardPath: false,
  }),
};

export type ResumeMissionInput = z.infer<typeof ResumeMissionInputSchema>;
export type ResumeMissionOutput = z.infer<typeof ResumeMissionOutputSchema>;