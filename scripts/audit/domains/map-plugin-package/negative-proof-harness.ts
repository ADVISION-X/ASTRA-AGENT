import { spawn } from "node:child_process";

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

const INSPECTOR_ENTRY = "scripts/audit/domains/map-plugin-package/inspector.ts";
const INSPECTOR_RUNNER = "scripts/audit/domains/map-plugin-package/run-inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_MAP_PLUGIN_NEGATIVE_PROOF";

const MUTATIONS: Mutation[] = [
  {
    name: "builtin executable handler mutation",
    file: "src/map-plugins/builtins/tiktok-product-discovery.map-package.json",
    search: '  "signature": null\n',
    replace: '  "handler": "evil.js",\n  "signature": null\n',
  },
  {
    name: "legacy branch dsl mutation",
    file: "src/map-plugins/builtins/tiktok-product-discovery.map-package.json",
    search: '{ "conditionType": "comparison", "leftRef": "decision", "operator": "equals", "rightValue": "product_yes" }',
    replace: '{ "source": "decision", "equals": "product_yes" }',
  },
  {
    name: "missing post-action verification mutation",
    file: "src/map-plugins/builtins/tiktok-comment-evidence.map-package.json",
    search: ', "postActionVerification": { "required": true, "verificationKind": "panel-open", "expectedSignal": "comment-panel-visible", "timeoutMs": 5000, "onPassTransitionId": "verify-comments-open:success", "onFailTransitionId": "verify-comments-open:failed", "onAmbiguousTransitionId": "verify-comments-open:review" }',
    replace: '',
  },
  {
    name: "activation snapshot proof mutation",
    file: "src/map-plugins/import/map-package-activation.ts",
    search: '  return {\n    activationId: input.activationId,\n    activationSnapshotRef,\n    activationSnapshotHash,\n',
    replace: '  return {\n    activationId: input.activationId,\n    activationSnapshotHash,\n',
  },
  {
    name: "generated capability catalog drift mutation",
    file: "src/map-plugins/authoring/capability-catalog/capability-catalog.generated.json",
    search: '  "version": "2026-04-map-prompt-contract-v1",\n',
    replace: '  "version": "2026-04-map-prompt-contract-v1-tampered",\n',
  },
  {
    name: "ai draft activation mutation",
    file: "src/map-plugins/builtins/ai-draft-map-placeholder.map-package.json",
    search: '    "approvalStatus": "draft",\n',
    replace: '    "approvalStatus": "approved",\n',
  },
];

async function runInspector(): Promise<{ passed: boolean; violationCount: number }> {
  return await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", INSPECTOR_RUNNER],
      {
        cwd: pathFromRepoRoot("."),
        env: {
          ...process.env,
          [SKIP_NEGATIVE_PROOF_ENV]: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

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
      });
    });
  });
}

async function mutateAndVerify(mutation: Mutation): Promise<void> {
  const filePath = pathFromRepoRoot(mutation.file);
  const state = await readAuditFileState(filePath);
  await applyAuditMutation(filePath, state.original, mutation);

  try {
    const mutated = await runInspector();
    if (mutated.passed) {
      throw new Error(`Inspector did not fail for ${mutation.name}`);
    }
  } finally {
    await restoreAuditFileState(filePath, state);
  }

  const restored = await runInspector();
  if (!restored.passed) {
    throw new Error(`Rollback verification failed for ${mutation.name}`);
  }
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
        lawId: "GRASSEYE-MAP-PLUGIN-007-V1",
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
  for (const mutation of MUTATIONS) {
    await mutateAndVerify(mutation);
  }
}

export async function runNegativeProofHarness(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  try {
    const baseline = await runInspector();
    if (!baseline.passed) {
      return createFatalResult(
        "Map package inspector baseline must pass before negative-proof mutations can run.",
        "Map package negative-proof harness cannot start because the baseline inspector is not passing.",
      );
    }

    await runMutations();

    return createPassResult("Map package negative-proof harness rejects executable payload, legacy branch DSL, missing action verification policy, activation snapshot drift, generated catalog drift, and AI draft activation mutations.");
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Map package negative-proof harness failed.",
      "Map package negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}
