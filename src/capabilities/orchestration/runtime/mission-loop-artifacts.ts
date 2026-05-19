import { unlink } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";

import sharp from "sharp";

import type { OrchestrationChildrenContext } from "../children-context.js";

const PRIMARY_AI_CONTEXT_MAX_WIDTH_PX = 896;
const PRESERVE_SCREENSHOT_ARTIFACTS_FOR_DEBUG = true;

export type ScreenshotCleanupKind =
  | "grid_failed"
  | "ai_failed"
  | "review_required"
  | "dispatch_failed"
  | "matched_evidence"
  | "no_match"
  | "done"
  | "blocked";

export const primaryAiContextMaxWidthPx = PRIMARY_AI_CONTEXT_MAX_WIDTH_PX;

type CleanupInput = {
  ctx: OrchestrationChildrenContext;
  missionId: string;
  runId: string;
  roundId: string;
  cleanupKind: ScreenshotCleanupKind;
  originalScreenshotRef?: string | null;
  coordinateGridScreenshotRef?: string | null;
  extraTransientScreenshotRefs?: string[] | null;
  deleteOriginalScreenshot: boolean;
};

const cleanupTargets = (input: CleanupInput): string[] => {
  const files = [
    input.coordinateGridScreenshotRef,
    ...(input.extraTransientScreenshotRefs ?? []),
    ...(input.deleteOriginalScreenshot ? [input.originalScreenshotRef] : []),
  ].filter((file): file is string => typeof file === "string" && file.length > 0);
  return [...new Set(files)];
};

const emitCleanupSkipped = (input: CleanupInput, count: number): void => {
  input.ctx.runtimeLogger.emit({
    traceId: input.missionId,
    level: "debug",
    modeVisibility: ["DEBUG", "TRACE"],
    eventType: "SCREENSHOT_TRANSIENT_CLEANUP",
    owner: "orchestration",
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    status: "success",
    reason: `${input.cleanupKind}: debug preserve enabled; skipped deletion for ${count} transient file(s)`,
  });
};

const deleteTransientFile = async (file: string): Promise<"deleted" | "already_missing"> => {
  try {
    await unlink(file);
    return "deleted";
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") return "already_missing";
    throw error;
  }
};

const countDeletionResults = (results: PromiseSettledResult<unknown>[]): { ok: number; failed: number } => {
  const ok = results.filter((result) => result.status === "fulfilled").length;
  return { ok, failed: results.length - ok };
};

const emitCleanupResult = (input: CleanupInput, ok: number, failed: number): void => {
  input.ctx.runtimeLogger.emit({
    traceId: input.missionId,
    level: "debug",
    modeVisibility: ["DEBUG", "TRACE"],
    eventType: "SCREENSHOT_TRANSIENT_CLEANUP",
    owner: "orchestration",
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    status: failed === 0 ? "success" : "failed",
    reason: `${input.cleanupKind}: deleted-or-missing ${ok} transient file(s)${failed > 0 ? `; ${failed} could not be deleted` : ""}`,
  });
};

export const cleanupRoundScreenshotArtifacts = async (input: CleanupInput): Promise<void> => {
  const files = cleanupTargets(input);
  if (files.length === 0) return;
  if (PRESERVE_SCREENSHOT_ARTIFACTS_FOR_DEBUG) {
    emitCleanupSkipped(input, files.length);
    return;
  }
  const results = await Promise.allSettled(files.map(deleteTransientFile));
  const counts = countDeletionResults(results);
  emitCleanupResult(input, counts.ok, counts.failed);
};

const buildPrimaryAiContextPath = (sourceFilePath: string, label: string): string => {
  const ext = extname(sourceFilePath) || ".png";
  const base = basename(sourceFilePath, ext);
  return join(dirname(sourceFilePath), `${base}.${label}.ai.max${PRIMARY_AI_CONTEXT_MAX_WIDTH_PX}.png`);
};

export const resizePrimaryImageForAi = async (
  sourceFilePath: string,
  label: string,
): Promise<string> => {
  const outputFilePath = buildPrimaryAiContextPath(sourceFilePath, label);
  await sharp(sourceFilePath)
    .resize({ width: PRIMARY_AI_CONTEXT_MAX_WIDTH_PX, withoutEnlargement: true, fit: "inside" })
    .png({ compressionLevel: 9 })
    .toFile(outputFilePath);
  return outputFilePath;
};
