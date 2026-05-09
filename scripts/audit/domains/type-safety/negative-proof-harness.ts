import { spawn } from "node:child_process";

import { withNestedNegativeProofEnv } from "../../core/nested-negative-proof.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { applyAuditMutation, readAuditFileState, restoreAuditFileState } from "../_shared/read-audit-file-state.js";

type Mutation = {
  name: string;
  file: string;
  search: string;
  replace: string;
};

const INSPECTOR_RUNNER = "scripts/audit/domains/type-safety/run-inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_TYPE_SAFETY_NEGATIVE_PROOF";

const MUTATIONS: Mutation[] = [
  {
    name: "disable noImplicitAny mutation",
    file: "tsconfig.json",
    search: '"noImplicitAny": true',
    replace: '"noImplicitAny": false',
  },
  {
    name: "explicit any source mutation",
    file: "src/types/visual-action.ts",
    search: "import { z } from \"zod\";",
    replace: "import { z } from \"zod\";\nconst mutatedAnyForNegativeProof: any = null;\nvoid mutatedAnyForNegativeProof;",
  },
];

const runInspector = async (): Promise<boolean> =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", INSPECTOR_RUNNER], {
      cwd: pathFromRepoRoot("."),
      env: withNestedNegativeProofEnv({
        ...process.env,
        [SKIP_NEGATIVE_PROOF_ENV]: "1",
        NODE_DISABLE_COMPILE_CACHE: "1",
        TSX_DISABLE_CACHE: "1",
      }),
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === null) {
        reject(new Error(`Type-safety inspector exited without code: ${stderr}`));
        return;
      }
      resolve(code === 0);
    });
  });

const mutateAndVerify = async (mutation: Mutation): Promise<void> => {
  const filePath = pathFromRepoRoot(mutation.file);
  const state = await readAuditFileState(filePath);
  await applyAuditMutation(filePath, state.original, mutation);
  try {
    if (await runInspector()) {
      throw new Error(`Inspector did not fail for ${mutation.name}`);
    }
  } finally {
    await restoreAuditFileState(filePath, state);
  }
  if (!(await runInspector())) {
    throw new Error(`Rollback verification failed for ${mutation.name}`);
  }
  process.stdout.write(`[NEGATIVE-PROOF] PASS ${mutation.name}\n`);
};

const createPassResult = (summary: string): { findings: Finding[]; phase: InspectorPhase } => ({
  findings: [],
  phase: createPhase("negative-proof-harness", "PASS", true, summary),
});

const createFatalResult = (message: string, summary: string): { findings: Finding[]; phase: InspectorPhase } => ({
  findings: [createFinding({
    lawId: "GRASSEYE-TYPE-SAFETY-001-V1",
    file: INSPECTOR_RUNNER,
    line: 1,
    severity: "fatal",
    message,
  })],
  phase: createPhase("negative-proof-harness", "FAKE ENFORCEMENT", false, summary),
});

export async function runNegativeProofHarness(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  try {
    if (!(await runInspector())) {
      return createFatalResult(
        "Baseline type-safety inspector must pass before negative proof.",
        "Type-safety negative-proof harness cannot start because the baseline inspector is not passing.",
      );
    }
    for (const mutation of MUTATIONS) {
      await mutateAndVerify(mutation);
    }
    return createPassResult("Type-safety negative-proof harness rejects relaxed tsconfig and explicit any mutations.");
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Type-safety negative-proof harness failed.",
      "Type-safety negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}

async function main(): Promise<void> {
  const result = await runNegativeProofHarness();
  if (!result.phase.passed) {
    for (const finding of result.findings) {
      process.stderr.write(`${finding.message}\n`);
    }
    process.exitCode = 1;
  }
}

void main();
