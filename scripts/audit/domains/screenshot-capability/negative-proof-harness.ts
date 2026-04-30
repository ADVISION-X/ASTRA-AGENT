import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector } from "../../core/runtime.js";
import { applyAuditMutation, readAuditFileState, restoreAuditFileState } from "../_shared/read-audit-file-state.js";

type Mutation = {
  name: string;
  file: string;
  search: string;
  replace: string;
};

const INSPECTOR_ENTRY = "scripts/audit/domains/screenshot-capability/inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_SCREENSHOT_NEGATIVE_PROOF";

const MUTATIONS: Mutation[] = [
  {
    name: "export-star escape mutation",
    file: "src/capabilities/screenshot/index.ts",
    search: "export {\n  listScreenshotChildren,\n} from \"./registry.js\";",
    replace: "export {\n  listScreenshotChildren,\n} from \"./registry.js\";\nexport * from \"./adapters/index.js\";",
  },
  {
    name: "contract child-interface leak mutation",
    file: "src/capabilities/screenshot/contract.ts",
    search: "export interface ScreenshotAbilityGroup {",
    replace: "export interface ScreenshotChildCapability { execute(input: ScreenshotAbilityInput): Promise<ScreenshotAbilityResult>; }\n\nexport interface ScreenshotAbilityGroup {",
  },
  {
    name: "payload-gate bypass mutation",
    file: "src/capabilities/screenshot/runtime/screenshot-executor.ts",
    search: "const payloadBudgetGate = runScreenshotPayloadBudgetGate({",
    replace: "const payloadBudgetGate = runScreenshotInputGate({",
  },
  {
    name: "private-runtime import mutation",
    file: "src/lib/local-runtime/workbench.ts",
    search: "} from \"../../capabilities/screenshot/adapters/index.js\";",
    replace: "} from \"../../capabilities/screenshot/runtime/screenshot-runtime-context.js\";",
  },
  {
    name: "non-success output escape mutation",
    file: "src/capabilities/screenshot/schema.ts",
    search: "non-success result must not expose output",
    replace: "non-success result may expose output",
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
  const state = await readAuditFileState(filePath);
  await applyAuditMutation(filePath, state.original, mutation);

  try {
    const mutated = await runInspector();
    if (mutated.passed || mutated.violationCount === 0) {
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
        lawId: "GRASSEYE-SCREENSHOT-CAPABILITY-004-V1",
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
        "Screenshot inspector baseline must pass before negative-proof mutation checks.",
        "Screenshot negative-proof harness cannot start because the baseline inspector is not passing.",
      );
    }

    await runMutations();

    return createPassResult("Screenshot negative-proof harness rejects export-star, contract leak, payload-gate bypass, private-runtime import, and non-success output escape mutations.");
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Screenshot negative-proof harness failed.",
      "Screenshot negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}