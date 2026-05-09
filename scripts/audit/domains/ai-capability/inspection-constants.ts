const AI_ROOT = "src/capabilities/ai";
const INSPECTOR_ENTRY = "scripts/audit/domains/ai-capability/inspector.ts";

const REQUIRED_FILES = [
  `${AI_ROOT}/ability-group.ts`,
  `${AI_ROOT}/contract.ts`,
  `${AI_ROOT}/schema.ts`,
  `${AI_ROOT}/schema-core.schema.ts`,
  `${AI_ROOT}/schema-runtime.schema.ts`,
  `${AI_ROOT}/registry.ts`,
  `${AI_ROOT}/index.ts`,
  `${AI_ROOT}/task-router.ts`,
  `${AI_ROOT}/model-roster.ts`,
  `${AI_ROOT}/ports/ai-clock-port.ts`,
  `${AI_ROOT}/ports/ai-runtime-port.ts`,
  `${AI_ROOT}/ports/ai-model-roster-port.ts`,
  `${AI_ROOT}/ports/ai-prompt-registry-port.ts`,
  `${AI_ROOT}/runtime/ai-executor.ts`,
  `${AI_ROOT}/runtime/ai-input-gate.ts`,
  `${AI_ROOT}/runtime/ai-provider-policy-gate.ts`,
  `${AI_ROOT}/runtime/ai-data-policy-gate.ts`,
  `${AI_ROOT}/runtime/ai-cost-policy-gate.ts`,
  `${AI_ROOT}/runtime/ai-safety-policy-gate.ts`,
  `${AI_ROOT}/runtime/ai-schema-gate.ts`,
  `${AI_ROOT}/runtime/ai-quality-gate.ts`,
  `${AI_ROOT}/runtime/ai-output-boundary-gate.ts`,
  `${AI_ROOT}/runtime/ai-result-builder.ts`,
  `${AI_ROOT}/runtime/ai-proof-builder.ts`,
  `${AI_ROOT}/runtime/ai-dispatch-failure.ts`,
  `${AI_ROOT}/runtime/ai-disabled-provider-result.ts`,
  `${AI_ROOT}/runtime/ai-clock.ts`,
  `${AI_ROOT}/runtime/ai-idempotency.ts`,
  `${AI_ROOT}/runtime/ai-timeout-policy-gate.ts`,
  `${AI_ROOT}/runtime/ai-payload-budget-gate.ts`,
  `${AI_ROOT}/runtime/ai-runtime-health-gate.ts`,
  `${AI_ROOT}/runtime/ai-runtime-call-runner.ts`,
  `${AI_ROOT}/runtime/ai-execution-context.ts`,
  `${AI_ROOT}/runtime/ai-prompt-registry.ts`,
  `${AI_ROOT}/runtime-adapters/local-ai-runtime-adapter.ts`,
  `${AI_ROOT}/runtime-adapters/local-ai-runtime-gateway.ts`,
  `${AI_ROOT}/runtime-adapters/local-ai-runtime-output.ts`,
  `${AI_ROOT}/runtime-adapters/local-ai-runtime-debug.ts`,
  `${AI_ROOT}/runtime-adapters/local-ai-runtime-debug-contract.ts`,
  `${AI_ROOT}/runtime-adapters/local-ai-runtime-debug-state.ts`,
  `${AI_ROOT}/runtime-adapters/local-ai-runtime-mapper.ts`,
  `${AI_ROOT}/shared/ai-types.ts`,
  `${AI_ROOT}/shared/ai-policy.ts`,
  `${AI_ROOT}/shared/ai-proof.ts`,
  `${AI_ROOT}/shared/ai-failure.ts`,
  `${AI_ROOT}/shared/ai-json-extract.ts`,
  `${AI_ROOT}/shared/ai-output.ts`,
] as const;

const CHILD_IDS = [
  "local-vision-ai",
  "local-text-ai",
  "local-ocr-ai",
  "internal-schema-validator",
  "paid-vision-ai",
  "paid-analysis-ai",
  "future-api-ai",
] as const;

const FORBIDDEN_FILES = [
  `${AI_ROOT}/schema-validation.ts`,
  `${AI_ROOT}/shared/ai-runtime-proof.ts`,
  `${AI_ROOT}/runtime/ai-runtime-executor.ts`,
  `${AI_ROOT}/runtime/ai-runtime-policy-gate.ts`,
  `${AI_ROOT}/runtime/ai-runtime-quality-gate.ts`,
  `${AI_ROOT}/runtime/ai-runtime-schema-gate.ts`,
  `${AI_ROOT}/runtime/ai-runtime-failure-result.ts`,
  `${AI_ROOT}/runtime/ai-runtime-proof-builder.ts`,
  `${AI_ROOT}/runtime/ai-runtime-output-normalizer.ts`,
  `${AI_ROOT}/runtime/ai-runtime-result-builder.ts`,
  `${AI_ROOT}/runtime-adapters/local-ai-runtime-bridge.ts`,
  `${AI_ROOT}/capability-check.ts`,
] as const;

const FORBIDDEN_IMPORT_SEGMENTS = [
  "capabilities/open",
  "capabilities/screenshot",
  "capabilities/mouse-click",
  "capabilities/mouse-scroll",
  "capabilities/geometry-guard",
  "capabilities/page-state",
  "capabilities/forensics-persistence",
  "features/platform-action",
  "computer-use",
  "forensics",
] as const;

const DISABLED_CHILD_GATEWAY_IDS = [
  "internal-schema-validator",
  "paid-vision-ai",
  "paid-analysis-ai",
  "future-api-ai",
] as const;

const DISABLED_EXECUTION_CHILD_IDS = [
  "paid-vision-ai",
  "paid-analysis-ai",
  "future-api-ai",
] as const;

const ROUTED_CHILD_IDS = [
  "internal-schema-validator",
  "local-ocr-ai",
  "local-text-ai",
  "local-vision-ai",
  "paid-analysis-ai",
] as const;

const REQUIRED_ADAPTER_TOKENS = [
  "AbortController",
  "AI_LOCAL_RUNTIME_POLICY",
  "circuitBreaker",
  "rawOutputRef",
  "rawOutputHash",
  "gatewayDurationMs",
  "modelHealthBefore",
  "modelHealthAfter",
  "runtimeCallId",
  "timeoutMs",
] as const;

export const aiInspectionConstants = {
  AI_ROOT,
  INSPECTOR_ENTRY,
  REQUIRED_FILES,
  CHILD_IDS,
  FORBIDDEN_FILES,
  FORBIDDEN_IMPORT_SEGMENTS,
  DISABLED_CHILD_GATEWAY_IDS,
  DISABLED_EXECUTION_CHILD_IDS,
  ROUTED_CHILD_IDS,
  REQUIRED_ADAPTER_TOKENS,
} as const;