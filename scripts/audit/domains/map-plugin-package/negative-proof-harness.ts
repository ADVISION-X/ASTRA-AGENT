import { spawn, type ChildProcessByStdio } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Readable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";

import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { applyAuditMutation, readAuditFileState, restoreAuditFileState, type AuditFileState } from "../_shared/read-audit-file-state.js";
import { MAP_PLUGIN_LAWS } from "./constants.js";
import { MAP_PLUGIN_NEGATIVE_PROOF_MUTATIONS as MUTATIONS, type Mutation } from "./negative-proof-mutations.js";

const INSPECTOR_ENTRY = "scripts/audit/domains/map-plugin-package/inspector.ts";
const INSPECTOR_RUNNER = "scripts/audit/domains/map-plugin-package/run-inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_MAP_PLUGIN_NEGATIVE_PROOF";

type InspectorRunResult = {
  passed: boolean;
  violationCount: number;
  stdout: string;
  stderr: string;
  exitCode: number;
};

type HeartbeatStage = "baseline" | "mutate" | "expect-fail" | "rollback" | "verify-rollback" | "pass" | "fail";
const ROLLBACK_VERIFY_RETRIES = 3;
const ROLLBACK_VERIFY_RETRY_DELAY_MS = 300;
const RANGE_START_ENV = "GRASSEYE_MAP_PLUGIN_NEGATIVE_PROOF_START";
const RANGE_END_ENV = "GRASSEYE_MAP_PLUGIN_NEGATIVE_PROOF_END";
let activeMutationState: { filePath: string; originalHash: string; state: AuditFileState; mutationName: string } | null = null;
let activeInspectorChild: ChildProcessByStdio<null, Readable, Readable> | null = null;

const restoreActiveMutationBeforeExit = async (signal: NodeJS.Signals) => {
  if (activeInspectorChild && !activeInspectorChild.killed) {
    activeInspectorChild.kill("SIGTERM");
    activeInspectorChild = null;
  }
  if (activeMutationState) {
    const stateToRestore = activeMutationState;
    activeMutationState = null;
    emitNegativeProofHeartbeat({ stage: "rollback", mutationName: stateToRestore.mutationName, detail: `received ${signal}` });
    await restoreAuditFileState(stateToRestore.filePath, stateToRestore.state);
    const restoredHash = await hashFile(stateToRestore.filePath);
    if (restoredHash !== stateToRestore.originalHash) {
      emitNegativeProofHeartbeat({
        stage: "fail",
        mutationName: stateToRestore.mutationName,
        detail: `signal rollback hash mismatch before=${stateToRestore.originalHash} after=${restoredHash}`,
      });
      process.exit(1);
    }
    emitNegativeProofHeartbeat({ stage: "verify-rollback", mutationName: stateToRestore.mutationName, detail: `received ${signal}` });
  }
  process.exit(signal === "SIGINT" ? 130 : 143);
};

process.once("SIGINT", () => {
  void restoreActiveMutationBeforeExit("SIGINT");
});

process.once("SIGTERM", () => {
  void restoreActiveMutationBeforeExit("SIGTERM");
});

const emitNegativeProofHeartbeat = (input: {
  stage: HeartbeatStage;
  mutationName?: string;
  index?: number;
  total?: number;
  durationMs?: number;
  detail?: string;
}) => {
  const progress = input.index && input.total ? ` ${input.index}/${input.total}` : "";
  const mutation = input.mutationName ? ` mutation="${input.mutationName}"` : "";
  const duration = input.durationMs === undefined ? "" : ` durationMs=${Math.round(input.durationMs)}`;
  const detail = input.detail ? ` detail="${input.detail.replaceAll("\"", "'")}"` : "";
  process.stdout.write(`[map-plugin-negative-proof][${input.stage}]${progress}${mutation}${duration}${detail}\n`);
};

const summarizeInspectorFailure = (result: InspectorRunResult): string => {
  const stdout = result.stdout.trim();
  const stderr = result.stderr.trim();
  return [
    `exitCode=${result.exitCode}`,
    stdout.length > 0 ? `stdout=${stdout}` : null,
    stderr.length > 0 ? `stderr=${stderr}` : null,
  ]
    .filter((segment): segment is string => segment !== null)
    .join(" | ");
};

async function runInspector(): Promise<InspectorRunResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", INSPECTOR_RUNNER],
      {
        cwd: pathFromRepoRoot("."),
        env: {
          ...process.env,
          [SKIP_NEGATIVE_PROOF_ENV]: "1",
          NODE_DISABLE_COMPILE_CACHE: "1",
          TSX_DISABLE_CACHE: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    activeInspectorChild = child;

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (activeInspectorChild === child) {
        activeInspectorChild = null;
      }
      if (code === null) {
        reject(new Error(`Inspector process exited without code. stderr: ${stderr}`));
        return;
      }

      const violationCount = stdout
        .split("\n")
        .filter((line) => line.startsWith("- "))
        .length + (code !== 0 && stdout.length === 0 ? 1 : 0);

      resolve({
        passed: code === 0,
        violationCount,
        stdout,
        stderr,
        exitCode: code,
      });
    });
  });
}

