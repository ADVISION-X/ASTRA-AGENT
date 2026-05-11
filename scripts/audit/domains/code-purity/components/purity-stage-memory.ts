import { CODE_PURITY_MAX_RSS_ENV } from "./purity-stage-paths.js";

const DEFAULT_MAX_RSS_MB = 6_000;

const readCodePurityMaxRssMb = (): number => {
  const rawValue = process.env[CODE_PURITY_MAX_RSS_ENV]?.trim();
  if (!rawValue) {
    return DEFAULT_MAX_RSS_MB;
  }

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${CODE_PURITY_MAX_RSS_ENV} must be a positive integer.`);
  }
  return parsed;
};

const captureCodePurityMemory = (): { rssMB: number; heapUsedMB: number } => {
  const usage = process.memoryUsage();
  return {
    rssMB: Math.round((usage.rss / 1024 / 1024) * 10) / 10,
    heapUsedMB: Math.round((usage.heapUsed / 1024 / 1024) * 10) / 10,
  };
};

export const assertCodePurityMemoryBoundary = (stage: string, scannedFileCount: number, findingsCount: number): void => {
  const memory = captureCodePurityMemory();
  const maxRssMB = readCodePurityMaxRssMb();
  if (memory.rssMB <= maxRssMB) {
    return;
  }

  throw new Error(
    `CODE_PURITY_RESOURCE_LIMIT_EXCEEDED stage=${stage} rssMB=${memory.rssMB} heapUsedMB=${memory.heapUsedMB} scannedFileCount=${scannedFileCount} findingsCount=${findingsCount} maxRssMB=${maxRssMB}`,
  );
};

export const logCodePurityStageMetrics = (stage: string, scannedFileCount: number, findingsCount: number): void => {
  const memory = captureCodePurityMemory();
  process.stdout.write(`[CODE PURITY] ${stage} rssMB=${memory.rssMB} heapUsedMB=${memory.heapUsedMB} scannedFileCount=${scannedFileCount} findingsCount=${findingsCount}\n`);
};
