import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { RuntimeLogEvent, RuntimeLogMode } from "./schema.js";
import { redactRuntimeLogEvent, redactRuntimeLogRecord } from "./redaction.js";

export type RuntimeDebugBundleIndex = {
  runId: string;
  missionId: string;
  createdAt: string;
  logMode: RuntimeLogMode;
  runtimeLogRef: string;
  rounds: Array<{
    roundId: string;
    roundIndex: number;
    status: string;
    stageRefs: Record<string, string>;
    failureClass?: string;
    failureReason?: string;
  }>;
  artifacts: Record<string, {
    ref: string;
    sha256?: string;
    byteSize?: number;
    contentType?: string;
  }>;
};

type RuntimeDebugBundle = {
  bundleDir: string;
  runtimeLogPath: string;
  appendEvent(event: RuntimeLogEvent): void;
  writeMissionSummary(summary: Record<string, unknown>): void;
  writeRoundSummary(input: {
    roundId: string;
    roundIndex: number;
    status: string;
    summary: Record<string, unknown>;
    failureClass?: string;
    failureReason?: string;
  }): void;
  writeStageTimeline(input: {
    roundId: string;
    timeline: Record<string, unknown>;
  }): string;
  writeRecoveryTrail(input: {
    roundId: string;
    trail: Record<string, unknown>;
  }): string;
  writeRoundArtifact(input: {
    roundId: string;
    fileName: string;
    data: Record<string, unknown>;
  }): string;
  writeIndex(): void;
};

