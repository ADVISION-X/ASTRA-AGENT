import type { ForensicsAppendRecordInput, ForensicsResult } from "../../schema.js";
import type { ForensicsStoragePort } from "../../storage-port.js";
import {
  buildForensicsFailureProof,
  buildForensicsSuccessProof,
  createForensicsProofTiming,
  resolveForensicsFailureReason,
} from "../../proof-support.js";

export async function executeAppendRecord(
  input: ForensicsAppendRecordInput,
  storage: ForensicsStoragePort,
): Promise<ForensicsResult> {
  const startedAt = new Date().toISOString();
  try {
    const result = await storage.appendRecord(input);
    return {
      status: "success",
      recordRef: result.recordRef,
      proof: buildForensicsSuccessProof({
        childCapabilityId: "append-record",
        missionId: input.missionId,
        runId: input.runId,
        sessionId: input.sessionId,
        roundId: input.roundId,
        capabilityCallId: input.capabilityCallId,
        recordRef: result.recordRef,
        storageRef: result.storageRef,
        integrityHash: result.integrityHash,
      }, createForensicsProofTiming(startedAt)),
    };
  } catch (err) {
    const failureReason = resolveForensicsFailureReason(err);
    return {
      status: "failed",
      failureReason,
      proof: buildForensicsFailureProof(
        "append-record",
        failureReason,
        createForensicsProofTiming(startedAt),
        {
        missionId: input.missionId,
        runId: input.runId,
        },
      ),
    };
  }
}
