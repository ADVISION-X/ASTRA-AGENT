import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector } from "../../core/runtime.js";
import { applyAuditMutation, readAuditFileState, restoreAuditFileState } from "../_shared/read-audit-file-state.js";
import { LAW_IDS } from "./config.js";

type Mutation = {
  name: string;
  file: string;
  mode?: "replace" | "write";
  search?: string;
  replace?: string;
  content?: string;
};

const INSPECTOR_ENTRY = "scripts/audit/domains/screenshot-capability/inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_SCREENSHOT_NEGATIVE_PROOF";

const MUTATIONS: Mutation[] = [
  {
    name: "historical screenshot drawer resurrection mutation",
    file: "src/app/platform-action-screenshot-drawer-active-owner.ts",
    mode: "write",
    content: "export const screenshotDrawerOwner = true;\n",
  },
  {
    name: "local-ai screenshot artifact helper mutation",
    file: "src/lib/local-ai/resize-screenshot-artifact-helper.ts",
    mode: "write",
    content: "export const resizeScreenshotArtifactScaleMapping = () => \"ai_input\";\n",
  },
  {
    name: "browser capture outside adapter mutation",
    file: "src/lib/local-runtime/direct-screenshot-region-capture.ts",
    mode: "write",
    content: "import type { BrowserController } from \"../browser/browser-controller.js\";\n\nexport async function captureOutsideScreenshotAdapter(browserController: BrowserController) {\n  return browserController.screenshotRegion({ regionLabel: \"probe\" });\n}\n",
  },
  {
    name: "export-star escape mutation",
    file: "src/capabilities/screenshot/index.ts",
    search: "export {\n  listScreenshotChildren,\n} from \"./registry.js\";",
    replace: "export {\n  listScreenshotChildren,\n} from \"./registry.js\";\nexport * from \"./adapters/index.js\";",
  },
  {
    name: "public workbench entry mutation",
    file: "src/capabilities/screenshot/index.ts",
    search: "export {\n  listScreenshotChildren,\n} from \"./registry.js\";",
    replace: "export {\n  listScreenshotChildren,\n} from \"./registry.js\";\nexport { createWorkbenchScreenshotAbilityGroup } from \"./workbench-screenshot-ability-group.js\";",
  },
  {
    name: "contract child-interface leak mutation",
    file: "src/capabilities/screenshot/contract.ts",
    search: "interface ScreenshotAbilityGroup {",
    replace: "export interface ScreenshotChildCapability { execute(input: ScreenshotAbilityInput): Promise<ScreenshotAbilityResult>; }\n\ninterface ScreenshotAbilityGroup {",
  },
  {
    name: "payload-gate bypass mutation",
    file: "src/capabilities/screenshot/runtime/screenshot-executor.ts",
    search: "payloadBudgetGate: runScreenshotPayloadBudgetGate({",
    replace: "payloadBudgetGate: runScreenshotInputGate({",
  },
  {
    name: "private-runtime import mutation",
    file: "src/lib/local-runtime/workbench-screenshot-ability-group.ts",
    search: "from \"../../capabilities/screenshot/workbench-screenshot-ability-group.js\";",
    replace: "from \"../../capabilities/screenshot/runtime/workbench-screenshot-ability-group.js\";",
  },
  {
    name: "local-runtime screenshot chain mapping regression mutation",
    file: "src/lib/local-runtime/workbench-screenshot-dispatch-input.ts",
    search: "    capabilityCallId: envelope.capabilityCallId,\n",
    replace: "    capabilityCallId: envelope.missionId,\n",
  },
  {
    name: "nullable chain field regression mutation",
    file: "src/capabilities/screenshot/shared/screenshot-governance.ts",
    search: "  capabilityCallId: limitedString(200),",
    replace: "  capabilityCallId: nullableLimitedString(200),",
  },
  {
    name: "non-success output escape mutation",
    file: "src/capabilities/screenshot/schema.ts",
    search: "non-success result must not expose output",
    replace: "non-success result may expose output",
  },
  {
    name: "region crop flattening mutation",
    file: "src/capabilities/screenshot/registry.ts",
    search: "    outputImageKind: \"region_crop\",\n    coordinateSpacePolicy: \"region_crop_pixels\",",
    replace: "    outputImageKind: \"evidence_original\",\n    coordinateSpacePolicy: \"source_image_pixels\",",
  },
  {
    name: "timeout truth bypass mutation",
    file: "src/capabilities/screenshot/runtime/screenshot-execution-phase-helpers.ts",
    search: "timeoutMs: resolveScreenshotTimeoutMs(input.request, input.registryEntry.maxDurationMs)",
    replace: "timeoutMs: input.registryEntry.maxDurationMs",
  },
  {
    name: "result chain parity escape mutation",
    file: "src/capabilities/screenshot/runtime/screenshot-result-builder.ts",
    search: "dataQualityFlags: input.runtimeProof.dataQualityFlags,",
    replace: "dataQualityFlags: [],",
  },
  {
    name: "artifact lifecycle self-promotion mutation",
    file: "src/capabilities/screenshot/runtime/screenshot-artifact-lifecycle.ts",
    search: "    promotionStatus: \"not_promoted\",\n",
    replace: "    promotionStatus: \"promoted\",\n",
  },
  {
    name: "artifact lifecycle manifest removal mutation",
    file: "src/capabilities/screenshot/runtime/screenshot-result-builder.ts",
    search: "    artifactLifecycleManifestRef: input.artifactLifecycleManifestRef,\n",
    replace: "",
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
        lawId: LAW_IDS.NEGATIVE_PROOF,
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

    return createPassResult("Screenshot negative-proof harness rejects historical screenshot-drawer resurrection, local-ai screenshot artifact helper ownership, browser capture outside adapters, export-star, public workbench entry, contract leak, payload-gate bypass, private-runtime import, local-runtime screenshot chain mapping regression, nullable chain regression, non-success output escape, region-crop flattening, timeout truth bypass, result chain parity escape, lifecycle self-promotion, and lifecycle manifest removal mutations.");
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Screenshot negative-proof harness failed.",
      "Screenshot negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}