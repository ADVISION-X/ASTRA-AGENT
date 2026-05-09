import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

import { withNestedNegativeProofEnv } from "../../core/nested-negative-proof.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { pathFromRepoRoot } from "../../core/paths.js";

import {
  TEXT_INPUT_NEGATIVE_PROOF_MUTATIONS,
  type NegativeProofMutation,
  type NegativeProofMutationGroup,
  type TargetNegativeProofPhase,
} from "./negative-proof-mutations.js";

import { LAW_IDS } from "./config.js";

const INSPECTOR_ENTRY = "scripts/audit/domains/text-input-capability/inspector.ts";
const RUN_INSPECTOR_ENTRY = "scripts/audit/domains/text-input-capability/run-inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_TEXT_INPUT_NEGATIVE_PROOF";

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
        lawId: LAW_IDS.PACKAGE,
        file: INSPECTOR_ENTRY,
        line: 1,
        severity: "fatal",
        message,
      }),
    ],
    phase: createPhase("negative-proof-harness", "FAKE ENFORCEMENT", false, summary),
  };
}

function runInspectorProcess(input: {
  phase?: TargetNegativeProofPhase;
  skipBuild?: boolean;
} = {}): { status: number | null; stdout: string; stderr: string } {
  const skipBuild = input.skipBuild ?? true;
  const result = spawnSync(
    "node",
    ["--import", "tsx", RUN_INSPECTOR_ENTRY, ...(skipBuild ? ["--skip-build"] : [])],
    {
      cwd: pathFromRepoRoot("."),
      encoding: "utf8",
      env: withNestedNegativeProofEnv({
        ...process.env,
        [SKIP_NEGATIVE_PROOF_ENV]: "1",
        ...(input.phase ? { GRASSEYE_TEXT_INPUT_NEGATIVE_PROOF_PHASE: input.phase } : {}),
      }),
    },
  );

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function formatProcessOutput(result: { status: number | null; stdout: string; stderr: string }): string {
  return [
    `status: ${result.status ?? "signal"}`,
    result.stdout.trim(),
    result.stderr.trim(),
  ].filter((part) => part.length > 0).join("\n");
}

function applyMutationOnce(source: string, mutation: NegativeProofMutation): string {
  const matchIndex = source.indexOf(mutation.oldText);
  if (matchIndex === -1) {
    throw new Error(`Mutation ${mutation.name} could not find target text in ${mutation.file}`);
  }

  return `${source.slice(0, matchIndex)}${mutation.newText}${source.slice(matchIndex + mutation.oldText.length)}`;
}

async function applyMutation(mutation: NegativeProofMutation): Promise<() => Promise<void>> {
  const absolutePath = pathFromRepoRoot(mutation.file);
  const originalContent = await readFile(absolutePath, "utf8");
  const mutatedContent = applyMutationOnce(originalContent, mutation);
  await writeFile(absolutePath, mutatedContent, "utf8");

  return async () => {
    await writeFile(absolutePath, originalContent, "utf8");
  };
}

function createMutationGroups(): NegativeProofMutationGroup[] {
  const groups = new Map<string, NegativeProofMutationGroup>();
  for (const mutation of TEXT_INPUT_NEGATIVE_PROOF_MUTATIONS) {
    const skipBuild = mutation.skipBuild ?? true;
    const key = skipBuild
      ? `${mutation.phase}:skip-build`
      : mutation.name;
    const group = groups.get(key);
    if (group) {
      group.mutations.push(mutation);
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
    const failureRun = runInspectorProcess({ phase: group.phase, skipBuild: group.skipBuild });
    const failOutput = formatProcessOutput(failureRun);
    if (failureRun.status === 0) {
      throw new Error(`Text Input inspector did not fail for mutation group ${group.name}.\n${failOutput}`);
    }

    const missingNeedles = group.mutations
      .map((mutation) => mutation.expectedNeedle)
      .filter((needle) => !failOutput.includes(needle));
    if (missingNeedles.length > 0) {
      throw new Error(`Mutation group ${group.name} failed, but not for every expected reason. Missing needles: ${missingNeedles.join("; ")}`);
    }
  } finally {
    await rollback();
  }

  return `${group.name}: ${group.mutations.map((mutation) => mutation.name).join(", ")} fail-ok`;
}

export async function runNegativeProofHarness(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  try {
    const baseline = runInspectorProcess({ skipBuild: false });
    if (baseline.status !== 0) {
      return createFatalResult(
        "Text Input inspector baseline must pass before negative-proof mutation checks.",
        "Text Input negative-proof harness cannot start because the baseline inspector is not passing.",
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

    return createPassResult(`Text Input negative-proof harness rejects ${reports.join(", ")}.`);
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Text Input negative-proof harness failed.",
      "Text Input negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}
