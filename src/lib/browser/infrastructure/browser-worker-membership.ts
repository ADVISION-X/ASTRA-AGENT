export type BrowserWorkerMembership = Readonly<{
  workerId: string;
  executionRef: string;
  writerFenceHash: `sha256:${string}`;
  writerLeaseEpoch: number;
}>;

export const assertCurrentWorkerMembership = (member: BrowserWorkerMembership, expectedFenceHash: `sha256:${string}`): void => {
  if (member.writerFenceHash !== expectedFenceHash) throw new Error("BROWSER_WORKER_FENCE_INVALID");
};
