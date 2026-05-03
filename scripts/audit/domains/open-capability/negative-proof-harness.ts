import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector } from "../../core/runtime.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { applyAuditMutation, readAuditFileState, restoreAuditFileState } from "../_shared/read-audit-file-state.js";

type Mutation = {
  name: string;
  file: string;
  search: string;
  replace: string;
};

const INSPECTOR_ENTRY = "scripts/audit/domains/open-capability/inspector.ts";
const EXPORT_STAR_MUTATION = `export ${"*"} from "./schema.js";`;

const MUTATIONS: Mutation[] = [
  {
    name: "request chain mutation",
    file: "src/capabilities/open/schema-core.ts",
    search: "  stepId: z.string().min(1),",
    replace: "  // mutated stepId removed,",
  },
  {
    name: "result diagnostic mutation",
    file: "src/capabilities/open/schema-proof.ts",
    search: "  diagnosticPayloadRef: nullableString,\n  dataQualityFlags: z.array(OpenDataQualityFlagSchema).default([]),\n  runtimeProof: OpenRuntimeProofSchema,",
    replace: "  // mutated diagnosticPayloadRef removed,\n  dataQualityFlags: z.array(OpenDataQualityFlagSchema).default([]),\n  runtimeProof: OpenRuntimeProofSchema,",
  },
  {
    name: "proof browser-session mutation",
    file: "src/capabilities/open/schema-proof.ts",
    search: "  browserSessionRef: nullableString,",
    replace: "  // mutated browserSessionRef removed,",
  },
  {
    name: "proof chain mutation",
    file: "src/capabilities/open/runtime/open-proof-builder.ts",
    search: "  capabilityCallId: request.capabilityCallId,",
    replace: "  // mutated capabilityCallId removed,",
  },
  {
    name: "dispatch shape-hash mutation",
    file: "src/capabilities/open/runtime/open-dispatch-failure-builders.ts",
    search: '  receivedShapeHash: input.trace.parseDecision === "fallback_trace_only" ? input.trace.receivedShapeHash : null,',
    replace: "  receivedShapeHash: null,",
  },
  {
    name: "success handoff mutation",
    file: "src/capabilities/open/runtime/open-result-builder.ts",
    search: "    pageStateHandoffRef,\n    pageStateHandoffRequired: true,",
    replace: "    pageStateHandoffRequired: true,",
  },
  {
    name: "timeout abort mutation",
    file: "src/capabilities/open/runtime/navigation-runner-support.ts",
    search: "      abortSignal: abortController.signal,",
    replace: "      // mutated abortSignal removed,",
  },
  {
    name: "idempotency fail-open mutation",
    file: "src/capabilities/open/runtime/open-idempotency.ts",
    search: "    return buildDuplicateReviewRequiredReservation(idempotencyKey);",
    replace: "    return buildReservedReservation(idempotencyKey);",
  },
  {
    name: "dispatch fake allow mutation",
    file: "src/capabilities/open/runtime/open-dispatch-failure-builders.ts",
    search: "const buildOpenDispatchFailureTargetPolicyDecision = (input: OpenDispatchFailureInput) => ({\n  status: \"block\" as const,",
    replace: "const buildOpenDispatchFailureTargetPolicyDecision = (input: OpenDispatchFailureInput) => ({\n  status: \"allow\" as const,",
  },
  {
    name: "export star mutation",
    file: "src/capabilities/open/index.ts",
    search: 'export type { OpenBrowserPort } from "./ports/open-browser-port.js";',
    replace: `export type { OpenBrowserPort } from "./ports/open-browser-port.js";\n${EXPORT_STAR_MUTATION}`,
  },
  {
    name: "forbidden import mutation",
    file: "src/capabilities/open/runtime/open-executor.ts",
    search: 'import { executeOpenChildFlow } from "./open-executor-flow.js";',
    replace: 'import { executeOpenChildFlow } from "./open-executor-flow.js";\nimport type { ScreenshotAbilityGroup } from "../../screenshot/contract.js";',
  },
  {
    name: "external private-leak mutation",
    file: "src/lib/local-runtime/workbench-open-runtime.ts",
    search: 'import { createOpenAbilityGroup } from "../../capabilities/open/index.js";',
    replace: 'import { createOpenAbilityGroup } from "../../capabilities/open/index.js";\nimport { executeOpenChild } from "../../capabilities/open/runtime/open-executor.js";\nvoid executeOpenChild;',
  },
];

async function runInspector(): Promise<{ passed: boolean; violationCount: number }> {
  await buildAuditArtifacts();
  const artifacts = await loadGeneratedArtifacts();
  const context = await createInspectorContext(artifacts);
  const inspector = await loadInspector(INSPECTOR_ENTRY);
  const result = await inspector(context);
  return { passed: result.passed, violationCount: result.violationCount };
}

async function mutateAndVerify(mutation: Mutation): Promise<void> {
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

async function main(): Promise<void> {
  const baseline = await runInspector();
  if (!baseline.passed) {
    throw new Error("Baseline open-capability inspector must pass before negative proof.");
  }

  for (const mutation of MUTATIONS) {
    await mutateAndVerify(mutation);
    process.stdout.write(`[NEGATIVE-PROOF] PASS ${mutation.name}\n`);
  }
}

void main();