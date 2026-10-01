import { execFile } from "node:child_process";
import { pathToFileURL } from "node:url";

import { worktreeCandidateFingerprint } from "../governance-git-state.js";
import { GovernanceError, ROOT, fail } from "../governance-runtime.js";

export type QualityCheckIssue = { label: string; status: "FAILED" | "BLOCKED"; message: string };

const integrityCodes = new Set([
  "CANDIDATE_DRIFT", "RELEASE_PARTICIPANT_DRIFT", "SOURCE_PARSE_FAILED",
  "SOURCE_SPEC_AMENDMENT_REQUIRED", "LAW_AMENDMENT_REQUIRED", "UNAUTHORIZED_PRODUCTION_DELETE",
  "USER_REQUEST_CONFLICTS_WITH_ACTIVE_LAW", "TARGET_OUTSIDE_DOMAIN_AUTHORITY",
  "EXTERNAL_SURFACE_AUTHORITY_MISSING", "INSPECTOR_WORKER_INVALID",
]);

export const isQualityIntegrityFailure = (error: unknown): boolean =>
  error instanceof GovernanceError && integrityCodes.has(error.code);

export const collectQualityCheck = async <T>(
  label: string,
  task: () => T | Promise<T>,
  assertCandidate: () => void,
  issues: QualityCheckIssue[],
): Promise<T | undefined> => {
  assertCandidate();
  try {
    const result = await task();
    assertCandidate();
    return result;
  } catch (error) {
    assertCandidate();
    if (isQualityIntegrityFailure(error)) throw error;
    const message = error instanceof Error ? error.message : String(error);
    const code = error instanceof GovernanceError ? error.code : "CHECK_EXECUTION_FAILED";
    issues.push({ label, status: "FAILED", message: `${code}: ${message}` });
    return undefined;
  }
};

export const writeQualityIssues = (issues: readonly QualityCheckIssue[]): void => {
  for (const issue of [...issues].sort((left, right) => left.label.localeCompare(right.label))) {
    process.stderr.write(`[${issue.status}] ${issue.label}: ${issue.message}\n`);
  }
};

export type CapturedExecution = {
  status: number | null;
  signal: NodeJS.Signals | null;
  stderr: string;
  stdout: string;
};

export const assertQualityCommandPassed = (execution: CapturedExecution, label: string): void => {
  if (execution.status === 0 && execution.signal === null) return;
  const code = [...integrityCodes].find((candidate) => execution.stderr.split("\n")
    .some((line) => line.startsWith(`${candidate} `)));
  fail(code ?? "CHECK_EXECUTION_FAILED", label);
};

export const executeCaptured = (
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; timeout?: number },
): Promise<CapturedExecution> => new Promise((resolveExecution) => {
  execFile(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: options.env,
    maxBuffer: 64 * 1024 * 1024,
    ...(options.timeout === undefined ? {} : { timeout: options.timeout }),
  }, (error, stdout, stderr) => resolveExecution({
    status: error === null ? 0 : typeof error.code === "number" ? error.code : null,
    signal: error?.signal ?? null,
    stderr,
    stdout,
  }));
});

export const mapWithConcurrency = async <T, R>(
  values: readonly T[],
  concurrency: number,
  task: (value: T, index: number) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(values.length);
  const errors: { error: unknown; index: number }[] = [];
  let nextIndex = 0;
  let stopped = false;
  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), values.length) }, async () => {
    while (!stopped && nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      try { results[index] = await task(values[index]!, index); }
      catch (error) {
        errors.push({ error, index });
        if (isQualityIntegrityFailure(error)) stopped = true;
      }
    }
  });
  await Promise.all(workers);
  errors.sort((left, right) => left.index - right.index);
  const integrity = errors.find((entry) => isQualityIntegrityFailure(entry.error));
  if (integrity) throw integrity.error;
  if (errors.length) throw errors[0]!.error;
  return results;
};

// Existing package acceptance groups pass their independent files here. This is
// a command collector, not a law/proof producer or a second quality verdict.
export const runAcceptanceFiles = async (files: readonly string[]): Promise<void> => {
  if (!files.length) fail("ENTRY_CONTRACT_MISMATCH", "acceptance files required");
  const candidate = worktreeCandidateFingerprint();
  const assertCandidate = (): void => {
    if (worktreeCandidateFingerprint() !== candidate) fail("CANDIDATE_DRIFT", "acceptance group");
  };
  const issues: QualityCheckIssue[] = [];
  for (const file of files) await collectQualityCheck(file, async () => {
    const execution = file.startsWith("npm:")
      ? await executeCaptured("npm", ["run", file.slice(4)], { cwd: ROOT, env: process.env })
      : await executeCaptured(process.execPath, ["--import", "tsx", file], { cwd: ROOT, env: process.env });
    process.stdout.write(execution.stdout);
    process.stderr.write(execution.stderr);
    assertQualityCommandPassed(execution, file);
  }, assertCandidate, issues);
  assertCandidate();
  writeQualityIssues(issues);
  if (issues.length) fail("CHECK_EXECUTION_FAILED", `${issues.length} acceptance commands failed`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAcceptanceFiles(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof GovernanceError ? error.code : "CHECK_EXECUTION_FAILED"} ${String(error)}\n`);
    process.exitCode = 1;
  });
}
