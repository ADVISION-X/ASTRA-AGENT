import { existsSync } from "node:fs";

import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { RuntimeLogSpineLaw, type RuntimeLogSpineFinding } from "./constants.js";
import { readRepoFile } from "./source-read.js";

const requiredDebugBundleTokens = [
  "runtime-log.jsonl",
  "mission-summary.json",
  "index.json",
  "round-summary.json",
  "stage-timeline.json",
  "recovery-trail.json",
  "redactRuntimeLog",
] as const;

const appendMissingDebugBundleFiles = (findings: RuntimeLogSpineFinding[]): void => {
  for (const repoPath of ["src/lib/runtime-logs/debug-bundle.ts", "src/lib/runtime-logs/debug-bundle-index.ts"]) {
    if (existsSync(resolveFromRepo(repoPath))) continue;
    findings.push({
      checkId: "runtime-log-spine/debug-bundle-file",
      lawId: RuntimeLogSpineLaw.DEBUG_BUNDLE,
      file: repoPath,
      line: 1,
      severity: "fatal",
      message: "debug bundle replay infrastructure is missing or incomplete",
      hint: "Implement debug bundle writer/index and acceptance proving failed rounds can be reconstructed.",
    });
  }
};

const appendMissingDebugBundleTokens = (findings: RuntimeLogSpineFinding[], combined: string): void => {
  for (const token of requiredDebugBundleTokens) {
    if (combined.includes(token)) continue;
    findings.push({
      checkId: "runtime-log-spine/debug-bundle-contract",
      lawId: RuntimeLogSpineLaw.DEBUG_BUNDLE,
      file: "src/lib/runtime-logs/debug-bundle.ts",
      line: 1,
      severity: "fatal",
      message: "debug bundle replay infrastructure is missing or incomplete",
      hint: `Debug bundle must write ${token} or prove equivalent replayable structure.`,
    });
  }
};

const appendMissingDebugBundleAcceptance = (findings: RuntimeLogSpineFinding[]): void => {
  if (existsSync(resolveFromRepo("scripts/acceptance/runtime-log-debug-bundle.acceptance.ts"))) return;
  findings.push({
    checkId: "runtime-log-spine/debug-bundle-acceptance",
    lawId: RuntimeLogSpineLaw.DEBUG_BUNDLE,
    file: "scripts/acceptance/runtime-log-debug-bundle.acceptance.ts",
    line: 1,
    severity: "fatal",
    message: "debug bundle replay acceptance is missing",
    hint: "Add acceptance proving bundle creation, runtime-log.jsonl, index.json, round lookup, and redaction.",
  });
};

export const collectDebugBundleFindings = (_context: InspectorContext): {
  findings: RuntimeLogSpineFinding[];
  inspectedFiles: string[];
} => {
  const findings: RuntimeLogSpineFinding[] = [];
  const inspectedFiles = [
    "src/lib/runtime-logs/debug-bundle.ts",
    "src/lib/runtime-logs/debug-bundle-index.ts",
    "scripts/acceptance/runtime-log-debug-bundle.acceptance.ts",
  ];
  const debugBundle = readRepoFile("src/lib/runtime-logs/debug-bundle.ts");
  const debugBundleIndex = readRepoFile("src/lib/runtime-logs/debug-bundle-index.ts");
  appendMissingDebugBundleFiles(findings);
  const combined = `${debugBundle?.text ?? ""}\n${debugBundleIndex?.text ?? ""}`;
  appendMissingDebugBundleTokens(findings, combined);
  appendMissingDebugBundleAcceptance(findings);
  return { findings, inspectedFiles };
};
