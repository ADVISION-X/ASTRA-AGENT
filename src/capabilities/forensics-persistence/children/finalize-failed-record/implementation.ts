import { FORENSICS_PERSISTENCE_ABILITY_GROUP_ID, type ForensicsPersistenceChildCapability } from "../../contract.js";
import { executeForensicsChild } from "../../runtime/forensics-executor.js";
import { FINALIZE_FAILED_RECORD_CHILD } from "./contract.js";
import { FinalizeFailedRecordInputSchema, FinalizeFailedRecordOutputSchema } from "./schema.js";

export const finalizeFailedRecordCapability: ForensicsPersistenceChildCapability = {
  abilityGroupId: FORENSICS_PERSISTENCE_ABILITY_GROUP_ID,
  childCapabilityId: FINALIZE_FAILED_RECORD_CHILD.childCapabilityId,
  recordType: FINALIZE_FAILED_RECORD_CHILD.recordType,
  execute(input, context) {
    return executeForensicsChild({
      rawRequest: input,
      context,
      child: {
        childCapabilityId: FINALIZE_FAILED_RECORD_CHILD.childCapabilityId,
        recordType: FINALIZE_FAILED_RECORD_CHILD.recordType,
        inputSchema: FinalizeFailedRecordInputSchema,
        outputSchema: FinalizeFailedRecordOutputSchema,
        policy: FINALIZE_FAILED_RECORD_CHILD,
        integrity: FINALIZE_FAILED_RECORD_CHILD,
      },
    });
  },
};
