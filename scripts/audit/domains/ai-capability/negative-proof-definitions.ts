export type Mutation = {
  name: string;
  file: string;
  mode?: "replace" | "write";
  search?: string;
  replace?: string;
  content?: string;
};
export const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_AI_NEGATIVE_PROOF";
const EXPORT_STAR_MUTATION = `export ${"*"} from "./schema.js";`;
const AS_ANY_MUTATION = `const mutatedEscape = runtimeResult as ${"any"};`;
const DYNAMIC_IMPORT_MUTATION = `void ${"import"}("./schema.js");`;
const REQUIRE_MUTATION = `const mutatedRequire = ${"require"}("./schema.js");`;
const AS_UNKNOWN_AS_MUTATION = `const escapedInput = input as ${"unknown"} as { status: string };`;

export const MUTATIONS: Mutation[] = [
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
    name: "runtime signal mutation",
    file: "src/capabilities/ai/runtime/ai-runtime-call-runner.ts",
    search: "input.context.runtime.execute(input.request, { signal })",
    replace: "input.context.runtime.execute(input.request)",
  },
  {
    name: "debug event wiring mutation",
    file: "src/capabilities/ai/runtime-factory.ts",
    search: "    emitDebugEvent: input.emitDebugEvent,\n",
    replace: "",
  },
  { name: "ai request debug pre-parse mutation", file: "src/capabilities/ai/ability-group.ts", search: "  await emitAiExecutionInputDebug(executionContext, inputValue);\n", replace: "" },
  {
    name: "debug emitter required mutation",
    file: "src/capabilities/ai/ability-group.ts",
    search: "  if (!executionContext.emitDebugEvent) {\n    return dispatchAiDebugEmitterMissing(executionContext, inputValue);\n  }\n",
    replace: "",
  },
  {
    name: "workbench ai terminal relay mutation",
    file: "src/lib/local-runtime/workbench-ai-debug-recorder.ts",
    search: "  runtime.structuredLogBus?.emitRuntimeEvent(structuredRuntimeEvent);\n",
    replace: "",
  },
  {
    name: "workbench ai signal bridge mutation",
    file: "src/lib/local-runtime/workbench-nerve-bus-ai-request.ts",
    search: "  const aiResult = await runtime.aiAbilityGroup.execute(buildWorkbenchAiAbilityRequest(envelope, inputPayload), { signal });",
    replace: "  const aiResult = await runtime.aiAbilityGroup.execute(buildWorkbenchAiAbilityRequest(envelope, inputPayload));",
  },
  {
    name: "ai request debug pre-gateway mutation",
    file: "src/capabilities/ai/runtime-adapters/local-ai-runtime-adapter.ts",
    search: "  await context.debugSession.emitAiRequestDebug();\n",
    replace: "",
  },
  { name: "ai request debug pre-runtime mutation", file: "src/capabilities/ai/runtime/ai-executor.ts", search: "  await emitAiExecutionRequestDebug({\n    request: inputGate.request,\n    childContract: input.childContract,\n    context: input.context,\n    promptContract: promptResolution.contract,\n  });\n", replace: "" },
  {
    name: "implementation status collapse mutation",
    file: "src/capabilities/ai/runtime/ai-runtime-result.ts",
    search: '    "invalid_output",\n    "model_missing",\n    "engine_missing",\n    "service_unreachable",\n    "missing_evidence",\n',
    replace: "",
  },
  {
    name: "ai error diagnostic ref mutation",
    file: "src/capabilities/ai/ability-group.ts",
    search: "      diagnosticPayloadRef,\n",
    replace: "",
  },
  {
    name: "hard timeout mutation",
    file: "src/capabilities/ai/runtime-adapters/local-ai-runtime-gateway.ts",
    search: "const outcome = await Promise.race([executionPromise, waitForAbort(runtimeSignal.signal)]);",
    replace: "const outcome = await executionPromise;",
  },
  {
    name: "runtime policy literal mutation",
    file: "src/capabilities/ai/runtime/ai-timeout-policy-gate.ts",
    search: "timeoutMs: resolveAiRuntimeTimeoutMs(request.taskType),",
    replace: "timeoutMs: 45_000,",
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
    name: "success raw output mutation",
    file: "src/capabilities/ai/schema-runtime-success-invariants.ts",
    search: 'if (input.createdAt !== null && input.rawOutputRef === null) {',
    replace: 'if (input.createdAt === null && input.rawOutputRef === null) {',
  },
  {
    name: "success raw output hash mutation",
    file: "src/capabilities/ai/schema-runtime-success-invariants.ts",
    search: 'if (input.status === "success" && input.runtimeProof.rawOutputHash === null) {',
    replace: 'if (input.status === "failed" && input.runtimeProof.rawOutputHash === null) {',
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
    search: 'const rawInputRef = buildStableAiRef("ai-raw-input", [trace.missionId, trace.sessionId, taskType, input.failureReason]);',
    replace: 'const unsafeRawInput = input.rawInput as Record<string, unknown>;\n  const rawInputRef = buildStableAiRef("ai-raw-input", [trace.missionId, trace.sessionId, taskType, input.failureReason, String(unsafeRawInput.sessionId)]);',
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
    name: "public index helper mutation",
    file: "src/capabilities/ai/index.ts",
    search: 'export { createConfiguredAiAbilityGroup } from "./runtime-factory.js";',
    replace: 'export { createConfiguredAiAbilityGroup } from "./runtime-factory.js";\nexport { createAiExecutionContext } from "./runtime/ai-execution-context.js";',
  },
  {
    name: "export star mutation",
    file: "src/capabilities/ai/index.ts",
    search: 'export { createConfiguredAiAbilityGroup } from "./runtime-factory.js";',
    replace: `export { createConfiguredAiAbilityGroup } from "./runtime-factory.js";\n${EXPORT_STAR_MUTATION}`,
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
    search: "const outputRef = resolveAiOutputRef(input);",
    replace: `${AS_UNKNOWN_AS_MUTATION}\n  const outputRef = resolveAiOutputRef(input);`,
  },
  {
    name: "dynamic import mutation",
    file: "src/capabilities/ai/index.ts",
    search: 'export { createConfiguredAiAbilityGroup } from "./runtime-factory.js";',
    replace: `export { createConfiguredAiAbilityGroup } from "./runtime-factory.js";\n${DYNAMIC_IMPORT_MUTATION}`,
  },
  {
    name: "require mutation",
    file: "src/capabilities/ai/index.ts",
    search: 'export { createConfiguredAiAbilityGroup } from "./runtime-factory.js";',
    replace: `export { createConfiguredAiAbilityGroup } from "./runtime-factory.js";\n${REQUIRE_MUTATION}`,
  },
  {
    name: "ability-group adapter import mutation",
    file: "src/capabilities/ai/ability-group.ts",
    search: 'import { routeAiTaskToChild } from "./task-router.js";',
    replace: 'import { routeAiTaskToChild } from "./task-router.js";\nimport { createLocalAiRuntimePort } from "./runtime-adapters/local-ai-runtime-adapter.js";',
  },
  {
    name: "module state mutation",
    file: "src/capabilities/ai/runtime-adapters/local-ai-runtime-adapter.ts",
    search: "type LocalAiRuntimeState = {",
    replace: 'let activeRuns = 0;\n\ntype LocalAiRuntimeState = {',
  },
  {
    name: "prompt registry throw mutation",
    file: "src/capabilities/ai/runtime/ai-prompt-registry.ts",
    search: 'if (!contract) {\n    return {\n      ok: false,\n      failureReason: "unknown_prompt_contract",\n      message: `Unknown prompt contract: ${input.promptContractId}`,\n    };\n  }',
    replace: 'if (!contract) {\n    throw new Error(`Unknown prompt contract: ${input.promptContractId}`);\n  }',
  },
  {
    name: "prompt policy string mutation",
    file: "src/capabilities/ai/prompt-contracts/schema.ts",
    search: "confidencePolicy: PromptContractConfidencePolicySchema,",
    replace: "confidencePolicy: z.string().min(1),",
  },
  {
    name: "runtime mapper throw helper mutation",
    file: "src/capabilities/ai/runtime-adapters/local-ai-runtime-mapper.ts",
    search: 'return resolvePromptContractCatalogEntryByLocalTaskType(taskType);',
    replace: 'return { ok: true, contract: getPromptContractCatalogEntryByLocalTaskType(taskType) };',
  },
  {
    name: "second prompt truth mutation",
    file: "src/lib/local-ai/prompt-registry.ts",
    search: 'export type { PromptContract } from "../../capabilities/ai/prompt-contracts/local-ai-task-contracts.js";',
    replace: 'const LOCAL_PROMPT_CONTRACTS = [];\n\nexport type { PromptContract } from "../../capabilities/ai/prompt-contracts/local-ai-task-contracts.js";',
  },
  {
    name: "proof chain mutation",
    file: "src/capabilities/ai/runtime/ai-proof-builder.ts",
    search: "capabilityCallId: input.request.capabilityCallId,",
    replace: "capabilityCallId: null,",
  },
  {
    name: "model config boundary mutation",
    file: "src/capabilities/ai/model-roster.ts",
    search: 'from "./runtime/local-ai-model-config.js";',
    replace: 'from "../../lib/local-ai/model-config.js";',
  },
  {
    name: "ai debug trace step unsanctioned stepId mutation",
    file: "src/lib/local-runtime/workbench-ai-debug-support.ts",
    search: "  // Always use the RoundLifecycleStep-safe computed step; input.stepId may be\n  // an orchestration map step ID (e.g. \"judge-seeding-video\") which is NOT a\n  // valid RoundLifecycleStepSchema enum value and would throw at parse time.\n  step,\n",
    replace: "  step: input.stepId ?? step,\n",
  },
  {
    name: "product presence prompt uncertain mutation",
    file: "src/lib/local-ai/prompts/vision-product-presence.v1.ts",
    search: "Never return product_uncertain, review_required, null, maybe, unknown, or a human-review decision.",
    replace: "Use product_uncertain when visual evidence is ambiguous and request human review.",
  },
  {
    name: "product presence schema uncertain mutation",
    file: "src/types/vision-product-presence.ts",
    search: '  "product_no",\n]).nullable().default(null);',
    replace: '  "product_no",\n  "product_uncertain",\n]).nullable().default(null);',
  },
  {
    name: "product presence low confidence review mutation",
    file: "src/lib/local-runtime/workbench-nerve-bus-ai-request-builder.ts",
    search: "? { reviewOnLowConfidence: false, reviewOnSchemaFailure: true, reviewOnPolicyViolation: true }",
    replace: "? { reviewOnLowConfidence: true, reviewOnSchemaFailure: true, reviewOnPolicyViolation: true }",
  },
];
