import type { BrowserMutationStore } from "../exact-target/browser-mutation-store.js";
import type { BrowserSessionWorkspace } from "../exact-target/browser-session-workspace.js";

export type PendingJobBoundTargetAcquisition = Readonly<{
  authorityEpoch: number;
  action: "acquire" | "release";
  jobRefHash: `sha256:${string}`;
  resolve(): void;
  reject(error: Error): void;
  timeout: ReturnType<typeof setTimeout>;
}>;

export type BrowserInfrastructureState = {
  mutationState: BrowserMutationStore | null;
  started: boolean;
  ownerLockHeld: boolean;
  connectionGeneration: number;
  workspace: BrowserSessionWorkspace | undefined;
  pendingJobBoundTargetAcquisition: PendingJobBoundTargetAcquisition | null;
};

export const createBrowserInfrastructureState = (): BrowserInfrastructureState => ({
  mutationState: null,
  started: false,
  ownerLockHeld: false,
  connectionGeneration: 0,
  workspace: undefined,
  pendingJobBoundTargetAcquisition: null,
});
