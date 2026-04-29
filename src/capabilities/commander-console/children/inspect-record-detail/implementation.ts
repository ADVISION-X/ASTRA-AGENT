import { commanderFlag } from "../../shared/commander-proof.js";
import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { executeCommanderReadChild } from "../../runtime/commander-child-executors.js";
import { buildCommanderEvidenceRef } from "../../runtime/commander-boundary-policy.js";
import { INSPECT_RECORD_DETAIL_CONTRACT, type InspectRecordDetailInput, type InspectRecordDetailOutput } from "./contract.js";
import { InspectRecordDetailInputSchema, InspectRecordDetailOutputSchema } from "./schema.js";

export const INSPECT_RECORD_DETAIL_CHILD: CommanderConsoleChildDefinition<InspectRecordDetailInput, InspectRecordDetailOutput> = {
  ...INSPECT_RECORD_DETAIL_CONTRACT,
  inputSchema: InspectRecordDetailInputSchema,
  outputSchema: InspectRecordDetailOutputSchema,
  async execute(input, context) {
    return executeCommanderReadChild({
      contract: INSPECT_RECORD_DETAIL_CONTRACT,
      operatorRef: input.operatorRef,
      rawInput: input.input,
      inputSchema: InspectRecordDetailInputSchema,
      context,
      read: async (readInput) => context.forensicsReadModel.inspectRecordDetail(readInput.recordId),
      buildEvidenceRefs: (detail) => detail.recordId
        ? [buildCommanderEvidenceRef({
          recordType: detail.recordType,
          recordId: detail.recordId,
          sourceAbility: "forensics-read-model",
        })]
        : [],
      buildOutputPolicy: (detail) => detail.recordType === "not-found"
        ? {
          status: "review_required",
          reviewRequiredReason: "record_not_found",
          targetRecordRef: null,
          dataQualityFlags: [commanderFlag("record_not_found", "warn", "Requested record detail was not found.")],
        }
        : {
          targetRecordRef: detail.recordId
            ? { recordType: detail.recordType, recordId: detail.recordId }
            : null,
        },
    });
  },
};