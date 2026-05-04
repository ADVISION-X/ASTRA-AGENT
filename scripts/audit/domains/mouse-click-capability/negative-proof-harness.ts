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

type InspectorRunResult = { passed: boolean; violationCount: number };
type InspectorRunner = () => Promise<InspectorRunResult>;

const INSPECTOR_ENTRY = "scripts/audit/domains/mouse-click-capability/inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_MOUSE_CLICK_NEGATIVE_PROOF";

const MUTATIONS: Mutation[] = [
  {
    name: "manual-first-enforcement mutation",
    file: ".github/instructions/cursor-rules/modules/module-mouse-click-capability.instructions.md",
    search: "status: active\ntier: P0\ncapabilityDomain: mouse-click-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
    replace: "status: active\ntier: P0\ncapabilityDomain: mouse-click-capability\nenforcementMode: manual-first\nevidenceMode: law+inspector+negative-proof",
  },
  {
    name: "warning-only-p0 mutation",
    file: ".github/instructions/cursor-rules/modules/module-mouse-click-capability.instructions.md",
    search: "status: active\ntier: P0\ncapabilityDomain: mouse-click-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
    replace: "status: active\ntier: P1\ncapabilityDomain: mouse-click-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
  },
  {
    name: "browser-controller-public-contract mutation",
    file: "src/capabilities/mouse-click/contract.ts",
    search: "import type { z } from \"zod\";",
    replace: "import type { z } from \"zod\";\nimport type { BrowserController } from \"../../lib/browser/browser-controller.js\";",
  },
  {
    name: "platform-adapter-direct-click mutation",
    file: "src/lib/local-runtime/workbench-mouse-click-runtime.ts",
    search: "  mouseClickAbilityGroup: createWorkbenchMouseClickAbilityGroup({",
    replace: "  platformClickStrategy: runtime.browserController.click({ x: 0, y: 0, button: \"left\", clickCount: 1 }),\n  mouseClickAbilityGroup: createWorkbenchMouseClickAbilityGroup({",
  },
  {
    name: "mouse-click-final-action-log mutation",
    file: "src/capabilities/mouse-click/runtime/mouse-click-result-builder.ts",
    search: "    postActionVerificationHandoffRef: verification.postActionVerificationHandoffRef,",
    replace: "    postActionVerificationHandoffRef: verification.postActionVerificationHandoffRef,\n    actionLogRef: input.seed.attemptRef,",
  },
  {
    name: "platform-business-verb-child mutation",
    file: "src/capabilities/mouse-click/registry.ts",
    search: "  createClickDesktopCoordinateCapability(),",
    replace: "  createClickDesktopCoordinateCapability(),\n  \"open_comments\" as never,",
  },
  {
    name: "export-star escape mutation",
    file: "src/capabilities/mouse-click/index.ts",
    search: 'export { listMouseClickChildren } from "./registry.js";',
    replace: 'export { listMouseClickChildren } from "./registry.js";\nexport * from "./schema.js";',
  },
  {
    name: "policy gate bypass mutation",
    file: "src/capabilities/mouse-click/runtime/mouse-click-preflight-stages.ts",
    search: "const policyGate = validateClickPolicy({ request: input.request, nowIsoTimestamp: input.context.clock.now().isoTimestamp });",
    replace: "const policyDecision = validateClickPolicy({ request: input.request, nowIsoTimestamp: input.context.clock.now().isoTimestamp });",
  },
  {
    name: "proof drop mutation",
    file: "src/capabilities/mouse-click/runtime/mouse-click-result-builder.ts",
    search: "const runtimeProof = buildMouseClickRuntimeProof(buildRuntimeProofInput(input, outputRef, diagnosticPayloadRef, verification));",
    replace: "const proofRemoved = buildMouseClickRuntimeProof(buildRuntimeProofInput(input, outputRef, diagnosticPayloadRef, verification));",
  },
  {
    name: "input capabilityCallId removal mutation",
    file: "src/capabilities/mouse-click/schema.ts",
    search: "  activationSnapshotRef: z.string().min(1),\n  capabilityCallId: z.string().min(1),\n  nerveBusEnvelopeId: z.string().min(1),\n  requestedBy: z.string().min(1),",
    replace: "  activationSnapshotRef: z.string().min(1),\n  nerveBusEnvelopeId: z.string().min(1),\n  requestedBy: z.string().min(1),",
  },
  {
    name: "proof fabricated runId mutation",
    file: "src/capabilities/mouse-click/runtime/mouse-click-proof-builder.ts",
    search: "    runId: input.runId,\n",
    replace: "    runId: buildStableMouseClickRef(\"mouse-click-run\", [input.attemptRef, input.childCapabilityId]),\n",
  },
  {
    name: "success without PAV handoff mutation",
    file: "src/capabilities/mouse-click/runtime/mouse-click-result-builder.ts",
    search: "    postActionVerificationHandoffRef: verification.postActionVerificationHandoffRef,\n    dataQualityFlags: input.dataQualityFlags,\n    runtimeProof,",
    replace: "    postActionVerificationHandoffRef: null,\n    dataQualityFlags: input.dataQualityFlags,\n    runtimeProof,",
  },
  {
    name: "timeout race removal mutation",
    file: "src/capabilities/mouse-click/runtime/primitive-click-runner.ts",
    search: "return Promise.race([",
    replace: "return Promise.all([",
  },
  {
    name: "computed click escape mutation",
    file: "src/capabilities/mouse-click/runtime/primitive-click-runner.ts",
    search: "input.context.primitivePort.click({",
    replace: 'input.context.primitivePort["click"]({',
  },
  {
    name: "abort signal removal mutation",
    file: "src/capabilities/mouse-click/runtime/primitive-click-runner.ts",
    search: "      abortSignal: abortController.signal,\n",
    replace: "",
  },
  {
    name: "workbench composition drift mutation",
    file: "src/lib/local-runtime/workbench-mouse-click-runtime.ts",
    search: "mouseClickAbilityGroup: createWorkbenchMouseClickAbilityGroup({",
    replace: "mouseClickAbilityGroup: createMouseClickAbilityGroupWithPrimitivePort({",
  },
];

