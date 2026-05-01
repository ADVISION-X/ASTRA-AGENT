import { readFile } from "node:fs/promises";

import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";

import { PATHS, type StructuredAuditDoc } from "./config.js";

const SCORECARD_START = "<!-- COMMANDER_CONSOLE_MAC_APP_SHELL_SCORECARD_JSON_START -->";
const SCORECARD_END = "<!-- COMMANDER_CONSOLE_MAC_APP_SHELL_SCORECARD_JSON_END -->";
const ATOMIC_QUALITY_START = "<!-- COMMANDER_CONSOLE_UI_ATOMIC_QUALITY_JSON_START -->";
const ATOMIC_QUALITY_END = "<!-- COMMANDER_CONSOLE_UI_ATOMIC_QUALITY_JSON_END -->";

export async function pathExists(repoRelativePath: string): Promise<boolean> {
  return fileExists(pathFromRepoRoot(repoRelativePath));
}

async function readStructuredAuditDoc(path: string, startMarker: string, endMarker: string): Promise<StructuredAuditDoc> {
  const content = await readFile(pathFromRepoRoot(path), "utf8");
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`Structured JSON block is missing in ${path}.`);
  }

  const json = content.slice(start + startMarker.length, end).trim();
  return JSON.parse(json) as StructuredAuditDoc;
}

export async function readScorecardData(): Promise<StructuredAuditDoc> {
  return readStructuredAuditDoc(PATHS.SCORECARD, SCORECARD_START, SCORECARD_END);
}

export async function readAtomicQualityData(): Promise<StructuredAuditDoc> {
  return readStructuredAuditDoc(PATHS.ATOMIC_QUALITY, ATOMIC_QUALITY_START, ATOMIC_QUALITY_END);
}