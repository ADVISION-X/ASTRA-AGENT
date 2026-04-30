import { pathFromRepoRoot } from "../../core/paths.js";
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

export type NegativeProofMutation = {
  name: string;
  file: string;
  oldText: string;
  newText: string;
};

export const PAGE_STATE_NEGATIVE_PROOF_MUTATIONS: NegativeProofMutation[] = [
  {
    name: "ability-group-creates-clock",
    file: "src/capabilities/page-state/ability-group.ts",
    oldText: "export function createPageStateAbilityGroup(context: PageStateRuntimeContext): PageStateAbilityGroup {",
    newText: "export function createPageStateAbilityGroup(context: PageStateRuntimeContext): PageStateAbilityGroup {\n  createSystemPageStateClock();",
  },
  {
    name: "contract-exposes-child-interface",
    file: "src/capabilities/page-state/contract.ts",
    oldText: "export interface PageStateAbilityGroup {",
    newText: "export interface PageStateChildCapability { execute(input: PageStateAbilityInput): Promise<PageStateAbilityResult>; }\n\nexport interface PageStateAbilityGroup {",
  },
  {
    name: "platform-kind-uses-includes-localhost",
    file: "src/capabilities/page-state/children/detect-platform-page-kind/implementation.ts",
    oldText: "const output = request.statePolicy.allowLocalWorkbench && isLocalWorkbenchUrl(request.snapshot.currentUrl)",
    newText: "const output = request.snapshot.currentUrl.includes(\"localhost\") || request.snapshot.currentUrl.includes(\"127.0.0.1\")",
  },
  {
    name: "failed-result-non-null-output",
    file: "src/capabilities/page-state/schema.ts",
    oldText: "message: \"failed or review_required result must null output\"",
    newText: "message: \"failed or review_required result may retain output\"",
  },
];

export function getNegativeProofMutationPaths(): string[] {
  return PAGE_STATE_NEGATIVE_PROOF_MUTATIONS.map((mutation) => pathFromRepoRoot(mutation.file));
}

function applyMutationOnce(source: string, mutation: NegativeProofMutation): string {
  const matchIndex = source.indexOf(mutation.oldText);
  if (matchIndex === -1) {
    throw new Error(`Mutation ${mutation.name} could not find target text in ${mutation.file}`);
  }

  return `${source.slice(0, matchIndex)}${mutation.newText}${source.slice(matchIndex + mutation.oldText.length)}`;
}

function runInspectorProcess(): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(
    "npx",
    ["tsx", "scripts/audit/domains/page-state-capability/run-inspector.ts"],
    {
      cwd: pathFromRepoRoot("."),
      encoding: "utf8",
    },
  );

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

async function runNegativeProofHarness(): Promise<void> {
  const reports: string[] = [];

  for (const mutation of PAGE_STATE_NEGATIVE_PROOF_MUTATIONS) {
    const absolutePath = pathFromRepoRoot(mutation.file);
    const originalContent = await readFile(absolutePath, "utf8");

    try {
      const mutatedContent = applyMutationOnce(originalContent, mutation);
      await writeFile(absolutePath, mutatedContent, "utf8");

      const failRun = runInspectorProcess();
      if (failRun.status === 0) {
        throw new Error(`Mutation ${mutation.name} did not fail inspector as expected.\n${failRun.stdout}\n${failRun.stderr}`);
      }

      await writeFile(absolutePath, originalContent, "utf8");
      const rollbackRun = runInspectorProcess();
      if (rollbackRun.status !== 0) {
        throw new Error(`Mutation ${mutation.name} did not restore inspector PASS after rollback.\n${rollbackRun.stdout}\n${rollbackRun.stderr}`);
      }

      reports.push(`${mutation.name}: fail-ok rollback-ok`);
    } finally {
      await writeFile(absolutePath, originalContent, "utf8");
    }
  }

  process.stdout.write(`[PAGE-STATE-NEGATIVE-PROOF]\n${reports.join("\n")}\n`);
}

void runNegativeProofHarness();