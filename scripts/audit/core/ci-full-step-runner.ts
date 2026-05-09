import { spawn, type ChildProcess } from "node:child_process";

import type { CiFullLayerLabel, CiFullStepDefinition } from "./ci-full-plan.js";
import { buildCiFullCommand, type CiFullStepSummary } from "./ci-full-summary.js";
import { assertStageResourceHealthy, captureMemorySnapshot, logMemorySnapshot, terminateChildProcessGroup, type StageResourceState } from "./ci-full-resource-guard.js";

type StepExecutionOutcome = {
  status: CiFullStepSummary["status"];
  exitCode: number | null;
};

type StepRunOptions = {
  step: CiFullStepDefinition;
  stageLabel: CiFullLayerLabel;
  runId: string;
  activeChildPids: Set<number>;
  resourceState: StageResourceState;
  sampleIntervalMs: number;
};

type StepRuntimeState = {
  memoryPeakMb: number;
  timeoutHandle?: ReturnType<typeof setTimeout>;
};

const roundPeakMb = (value: number): number => Math.round(value * 10) / 10;

const reportStepSamplingError = (stageLabel: CiFullLayerLabel, stepName: string, error: unknown): void => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[CI FULL WARN] ${stageLabel}/${stepName} memory sampling failed: ${message}\n`);
};

const sampleMemoryPeak = async (activeChildPids: ReadonlySet<number>, currentPeakMb: number): Promise<number> => {
  const snapshot = await captureMemorySnapshot(activeChildPids);
  return Math.max(currentPeakMb, snapshot.totalRssMb);
};

const safeSampleMemoryPeak = async (options: StepRunOptions, runtimeState: StepRuntimeState): Promise<void> => {
  try {
    runtimeState.memoryPeakMb = await sampleMemoryPeak(options.activeChildPids, runtimeState.memoryPeakMb);
  } catch (error) {
    reportStepSamplingError(options.stageLabel, options.step.name, error);
  }
};

const clearStepTimeout = (runtimeState: StepRuntimeState): void => {
  if (runtimeState.timeoutHandle) {
    clearTimeout(runtimeState.timeoutHandle);
    delete runtimeState.timeoutHandle;
  }
};

const unregisterChildPid = (child: ChildProcess, activeChildPids: Set<number>): void => {
  if (typeof child.pid === "number") {
    activeChildPids.delete(child.pid);
  }
};

const terminateChild = (child: ChildProcess): void => {
  if (typeof child.pid === "number") {
    terminateChildProcessGroup(child.pid, "SIGTERM");
    return;
  }
  child.kill("SIGTERM");
};

const resolveExitOutcome = (
  resourceState: StageResourceState,
  code: number | null,
  signal: NodeJS.Signals | null,
): StepExecutionOutcome => {
  if (resourceState.error) {
    return { status: "FAIL", exitCode: 1 };
  }
  if (code === 0) {
    return { status: "PASS", exitCode: 0 };
  }
  return { status: "FAIL", exitCode: code ?? (signal ? 1 : 1) };
};

const createTimeoutHandle = (
  child: ChildProcess,
  step: CiFullStepDefinition,
  finish: (outcome: StepExecutionOutcome) => void,
): ReturnType<typeof setTimeout> => setTimeout(() => {
  terminateChild(child);
  finish({ status: "FAIL", exitCode: 1 });
}, step.timeoutMs);

const executeCiStepChild = async (options: StepRunOptions, runtimeState: StepRuntimeState): Promise<StepExecutionOutcome> => {
  const [command, ...args] = options.step.command;
  const child = spawn(command, args, {
    stdio: "inherit",
    detached: process.platform !== "win32",
    shell: process.platform === "win32",
  });

  if (typeof child.pid === "number") {
    options.activeChildPids.add(child.pid);
  }

  return await new Promise<StepExecutionOutcome>((resolve) => {
    let settled = false;
    const finish = (outcome: StepExecutionOutcome): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearStepTimeout(runtimeState);
      unregisterChildPid(child, options.activeChildPids);
      resolve(outcome);
    };

    runtimeState.timeoutHandle = createTimeoutHandle(child, options.step, finish);
    child.on("error", (error) => {
      process.stderr.write(`[CI FULL FAIL-FAST] ${options.stageLabel}/${options.step.name} could not start: ${error.message}\n`);
      finish({ status: "FAIL", exitCode: 1 });
    });
    child.on("exit", (code, signal) => {
      finish(resolveExitOutcome(options.resourceState, code, signal));
    });
  });
};

const startMemoryTracker = (options: StepRunOptions, runtimeState: StepRuntimeState): ReturnType<typeof setInterval> => {
  let isSampling = false;
  return setInterval(() => {
    if (isSampling) {
      return;
    }

    isSampling = true;
    void safeSampleMemoryPeak(options, runtimeState).finally(() => {
      isSampling = false;
    });
  }, options.sampleIntervalMs);
};

const createStepSummary = (
  options: StepRunOptions,
  outcome: StepExecutionOutcome,
  runtimeState: StepRuntimeState,
  durationMs: number,
): CiFullStepSummary => ({
  name: options.step.name,
  layer: options.stageLabel,
  runId: options.runId,
  command: buildCiFullCommand(options.step.command),
  status: outcome.status,
  exitCode: outcome.exitCode,
  durationMs,
  memoryPeakMb: roundPeakMb(runtimeState.memoryPeakMb),
  artifactPaths: [...options.step.artifactPaths],
});

const logStepStart = async (options: StepRunOptions): Promise<void> => {
  process.stdout.write(`[CI FULL] ${options.stageLabel} starting ${options.step.name}...\n`);
  await logMemorySnapshot(`before ${options.stageLabel}/${options.step.name}`, options.activeChildPids);
};

const logStepOutcome = async (options: StepRunOptions, outcome: StepExecutionOutcome): Promise<void> => {
  await logMemorySnapshot(`after ${options.stageLabel}/${options.step.name}`, options.activeChildPids);
  process.stdout.write(`[CI FULL] ${options.step.name} ${outcome.status === "PASS" ? "passed" : "failed"}.\n`);
};

export const runCiStep = async (options: StepRunOptions): Promise<CiFullStepSummary> => {
  assertStageResourceHealthy(options.resourceState);
  await logStepStart(options);

  const startedAtMs = Date.now();
  const runtimeState: StepRuntimeState = { memoryPeakMb: 0 };
  await safeSampleMemoryPeak(options, runtimeState);
  const trackerHandle = startMemoryTracker(options, runtimeState);

  let outcome: StepExecutionOutcome;
  try {
    outcome = await executeCiStepChild(options, runtimeState);
  } finally {
    clearInterval(trackerHandle);
    await safeSampleMemoryPeak(options, runtimeState);
  }

  const durationMs = Date.now() - startedAtMs;
  await logStepOutcome(options, outcome);
  return createStepSummary(options, outcome, runtimeState, durationMs);
};