const writeJson = (filePath: string, value: unknown): void => {
  mkdirSync(join(filePath, ".."), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const roundDir = (bundleDir: string, roundId: string): string => join(bundleDir, "rounds", roundId);

const ensureRoundDir = (bundleDir: string, roundId: string): string => {
  const directory = roundDir(bundleDir, roundId);
  mkdirSync(directory, { recursive: true });
  return directory;
};

const upsertRoundIndexEntry = (input: {
  index: RuntimeDebugBundleIndex;
  roundId: string;
  roundIndex: number;
  status: string;
  failureClass?: string;
  failureReason?: string;
}): void => {
  const currentRound = input.index.rounds.find((entry) => entry.roundId === input.roundId);
  const nextRound: RuntimeDebugBundleIndex["rounds"][number] = {
    roundId: input.roundId,
    roundIndex: input.roundIndex,
    status: input.status,
    stageRefs: currentRound?.stageRefs ?? {},
    ...(input.failureClass ? { failureClass: input.failureClass } : {}),
    ...(input.failureReason ? { failureReason: input.failureReason } : {}),
  };
  const indexOfRound = input.index.rounds.findIndex((entry) => entry.roundId === input.roundId);
  if (indexOfRound >= 0) {
    input.index.rounds[indexOfRound] = nextRound;
    return;
  }
  input.index.rounds.push(nextRound);
};

const updateRoundArtifactRef = (input: {
  index: RuntimeDebugBundleIndex;
  roundId: string;
  fileName: string;
  filePath: string;
}): void => {
  const roundEntry = input.index.rounds.find((entry) => entry.roundId === input.roundId);
  if (roundEntry) {
    roundEntry.stageRefs[input.fileName.replace(/\.json$/u, "")] = input.filePath;
  }
};

const createDebugBundleIndex = (input: {
  runId: string;
  missionId: string;
  logMode: RuntimeLogMode;
  runtimeLogPath: string;
}): RuntimeDebugBundleIndex => ({
  runId: input.runId,
  missionId: input.missionId,
  createdAt: new Date().toISOString(),
  logMode: input.logMode,
  runtimeLogRef: input.runtimeLogPath,
  rounds: [],
  artifacts: {},
});

const writeNamedRoundArtifact = (input: {
  bundleDir: string;
  index: RuntimeDebugBundleIndex;
  roundId: string;
  fileName: string;
  data: Record<string, unknown>;
}): string => writeBundleRoundArtifact({
  bundleDir: input.bundleDir,
  index: input.index,
  roundArtifactInput: {
    roundId: input.roundId,
    fileName: input.fileName,
    data: input.data,
  },
});

const appendBundleEvent = (runtimeLogPath: string, event: RuntimeLogEvent): void => {
  appendFileSync(runtimeLogPath, `${JSON.stringify(redactRuntimeLogEvent(event))}\n`, "utf8");
};

const writeBundleMissionSummary = (missionSummaryPath: string, summary: Record<string, unknown>): void => {
  writeJson(missionSummaryPath, redactRuntimeLogRecord(summary));
};

const writeBundleIndex = (indexPath: string, index: RuntimeDebugBundleIndex): void => {
  writeJson(indexPath, index);
};

const writeStageTimelineArtifact = (bundleDir: string, index: RuntimeDebugBundleIndex, roundId: string, timeline: Record<string, unknown>): string =>
  writeNamedRoundArtifact({
    bundleDir,
    index,
    roundId,
    fileName: "stage-timeline.json",
    data: timeline,
  });

const writeRecoveryTrailArtifact = (bundleDir: string, index: RuntimeDebugBundleIndex, roundId: string, trail: Record<string, unknown>): string =>
  writeNamedRoundArtifact({
    bundleDir,
    index,
    roundId,
    fileName: "recovery-trail.json",
    data: trail,
  });

const createAppendEventWriter = (runtimeLogPath: string): RuntimeDebugBundle["appendEvent"] => (event) => {
  appendBundleEvent(runtimeLogPath, event);
};

const createMissionSummaryWriter = (missionSummaryPath: string): RuntimeDebugBundle["writeMissionSummary"] => (summary) => {
  writeBundleMissionSummary(missionSummaryPath, summary);
};

const createRoundSummaryWriter = (bundleDir: string, index: RuntimeDebugBundleIndex): RuntimeDebugBundle["writeRoundSummary"] => (roundInput) => {
  writeBundleRoundSummary({ bundleDir, index, roundInput });
};

const createRoundArtifactWriter = (bundleDir: string, index: RuntimeDebugBundleIndex): RuntimeDebugBundle["writeRoundArtifact"] => (roundArtifactInput) =>
  writeBundleRoundArtifact({ bundleDir, index, roundArtifactInput });

const createStageTimelineWriter = (bundleDir: string, index: RuntimeDebugBundleIndex): RuntimeDebugBundle["writeStageTimeline"] => (stageTimelineInput) =>
  writeStageTimelineArtifact(bundleDir, index, stageTimelineInput.roundId, stageTimelineInput.timeline);

const createRecoveryTrailWriter = (bundleDir: string, index: RuntimeDebugBundleIndex): RuntimeDebugBundle["writeRecoveryTrail"] => (recoveryTrailInput) =>
  writeRecoveryTrailArtifact(bundleDir, index, recoveryTrailInput.roundId, recoveryTrailInput.trail);

const createIndexWriter = (indexPath: string, index: RuntimeDebugBundleIndex): RuntimeDebugBundle["writeIndex"] => () => {
  writeBundleIndex(indexPath, index);
};

const writeBundleRoundSummary = (input: {
  bundleDir: string;
  index: RuntimeDebugBundleIndex;
  roundInput: Parameters<RuntimeDebugBundle["writeRoundSummary"]>[0];
}): void => {
  const filePath = join(ensureRoundDir(input.bundleDir, input.roundInput.roundId), "round-summary.json");
  writeJson(filePath, redactRuntimeLogRecord(input.roundInput.summary));
  upsertRoundIndexEntry({
    index: input.index,
    roundId: input.roundInput.roundId,
    roundIndex: input.roundInput.roundIndex,
    status: input.roundInput.status,
    ...(input.roundInput.failureClass ? { failureClass: input.roundInput.failureClass } : {}),
    ...(input.roundInput.failureReason ? { failureReason: input.roundInput.failureReason } : {}),
  });
};

const writeBundleRoundArtifact = (input: {
  bundleDir: string;
  index: RuntimeDebugBundleIndex;
  roundArtifactInput: Parameters<RuntimeDebugBundle["writeRoundArtifact"]>[0];
}): string => {
  const filePath = join(ensureRoundDir(input.bundleDir, input.roundArtifactInput.roundId), input.roundArtifactInput.fileName);
  writeJson(filePath, redactRuntimeLogRecord(input.roundArtifactInput.data));
  updateRoundArtifactRef({
    index: input.index,
    roundId: input.roundArtifactInput.roundId,
    fileName: input.roundArtifactInput.fileName,
    filePath,
  });
  return filePath;
};

export const createRuntimeDebugBundle = (input: {
  rootDir: string;
  runId: string;
  missionId: string;
  logMode: RuntimeLogMode;
}): RuntimeDebugBundle => {
  const bundleDir = join(input.rootDir, input.runId);
  const runtimeLogPath = join(bundleDir, "runtime-log.jsonl");
  const indexPath = join(bundleDir, "index.json");
  const missionSummaryPath = join(bundleDir, "mission-summary.json");
  const index = createDebugBundleIndex({
    runId: input.runId,
    missionId: input.missionId,
    logMode: input.logMode,
    runtimeLogPath,
  });

  mkdirSync(bundleDir, { recursive: true });

  return {
    bundleDir,
    runtimeLogPath,
    appendEvent: createAppendEventWriter(runtimeLogPath),
    writeMissionSummary: createMissionSummaryWriter(missionSummaryPath),
    writeRoundSummary: createRoundSummaryWriter(bundleDir, index),
    writeRoundArtifact: createRoundArtifactWriter(bundleDir, index),
    writeStageTimeline: createStageTimelineWriter(bundleDir, index),
    writeRecoveryTrail: createRecoveryTrailWriter(bundleDir, index),
    writeIndex: createIndexWriter(indexPath, index),
  };
};

