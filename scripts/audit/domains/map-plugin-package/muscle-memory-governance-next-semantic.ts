import { readFile } from "node:fs/promises";

import { listFilesRecursive } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { MAP_PLUGIN_LAWS } from "./constants.js";

const PREVIOUS_VIDEO_FORBIDDEN_TOKENS = [
  "previous-video",
  "previous_video",
  "click_previous_video",
  "normalize-previous",
  "prev-video",
] as const;

const NON_AI_NEXT_SEMANTIC_TOKENS = [
  "isNextVideo",
  "isPreviousVideo",
  "nextVideoSemanticTruth",
  "previousVideoSemanticTruth",
  "pageReady",
  "videoChanged",
] as const;

const readRepoFile = async (file: string): Promise<string> => readFile(pathFromRepoRoot(file), "utf8");

const toFinding = (file: string, message: string, detail?: string): Finding =>
  createFinding({
    lawId: MAP_PLUGIN_LAWS.MUSCLE_MEMORY_GOVERNANCE,
    file,
    line: 1,
    severity: "fatal",
    message,
    ...(detail ? { detail } : {}),
  });

export async function collectPreviousVideoOwnerFindings(): Promise<Finding[]> {
  const allFiles = await listFilesRecursive(pathFromRepoRoot("src"));
  const inspected = allFiles
    .map((file) => file.slice(pathFromRepoRoot(".").length + 1))
    .filter((file) => file.endsWith(".ts") || file.endsWith(".json"));
  const findings: Finding[] = [];

  for (const file of inspected) {
    const text = await readRepoFile(file);
    const leaked = PREVIOUS_VIDEO_FORBIDDEN_TOKENS.filter((token) => text.includes(token));
    if (leaked.length > 0) {
      findings.push(toFinding(file, "No governed previous-video owner exists; current task must not invoke previous-video chains.", leaked.join(", ")));
    }
  }

  return findings;
}

export async function collectNonAiNextSemanticFindings(): Promise<Finding[]> {
  const allFiles = await listFilesRecursive(pathFromRepoRoot("src"));
  const inspected = allFiles
    .map((file) => file.slice(pathFromRepoRoot(".").length + 1))
    .filter((file) => file.endsWith(".ts"))
    .filter((file) => !file.startsWith("src/capabilities/ai/"));
  const findings: Finding[] = [];

  for (const file of inspected) {
    const text = await readRepoFile(file);
    const explicitSemanticTruth = /(?:isNextVideo|isPreviousVideo|nextVideoSemanticTruth|previousVideoSemanticTruth)/.test(text);
    const derivedPageOrVideo = /(?:pageReady|videoChanged)\s*=.*(?:currentUrl|url|title|hash|document|window|DOM)/is.test(text);
    const leaked = NON_AI_NEXT_SEMANTIC_TOKENS.filter((token) => text.includes(token));
    if (leaked.length > 0 && (explicitSemanticTruth || derivedPageOrVideo)) {
      findings.push(toFinding(file, "Non-AI code must not decide next/previous video semantic truth or derive page readiness/video changes from URL/hash/DOM/title.", leaked.join(", ")));
    }
  }

  return findings;
}