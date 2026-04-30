import { FORENSICS_PERSISTENCE_ABILITY_GROUP_ID, type ForensicsPersistenceChildCapability } from "../../contract.js";
import { executeForensicsChild } from "../../shared/forensics-executor.js";
import { FINALIZE_EVIDENCE_PACKET_CHILD } from "./contract.js";
import { FinalizeEvidencePacketInputSchema, FinalizeEvidencePacketOutputSchema } from "./schema.js";

export const finalizeEvidencePacketCapability: ForensicsPersistenceChildCapability = {
  abilityGroupId: FORENSICS_PERSISTENCE_ABILITY_GROUP_ID,
  childCapabilityId: FINALIZE_EVIDENCE_PACKET_CHILD.childCapabilityId,
  recordType: FINALIZE_EVIDENCE_PACKET_CHILD.recordType,
  execute(input, context) {
    return executeForensicsChild({
      rawRequest: input,
      context,
      child: {
        childCapabilityId: FINALIZE_EVIDENCE_PACKET_CHILD.childCapabilityId,
        recordType: FINALIZE_EVIDENCE_PACKET_CHILD.recordType,
        inputSchema: FinalizeEvidencePacketInputSchema,
        outputSchema: FinalizeEvidencePacketOutputSchema,
        policy: FINALIZE_EVIDENCE_PACKET_CHILD,
        integrity: FINALIZE_EVIDENCE_PACKET_CHILD,
      },
    });
  },
};
