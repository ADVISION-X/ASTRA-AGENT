import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { runCommand } from "./command-runner.mjs";
import { writeJsonFile } from "./json-utils.mjs";
import { getRepoRoot } from "./path-policy.mjs";

const GENERATED_ROOT = "scripts/audit/generated";
const PROTECTED_DELETION_PATTERNS = [/\/inspector\.ts$/i, /\.instructions\.md$/i];
const LAW_DOWNGRADE_PATTERN = /status:\s*active[\s\S]{0,200}?tier:\s*P0[\s\S]{0,200}?enforcementMode:\s*(manual-first|warning-only)/i;

function splitLines(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function toGlobRegExp(pattern) {
  return new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "::DOUBLE_STAR::").replace(/\*/g, "[^/]*").replace(/::DOUBLE_STAR::/g, ".*")}$`);
}

function matchesAnyPattern(filePath, patterns) {
  return patterns.some((pattern) => toGlobRegExp(pattern).test(filePath));
}

function parseStatusLine(line) {
  const statusCode = line.slice(0, 2);
  const rawPath = line.slice(3).trim();
  const normalizedPath = rawPath.includes(" -> ") ? rawPath.split(" -> ").at(-1) : rawPath;
  return {
    statusCode,
    rawPath,
    path: normalizedPath,
    deleted: statusCode.includes("D"),
    renamed: statusCode.includes("R"),
    untracked: statusCode === "??",
  };
}

async function runGitCommand(args) {
  return runCommand("git", args, { cwd: getRepoRoot() });
}

async function listFilesRecursive(rootDir, currentDir = rootDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFilesRecursive(rootDir, absolutePath));
      continue;
    }

    files.push(path.relative(getRepoRoot(), absolutePath));
  }

  return files.sort();
}

async function hashFile(repoRelativePath) {
  const content = await readFile(path.join(getRepoRoot(), repoRelativePath));
  return createHash("sha1").update(content).digest("hex");
}

async function listFilesIfPresent(rootDir) {
  try {
    return await listFilesRecursive(rootDir);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function captureGeneratedHashes() {
  const generatedRoot = path.join(getRepoRoot(), GENERATED_ROOT);
  const filePaths = await listFilesIfPresent(generatedRoot);
  const hashes = {};

  for (const filePath of filePaths) {
    hashes[filePath] = await hashFile(filePath);
  }

  return hashes;
}

function diffGeneratedHashes(previousHashes = {}, currentHashes = {}) {
  const allFiles = [...new Set([...Object.keys(previousHashes), ...Object.keys(currentHashes)])].sort();
  return allFiles.filter((filePath) => previousHashes[filePath] !== currentHashes[filePath]);
}

async function detectLawDowngrade(changedFiles) {
  const lawFiles = changedFiles.filter((filePath) => filePath.endsWith(".instructions.md"));
  for (const filePath of lawFiles) {
    const content = await readFile(path.join(getRepoRoot(), filePath), "utf8");
    if (LAW_DOWNGRADE_PATTERN.test(content)) {
      return filePath;
    }
  }

  return null;
}

function buildScopeDecision(decision, reason, changedFiles) {
  return { decision, reason, changedFiles };
}

function checkForbiddenPaths(input, currentState) {
  const forbiddenHit = currentState.changedFiles.find((filePath) => matchesAnyPattern(filePath, input.forbiddenModify ?? []));
  return forbiddenHit ? `Changed forbidden path: ${forbiddenHit}` : null;
}

function checkProtectedDeletes(currentState) {
  const deletedProtectedFile = currentState.deletedFiles.find((filePath) => PROTECTED_DELETION_PATTERNS.some((pattern) => pattern.test(filePath)));
  return deletedProtectedFile ? `Protected governance file deleted: ${deletedProtectedFile}` : null;
}

function checkGeneratedDrift(input, currentState) {
  const changedGeneratedFiles = diffGeneratedHashes(input.previousGitState?.generatedHashes, currentState.generatedHashes);
  return changedGeneratedFiles.length > 0 ? `Generated audit files changed before ci:full: ${changedGeneratedFiles.join(", ")}` : null;
}

function checkAllowedModify(input, currentState) {
  const outOfScopeFile = currentState.changedFiles.find((filePath) => !matchesAnyPattern(filePath, input.allowedModify ?? []));
  return outOfScopeFile ? `Changed file is outside allowedModify: ${outOfScopeFile}` : null;
}

async function checkLawDowngrade(currentState) {
  const downgradedLawFile = await detectLawDowngrade(currentState.changedFiles);
  return downgradedLawFile ? `Law downgrade detected in ${downgradedLawFile}` : null;
}

const REPAIR_SCOPE_CHECKS = [
  (input, currentState) => checkForbiddenPaths(input, currentState),
  (_input, currentState) => checkProtectedDeletes(currentState),
  (input, currentState) => checkGeneratedDrift(input, currentState),
  (input, currentState) => checkAllowedModify(input, currentState),
  (_input, currentState) => checkLawDowngrade(currentState),
];

export async function captureGitState(input = {}) {
  const [statusResult, headResult, diffResult, untrackedResult, generatedHashes] = await Promise.all([
    runGitCommand(["status", "--porcelain"]),
    runGitCommand(["rev-parse", "HEAD"]),
    runGitCommand(["diff", "--name-only"]),
    runGitCommand(["ls-files", "--others", "--exclude-standard"]),
    captureGeneratedHashes(),
  ]);

  const statusEntries = splitLines(statusResult.stdout).map((line) => parseStatusLine(line));
  const trackedChangedFiles = [...new Set([
    ...splitLines(diffResult.stdout),
    ...statusEntries.filter((entry) => !entry.untracked).map((entry) => entry.path),
  ])].sort();
  const untrackedFiles = splitLines(untrackedResult.stdout).sort();
  const changedFiles = [...new Set([...trackedChangedFiles, ...untrackedFiles])].sort();
  const gitState = {
    statusLines: splitLines(statusResult.stdout),
    statusEntries,
    head: headResult.stdout.trim(),
    trackedChangedFiles,
    untrackedFiles,
    deletedFiles: statusEntries.filter((entry) => entry.deleted).map((entry) => entry.path),
    renamedFiles: statusEntries.filter((entry) => entry.renamed).map((entry) => entry.path),
    changedFiles,
    generatedHashes,
    suspiciousGeneratedEdit: changedFiles.some((filePath) => filePath.startsWith(`${GENERATED_ROOT}/`)),
  };

  if (input.iterationDir) {
    await writeJsonFile(path.join(input.iterationDir, input.fileName ?? "git-state.json"), gitState);
  }

  return gitState;
}

export async function verifyRepairScope(input) {
  const currentState = await captureGitState();
  for (const runCheck of REPAIR_SCOPE_CHECKS) {
    const rejectionReason = await runCheck(input, currentState);
    if (rejectionReason) {
      return buildScopeDecision("REJECT_REPAIR", rejectionReason, currentState.changedFiles);
    }
  }

  return buildScopeDecision("PASS", "Changed files stay within allowedModify and governance baselines.", currentState.changedFiles);
}
