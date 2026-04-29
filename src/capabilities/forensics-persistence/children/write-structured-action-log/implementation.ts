import { FORENSICS_PERSISTENCE_ABILITY_GROUP_ID, type ForensicsPersistenceChildCapability } from "../../contract.js";
import { executeForensicsChild } from "../../runtime/forensics-executor.js";
import { WRITE_STRUCTURED_ACTION_LOG_CHILD } from "./contract.js";
import { WriteStructuredActionLogInputSchema, WriteStructuredActionLogOutputSchema } from "./schema.js";

export const writeStructuredActionLogCapability: ForensicsPersistenceChildCapability = {
  abilityGroupId: FORENSICS_PERSISTENCE_ABILITY_GROUP_ID,
  childCapabilityId: WRITE_STRUCTURED_ACTION_LOG_CHILD.childCapabilityId,
  recordType: WRITE_STRUCTURED_ACTION_LOG_CHILD.recordType,
  execute(input, context) {
    return executeForensicsChild({
      rawRequest: input,
      context,
      child: {
        childCapabilityId: WRITE_STRUCTURED_ACTION_LOG_CHILD.childCapabilityId,
        recordType: WRITE_STRUCTURED_ACTION_LOG_CHILD.recordType,
        inputSchema: WriteStructuredActionLogInputSchema,
        outputSchema: WriteStructuredActionLogOutputSchema,
        policy: WRITE_STRUCTURED_ACTION_LOG_CHILD,
        integrity: WRITE_STRUCTURED_ACTION_LOG_CHILD,
      },
    });
  },
};
