import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { writeJsonFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { applyAuditMutation, readAuditFileState, restoreAuditFileState } from "../_shared/read-audit-file-state.js";
import { AUDIT_COVERAGE_ANTI_FRAUD_MUTATIONS, type AntiFraudMutation } from "./anti-fraud-mutations.js";

type CoverageSummary = {
  finalVerdict: "PASS" | "BLOCKED";
  totalRequirements?: number;
  sourceLawHash?: string;
  sourceBlueprintHash?: string;
};

type MutationResult = {
  name: string;
  expected: "FAIL";
  actual: "FAIL" | "PASS";
  rollback: "PASS" | "FAIL";
  rollbackHashVerified: boolean;
};

const SUMMARY_PATH = "scripts/audit/generated/audit-coverage-summary.generated.json";

const hashFile = async (filePath: string): Promise<string> =>
  createHash("sha256").update(await readFile(filePath)).digest("hex");

const readSummary = async (): Promise<CoverageSummary> =>
  JSON.parse(await readFile(pathFromRepoRoot(SUMMARY_PATH), "utf8")) as CoverageSummary;

const runCommand = (args: readonly string[]) => spawnSync(args[0] ?? "npm", args.slice(1), {
  cwd: pathFromRepoRoot("."),
  encoding: "utf8",
  shell: process.platform === "win32",
});

const runCoverageBaseline = (): boolean => runCommand(["npm", "run", "audit:coverage"]).status === 0;

const detectedExpectedFailure = async (
  mutation: AntiFraudMutation,
  baseline: CoverageSummary,
  commandStatus: number | null,
): Promise<boolean> => {
  if (mutation.detection === "command-fails") {
    return commandStatus !== 0;
  }
  const summary = await readSummary();
  if (mutation.detection === "summary-law-hash-changes") {
    return summary.sourceLawHash !== baseline.sourceLawHash;
  }
  if (mutation.detection === "summary-blueprint-hash-changes") {
    return summary.sourceBlueprintHash !== baseline.sourceBlueprintHash;
  }
  if (mutation.detection === "generated-tamper-rejected") {
    return commandStatus === 0 && summary.totalRequirements === baseline.totalRequirements;
  }
  return commandStatus !== 0 || summary.finalVerdict === "BLOCKED";
};

const runMutation = async (mutation: AntiFraudMutation, baseline: CoverageSummary): Promise<MutationResult> => {
  const filePath = pathFromRepoRoot(mutation.file);
  const state = await readAuditFileState(filePath);
  const beforeHash = await hashFile(filePath);
  await applyAuditMutation(filePath, state.original, mutation);

  let actual: MutationResult["actual"] = "PASS";
  try {
    const command = runCommand(mutation.command);
    actual = await detectedExpectedFailure(mutation, baseline, command.status) ? "FAIL" : "PASS";
  } finally {
    await restoreAuditFileState(filePath, state);
  }

  const rollbackHashVerified = await hashFile(filePath) === beforeHash;
  const rollback = rollbackHashVerified && runCoverageBaseline() ? "PASS" : "FAIL";
  return { name: mutation.name, expected: "FAIL", actual, rollback, rollbackHashVerified };
};

export const runAuditCoverageAntiFraudHarness = async () => {
  if (!runCoverageBaseline()) {
    throw new Error("audit:coverage baseline must pass before anti-fraud mutations.");
  }
  const baseline = await readSummary();
  const mutations: MutationResult[] = [];
  for (const mutation of AUDIT_COVERAGE_ANTI_FRAUD_MUTATIONS) {
    mutations.push(await runMutation(mutation, baseline));
  }

  const artifact = {
    generatedAt: new Date().toISOString(),
    totalMutations: mutations.length,
    passedMutations: mutations.filter((mutation) => mutation.actual === "FAIL" && mutation.rollback === "PASS" && mutation.rollbackHashVerified).length,
    failedMutations: mutations.filter((mutation) => mutation.actual !== "FAIL" || mutation.rollback !== "PASS" || !mutation.rollbackHashVerified).length,
    mutations,
  };
  await writeJsonFile(pathFromRepoRoot("scripts/audit/generated/audit-coverage-anti-fraud.generated.json"), artifact);
  const summary = await readSummary();
  await writeJsonFile(pathFromRepoRoot(SUMMARY_PATH), { ...summary, antiFraudVerified: artifact.failedMutations === 0 });
  return artifact;
};
