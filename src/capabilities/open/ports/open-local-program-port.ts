export type OpenLocalProgramLaunchResult = {
  localProgramActionId: string | null;
  ok: boolean;
  message: string;
  createdAt: string;
  appLaunchAttemptRef: string;
  windowHandoffRef: string | null;
  localAppStateHandoffRef: string | null;
  portKind: "open-local-program-port";
};

export type OpenLocalProgramSnapshot = {
  appName: string;
  bundleId: string | null;
  visibleWindowAvailable: boolean;
  windowTitle: string | null;
  windowHandoffRef: string | null;
  localAppStateHandoffRef: string | null;
  snapshotFailureReason: string | null;
};

export interface OpenLocalProgramPort {
  openLocalProgram(input: {
    openAttemptRef: string;
    missionId: string;
    runId: string;
    sessionId: string;
    roundId: string | null;
    videoVisitId: string | null;
    childCapabilityId: "open-local-program";
    platformId: "macos-local";
    targetKind: "local-program";
    targetProfileRef: string;
    appName: string;
    bundleId: string | null;
    appPath: string | null;
    allowedLaunchMethod: "macos-open-application";
    timeoutMs: number;
    abortSignal: AbortSignal;
    idempotencyKey: string;
    sourceRef: string | null;
  }): Promise<OpenLocalProgramLaunchResult>;

  getLocalProgramSnapshot(input: {
    targetProfileRef: string;
    appName: string;
    bundleId: string | null;
  }): Promise<OpenLocalProgramSnapshot>;
}
