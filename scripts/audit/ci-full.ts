import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

import { readProcessTreeRssMB } from "./core/owner-audit-runner.js";
import { CI_FULL_LAYER_EXECUTION, CI_FULL_LAYER_ORDER, getCiFullStepsByLayer, type CiFullLayerLabel, type CiFullStepDefinition } from "./core/ci-full-plan.js";
import { buildCiFullCommand, getCiFullLayerStatus, type CiFullLayerSummary, type CiFullSummary, type CiFullStepSummary, writeCiFullSummary } from "./core/ci-full-summary.js";
import { ABILITY_GROUP_SAFE_MAX_CONCURRENCY } from "./core/ci-full-timeouts.js";

type CiStep = CiFullStepDefinition;

type CiStageExecutionMode = "serial" | "bounded";

type CiStage = {
  label: CiFullLayerLabel;
  executionMode: CiStageExecutionMode;
  steps: CiStep[];
  maxConcurrency?: number;
};

type MemorySnapshot = {
  runnerRssMb: number;
  childRssMb: number;
  totalRssMb: number;
  heapUsedMb: number;
  externalMb: number;
  activeChildCount: number;
};

type StageRunResult = {
  summary: CiFullLayerSummary;
  passed: boolean;
};

const DEFAULT_MAX_RSS_MB = 4_500;
const MEMORY_SAMPLE_INTERVAL_MS = 1_000;
const MAX_CONCURRENCY_ENV = "GRASSEYE_CI_FULL_MAX_CONCURRENCY";
const MAX_RSS_ENV = "GRASSEYE_CI_MAX_RSS_MB";

const ACTIVE_CHILD_PIDS = new Set<number>();

let activeStageResourceError: Error | undefined;

const readPositiveIntegerEnv = (name: string): number | undefined => {
  const rawValue = process.env[name]?.trim();
  if (!rawValue) {
    return undefined;
  }

  const parsedValue = Number(rawValue);
  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    throw new Error(`[CI FULL CONFIG] ${name} must be a positive integer.`);
  }

  return parsedValue;
};

const roundMb = (bytes: number): number => Math.round((bytes / 1024 / 1024) * 10) / 10;

const captureMemorySnapshot = async (): Promise<MemorySnapshot> => {
  const runnerUsage = process.memoryUsage();
  const childRssValues = await Promise.all([...ACTIVE_CHILD_PIDS].map((pid) => readProcessTreeRssMB(pid)));
  const childRssMb = Math.round(childRssValues.reduce((sum, value) => sum + value, 0) * 10) / 10;
  const runnerRssMb = roundMb(runnerUsage.rss);

  return {
    runnerRssMb,
    childRssMb,
    totalRssMb: Math.round((runnerRssMb + childRssMb) * 10) / 10,
    heapUsedMb: roundMb(runnerUsage.heapUsed),
    externalMb: roundMb(runnerUsage.external),
    activeChildCount: ACTIVE_CHILD_PIDS.size,
  };
};

const formatMemorySnapshot = (snapshot: MemorySnapshot): string =>
  `runnerRssMB=${snapshot.runnerRssMb} childRssMB=${snapshot.childRssMb} totalRssMB=${snapshot.totalRssMb} heapUsedMB=${snapshot.heapUsedMb} externalMB=${snapshot.externalMb} activeChildren=${snapshot.activeChildCount}`;

const logMemorySnapshot = async (prefix: string): Promise<void> => {
  const snapshot = await captureMemorySnapshot();
  process.stdout.write(`[CI FULL] ${prefix} memory ${formatMemorySnapshot(snapshot)}.\n`);
};

const stopActiveChildren = (): void => {
  for (const pid of ACTIVE_CHILD_PIDS) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Ignore races for already-exited children.
    }
  }
};

const MAX_RSS_MB = readPositiveIntegerEnv(MAX_RSS_ENV) ?? DEFAULT_MAX_RSS_MB;

const createResourceLimitError = (stageLabel: string, snapshot: MemorySnapshot): Error =>
  new Error(`[CI_RESOURCE_LIMIT_EXCEEDED] stage ${stageLabel} exceeded ${MAX_RSS_MB}MB rss limit (${formatMemorySnapshot(snapshot)}).`);

const assertStageResourceHealthy = (): void => {
  if (activeStageResourceError) {
    throw activeStageResourceError;
  }
};

const startStageMemoryGuard = (stageLabel: string): (() => Promise<void>) => {
  let isStopped = false;
  let isChecking = false;
  const interval = setInterval(() => {
    if (isStopped || isChecking || activeStageResourceError) {
      return;
    }

    isChecking = true;
    void captureMemorySnapshot()
      .then((snapshot) => {
        if (snapshot.totalRssMb > MAX_RSS_MB) {
          activeStageResourceError = createResourceLimitError(stageLabel, snapshot);
          stopActiveChildren();
        }
      })
      .catch(() => {
        // Best-effort guard; ignore sampling errors.
      })
      .finally(() => {
        isChecking = false;
      });
  }, MEMORY_SAMPLE_INTERVAL_MS);

  return async () => {
    isStopped = true;
    clearInterval(interval);
  };
};

