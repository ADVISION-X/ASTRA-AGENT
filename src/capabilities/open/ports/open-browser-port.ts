import type {
  BrowserSessionSnapshot,
  OpenBrowserNavigationResult,
  OpenChildCapabilityId,
  OpenPlatformId,
  OpenTargetKind,
} from "../contract.js";

export interface OpenBrowserPort {
  getSessionSnapshot(): Promise<BrowserSessionSnapshot>;
  open(input: {
    openAttemptRef: string;
    missionId: string;
    runId: string;
    sessionId: string;
    roundId: string | null;
    videoVisitId: string | null;
    childCapabilityId: OpenChildCapabilityId;
    platformId: OpenPlatformId;
    targetKind: OpenTargetKind;
    targetProfileRef: string | null;
    url: string;
    title: string | null;
    timeoutMs: number;
    abortSignal: AbortSignal;
    idempotencyKey: string;
    sourceRef: string | null;
  }): Promise<OpenBrowserNavigationResult>;
}