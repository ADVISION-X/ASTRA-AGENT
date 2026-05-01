export const localAiRuntimeInspectionConstants = {
  CONFIG_PATH: "config/local-ai.models.json",
  GATEWAY_PATH: "src/lib/local-ai/local-ai-gateway.ts",
  RUNTIME_EXECUTION_PATH: "src/lib/local-ai/local-ai-runtime-execution.ts",
  MODEL_CONFIG_PATH: "src/lib/local-ai/model-config.ts",
  PROMPT_REGISTRY_PATH: "src/lib/local-ai/prompt-registry.ts",
  OLLAMA_ADAPTER_PATH: "src/lib/local-ai/runtime-adapters/ollama-runtime-adapter.ts",
  OCR_ADAPTER_PATH: "src/lib/local-ai/runtime-adapters/local-ocr-runtime-adapter.ts",
  RUNTIME_ERROR_PATH: "src/lib/local-ai/local-ai-runtime-error.ts",
  WORKBENCH_PATH: "src/lib/local-runtime/workbench.ts",
  COMMANDER_SCHEMA_PATH: "src/capabilities/commander-console/schema.ts",
  SOURCE_ROOTS: ["src"] as const,
} as const;

export const PRODUCT_SIGNAL_ALLOWED_PATHS = new Set([
  "src/types/local-ai.ts",
  localAiRuntimeInspectionConstants.PROMPT_REGISTRY_PATH,
  localAiRuntimeInspectionConstants.MODEL_CONFIG_PATH,
  localAiRuntimeInspectionConstants.RUNTIME_EXECUTION_PATH,
]);

export const LOCAL_AI_REQUIRED_FILES = [
  localAiRuntimeInspectionConstants.GATEWAY_PATH,
  localAiRuntimeInspectionConstants.RUNTIME_EXECUTION_PATH,
  localAiRuntimeInspectionConstants.OLLAMA_ADAPTER_PATH,
  localAiRuntimeInspectionConstants.OCR_ADAPTER_PATH,
  localAiRuntimeInspectionConstants.RUNTIME_ERROR_PATH,
  localAiRuntimeInspectionConstants.WORKBENCH_PATH,
  localAiRuntimeInspectionConstants.COMMANDER_SCHEMA_PATH,
] as const;