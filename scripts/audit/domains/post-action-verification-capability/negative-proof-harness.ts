import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

import { pathFromRepoRoot } from "../../core/paths.js";

export type NegativeProofMutation = {
  name: string;
  file: string;
  oldText: string;
  newText: string;
};

export const POST_ACTION_NEGATIVE_PROOF_MUTATIONS: NegativeProofMutation[] = [
  {
    name: "ability-group-creates-clock",
    file: "src/capabilities/post-action-verification/ability-group.ts",
    oldText: "export function createPostActionVerificationAbilityGroup(input: CreatePostActionVerificationAbilityGroupInput): PostActionVerificationAbilityGroup {",
    newText: "export function createPostActionVerificationAbilityGroup(input: CreatePostActionVerificationAbilityGroupInput): PostActionVerificationAbilityGroup {\n  createSystemPostActionVerificationClock();",
  },
  {
    name: "contract-exposes-child-interface",
    file: "src/capabilities/post-action-verification/contract.ts",
    oldText: "export interface PostActionVerificationAbilityGroup {",
    newText: "export interface PostActionVerificationChildCapability { execute(input: PostActionVerificationAbilityInput): Promise<PostActionVerificationAbilityResult>; }\n\nexport interface PostActionVerificationAbilityGroup {",
  },
  {
    name: "schema-allows-non-success-output",
    file: "src/capabilities/post-action-verification/schema.ts",
    oldText: "failed/review_required result must not expose output",
    newText: "failed/review_required result may retain output",
  },
  {
    name: "external-imports-runtime-path",
    file: "src/lib/local-runtime/workbench.ts",
    oldText: "import { createPostActionVerificationAbilityGroup, type PostActionVerificationAbilityGroup } from \"../../capabilities/post-action-verification/index.js\";",
    newText: "import { createPostActionVerificationAbilityGroup, type PostActionVerificationAbilityGroup } from \"../../capabilities/post-action-verification/index.js\";\nimport type { PostActionVerificationRuntimeContext } from \"../../capabilities/post-action-verification/runtime/post-action-verification-runtime-context.js\";",
  },
];

export function getNegativeProofMutationPaths(): string[] {
  return POST_ACTION_NEGATIVE_PROOF_MUTATIONS.map((mutation) => pathFromRepoRoot(mutation.file));
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
    ["tsx", "scripts/audit/domains/post-action-verification-capability/run-inspector.ts"],
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

  for (const mutation of POST_ACTION_NEGATIVE_PROOF_MUTATIONS) {
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

  process.stdout.write(`[POST-ACTION-NEGATIVE-PROOF]\n${reports.join("\n")}\n`);
}

void runNegativeProofHarness();