import { FORENSICS_PERSISTENCE_ABILITY_GROUP_ID, type ForensicsPersistenceChildCapability } from "../../contract.js";
import { executeForensicsChild } from "../../runtime/forensics-executor.js";
import { WRITE_STRUCTURED_RUNTIME_EVENT_CHILD } from "./contract.js";
import { WriteStructuredRuntimeEventInputSchema, WriteStructuredRuntimeEventOutputSchema } from "./schema.js";

export const writeStructuredRuntimeEventCapability: ForensicsPersistenceChildCapability = {
  abilityGroupId: FORENSICS_PERSISTENCE_ABILITY_GROUP_ID,
  childCapabilityId: WRITE_STRUCTURED_RUNTIME_EVENT_CHILD.childCapabilityId,
  recordType: WRITE_STRUCTURED_RUNTIME_EVENT_CHILD.recordType,
  execute(input, context) {
    return executeForensicsChild({
      rawRequest: input,
      context,
      child: {
        childCapabilityId: WRITE_STRUCTURED_RUNTIME_EVENT_CHILD.childCapabilityId,
        recordType: WRITE_STRUCTURED_RUNTIME_EVENT_CHILD.recordType,
        inputSchema: WriteStructuredRuntimeEventInputSchema,
        outputSchema: WriteStructuredRuntimeEventOutputSchema,
        policy: WRITE_STRUCTURED_RUNTIME_EVENT_CHILD,
        integrity: WRITE_STRUCTURED_RUNTIME_EVENT_CHILD,
      },
    });
  },
};
