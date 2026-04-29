import type { z } from "zod";

import type { CommanderReadChildContract } from "../../contract.js";
import { CommanderEvidencePolicySchema } from "../../schema.js";
import { ShowFailedRecordsBoundaryPolicySchema, ShowFailedRecordsInputSchema, ShowFailedRecordsOutputSchema, ShowFailedRecordsProofPolicySchema, ShowFailedRecordsReadinessSchema } from "./schema.js";

export const SHOW_FAILED_RECORDS_CHILD_ID = "show-failed-records";

export const SHOW_FAILED_RECORDS_CONTRACT: CommanderReadChildContract = {
  childCapabilityId: SHOW_FAILED_RECORDS_CHILD_ID,
  childKind: "read",
  purpose: "Return governed failed-record summaries for Commander Console.",
  allowedCaller: "commander-console",
  boundaryDecision: "read-port-only",
  ownedCommandType: null,
  readModelSource: "forensics-read-model",
  requiresOperatorRef: true,
  hardStopPriority: null,
  maxDurationMs: 3000,
  idempotencyPolicy: "idempotent-read",
  boundaryPolicy: ShowFailedRecordsBoundaryPolicySchema.parse({
    allowedCaller: "commander-console",
    boundaryDecision: "read-port-only",
    ownedCommandType: null,
    readModelSource: "forensics-read-model",
    requiresOperatorRef: true,
    hardStopPriority: null,
    maxDurationMs: 3000,
    idempotencyPolicy: "idempotent-read",
  }),
  evidencePolicy: CommanderEvidencePolicySchema.parse({
    sourceAbility: "forensics-read-model",
    targetRecordRequired: false,
    proofRefRequired: false,
    recordTypes: ["failed-record"],
  }),
  proofPolicy: ShowFailedRecordsProofPolicySchema.parse({
    requiresRuntimeProof: true,
    requiresGovernedReceipt: false,
    requiresStructuredEvidenceRefs: true,
    requiresFailureReceipt: false,
    requiresTransportDecision: false,
    requiresReadDecision: true,
    requiresHardStopDecision: false,
  }),
  readiness: ShowFailedRecordsReadinessSchema.parse({
    requiresCommandTransport: false,
    requiresReadModel: true,
    requiresHardPath: false,
  }),
};

export type ShowFailedRecordsInput = z.infer<typeof ShowFailedRecordsInputSchema>;
export type ShowFailedRecordsOutput = z.infer<typeof ShowFailedRecordsOutputSchema>;