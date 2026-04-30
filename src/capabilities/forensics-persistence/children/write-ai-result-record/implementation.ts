import { FORENSICS_PERSISTENCE_ABILITY_GROUP_ID, type ForensicsPersistenceChildCapability } from "../../contract.js";
import { executeForensicsChild } from "../../shared/forensics-executor.js";
import { WRITE_AI_RESULT_RECORD_CHILD } from "./contract.js";
import { WriteAiResultRecordInputSchema, WriteAiResultRecordOutputSchema } from "./schema.js";

export const writeAiResultRecordCapability: ForensicsPersistenceChildCapability = {
  abilityGroupId: FORENSICS_PERSISTENCE_ABILITY_GROUP_ID,
  childCapabilityId: WRITE_AI_RESULT_RECORD_CHILD.childCapabilityId,
  recordType: WRITE_AI_RESULT_RECORD_CHILD.recordType,
  execute(input, context) {
    return executeForensicsChild({
      rawRequest: input,
      context,
      child: {
        childCapabilityId: WRITE_AI_RESULT_RECORD_CHILD.childCapabilityId,
        recordType: WRITE_AI_RESULT_RECORD_CHILD.recordType,
        inputSchema: WriteAiResultRecordInputSchema,
        outputSchema: WriteAiResultRecordOutputSchema,
        policy: WRITE_AI_RESULT_RECORD_CHILD,
        integrity: WRITE_AI_RESULT_RECORD_CHILD,
      },
    });
  },
};
