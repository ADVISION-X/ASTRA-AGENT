import type { ForensicsReadRecordRefInput, ForensicsResult } from "../schema.js";
import type { ForensicsStoragePort } from "../storage-port.js";
import {
  buildForensicsFailureProof,
  buildForensicsSuccessProof,
  createForensicsProofTiming,
  resolveForensicsFailureReason,
} from "../proof-support.js";

export async function executeReadRecordRef(
  input: ForensicsReadRecordRefInput,
  storage: ForensicsStoragePort,
): Promise<ForensicsResult> {
  const startedAt = new Date().toISOString();
  try {
    const record = await storage.readRecord(input.recordRef);
    return {
      status: "success",
      recordRef: input.recordRef,
      record: record ?? undefined,
      proof: buildForensicsSuccessProof({
        childCapabilityId: "read-record-ref",
        recordRef: input.recordRef,
      }, createForensicsProofTiming(startedAt)),
    };
  } catch (err) {
    const failureReason = resolveForensicsFailureReason(err);
    return {
      status: "failed",
      failureReason,
      proof: buildForensicsFailureProof(
        "read-record-ref",
        failureReason,
        createForensicsProofTiming(startedAt),
        { recordRef: input.recordRef },
      ),
    };
  }
}
