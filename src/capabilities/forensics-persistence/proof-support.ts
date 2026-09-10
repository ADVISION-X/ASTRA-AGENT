import { randomUUID } from "node:crypto";
export const createForensicsProofTiming = (startedAt: string) => {
  const endedAt = new Date().toISOString();
  return {
    proofId: randomUUID(), startedAt,
    endedAt,
    durationMs: Date.now() - new Date(startedAt).getTime(),
  };
};

export const resolveForensicsFailureReason = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
