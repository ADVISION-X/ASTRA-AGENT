import type { z } from "zod";

import type { CommanderReadChildContract } from "../../contract.js";
import { CommanderEvidencePolicySchema } from "../../schema.js";
import { InspectRecordDetailBoundaryPolicySchema, InspectRecordDetailInputSchema, InspectRecordDetailOutputSchema, InspectRecordDetailProofPolicySchema, InspectRecordDetailReadinessSchema } from "./schema.js";

export const INSPECT_RECORD_DETAIL_CHILD_ID = "inspect-record-detail";

export const INSPECT_RECORD_DETAIL_CONTRACT: CommanderReadChildContract = {
  childCapabilityId: INSPECT_RECORD_DETAIL_CHILD_ID,
  childKind: "read",
  purpose: "Return a governed detail view for one forensics record reference.",
  allowedCaller: "commander-console",
  boundaryDecision: "read-port-only",
  ownedCommandType: null,
  readModelSource: "forensics-read-model",
  requiresOperatorRef: true,
  hardStopPriority: null,
  maxDurationMs: 60_000,
  idempotencyPolicy: "idempotent-read",
  boundaryPolicy: InspectRecordDetailBoundaryPolicySchema.parse({
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
    targetRecordRequired: true,
    proofRefRequired: false,
    recordTypes: ["candidate", "evidence-packet", "browse-ledger", "failed-record", "runtime-event", "mission", "not-found"],
  }),
  proofPolicy: InspectRecordDetailProofPolicySchema.parse({
    requiresRuntimeProof: true,
    requiresGovernedReceipt: false,
    requiresStructuredEvidenceRefs: true,
    requiresFailureReceipt: false,
    requiresTransportDecision: false,
    requiresReadDecision: true,
    requiresHardStopDecision: false,
  }),
  readiness: InspectRecordDetailReadinessSchema.parse({
    requiresCommandTransport: false,
    requiresReadModel: true,
    requiresHardPath: false,
  }),
};

export type InspectRecordDetailInput = z.infer<typeof InspectRecordDetailInputSchema>;
export type InspectRecordDetailOutput = z.infer<typeof InspectRecordDetailOutputSchema>;