async function createInspectorRunner(): Promise<InspectorRunner> {
  await buildAuditArtifacts();
  const artifacts = await loadGeneratedArtifacts();
  const context = await createInspectorContext(artifacts);
  const inspector = await loadInspector(INSPECTOR_ENTRY);

  return async () => {
    const previous = process.env[SKIP_NEGATIVE_PROOF_ENV];
    process.env[SKIP_NEGATIVE_PROOF_ENV] = "1";

    try {
      const result = await inspector(context);
      return { passed: result.passed, violationCount: result.violationCount };
    } finally {
      if (previous === undefined) {
        delete process.env[SKIP_NEGATIVE_PROOF_ENV];
      } else {
        process.env[SKIP_NEGATIVE_PROOF_ENV] = previous;
      }
    }
  };
}

async function mutateAndVerify(runInspector: InspectorRunner, mutation: Mutation): Promise<void> {
  const filePath = pathFromRepoRoot(mutation.file);
  const state = await readAuditFileState(filePath);
  await applyAuditMutation(filePath, state.original, mutation);

  try {
    const result = await runInspector();
    if (result.passed || result.violationCount === 0) {
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
        lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-007-V2",
        file: INSPECTOR_ENTRY,
        line: 1,
        severity: "fatal",
        message,
      }),
    ],
    phase: createPhase("negative-proof-harness", "FAKE ENFORCEMENT", false, summary),
  };
}

async function runMutations(runInspector: InspectorRunner): Promise<void> {
  for (const mutation of MUTATIONS) {
    await mutateAndVerify(runInspector, mutation);
  }
}

export async function runNegativeProofHarness(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  try {
    const runInspector = await createInspectorRunner();
    const baseline = await runInspector();
    if (!baseline.passed) {
      return createFatalResult(
        "Mouse Click inspector baseline must pass before negative-proof mutation checks.",
        "Mouse Click negative-proof harness cannot start because the baseline inspector is not passing.",
      );
    }

    await runMutations(runInspector);

    return createPassResult("Mouse Click negative-proof harness rejects baseline drift, BrowserController public-contract leak, platform direct click ownership, final action-log leakage, platform business-verb child drift, gate bypass, proof drop, timeout escape, computed click, and composition drift mutations.");
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Mouse Click negative-proof harness failed.",
      "Mouse Click negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}