const resolveAbilityGroupConcurrency = (): number => {
  const configuredValue = readPositiveIntegerEnv(MAX_CONCURRENCY_ENV) ?? ABILITY_GROUP_SAFE_MAX_CONCURRENCY;
  if (configuredValue > ABILITY_GROUP_SAFE_MAX_CONCURRENCY) {
    throw new Error(`[CI FULL CONFIG] ${MAX_CONCURRENCY_ENV} must not exceed ${ABILITY_GROUP_SAFE_MAX_CONCURRENCY} on the memory-safe topology.`);
  }
  return configuredValue;
};

const CI_STAGES: CiStage[] = CI_FULL_LAYER_ORDER.map((label) => ({
  label,
  executionMode: CI_FULL_LAYER_EXECUTION[label].executionMode,
  ...(CI_FULL_LAYER_EXECUTION[label].executionMode === "bounded"
    ? { maxConcurrency: CI_FULL_LAYER_EXECUTION[label].maxConcurrency }
    : {}),
  steps: getCiFullStepsByLayer(label),
}));

const exitNow = (code: number): never => {
  process.exit(code);
};

const createSkippedStepSummary = (step: CiStep, stageLabel: CiFullLayerLabel, runId: string): CiFullStepSummary => ({
  name: step.name,
  layer: stageLabel,
  runId,
  command: buildCiFullCommand(step.command),
  status: "SKIPPED",
  exitCode: null,
  durationMs: 0,
  memoryPeakMb: 0,
  artifactPaths: [...step.artifactPaths],
});

const runCiStep = async (step: CiStep, stageLabel: CiFullLayerLabel, runId: string): Promise<CiFullStepSummary> => {
  assertStageResourceHealthy();
  process.stdout.write(`[CI FULL] ${stageLabel} starting ${step.name}...\n`);
  await logMemorySnapshot(`before ${stageLabel}/${step.name}`);

  const startedAtMs = Date.now();
  let memoryPeakMb = 0;
  let status: CiFullStepSummary["status"] = "FAIL";
  let exitCode: number | null = null;
  let settled = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let trackerHandle: ReturnType<typeof setInterval> | undefined;

  const sampleMemory = async (): Promise<void> => {
    try {
      const snapshot = await captureMemorySnapshot();
      if (snapshot.totalRssMb > memoryPeakMb) {
        memoryPeakMb = snapshot.totalRssMb;
      }
    } catch {
      // Best-effort telemetry.
    }
  };

  trackerHandle = setInterval(() => {
    void sampleMemory();
  }, MEMORY_SAMPLE_INTERVAL_MS);

  await sampleMemory();

  try {
    await new Promise<void>((resolve) => {
      const [command, ...args] = step.command;
      const child = spawn(command, args, {
        stdio: "inherit",
        shell: process.platform === "win32",
      });

      if (typeof child.pid === "number") {
        ACTIVE_CHILD_PIDS.add(child.pid);
      }

      const finish = (nextStatus: CiFullStepSummary["status"], nextExitCode: number | null): void => {
        if (settled) {
          return;
        }
        settled = true;
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        if (trackerHandle) {
          clearInterval(trackerHandle);
        }
        if (typeof child.pid === "number") {
          ACTIVE_CHILD_PIDS.delete(child.pid);
        }
        status = nextStatus;
        exitCode = nextExitCode;
        resolve();
      };

      timeoutHandle = setTimeout(() => {
        child.kill("SIGTERM");
        finish("FAIL", 1);
      }, step.timeoutMs);

      child.on("error", (error) => {
        process.stderr.write(`[CI FULL FAIL-FAST] ${stageLabel}/${step.name} could not start: ${error.message}\n`);
        finish("FAIL", 1);
      });

      child.on("exit", (code, signal) => {
        if (activeStageResourceError) {
          finish("FAIL", 1);
          return;
        }

        if (code === 0) {
          finish("PASS", 0);
          return;
        }

        finish("FAIL", code ?? (signal ? 1 : 1));
      });
    });
  } finally {
    if (trackerHandle) {
      clearInterval(trackerHandle);
    }
    await sampleMemory();
  }

  const durationMs = Date.now() - startedAtMs;
  await logMemorySnapshot(`after ${stageLabel}/${step.name}`);
  process.stdout.write(`[CI FULL] ${step.name} ${status === "PASS" ? "passed" : "failed"}.\n`);

  return {
    name: step.name,
    layer: stageLabel,
    runId,
    command: buildCiFullCommand(step.command),
    status,
    exitCode,
    durationMs,
    memoryPeakMb: Math.round(memoryPeakMb * 10) / 10,
    artifactPaths: [...step.artifactPaths],
  };
};

