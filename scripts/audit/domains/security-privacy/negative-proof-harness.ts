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

const INSPECTOR_RUNNER = "scripts/audit/domains/security-privacy/run-inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_SECURITY_PRIVACY_NEGATIVE_PROOF";

const MUTATIONS: Mutation[] = [
  {
    name: "public host binding mutation",
    file: "src/app/server.ts",
    search: 'process.env.GRASSEYE_HOST ?? "127.0.0.1"',
    replace: 'process.env.GRASSEYE_HOST ?? "0.0.0.0"',
  },
  {
    name: "sensitive evidence export mutation",
    file: "src/lib/storage/evidence-store/evidence-store-service-context.ts",
    search: "export {\n  createEvidenceStoreInternals,",
    replace: 'export const access_token = "mutated-secret-export";\n\nexport {\n  createEvidenceStoreInternals,',
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
        reject(new Error(`Security privacy inspector exited without code: ${stderr}`));
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
    lawId: "GRASSEYE-SECURITY-PRIVACY-001-V1",
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
        "Baseline security-privacy inspector must pass before negative proof.",
        "Security privacy negative-proof harness cannot start because the baseline inspector is not passing.",
      );
    }
    for (const mutation of MUTATIONS) {
      await mutateAndVerify(mutation);
    }
    return createPassResult("Security privacy negative-proof harness rejects public host binding and sensitive evidence export mutations.");
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Security privacy negative-proof harness failed.",
      "Security privacy negative-proof harness failed to prove mutation rejection and rollback recovery.",
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
