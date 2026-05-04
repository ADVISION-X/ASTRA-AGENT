import { spawnSync } from "node:child_process";
import { access, readFile, unlink, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { PAGE_STATE_NEGATIVE_PROOF_MUTATIONS, type NegativeProofMutation, type NegativeProofMutationGroup, type ReplaceMutation, type TargetNegativeProofPhase } from "./negative-proof-mutations.js";

const INSPECTOR_ENTRY = "scripts/audit/domains/page-state-capability/inspector.ts";
const RUN_INSPECTOR_ENTRY = "scripts/audit/domains/page-state-capability/run-inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_PAGE_STATE_NEGATIVE_PROOF";

function runInspectorProcess(options: {
  phase?: TargetNegativeProofPhase;
  skipBuild?: boolean;
} = {}): { status: number | null; stdout: string; stderr: string } {
  const skipBuild = options.skipBuild ?? true;
  const result = spawnSync(
    "node",
    ["--import", "tsx", RUN_INSPECTOR_ENTRY, ...(skipBuild ? ["--skip-build"] : [])],
    {
      cwd: pathFromRepoRoot("."),
      encoding: "utf8",
      env: {
        ...process.env,
        [SKIP_NEGATIVE_PROOF_ENV]: "1",
        ...(options.phase ? { GRASSEYE_PAGE_STATE_NEGATIVE_PROOF_PHASE: options.phase } : {}),
      },
    },
  );

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function applyMutationOnce(source: string, mutation: ReplaceMutation): string {
  const matchIndex = source.indexOf(mutation.oldText);
  if (matchIndex === -1) {
    throw new Error(`Mutation ${mutation.name} could not find target text in ${mutation.file}`);
  }

  return `${source.slice(0, matchIndex)}${mutation.newText}${source.slice(matchIndex + mutation.oldText.length)}`;
}

async function doesFileExist(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}

async function applyMutation(mutation: NegativeProofMutation): Promise<() => Promise<void>> {
  const absolutePath = pathFromRepoRoot(mutation.file);

  if (mutation.kind === "replace") {
    const originalContent = await readFile(absolutePath, "utf8");
    const mutatedContent = applyMutationOnce(originalContent, mutation);
    await writeFile(absolutePath, mutatedContent, "utf8");
    return async () => {
      await writeFile(absolutePath, originalContent, "utf8");
    };
  }

  const fileExisted = await doesFileExist(absolutePath);
  if (fileExisted) {
    throw new Error(`Create-file mutation ${mutation.name} expected ${mutation.file} to be absent before mutation.`);
  }

  await writeFile(absolutePath, mutation.content, "utf8");
  return async () => {
    await unlink(absolutePath);
  };
}

function createMutationGroups(): NegativeProofMutationGroup[] {
  const groups = new Map<string, NegativeProofMutationGroup>();
  for (const mutation of PAGE_STATE_NEGATIVE_PROOF_MUTATIONS) {
    const skipBuild = mutation.skipBuild ?? true;
    const key = skipBuild
      ? `${mutation.phase}:skip-build`
      : mutation.name;
    const existing = groups.get(key);
    if (existing) {
      existing.mutations.push(mutation);
      continue;
    }

    groups.set(key, {
      name: key,
      mutations: [mutation],
      phase: mutation.phase,
      skipBuild,
    });
  }

  return [...groups.values()];
}

async function applyMutationGroup(group: NegativeProofMutationGroup): Promise<() => Promise<void>> {
  const rollbacks: Array<() => Promise<void>> = [];
  try {
    for (const mutation of group.mutations) {
      rollbacks.push(await applyMutation(mutation));
    }

    return async () => {
      for (const rollback of rollbacks.reverse()) {
        await rollback();
      }
    };
  } catch (error) {
    for (const rollback of rollbacks.reverse()) {
      await rollback();
    }
    throw error;
  }
}

async function mutateGroupAndVerifyFailure(group: NegativeProofMutationGroup): Promise<string> {
  const rollback = await applyMutationGroup(group);
  try {
    const failRun = runInspectorProcess({ phase: group.phase, skipBuild: group.skipBuild });
    const combinedOutput = `${failRun.stdout}\n${failRun.stderr}`;
    if (failRun.status === 0) {
      throw new Error(`Mutation group ${group.name} did not fail inspector as expected.\n${combinedOutput}`);
    }
    const missingNeedles = group.mutations
      .map((mutation) => mutation.expectedNeedle)
      .filter((needle) => !combinedOutput.includes(needle));
    if (missingNeedles.length > 0) {
      throw new Error(`Mutation group ${group.name} failed, but not for every expected reason. Missing needles: ${missingNeedles.join("; ")}`);
    }
  } finally {
    await rollback();
  }

  return `${group.name}: ${group.mutations.map((mutation) => mutation.name).join(", ")} fail-ok`;
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
        lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-008-V2",
        file: INSPECTOR_ENTRY,
        line: 1,
        severity: "fatal",
        message,
      }),
    ],
    phase: createPhase("negative-proof-harness", "FAKE ENFORCEMENT", false, summary),
  };
}

export async function runNegativeProofHarness(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  try {
    const baseline = runInspectorProcess({ skipBuild: true });
    if (baseline.status !== 0) {
      return createFatalResult(
        "Page State inspector baseline must pass before negative-proof mutation checks.",
        "Page State negative-proof harness cannot start because the baseline inspector is not passing.",
      );
    }

    const reports: string[] = [];
    for (const group of createMutationGroups()) {
      reports.push(await mutateGroupAndVerifyFailure(group));
    }

    const rollbackRun = runInspectorProcess({ skipBuild: false });
    if (rollbackRun.status !== 0) {
      throw new Error(`Negative-proof mutations did not restore inspector PASS after rollback.\n${rollbackRun.stdout}\n${rollbackRun.stderr}`);
    }

    return createPassResult(`Page State negative-proof harness rejects ${reports.join(", ")}.`);
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Page State negative-proof harness failed.",
      "Page State negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}

async function main(): Promise<void> {
  const result = await runNegativeProofHarness();
  process.stdout.write(`[PAGE-STATE-NEGATIVE-PROOF] ${result.phase.summary}\n`);
  if (!result.phase.passed || result.findings.length > 0) {
    for (const finding of result.findings) {
      process.stdout.write(`- ${finding.message}\n`);
    }
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  void main();
}
