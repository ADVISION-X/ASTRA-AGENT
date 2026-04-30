import { FORENSICS_PERSISTENCE_ABILITY_GROUP_ID, type ForensicsPersistenceChildCapability } from "../../contract.js";
import { executeForensicsChild } from "../../shared/forensics-executor.js";
import { WRITE_EVIDENCE_RECORD_CHILD } from "./contract.js";
import { WriteEvidenceRecordInputSchema, WriteEvidenceRecordOutputSchema } from "./schema.js";

export const writeEvidenceRecordCapability: ForensicsPersistenceChildCapability = {
  abilityGroupId: FORENSICS_PERSISTENCE_ABILITY_GROUP_ID,
  childCapabilityId: WRITE_EVIDENCE_RECORD_CHILD.childCapabilityId,
  recordType: WRITE_EVIDENCE_RECORD_CHILD.recordType,
  execute(input, context) {
    return executeForensicsChild({
      rawRequest: input,
      context,
      child: {
        childCapabilityId: WRITE_EVIDENCE_RECORD_CHILD.childCapabilityId,
        recordType: WRITE_EVIDENCE_RECORD_CHILD.recordType,
        inputSchema: WriteEvidenceRecordInputSchema,
        outputSchema: WriteEvidenceRecordOutputSchema,
        policy: WRITE_EVIDENCE_RECORD_CHILD,
        integrity: WRITE_EVIDENCE_RECORD_CHILD,
      },
    });
  },
};
