import { readFile, writeFile } from "node:fs/promises";

import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector } from "../../core/runtime.js";

type Mutation = {
  name: string;
  file: string;
  search: string;
  replace: string;
};

const INSPECTOR_ENTRY = "scripts/audit/domains/map-plugin-package/inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_MAP_PLUGIN_NEGATIVE_PROOF";

const MUTATIONS: Mutation[] = [
  {
    name: "builtin executable handler mutation",
    file: "src/map-plugins/builtins/tiktok-product-discovery.map-package.json",
    search: '  "signature": null\n',
    replace: '  "handler": "evil.js",\n  "signature": null\n',
  },
  {
    name: "orchestration platform fallback mutation",
    file: "src/capabilities/orchestration/runtime/map-selection-gate.ts",
    search: '| "task_template_id"\n',
    replace: '| "platform_policy"\n',
  },
  {
    name: "ai draft activation mutation",
    file: "src/map-plugins/builtins/ai-draft-map-placeholder.map-package.json",
    search: '    "approvalStatus": "draft",\n',
    replace: '    "approvalStatus": "approved",\n',
  },
];

async function runInspector(): Promise<{ passed: boolean; violationCount: number }> {
  const previous = process.env[SKIP_NEGATIVE_PROOF_ENV];
  process.env[SKIP_NEGATIVE_PROOF_ENV] = "1";

  try {
    await buildAuditArtifacts();
    const artifacts = await loadGeneratedArtifacts();
    const context = await createInspectorContext(artifacts);
    const inspector = await loadInspector(INSPECTOR_ENTRY);
    const result = await inspector(context);
    return { passed: result.passed, violationCount: result.violationCount };
  } finally {
    if (previous === undefined) {
      delete process.env[SKIP_NEGATIVE_PROOF_ENV];
    } else {
      process.env[SKIP_NEGATIVE_PROOF_ENV] = previous;
    }
  }
}

async function mutateAndVerify(mutation: Mutation): Promise<void> {
  const filePath = pathFromRepoRoot(mutation.file);
  const original = await readFile(filePath, "utf8");

  if (!original.includes(mutation.search)) {
    throw new Error(`Mutation seed not found for ${mutation.name} in ${mutation.file}`);
  }

  await writeFile(filePath, original.replace(mutation.search, mutation.replace), "utf8");

  try {
    const mutated = await runInspector();
    if (mutated.passed || mutated.violationCount === 0) {
      throw new Error(`Inspector did not fail for ${mutation.name}`);
    }
  } finally {
    await writeFile(filePath, original, "utf8");
  }

  const restored = await runInspector();
  if (!restored.passed) {
    throw new Error(`Rollback verification failed for ${mutation.name}`);
  }
}

export async function runNegativeProofHarness(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  try {
    const baseline = await runInspector();
    if (!baseline.passed) {
      return {
        findings: [
          createFinding({
            lawId: "GRASSEYE-MAP-PLUGIN-007-V1",
            file: INSPECTOR_ENTRY,
            line: 1,
            severity: "fatal",
            message: "Map package inspector baseline must pass before negative-proof mutations can run.",
          }),
        ],
        phase: createPhase(
          "negative-proof-harness",
          "FAKE ENFORCEMENT",
          false,
          "Map package negative-proof harness cannot start because the baseline inspector is not passing.",
        ),
      };
    }

    for (const mutation of MUTATIONS) {
      await mutateAndVerify(mutation);
    }

    return {
      findings: [],
      phase: createPhase(
        "negative-proof-harness",
        "PASS",
        true,
        "Map package negative-proof harness rejects executable payload, hardcoded fallback, and AI draft activation mutations.",
      ),
    };
  } catch (error) {
    return {
      findings: [
        createFinding({
          lawId: "GRASSEYE-MAP-PLUGIN-007-V1",
          file: INSPECTOR_ENTRY,
          line: 1,
          severity: "fatal",
          message: error instanceof Error ? error.message : "Map package negative-proof harness failed.",
        }),
      ],
      phase: createPhase(
        "negative-proof-harness",
        "FAKE ENFORCEMENT",
        false,
        "Map package negative-proof harness failed to prove mutation rejection and rollback recovery.",
      ),
    };
  }
}
