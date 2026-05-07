import type { z } from "zod";

import type { CommanderCommandChildContract } from "../../contract.js";
import {
  CommanderEvidencePolicySchema,
} from "../../schema.js";
import {
  IssueHumanCommandBoundaryPolicySchema,
  IssueHumanCommandInputSchema,
  IssueHumanCommandOutputSchema,
  IssueHumanCommandProofPolicySchema,
  IssueHumanCommandReadinessSchema,
} from "./schema.js";

export const ISSUE_HUMAN_COMMAND_CHILD_ID = "issue-human-command";

export const ISSUE_HUMAN_COMMAND_CONTRACT: CommanderCommandChildContract = {
  childCapabilityId: ISSUE_HUMAN_COMMAND_CHILD_ID,
  childKind: "command",
  purpose: "Accept operator start-mission commands and emit governed human-command transport.",
  allowedCaller: "commander-console",
  boundaryDecision: "command-transport-only",
  ownedCommandType: "start-mission",
  readModelSource: null,
  requiresOperatorRef: true,
  hardStopPriority: null,
  maxDurationMs: 60_000,
  idempotencyPolicy: "dedupe-command",
  boundaryPolicy: IssueHumanCommandBoundaryPolicySchema.parse({
    allowedCaller: "commander-console",
    boundaryDecision: "command-transport-only",
    ownedCommandType: "start-mission",
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
  proofPolicy: IssueHumanCommandProofPolicySchema.parse({
    requiresRuntimeProof: true,
    requiresGovernedReceipt: true,
    requiresStructuredEvidenceRefs: true,
    requiresFailureReceipt: true,
    requiresTransportDecision: true,
    requiresReadDecision: false,
    requiresHardStopDecision: false,
  }),
  readiness: IssueHumanCommandReadinessSchema.parse({
    requiresCommandTransport: true,
    requiresReadModel: false,
    requiresHardPath: false,
  }),
};

export type IssueHumanCommandInput = z.infer<typeof IssueHumanCommandInputSchema>;
export type IssueHumanCommandOutput = z.infer<typeof IssueHumanCommandOutputSchema>;