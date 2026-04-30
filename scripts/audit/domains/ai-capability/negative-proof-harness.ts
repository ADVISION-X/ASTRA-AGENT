import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector } from "../../core/runtime.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { applyAuditMutation, readAuditFileState, restoreAuditFileState } from "../_shared/read-audit-file-state.js";

type Mutation = {
  name: string;
  file: string;
  mode?: "replace" | "write";
  search?: string;
  replace?: string;
  content?: string;
};

const INSPECTOR_ENTRY = "scripts/audit/domains/ai-capability/inspector.ts";
const EXPORT_STAR_MUTATION = `export ${"*"} from "./schema.js";`;
const AS_ANY_MUTATION = `const mutatedEscape = runtimeResult as ${"any"};`;
const DYNAMIC_IMPORT_MUTATION = `void ${"import"}("./schema.js");`;
const REQUIRE_MUTATION = `const mutatedRequire = ${"require"}("./schema.js");`;
const AS_UNKNOWN_AS_MUTATION = `const escapedInput = input as ${"unknown"} as { status: string };`;

const MUTATIONS: Mutation[] = [
  {
    name: "input gate mutation",
    file: "src/capabilities/ai/runtime/ai-pre-runtime.ts",
    search: "parseAiExecutorInput(request, childCapabilityId)",
    replace: '({ ok: true, request })',
  },
  {
    name: "provider gate mutation",
    file: "src/capabilities/ai/runtime/ai-pre-runtime.ts",
    search: "evaluateAiProviderPolicy(input.request, input.childContract)",
    replace: '({ decision: "allow", reason: null })',
  },
  {
    name: "schema gate mutation",
    file: "src/capabilities/ai/runtime/ai-pre-runtime.ts",
    search: "resolveAiSchemaContract(input.request, input.promptContract)",
    replace: '({ decision: "resolved", reason: null, schemaId: "mutated", outputSchema: null })',
  },
  {
    name: "quality gate mutation",
    file: "src/capabilities/ai/runtime/ai-runtime-result.ts",
    search: "evaluateAiQualityGate({",
    replace: "evaluateAiQualityGateRemoved({",
  },
  {
    name: "proof builder mutation",
    file: "src/capabilities/ai/runtime/ai-result-builder.ts",
    search: "buildAiRuntimeProof({",
    replace: "buildAiRuntimeProofRemoved({",
  },
  {
    name: "payload budget mutation",
    file: "src/capabilities/ai/runtime/ai-pre-runtime.ts",
    search: "evaluateAiPayloadBudgetGate(input.request)",
    replace: '({ decision: "allow", reason: null, flags: [] })',
  },
  {
    name: "runtime health gate mutation",
    file: "src/capabilities/ai/runtime/ai-pre-runtime.ts",
    search: "evaluateAiRuntimeHealthGate({",
    replace: "evaluateAiRuntimeHealthGateRemoved({",
  },
  {
    name: "runtime runner mutation",
    file: "src/capabilities/ai/runtime/ai-executor.ts",
    search: "runAiRuntimeCall({",
    replace: "runAiRuntimeCallRemoved({",
  },
  {
    name: "output boundary mutation",
    file: "src/capabilities/ai/runtime/ai-runtime-result.ts",
    search: "const boundaryDecision = evaluateAiOutputBoundary(runtimeResult.output);",
    replace: 'const boundaryDecision = { decision: "allow", reason: null, flags: [] };',
  },
  {
    name: "invalid-success mutation",
    file: "src/capabilities/ai/runtime/ai-runtime-result.ts",
    search: 'status: input.qualityDecision.decision === "review_required" ? "review_required" : "failed"',
    replace: 'status: "success"',
  },
  {
    name: "child-schema-shell mutation",
    file: "src/capabilities/ai/children/local-text-ai/schema.ts",
    search: 'export const LocalTextAiChildInputSchema = LocalTextAiInputSchema.describe("local-text-ai child input");',
    replace: 'export { LocalTextAiInputSchema as LocalTextAiChildInputSchema } from "../../schema.js";',
  },
  {
    name: "forbidden action output mutation",
    file: "src/capabilities/ai/runtime/ai-output-boundary-gate.ts",
    search: 'const FORBIDDEN_OUTPUT_KEYS = new Set<string>([',
    replace: 'const FORBIDDEN_OUTPUT_KEYS_REMOVED = new Set<string>([',
  },
  {
    name: "dispatch record assertion mutation",
    file: "src/capabilities/ai/runtime/ai-dispatch-failure.ts",
    search: "const rawInputRef = buildStableAiRef(\"ai-raw-input\", [trace.missionId, trace.sessionId, taskType, input.failureReason]);",
    replace: "const unsafeRawInput = input.rawInput as Record<string, unknown>;\n  const rawInputRef = buildStableAiRef(\"ai-raw-input\", [trace.missionId, trace.sessionId, taskType, input.failureReason, String(unsafeRawInput.sessionId)]);",
  },
  {
    name: "paid gateway mutation",
    file: "src/capabilities/ai/children/paid-analysis-ai/implementation.ts",
    search: 'import { PaidAnalysisAiChildContract as contract } from "./contract.js";',
    replace: 'import { PaidAnalysisAiChildContract as contract } from "./contract.js";\nimport { LocalAiGateway } from "../../../lib/local-ai/local-ai-gateway.js";',
  },
  {
    name: "paid execute mutation",
    file: "src/capabilities/ai/children/paid-analysis-ai/implementation.ts",
    search: "implementation: {\n      async checkReadiness()",
    replace: 'implementation: {\n      async execute() {\n        return Promise.reject(new Error("mutated disabled execute"));\n      },\n      async checkReadiness()',
  },
  {
    name: "future execute mutation",
    file: "src/capabilities/ai/children/future-api-ai/implementation.ts",
    search: "implementation: {\n      async checkReadiness()",
    replace: 'implementation: {\n      async execute() {\n        return Promise.reject(new Error("mutated future execute"));\n      },\n      async checkReadiness()',
  },
  {
    name: "internal gateway mutation",
    file: "src/capabilities/ai/children/internal-schema-validator/implementation.ts",
    search: 'import { executeAiChild } from "../../runtime/ai-executor.js";',
    replace: 'import { executeAiChild } from "../../runtime/ai-executor.js";\nimport { LocalAiGateway } from "../../../lib/local-ai/local-ai-gateway.js";',
  },
  {
    name: "export star mutation",
    file: "src/capabilities/ai/index.ts",
    search: 'export { listAiChildren } from "./registry.js";',
    replace: `export { listAiChildren } from "./registry.js";\n${EXPORT_STAR_MUTATION}`,
  },
  {
    name: "forbidden import mutation",
    file: "src/capabilities/ai/runtime/ai-pre-runtime.ts",
    search: 'import { resolveAiSchemaContract, validateAiInternalCandidate } from "./ai-schema-gate.js";',
    replace: 'import { resolveAiSchemaContract, validateAiInternalCandidate } from "./ai-schema-gate.js";\nimport type { MouseClickAbilityGroup } from "../../mouse-click/contract.js";',
  },
  {
    name: "as-any mutation",
    file: "src/capabilities/ai/runtime/ai-executor.ts",
    search: "const runtimeResult = await runAiRuntimeCall({",
    replace: `${AS_ANY_MUTATION}\n  const runtimeResult = await runAiRuntimeCall({`,
  },
  {
    name: "as-unknown-as mutation",
    file: "src/capabilities/ai/runtime/ai-result-builder.ts",
    search: "const outputRef = input.status === \"success\" && input.output !== null",
    replace: `${AS_UNKNOWN_AS_MUTATION}\n  const outputRef = input.status === "success" && input.output !== null`,
  },
  {
    name: "dynamic import mutation",
    file: "src/capabilities/ai/index.ts",
    search: 'export { listAiChildren } from "./registry.js";',
    replace: `export { listAiChildren } from "./registry.js";\n${DYNAMIC_IMPORT_MUTATION}`,
  },
  {
    name: "require mutation",
    file: "src/capabilities/ai/index.ts",
    search: 'export { listAiChildren } from "./registry.js";',
    replace: `export { listAiChildren } from "./registry.js";\n${REQUIRE_MUTATION}`,
  },
  {
    name: "ability-group adapter import mutation",
    file: "src/capabilities/ai/ability-group.ts",
    search: 'import { routeAiTaskToChild } from "./task-router.js";',
    replace: 'import { routeAiTaskToChild } from "./task-router.js";\nimport { createLocalAiRuntimePort } from "./runtime-adapters/local-ai-runtime-adapter.js";',
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
    throw new Error("Baseline ai-capability inspector must pass before negative proof.");
  }

  for (const mutation of MUTATIONS) {
    await mutateAndVerify(mutation);
    process.stdout.write(`[NEGATIVE-PROOF] PASS ${mutation.name}\n`);
  }
}

void main();
