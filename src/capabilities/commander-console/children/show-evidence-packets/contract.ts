import type { z } from "zod";

import type { CommanderReadChildContract } from "../../contract.js";
import { CommanderEvidencePolicySchema } from "../../schema.js";
import { ShowEvidencePacketsBoundaryPolicySchema, ShowEvidencePacketsInputSchema, ShowEvidencePacketsOutputSchema, ShowEvidencePacketsProofPolicySchema, ShowEvidencePacketsReadinessSchema } from "./schema.js";

export const SHOW_EVIDENCE_PACKETS_CHILD_ID = "show-evidence-packets";

export const SHOW_EVIDENCE_PACKETS_CONTRACT: CommanderReadChildContract = {
  childCapabilityId: SHOW_EVIDENCE_PACKETS_CHILD_ID,
  childKind: "read",
  purpose: "Return governed evidence-packet summaries for Commander Console.",
  allowedCaller: "commander-console",
  boundaryDecision: "read-port-only",
  ownedCommandType: null,
  readModelSource: "forensics-read-model",
  requiresOperatorRef: true,
  hardStopPriority: null,
  maxDurationMs: 60_000,
  idempotencyPolicy: "idempotent-read",
  boundaryPolicy: ShowEvidencePacketsBoundaryPolicySchema.parse({
    allowedCaller: "commander-console",
    boundaryDecision: "read-port-only",
    ownedCommandType: null,
    readModelSource: "forensics-read-model",
    requiresOperatorRef: true,
    hardStopPriority: null,
    maxDurationMs: 60_000,
    idempotencyPolicy: "idempotent-read",
  }),
  evidencePolicy: CommanderEvidencePolicySchema.parse({
    sourceAbility: "forensics-read-model",
    targetRecordRequired: false,
    proofRefRequired: false,
    recordTypes: ["evidence-packet"],
  }),
  proofPolicy: ShowEvidencePacketsProofPolicySchema.parse({
    requiresRuntimeProof: true,
    requiresGovernedReceipt: false,
    requiresStructuredEvidenceRefs: true,
    requiresFailureReceipt: false,
    requiresTransportDecision: false,
    requiresReadDecision: true,
    requiresHardStopDecision: false,
  }),
  readiness: ShowEvidencePacketsReadinessSchema.parse({
    requiresCommandTransport: false,
    requiresReadModel: true,
    requiresHardPath: false,
  }),
};

export type ShowEvidencePacketsInput = z.infer<typeof ShowEvidencePacketsInputSchema>;
export type ShowEvidencePacketsOutput = z.infer<typeof ShowEvidencePacketsOutputSchema>;