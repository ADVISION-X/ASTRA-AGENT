import { readProcessTreeRssMB } from "./owner-audit-runner.js";

export type MemorySnapshot = {
  runnerRssMb: number;
  childRssMb: number;
  totalRssMb: number;
  heapUsedMb: number;
  externalMb: number;
  activeChildCount: number;
};

export type StageResourceState = {
  error?: Error;
};

type StageMemoryGuardOptions = {
  stageLabel: string;
  activeChildPids: Set<number>;
  maxRssMb: number;
  sampleIntervalMs: number;
  resourceState: StageResourceState;
};

const roundMb = (bytes: number): number => Math.round((bytes / 1024 / 1024) * 10) / 10;

const getErrorCode = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }
  return typeof error.code === "string" ? error.code : undefined;
};

const isMissingProcessError = (error: unknown): boolean => getErrorCode(error) === "ESRCH";

const tryKillProcess = (pid: number, signal: NodeJS.Signals): boolean => {
  try {
    process.kill(pid, signal);
    return true;
  } catch (error) {
    if (isMissingProcessError(error)) {
      return false;
    }
    throw error;
  }
};

const stopActiveChildren = (activeChildPids: ReadonlySet<number>, signal: NodeJS.Signals): void => {
  for (const pid of activeChildPids) {
    terminateChildProcessGroup(pid, signal);
  }
};

const createResourceLimitError = (stageLabel: string, maxRssMb: number, snapshot: MemorySnapshot): Error =>
  new Error(`[CI_RESOURCE_LIMIT_EXCEEDED] stage ${stageLabel} exceeded ${maxRssMb}MB rss limit (${formatMemorySnapshot(snapshot)}).`);

const reportSamplingError = (stageLabel: string, error: unknown): void => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[CI FULL WARN] ${stageLabel} memory sampling failed: ${message}\n`);
};

const enforceStageMemoryLimit = async (options: StageMemoryGuardOptions): Promise<void> => {
  const snapshot = await captureMemorySnapshot(options.activeChildPids);
  if (snapshot.totalRssMb <= options.maxRssMb) {
    return;
  }

  options.resourceState.error = createResourceLimitError(options.stageLabel, options.maxRssMb, snapshot);
  stopActiveChildren(options.activeChildPids, "SIGKILL");
};

export const captureMemorySnapshot = async (activeChildPids: ReadonlySet<number>): Promise<MemorySnapshot> => {
  const runnerUsage = process.memoryUsage();
  const childRssValues = await Promise.all([...activeChildPids].map((pid) => readProcessTreeRssMB(pid)));
  const childRssMb = Math.round(childRssValues.reduce((sum, value) => sum + value, 0) * 10) / 10;
  const runnerRssMb = roundMb(runnerUsage.rss);

  return {
    runnerRssMb,
    childRssMb,
    totalRssMb: Math.round((runnerRssMb + childRssMb) * 10) / 10,
    heapUsedMb: roundMb(runnerUsage.heapUsed),
    externalMb: roundMb(runnerUsage.external),
    activeChildCount: activeChildPids.size,
  };
};

export const formatMemorySnapshot = (snapshot: MemorySnapshot): string =>
  `runnerRssMB=${snapshot.runnerRssMb} childRssMB=${snapshot.childRssMb} totalRssMB=${snapshot.totalRssMb} heapUsedMB=${snapshot.heapUsedMb} externalMB=${snapshot.externalMb} activeChildren=${snapshot.activeChildCount}`;

export const logMemorySnapshot = async (prefix: string, activeChildPids: ReadonlySet<number>): Promise<void> => {
  const snapshot = await captureMemorySnapshot(activeChildPids);
  process.stdout.write(`[CI FULL] ${prefix} memory ${formatMemorySnapshot(snapshot)}.\n`);
};

export const terminateChildProcessGroup = (pid: number, signal: NodeJS.Signals): void => {
  if (process.platform !== "win32" && tryKillProcess(-pid, signal)) {
    return;
  }
  tryKillProcess(pid, signal);
};

export const assertStageResourceHealthy = (resourceState: StageResourceState): void => {
  if (resourceState.error) {
    throw resourceState.error;
  }
};

export const startStageMemoryGuard = (options: StageMemoryGuardOptions): (() => Promise<void>) => {
  let isStopped = false;
  let isChecking = false;
  const interval = setInterval(() => {
    if (isStopped || isChecking || options.resourceState.error) {
      return;
    }

    isChecking = true;
    void enforceStageMemoryLimit(options)
      .catch((error) => {
        reportSamplingError(options.stageLabel, error);
      })
      .finally(() => {
        isChecking = false;
      });
  }, options.sampleIntervalMs);

  return async () => {
    isStopped = true;
    clearInterval(interval);
  };
};