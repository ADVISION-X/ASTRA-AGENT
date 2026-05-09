import { spawnSync } from "node:child_process";

import { fileExists, readJsonFile } from "./filesystem.js";
import { generatedArtifactPaths } from "./generated-artifact-paths.js";
import { pathFromRepoRoot } from "./paths.js";
import type { TouchedFilesArtifact, TouchedFilesBaselineSource } from "./touched-files.js";

const repoRoot = pathFromRepoRoot(".");
const IGNORED_TOUCHED_FILE_PREFIXES = ["tmp/", ".debug-loop/", "dist/", "node_modules/", "scripts/audit/generated/"] as const;

const normalizePath = (value: string): string => value.trim().replace(/\\/g, "/");

const shouldKeepTouchedFile = (filePath: string): boolean =>
  filePath.length > 0 && !IGNORED_TOUCHED_FILE_PREFIXES.some((prefix) => filePath.startsWith(prefix));

const sanitizeTouchedFiles = (filePaths: string[]): string[] =>
  [...new Set(filePaths.map((filePath) => normalizePath(filePath)).filter((filePath) => shouldKeepTouchedFile(filePath)))].sort((left, right) => left.localeCompare(right));

const runGitLines = (args: string[]) => {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0 || typeof result.stdout !== "string") {
    return { ok: false, lines: [] as string[] };
  }

  return {
    ok: true,
    lines: result.stdout
      .split("\n")
      .map((line) => normalizePath(line))
      .filter((line) => line.length > 0),
  };
};

const parseGitStatusPath = (line: string): string | undefined => {
  const trimmed = line.trim();
  if (trimmed.length < 4) {
    return undefined;
  }

  const rawPath = trimmed.slice(3).trim();
  if (rawPath.length === 0) {
    return undefined;
  }

  const renamedPath = rawPath.includes(" -> ") ? rawPath.slice(rawPath.indexOf(" -> ") + 4) : rawPath;
  return normalizePath(renamedPath);
};

const loadGeneratedTouchedFilesArtifact = async (): Promise<TouchedFilesArtifact | undefined> => {
  if (!(await fileExists(pathFromRepoRoot(generatedArtifactPaths.touchedFiles)))) {
    return undefined;
  }

  return readJsonFile<TouchedFilesArtifact>(generatedArtifactPaths.touchedFiles);
};

const buildArtifact = (input: {
  source: TouchedFilesBaselineSource;
  touchedFiles: string[];
  touchedBaseRef?: string;
}): TouchedFilesArtifact => ({
  generatedAt: new Date().toISOString(),
  touchedBaselineSource: input.source,
  touchedFiles: sanitizeTouchedFiles(input.touchedFiles),
  ...(input.touchedBaseRef ? { touchedBaseRef: input.touchedBaseRef } : {}),
});

export const collectTouchedFilesArtifact = async (options?: { allowStatusFallback?: boolean }): Promise<TouchedFilesArtifact> => {
  const baseRef = process.env.CODE_PURITY_BASE_REF?.trim();
  if (baseRef) {
    const result = runGitLines(["diff", "--name-only", `${baseRef}...HEAD`]);
    if (result.ok) {
      return buildArtifact({
        source: "CODE_PURITY_BASE_REF...HEAD",
        touchedBaseRef: baseRef,
        touchedFiles: result.lines,
      });
    }
  }

  const headResult = runGitLines(["diff", "--name-only", "HEAD"]);
  if (headResult.ok) {
    return buildArtifact({
      source: "git diff --name-only HEAD",
      touchedFiles: headResult.lines,
    });
  }

  const generatedArtifact = await loadGeneratedTouchedFilesArtifact();
  if (generatedArtifact) {
    return generatedArtifact;
  }

  if (options?.allowStatusFallback) {
    const statusResult = runGitLines(["status", "--porcelain", "--untracked-files=all"]);
    if (statusResult.ok) {
      const touchedFiles = statusResult.lines
        .map((line) => parseGitStatusPath(line))
        .filter((filePath): filePath is string => Boolean(filePath));
      return buildArtifact({
        source: "git status --porcelain --untracked-files=all",
        touchedFiles,
      });
    }
  }

  return buildArtifact({
    source: "none",
    touchedFiles: [],
  });
};
