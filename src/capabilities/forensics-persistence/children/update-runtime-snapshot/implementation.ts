import { FORENSICS_PERSISTENCE_ABILITY_GROUP_ID, type ForensicsPersistenceChildCapability } from "../../contract.js";
import { executeForensicsChild } from "../../runtime/forensics-executor.js";
import { UPDATE_RUNTIME_SNAPSHOT_CHILD } from "./contract.js";
import { UpdateRuntimeSnapshotInputSchema, UpdateRuntimeSnapshotOutputSchema } from "./schema.js";

export const updateRuntimeSnapshotCapability: ForensicsPersistenceChildCapability = {
  abilityGroupId: FORENSICS_PERSISTENCE_ABILITY_GROUP_ID,
  childCapabilityId: UPDATE_RUNTIME_SNAPSHOT_CHILD.childCapabilityId,
  recordType: UPDATE_RUNTIME_SNAPSHOT_CHILD.recordType,
  execute(input, context) {
    return executeForensicsChild({
      rawRequest: input,
      context,
      child: {
        childCapabilityId: UPDATE_RUNTIME_SNAPSHOT_CHILD.childCapabilityId,
        recordType: UPDATE_RUNTIME_SNAPSHOT_CHILD.recordType,
        inputSchema: UpdateRuntimeSnapshotInputSchema,
        outputSchema: UpdateRuntimeSnapshotOutputSchema,
        policy: UPDATE_RUNTIME_SNAPSHOT_CHILD,
        integrity: UPDATE_RUNTIME_SNAPSHOT_CHILD,
      },
    });
  },
};