const runSerialStage = async (stage: CiStage, runId: string): Promise<StageRunResult> => {
  const stepSummaries: CiFullStepSummary[] = [];
  let stageFailed = false;

  for (const step of stage.steps) {
    if (stageFailed) {
      stepSummaries.push(createSkippedStepSummary(step, stage.label, runId));
      continue;
    }

    const summary = await runCiStep(step, stage.label, runId);
    stepSummaries.push(summary);
    if (summary.status !== "PASS") {
      stageFailed = true;
    }
  }

  return {
    summary: {
      label: stage.label,
      runId,
      status: getCiFullLayerStatus(stepSummaries),
      steps: stepSummaries,
    },
    passed: !stageFailed && stepSummaries.every((step) => step.status === "PASS"),
  };
};

const runBoundedStage = async (stage: CiStage, maxConcurrency: number, runId: string): Promise<StageRunResult> => {
  const pendingSteps = [...stage.steps];
  const stepSummaries = new Map<string, CiFullStepSummary>();
  let stopRequested = false;
  const workerCount = Math.min(maxConcurrency, pendingSteps.length);

  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      if (stopRequested) {
        return;
      }

      const step = pendingSteps.shift();
      if (!step) {
        return;
      }

      const summary = await runCiStep(step, stage.label, runId);
      stepSummaries.set(step.name, summary);
      if (summary.status !== "PASS") {
        stopRequested = true;
      }
    }
  });

  await Promise.all(workers);

  for (const step of pendingSteps) {
    stepSummaries.set(step.name, createSkippedStepSummary(step, stage.label, runId));
  }

  const orderedStepSummaries = stage.steps.map((step) => stepSummaries.get(step.name) ?? createSkippedStepSummary(step, stage.label, runId));

  return {
    summary: {
      label: stage.label,
      runId,
      status: getCiFullLayerStatus(orderedStepSummaries),
      steps: orderedStepSummaries,
    },
    passed: orderedStepSummaries.every((step) => step.status === "PASS"),
  };
};

const runCiStage = async (stage: CiStage, runId: string): Promise<StageRunResult> => {
  const maxConcurrency = stage.executionMode === "bounded" ? resolveAbilityGroupConcurrency() : 1;
  process.stdout.write(`[CI FULL] stage ${stage.label} starting (${stage.executionMode}${stage.executionMode === "bounded" ? ` maxConcurrency=${maxConcurrency}` : ""}).\n`);
  await logMemorySnapshot(`before stage ${stage.label}`);
  activeStageResourceError = undefined;
  const stopMemoryGuard = startStageMemoryGuard(stage.label);

  try {
    const result = stage.executionMode === "serial"
      ? await runSerialStage(stage, runId)
      : await runBoundedStage(stage, maxConcurrency, runId);
    return result;
  } finally {
    await stopMemoryGuard();
  }
};

const createSkippedStageSummary = (stage: CiStage, runId: string): CiFullLayerSummary => ({
  label: stage.label,
  runId,
  status: "SKIPPED",
  steps: stage.steps.map((step) => createSkippedStepSummary(step, stage.label, runId)),
});

const buildCiFullSummary = (runId: string, layers: CiFullLayerSummary[]): CiFullSummary => ({
  generatedAt: new Date().toISOString(),
  runId,
  status: layers.every((layer) => layer.status === "PASS") ? "PASS" : "FAIL",
  layers,
});

const main = async (): Promise<void> => {
  const runId = randomUUID();
  const layerSummaries: CiFullLayerSummary[] = [];
  let encounteredFailure = false;

  try {
    for (const stage of CI_STAGES) {
      if (encounteredFailure) {
        layerSummaries.push(createSkippedStageSummary(stage, runId));
        continue;
      }

      const result = await runCiStage(stage, runId);
      layerSummaries.push(result.summary);
      if (!result.passed) {
        encounteredFailure = true;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[CI FULL ERROR] ${message}\n`);
    while (layerSummaries.length < CI_STAGES.length) {
      layerSummaries.push(createSkippedStageSummary(CI_STAGES[layerSummaries.length], runId));
    }
  }

  const summary = buildCiFullSummary(runId, layerSummaries);
  await writeCiFullSummary(summary);

  if (summary.status === "PASS") {
    process.stdout.write("[CI FULL PASS] foundation, map, and ability-group audits all passed.\n");
    exitNow(0);
  }

  process.stderr.write("[CI FULL FAIL] structured summary recorded blocking or skipped evidence.\n");
  exitNow(1);
};

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[CI FULL ERROR] ${message}\n`);
  exitNow(1);
});