const hashFile = async (filePath: string): Promise<string> =>
  createHash("sha256").update(await readFile(filePath)).digest("hex");

const resolveMutationRange = (): Mutation[] => {
  const start = Number(process.env[RANGE_START_ENV] ?? "1");
  const end = Number(process.env[RANGE_END_ENV] ?? String(MUTATIONS.length));
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > MUTATIONS.length) {
    throw new Error(`Invalid map-plugin negative proof range: start=${process.env[RANGE_START_ENV] ?? ""} end=${process.env[RANGE_END_ENV] ?? ""}`);
  }
  return MUTATIONS.slice(start - 1, end);
};

async function mutateAndVerify(mutation: Mutation): Promise<void> {
  const mutationIndex = MUTATIONS.indexOf(mutation) + 1;
  const mutationStartedAt = Date.now();
  emitNegativeProofHeartbeat({ stage: "mutate", mutationName: mutation.name, index: mutationIndex, total: MUTATIONS.length });
  const filePath = pathFromRepoRoot(mutation.file);
  const state = await readAuditFileState(filePath);
  const originalHash = await hashFile(filePath);
  activeMutationState = { filePath, originalHash, state, mutationName: mutation.name };
  await applyAuditMutation(filePath, state.original, mutation);

  try {
    emitNegativeProofHeartbeat({ stage: "expect-fail", mutationName: mutation.name, index: mutationIndex, total: MUTATIONS.length });
    const mutated = await runInspector();
    if (mutated.passed) {
      throw new Error(`Inspector did not fail for ${mutation.name}: ${summarizeInspectorFailure(mutated)}`);
    }
  } finally {
    emitNegativeProofHeartbeat({ stage: "rollback", mutationName: mutation.name, index: mutationIndex, total: MUTATIONS.length });
    await restoreAuditFileState(filePath, state);
    activeMutationState = null;
  }

  const restoredHash = await hashFile(filePath);
  if (restoredHash !== originalHash) {
    throw new Error(`Rollback hash verification failed for ${mutation.name}: before=${originalHash} after=${restoredHash}`);
  }
  await delay(50);
  emitNegativeProofHeartbeat({ stage: "verify-rollback", mutationName: mutation.name, index: mutationIndex, total: MUTATIONS.length });
  let restored = await runInspector();
  for (let attempt = 1; !restored.passed && attempt < ROLLBACK_VERIFY_RETRIES; attempt += 1) {
    emitNegativeProofHeartbeat({ stage: "verify-rollback", mutationName: mutation.name, index: mutationIndex, total: MUTATIONS.length, detail: `retry ${attempt}` });
    await delay(ROLLBACK_VERIFY_RETRY_DELAY_MS);
    restored = await runInspector();
  }
  if (!restored.passed) {
    throw new Error(`Rollback verification failed for ${mutation.name}: ${summarizeInspectorFailure(restored)}`);
  }
  emitNegativeProofHeartbeat({ stage: "pass", mutationName: mutation.name, index: mutationIndex, total: MUTATIONS.length, durationMs: Date.now() - mutationStartedAt });
}

function createPassResult(summary: string): { findings: Finding[]; phase: InspectorPhase } {
  return {
    findings: [],
    phase: createPhase("negative-proof-harness", "PASS", true, summary),
  };
}

function createFatalResult(message: string, summary: string): { findings: Finding[]; phase: InspectorPhase } {
  return {
    findings: [
      createFinding({
        lawId: MAP_PLUGIN_LAWS.ENFORCEMENT,
        file: INSPECTOR_ENTRY,
        line: 1,
        severity: "fatal",
        message,
      }),
    ],
    phase: createPhase("negative-proof-harness", "FAKE ENFORCEMENT", false, summary),
  };
}

async function runMutations(): Promise<void> {
  for (const mutation of resolveMutationRange()) {
    await mutateAndVerify(mutation);
  }
}

export async function runNegativeProofHarness(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  try {
    const startedAt = Date.now();
    emitNegativeProofHeartbeat({ stage: "baseline", total: MUTATIONS.length });
    const baseline = await runInspector();
    if (!baseline.passed) {
      emitNegativeProofHeartbeat({ stage: "fail", durationMs: Date.now() - startedAt, detail: "baseline inspector failed" });
      return createFatalResult(
        `Map package inspector baseline must pass before negative-proof mutations can run: ${summarizeInspectorFailure(baseline)}`,
        "Map package negative-proof harness cannot start because the baseline inspector is not passing.",
      );
    }

    await runMutations();

    emitNegativeProofHeartbeat({ stage: "pass", total: MUTATIONS.length, durationMs: Date.now() - startedAt, detail: "all mutations rejected and rolled back" });
    return createPassResult("Map package negative-proof harness rejects law-strength regressions, child-ability reintroduction, raw prompt/code payloads, prompt binding drift, lifecycle proof gaps, AI draft spoofing, catalog misuse, ordinary-feed leaks, Commander registry bypass, and negative-proof bypass mutations.");
  } catch (error) {
    emitNegativeProofHeartbeat({ stage: "fail", detail: error instanceof Error ? error.message : "unknown error" });
    return createFatalResult(
      error instanceof Error ? error.message : "Map package negative-proof harness failed.",
      "Map package negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}
