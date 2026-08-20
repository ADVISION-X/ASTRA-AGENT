import type { BrowserWorkerMembership } from "./browser-worker-membership.js";

export type BrowserWorkerHandoverReceipt = Readonly<{
  previousWorkerId: string;
  nextWorkerId: string;
  previousFenceHash: `sha256:${string}`;
  nextFenceHash: `sha256:${string}`;
  closedAt: string;
}>;

export const sealBrowserWorkerHandover = (
  previous: BrowserWorkerMembership,
  next: BrowserWorkerMembership,
): BrowserWorkerHandoverReceipt => ({
  previousWorkerId: previous.workerId,
  nextWorkerId: next.workerId,
  previousFenceHash: previous.writerFenceHash,
  nextFenceHash: next.writerFenceHash,
  closedAt: new Date().toISOString(),
});
