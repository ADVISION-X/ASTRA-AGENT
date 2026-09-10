import type { ForensicsReadRecordRefInput, ForensicsReadRecordResult } from "../../schema.js";
import type { ForensicsStoragePort } from "../../storage-port.js";
import {
  createForensicsProofTiming,
  resolveForensicsFailureReason,
} from "../../proof-support.js";

export async function executeReadRecordRef(
  input: ForensicsReadRecordRefInput,
  storage: ForensicsStoragePort,
): Promise<ForensicsReadRecordResult> {
  const startedAt = new Date().toISOString();
  try {
    const record = await storage.readRecord(input.recordRef);
    if (!record) throw new Error("FORENSICS_RECORD_REF_NOT_FOUND");
    return {
      status: "success",
      recordRef: input.recordRef,
      record,
      proof: {
        childCapabilityId: "read-record-ref",
        recordRef: input.recordRef,
        status: "success", ...createForensicsProofTiming(startedAt),
      },
    };
  } catch (err) {
    const failureReason = resolveForensicsFailureReason(err);
    return {
      status: "failed",
      failureReason,
      proof: { childCapabilityId: "read-record-ref", status: "failed", failureReason,
        recordRef: input.recordRef, ...createForensicsProofTiming(startedAt) },
    };
  }
}
