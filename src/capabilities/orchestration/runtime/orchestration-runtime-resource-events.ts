import { getRuntimeResourceUsageSnapshot } from "../../../lib/local-runtime/runtime-resource-usage.js";
import type { StructuredRuntimeResourceSummary } from "../../../types/structured-log.js";

import type { RuntimeEventInput } from "./orchestration-runtime-event-payload.js";

const RESOURCE_CHECKPOINT_INTERVAL_MS = 60_000;
const DEFAULT_CHROME_WARNING_THRESHOLD_MB = 4_500;
const ROUND_START_STEP_ID = "capture-video-frame-3s";
const TERMINAL_RESOURCE_EVENT_TYPES = new Set([
  "MISSION_FAILED",
  "MISSION_FINALIZED",
  "MISSION_REVIEW_REQUIRED",
  "MISSION_STOPPED",
]);
const PERIODIC_RESOURCE_EVENT_TYPES = new Set(["STEP_TRANSITION_EVALUATED"]);
const lastCheckpointAtByMission = new Map<string, number>();

type ResourceSnapshot = Awaited<ReturnType<typeof getRuntimeResourceUsageSnapshot>>;

function readPositiveIntegerEnv(name: string): number | null {
  const rawValue = process.env[name]?.trim();
  if (!rawValue) {
    return null;
  }
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function roundMb(bytesOrMb: number, divisor = 1): number {
  return Math.round((bytesOrMb / divisor) * 10) / 10;
}

function resolveChromeWarningThresholdMb(): number {
  return readPositiveIntegerEnv("GRASSEYE_RUNTIME_CHROME_WARN_RSS_MB") ?? DEFAULT_CHROME_WARNING_THRESHOLD_MB;
}

function resolveMissionKey(input: RuntimeEventInput): string {
  return input.state.missionId ?? input.state.activeTaskRunId ?? `${input.state.mapId ?? "unknown-map"}:${input.state.currentRoundIndex}`;
}

function isRuntimeResourceEvent(eventType: string): boolean {
  return eventType === "runtime_resource_checkpoint" || eventType === "runtime_resource_warning";
}

function shouldForceResourceCheckpoint(input: RuntimeEventInput): boolean {
  return TERMINAL_RESOURCE_EVENT_TYPES.has(input.eventType)
    || (input.eventType === "MAP_STEP_SELECTED" && input.step.stepId === ROUND_START_STEP_ID);
}

function shouldRecordPeriodicResourceCheckpoint(input: RuntimeEventInput, missionKey: string): boolean {
  if (!PERIODIC_RESOURCE_EVENT_TYPES.has(input.eventType)) {
    return false;
  }

  const lastCheckpointAt = lastCheckpointAtByMission.get(missionKey) ?? 0;
  return Date.now() - lastCheckpointAt >= RESOURCE_CHECKPOINT_INTERVAL_MS;
}

function shouldRecordResourceCheckpoint(input: RuntimeEventInput): boolean {
  if (isRuntimeResourceEvent(input.eventType)) {
    return false;
  }

  const missionKey = resolveMissionKey(input);
  return shouldForceResourceCheckpoint(input) || shouldRecordPeriodicResourceCheckpoint(input, missionKey);
}

function buildResourceSummary(snapshot: ResourceSnapshot): StructuredRuntimeResourceSummary {
  const chromeProcesses = snapshot.topByRss.filter((processSnapshot) => processSnapshot.tags.includes("chrome"));
  const chromeRssMb = roundMb(chromeProcesses.reduce((sum, processSnapshot) => sum + processSnapshot.rssMb, 0));
  const topChromeProcess = chromeProcesses[0] ?? null;

  return {
    capturedAt: snapshot.capturedAt,
    chromeRssMb,
    chromeProcessCount: chromeProcesses.length,
    nodeRssMb: roundMb(snapshot.nodeProcess.rssBytes, 1024 * 1024),
    hostFreeMemoryMb: roundMb(snapshot.host.freeMemoryBytes, 1024 * 1024),
    warningThresholdMb: resolveChromeWarningThresholdMb(),
    topChromePid: topChromeProcess?.pid ?? null,
    topChromeRssMb: topChromeProcess?.rssMb ?? null,
    interestingProcesses: snapshot.interestingProcesses.slice(0, 5).map((processSnapshot) => ({
      pid: processSnapshot.pid,
      rssMb: processSnapshot.rssMb,
      cpuPercent: processSnapshot.cpuPercent,
      tags: processSnapshot.tags,
    })),
  };
}

function buildResourceEventBase(input: RuntimeEventInput, resourceSummary: StructuredRuntimeResourceSummary): RuntimeEventInput {
  return {
    ...input,
    level: "INFO",
    status: "success",
    eventType: "runtime_resource_checkpoint",
    reason: `Chrome rss checkpoint captured at step "${input.step.stepId}" (${resourceSummary.chromeRssMb}MB across ${resourceSummary.chromeProcessCount} chrome processes).`,
    actionableMessage: "Track Chrome rss checkpoints across rounds and inspect the current Chrome session before memory pressure starts distorting mission outcomes.",
    ownerResponsible: "Orchestration / runtime-resource-monitor",
    resourceSummary,
    refs: [
      `chromeRssMb=${resourceSummary.chromeRssMb}`,
      `chromeProcessCount=${resourceSummary.chromeProcessCount}`,
      `nodeRssMb=${resourceSummary.nodeRssMb}`,
    ],
    inputRefs: [],
    outputRefs: [],
    proofRefs: [],
    actionLogRefs: [],
    expectedInputRefKeys: [],
    resolvedInputRefKeys: [],
    missingInputRefKeys: [],
    outputRefAliases: [],
    producedOutputRefs: [],
    jointCheckpoint: null,
    failureSnapshot: null,
    proofSummary: {},
  };
}

export async function buildRuntimeResourceEvents(input: RuntimeEventInput): Promise<RuntimeEventInput[]> {
  if (!shouldRecordResourceCheckpoint(input)) {
    return [];
  }

  const resourceSummary = buildResourceSummary(await getRuntimeResourceUsageSnapshot({ limit: 8 }));
  const warningThresholdMb = resourceSummary.warningThresholdMb ?? resolveChromeWarningThresholdMb();
  lastCheckpointAtByMission.set(resolveMissionKey(input), Date.now());

  const checkpointEvent = buildResourceEventBase(input, resourceSummary);
  if (resourceSummary.chromeRssMb < warningThresholdMb) {
    return [checkpointEvent];
  }

  return [
    checkpointEvent,
    {
      ...checkpointEvent,
      level: "WARN",
      eventType: "runtime_resource_warning",
      reason: `Chrome rss soft warning triggered at ${resourceSummary.chromeRssMb}MB (threshold ${warningThresholdMb}MB).`,
      actionableMessage: `Chrome rss exceeded the soft warning threshold. Inspect the current Chrome session and reduce memory pressure before the next round continues.`,
      refs: [...(checkpointEvent.refs ?? []), `warningThresholdMb=${warningThresholdMb}`],
    },
  ];
}