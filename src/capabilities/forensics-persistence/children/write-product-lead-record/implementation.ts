import { FORENSICS_PERSISTENCE_ABILITY_GROUP_ID, type ForensicsPersistenceChildCapability } from "../../contract.js";
import { executeForensicsChild } from "../../shared/forensics-executor.js";
import { WRITE_PRODUCT_LEAD_RECORD_CHILD } from "./contract.js";
import { WriteProductLeadRecordInputSchema, WriteProductLeadRecordOutputSchema } from "./schema.js";

export const writeProductLeadRecordCapability: ForensicsPersistenceChildCapability = {
  abilityGroupId: FORENSICS_PERSISTENCE_ABILITY_GROUP_ID,
  childCapabilityId: WRITE_PRODUCT_LEAD_RECORD_CHILD.childCapabilityId,
  recordType: WRITE_PRODUCT_LEAD_RECORD_CHILD.recordType,
  execute(input, context) {
    return executeForensicsChild({
      rawRequest: input,
      context,
      child: {
        childCapabilityId: WRITE_PRODUCT_LEAD_RECORD_CHILD.childCapabilityId,
        recordType: WRITE_PRODUCT_LEAD_RECORD_CHILD.recordType,
        inputSchema: WriteProductLeadRecordInputSchema,
        outputSchema: WriteProductLeadRecordOutputSchema,
        policy: WRITE_PRODUCT_LEAD_RECORD_CHILD,
        integrity: WRITE_PRODUCT_LEAD_RECORD_CHILD,
      },
    });
  },
};