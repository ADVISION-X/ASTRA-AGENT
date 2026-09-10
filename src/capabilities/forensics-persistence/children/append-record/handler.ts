import type { ForensicsAppendRecordInput, ForensicsAppendRecordResult } from "../../schema.js";
import type { ForensicsStoragePort } from "../../storage-port.js";
import {
  createForensicsProofTiming,
  resolveForensicsFailureReason,
} from "../../proof-support.js";

export async function executeAppendRecord(
  input: ForensicsAppendRecordInput,
  storage: ForensicsStoragePort,
): Promise<ForensicsAppendRecordResult> {
  const startedAt = new Date().toISOString();
  try {
    const result = await storage.appendRecord(input);
    return {
      status: "success",
      recordRef: result.recordRef,
      proof: {
        childCapabilityId: "append-record",
        missionId: input.missionId,
        runId: input.runId,
        capabilityCallId: input.capabilityCallId,
        recordRef: result.recordRef,
        storageRef: result.storageRef,
        integrityHash: result.integrityHash,
        status: "success", ...createForensicsProofTiming(startedAt),
      },
    };
  } catch (err) {
    const failureReason = resolveForensicsFailureReason(err);
    return {
      status: "failed",
      failureReason,
      proof: { childCapabilityId: "append-record", status: "failed", failureReason,
        missionId: input.missionId, runId: input.runId, ...createForensicsProofTiming(startedAt) },
    };
  }
}
