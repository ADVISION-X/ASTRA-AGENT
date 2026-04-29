import type { z } from "zod";

import type { CommanderReadChildContract } from "../../contract.js";
import { CommanderEvidencePolicySchema } from "../../schema.js";
import { ShowBrowseLedgerBoundaryPolicySchema, ShowBrowseLedgerInputSchema, ShowBrowseLedgerOutputSchema, ShowBrowseLedgerProofPolicySchema, ShowBrowseLedgerReadinessSchema } from "./schema.js";

export const SHOW_BROWSE_LEDGER_CHILD_ID = "show-browse-ledger";

export const SHOW_BROWSE_LEDGER_CONTRACT: CommanderReadChildContract = {
  childCapabilityId: SHOW_BROWSE_LEDGER_CHILD_ID,
  childKind: "read",
  purpose: "Return governed browse-ledger summaries for Commander Console.",
  allowedCaller: "commander-console",
  boundaryDecision: "read-port-only",
  ownedCommandType: null,
  readModelSource: "forensics-read-model",
  requiresOperatorRef: true,
  hardStopPriority: null,
  maxDurationMs: 3000,
  idempotencyPolicy: "idempotent-read",
  boundaryPolicy: ShowBrowseLedgerBoundaryPolicySchema.parse({
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
    recordTypes: ["browse-ledger"],
  }),
  proofPolicy: ShowBrowseLedgerProofPolicySchema.parse({
    requiresRuntimeProof: true,
    requiresGovernedReceipt: false,
    requiresStructuredEvidenceRefs: true,
    requiresFailureReceipt: false,
    requiresTransportDecision: false,
    requiresReadDecision: true,
    requiresHardStopDecision: false,
  }),
  readiness: ShowBrowseLedgerReadinessSchema.parse({
    requiresCommandTransport: false,
    requiresReadModel: true,
    requiresHardPath: false,
  }),
};

export type ShowBrowseLedgerInput = z.infer<typeof ShowBrowseLedgerInputSchema>;
export type ShowBrowseLedgerOutput = z.infer<typeof ShowBrowseLedgerOutputSchema>;