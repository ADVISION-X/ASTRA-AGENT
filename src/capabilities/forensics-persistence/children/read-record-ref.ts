import { randomUUID } from "node:crypto";

import type { ForensicsReadRecordRefInput, ForensicsResult } from "../schema.js";
import type { ForensicsStoragePort } from "../storage-port.js";

export async function executeReadRecordRef(
  input: ForensicsReadRecordRefInput,
  storage: ForensicsStoragePort,
): Promise<ForensicsResult> {
  const startedAt = new Date().toISOString();
  try {
    const record = await storage.readRecord(input.recordRef);
    const endedAt = new Date().toISOString();
    return {
      status: "success",
      recordRef: input.recordRef,
      record: record ?? undefined,
      proof: {
        proofId: randomUUID(),
        abilityGroupId: "forensics-persistence",
        childCapabilityId: "read-record-ref",
        recordRef: input.recordRef,
        status: "success",
        startedAt,
        endedAt,
        durationMs: Date.now() - new Date(startedAt).getTime(),
      },
    };
  } catch (err) {
    const endedAt = new Date().toISOString();
    return {
      status: "failed",
      failureReason: err instanceof Error ? err.message : String(err),
      proof: {
        proofId: randomUUID(),
        abilityGroupId: "forensics-persistence",
        childCapabilityId: "read-record-ref",
        recordRef: input.recordRef,
        status: "failed",
        failureReason: err instanceof Error ? err.message : String(err),
        startedAt,
        endedAt,
        durationMs: Date.now() - new Date(startedAt).getTime(),
      },
    };
  }
}
