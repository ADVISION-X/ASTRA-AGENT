import { randomUUID } from "node:crypto";

import { CI_FULL_LAYER_EXECUTION, CI_FULL_LAYER_ORDER, getCiFullStepsByLayer, type CiFullLayerLabel, type CiFullStepDefinition } from "./core/ci-full-plan.js";
import { logMemorySnapshot, startStageMemoryGuard, type StageResourceState } from "./core/ci-full-resource-guard.js";
import { runCiStep } from "./core/ci-full-step-runner.js";
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

type StageRunResult = {
  summary: CiFullLayerSummary;
  passed: boolean;
};

const DEFAULT_MAX_RSS_MB = 4_500;
const MEMORY_SAMPLE_INTERVAL_MS = 1_000;
const MAX_CONCURRENCY_ENV = "GRASSEYE_CI_FULL_MAX_CONCURRENCY";
const MAX_RSS_ENV = "GRASSEYE_CI_MAX_RSS_MB";

const ACTIVE_CHILD_PIDS = new Set<number>();

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

const MAX_RSS_MB = readPositiveIntegerEnv(MAX_RSS_ENV) ?? DEFAULT_MAX_RSS_MB;

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

const runSerialStage = async (stage: CiStage, runId: string, resourceState: StageResourceState): Promise<StageRunResult> => {
  const stepSummaries: CiFullStepSummary[] = [];
  let stageFailed = false;

  for (const step of stage.steps) {
    if (stageFailed) {
      stepSummaries.push(createSkippedStepSummary(step, stage.label, runId));
      continue;
    }

    const summary = await runCiStep({
      step,
      stageLabel: stage.label,
      runId,
      activeChildPids: ACTIVE_CHILD_PIDS,
      resourceState,
      sampleIntervalMs: MEMORY_SAMPLE_INTERVAL_MS,
    });
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

const runBoundedStage = async (stage: CiStage, maxConcurrency: number, runId: string, resourceState: StageResourceState): Promise<StageRunResult> => {
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

      const summary = await runCiStep({
        step,
        stageLabel: stage.label,
        runId,
        activeChildPids: ACTIVE_CHILD_PIDS,
        resourceState,
        sampleIntervalMs: MEMORY_SAMPLE_INTERVAL_MS,
      });
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
  await logMemorySnapshot(`before stage ${stage.label}`, ACTIVE_CHILD_PIDS);
  const resourceState: StageResourceState = {};
  const stopMemoryGuard = startStageMemoryGuard({
    stageLabel: stage.label,
    activeChildPids: ACTIVE_CHILD_PIDS,
    maxRssMb: MAX_RSS_MB,
    sampleIntervalMs: MEMORY_SAMPLE_INTERVAL_MS,
    resourceState,
  });

  try {
    const result = stage.executionMode === "serial"
      ? await runSerialStage(stage, runId, resourceState)
      : await runBoundedStage(stage, maxConcurrency, runId, resourceState);
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

const runCiStagesUntilFailure = async (runId: string): Promise<CiFullLayerSummary[]> => {
  const layerSummaries: CiFullLayerSummary[] = [];
  let encounteredFailure = false;

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

  return layerSummaries;
};

const appendSkippedStagesAfterError = (layerSummaries: CiFullLayerSummary[], runId: string): CiFullLayerSummary[] => {
  while (layerSummaries.length < CI_STAGES.length) {
    const stage = CI_STAGES[layerSummaries.length];
    if (!stage) {
      break;
    }
    layerSummaries.push(createSkippedStageSummary(stage, runId));
  }
  return layerSummaries;
};

const recoverLayerSummariesFromError = (error: unknown, layerSummaries: CiFullLayerSummary[], runId: string): CiFullLayerSummary[] => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[CI FULL ERROR] ${message}\n`);
  return appendSkippedStagesAfterError(layerSummaries, runId);
};

const exitFromCiFullSummary = (summary: CiFullSummary): void => {
  if (summary.status === "PASS") {
    process.stdout.write("[CI FULL PASS] foundation, map, and ability-group audits all passed.\n");
    exitNow(0);
  }

  process.stderr.write("[CI FULL FAIL] structured summary recorded blocking or skipped evidence.\n");
  exitNow(1);
};

const main = async (): Promise<void> => {
  const runId = randomUUID();
  let layerSummaries: CiFullLayerSummary[] = [];

  try {
    layerSummaries = await runCiStagesUntilFailure(runId);
  } catch (error) {
    layerSummaries = recoverLayerSummariesFromError(error, layerSummaries, runId);
  }

  const summary = buildCiFullSummary(runId, layerSummaries);
  await writeCiFullSummary(summary);
  exitFromCiFullSummary(summary);
};

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[CI FULL ERROR] ${message}\n`);
  exitNow(1);
});
