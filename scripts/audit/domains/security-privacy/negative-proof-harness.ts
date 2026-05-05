import { spawn } from "node:child_process";

import { pathFromRepoRoot } from "../../core/paths.js";
import { applyAuditMutation, readAuditFileState, restoreAuditFileState } from "../_shared/read-audit-file-state.js";

type Mutation = {
  name: string;
  file: string;
  search: string;
  replace: string;
};

const INSPECTOR_RUNNER = "scripts/audit/domains/security-privacy/run-inspector.ts";

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
      env: { ...process.env, NODE_DISABLE_COMPILE_CACHE: "1", TSX_DISABLE_CACHE: "1" },
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

async function main(): Promise<void> {
  if (!(await runInspector())) {
    throw new Error("Baseline security-privacy inspector must pass before negative proof.");
  }
  for (const mutation of MUTATIONS) {
    await mutateAndVerify(mutation);
  }
}

void main();
