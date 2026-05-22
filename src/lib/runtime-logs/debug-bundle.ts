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

export type RuntimeDebugBundle = {
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
  writeRoundArtifact(input: {
    roundId: string;
    fileName: string;
    data: Record<string, unknown>;
  }): string;
  writeIndex(): void;
};

const writeJson = (filePath: string, value: Record<string, unknown>): void => {
  mkdirSync(join(filePath, ".."), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const roundDir = (bundleDir: string, roundId: string): string => join(bundleDir, "rounds", roundId);

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
  const index: RuntimeDebugBundleIndex = {
    runId: input.runId,
    missionId: input.missionId,
    createdAt: new Date().toISOString(),
    logMode: input.logMode,
    runtimeLogRef: runtimeLogPath,
    rounds: [],
    artifacts: {},
  };

  mkdirSync(bundleDir, { recursive: true });

  return {
    bundleDir,
    runtimeLogPath,
    appendEvent(event) {
      appendFileSync(runtimeLogPath, `${JSON.stringify(redactRuntimeLogEvent(event))}\n`, "utf8");
    },
    writeMissionSummary(summary) {
      writeJson(missionSummaryPath, redactRuntimeLogRecord(summary));
    },
    writeRoundSummary(roundInput) {
      const currentRound = index.rounds.find((entry) => entry.roundId === roundInput.roundId);
      const stageRefs: Record<string, string> = currentRound?.stageRefs ?? {};
      const filePath = join(roundDir(bundleDir, roundInput.roundId), "round-summary.json");
      mkdirSync(roundDir(bundleDir, roundInput.roundId), { recursive: true });
      writeJson(filePath, redactRuntimeLogRecord(roundInput.summary));
      const nextRound = {
        roundId: roundInput.roundId,
        roundIndex: roundInput.roundIndex,
        status: roundInput.status,
        stageRefs,
        ...(roundInput.failureClass ? { failureClass: roundInput.failureClass } : {}),
        ...(roundInput.failureReason ? { failureReason: roundInput.failureReason } : {}),
      };
      const indexOfRound = index.rounds.findIndex((entry) => entry.roundId === roundInput.roundId);
      if (indexOfRound >= 0) {
        index.rounds[indexOfRound] = nextRound;
      } else {
        index.rounds.push(nextRound);
      }
    },
    writeRoundArtifact(roundArtifactInput) {
      const filePath = join(roundDir(bundleDir, roundArtifactInput.roundId), roundArtifactInput.fileName);
      mkdirSync(roundDir(bundleDir, roundArtifactInput.roundId), { recursive: true });
      writeJson(filePath, redactRuntimeLogRecord(roundArtifactInput.data));
      const roundEntry = index.rounds.find((entry) => entry.roundId === roundArtifactInput.roundId);
      if (roundEntry) {
        roundEntry.stageRefs[roundArtifactInput.fileName.replace(/\.json$/u, "")] = filePath;
      }
      return filePath;
    },
    writeIndex() {
      writeJson(indexPath, index as unknown as Record<string, unknown>);
    },
  };
};

export const appendRuntimeEventToDebugBundle = (bundle: RuntimeDebugBundle, event: RuntimeLogEvent): void => {
  bundle.appendEvent(event);
};