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
    search: "input.context.runtime.execute(input.request, { signal: controller.signal })",
    replace: "input.context.runtime.execute(input.request)",
  },
  {
    name: "debug event wiring mutation",
    file: "src/capabilities/ai/runtime-factory.ts",
    search: "    emitDebugEvent: input.emitDebugEvent,\n",
    replace: "",
  },
  { name: "ai request debug pre-parse mutation", file: "src/capabilities/ai/ability-group.ts", search: "  await emitAiExecutionInputDebug(context, inputValue);\n", replace: "" },
  {
    name: "debug emitter required mutation",
    file: "src/capabilities/ai/ability-group.ts",
    search: "  if (!context.emitDebugEvent) {\n    return dispatchAiDebugEmitterMissing(context, inputValue);\n  }\n",
    replace: "",
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
];

export const MUTATION_LAW_COVERAGE: Record<string, {
  coveredLawIds: string[];
  coverageReasonByLawId: Record<string, string>;
}> = {
  "public index helper mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-001-V1", "GRASSEYE-AI-CAPABILITY-004-V1", "GRASSEYE-AI-CAPABILITY-007-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-001-V1": "The mutation exports a private AI execution-context helper from the public AI root; this proves AI public sovereignty is blocked by the owner inspector.",
      "GRASSEYE-AI-CAPABILITY-004-V1": "The mutation breaks the static AI package public surface by leaking an internal runtime helper.",
      "GRASSEYE-AI-CAPABILITY-007-V1": "The mutation proves the AI owner inspector is the machine-blocking enforcement entry for AI public-surface drift.",
    },
  },
  "forbidden import mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-001-V1", "GRASSEYE-AI-CAPABILITY-003-V1", "GRASSEYE-AI-CAPABILITY-010-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-001-V1": "The mutation imports an action owner type into AI runtime code, proving AI ownership cannot mix with action ability groups.",
      "GRASSEYE-AI-CAPABILITY-003-V1": "The mutation attempts to give AI knowledge of action ownership, proving AI remains reasoning-only and cannot become an action executor.",
      "GRASSEYE-AI-CAPABILITY-010-V1": "The mutation proves action-authority imports are rejected before prompts or AI output can become action commands.",
    },
  },
  "paid execute mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-005-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-005-V1": "The mutation adds execute authority to a disabled paid provider child, proving paid providers fail closed by policy.",
    },
  },
  "forbidden action output mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-005B-V2", "GRASSEYE-AI-CAPABILITY-014-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-005B-V2": "The mutation disables forbidden output-key enforcement before Forensics persistence, proving AI output must be cleaned before persistence.",
      "GRASSEYE-AI-CAPABILITY-014-V1": "The mutation weakens the recursive action-output boundary, proving AI output cannot carry browser/action/forensics/command authority.",
    },
  },
  "as-any mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-006-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-006-V1": "The mutation injects an any escape into AI runtime code, proving the AI public/private boundary cannot be bypassed with type escapes.",
    },
  },
  "second prompt truth mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-008-V1", "GRASSEYE-AI-CAPABILITY-009-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-008-V1": "The mutation creates a second local prompt catalog, proving Prompt Contract Registry remains the only prompt truth.",
      "GRASSEYE-AI-CAPABILITY-009-V1": "The mutation proves prompt contract metadata cannot be duplicated outside the governed catalog.",
    },
  },
  "prompt registry throw mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-011-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-011-V1": "The mutation changes typed prompt resolution failure into a throw, proving prompt execution must route through governed typed failures.",
    },
  },
  "runtime signal mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-012-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-012-V1": "The mutation drops AbortController signal propagation to the runtime port, proving AI timeout and cancellation are machine-enforced.",
    },
  },
  "debug event wiring mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-002-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-002-V1": "The mutation removes emitDebugEvent from the configured runtime factory, proving AI_ERROR_DEBUG cannot silently disconnect from structured runtime logging.",
    },
  },
  "debug emitter required mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-002-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-002-V1": "The mutation lets ASK AI continue without a structured debug emitter, proving AI_REQUEST_DEBUG is a hard execution precondition.",
    },
  },
  "implementation status collapse mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-002-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-002-V1": "The mutation removes specific local runtime statuses, proving runtime failures cannot collapse into a single non-diagnostic reason.",
    },
  },
  "ai error diagnostic ref mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-002-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-002-V1": "The mutation removes diagnosticPayloadRef from unexpected AI child throw handling, proving outer runtime_execution_failed failures remain diagnosable.",
    },
  },
  "proof chain mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-013-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-013-V1": "The mutation removes capabilityCallId from runtime proof identity, proving AI result proofs must remain complete and chain-linked.",
    },
  },
  "success raw output hash mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-002-V1", "GRASSEYE-AI-CAPABILITY-013-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-002-V1": "The mutation weakens raw response hash enforcement, proving ASK AI success requires rawResponseHash evidence.",
      "GRASSEYE-AI-CAPABILITY-013-V1": "The mutation proves AI runtime proof cannot be considered complete without rawOutputHash on success.",
    },
  },
  "input gate mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-002-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-002-V1": "The mutation bypasses the AI input schema gate in the runtime chain, proving provider/runtime channels cannot bypass AI-owned routing gates.",
    },
  },
};
