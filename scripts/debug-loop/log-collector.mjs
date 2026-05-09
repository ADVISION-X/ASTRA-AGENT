import { access, copyFile } from "node:fs/promises";
import path from "node:path";

import { ensureDirectory, writeJsonFile, writeTextFile } from "./json-utils.mjs";
import { getRepoRoot } from "./path-policy.mjs";

const REQUIRED_LOG_ARTIFACTS = [
  "stdout.log",
  "stderr.log",
  "runtime.jsonl",
  "audit-build.stdout.log",
  "audit-build.stderr.log",
  "ci-full.stdout.log",
  "ci-full.stderr.log",
  "runtime-recheck.stdout.log",
  "runtime-recheck.stderr.log",
];

const GENERATED_AUDIT_ARTIFACTS = [
  "ci-full-summary.generated.json",
  "law-registry.generated.json",
  "enforcement-matrix.generated.json",
  "audit-plan.generated.json",
];

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

async function ensureTextArtifact(filePath, missingLogSources, sourceName) {
  if (await fileExists(filePath)) {
    return filePath;
  }

  await writeTextFile(filePath, "");
  missingLogSources.push(sourceName);
  return filePath;
}

async function copyGeneratedArtifact(iterationDir, artifactName, missingLogSources) {
  const sourcePath = path.join(getRepoRoot(), "scripts", "audit", "generated", artifactName);
  const targetPath = path.join(iterationDir, artifactName);
  if (await fileExists(sourcePath)) {
    await ensureDirectory(path.dirname(targetPath));
    await copyFile(sourcePath, targetPath);
    return targetPath;
  }

  await writeTextFile(targetPath, "");
  missingLogSources.push(artifactName);
  return targetPath;
}

function serializeRuntimeEvents(runtimeEvents) {
  if (!Array.isArray(runtimeEvents) || runtimeEvents.length === 0) {
    return "";
  }

  return `${runtimeEvents.map((entry) => JSON.stringify(entry)).join("\n")}\n`;
}

export async function collectLogs(input) {
  const iterationDir = input.iterationDir;
  const missingLogSources = [];

  await ensureDirectory(iterationDir);
  await writeJsonFile(path.join(iterationDir, "scenario.json"), input.scenario ?? {});
  await writeJsonFile(path.join(iterationDir, "command.json"), input.command ?? {});

  if (Array.isArray(input.runtimeEvents)) {
    await writeTextFile(path.join(iterationDir, "runtime.jsonl"), serializeRuntimeEvents(input.runtimeEvents));
  }

  await Promise.all(REQUIRED_LOG_ARTIFACTS.map((artifactName) => ensureTextArtifact(path.join(iterationDir, artifactName), missingLogSources, artifactName)));
  await Promise.all(GENERATED_AUDIT_ARTIFACTS.map((artifactName) => copyGeneratedArtifact(iterationDir, artifactName, missingLogSources)));

  return {
    iterationDir,
    missingLogSources,
    collectedArtifacts: [...REQUIRED_LOG_ARTIFACTS, ...GENERATED_AUDIT_ARTIFACTS, "scenario.json", "command.json"],
  };
}
