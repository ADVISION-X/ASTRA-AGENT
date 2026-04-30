import { ZodError } from "zod";

import { validateLocalAiModelConfig } from "../../../../src/lib/local-ai/model-config.js";
import { createFinding, createPhase } from "../../core/result.js";
import { fileExists, listFilesRecursive, readJsonFile, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { scanFilesForPatterns } from "../_shared/scan-for-patterns.js";

const CONFIG_PATH = "config/local-ai.models.json";
const GATEWAY_PATH = "src/lib/local-ai/local-ai-gateway.ts";
const RUNTIME_EXECUTION_PATH = "src/lib/local-ai/local-ai-runtime-execution.ts";
const MODEL_CONFIG_PATH = "src/lib/local-ai/model-config.ts";
const PROMPT_REGISTRY_PATH = "src/lib/local-ai/prompt-registry.ts";
const OLLAMA_ADAPTER_PATH = "src/lib/local-ai/runtime-adapters/ollama-runtime-adapter.ts";
const OCR_ADAPTER_PATH = "src/lib/local-ai/runtime-adapters/local-ocr-runtime-adapter.ts";
const RUNTIME_ERROR_PATH = "src/lib/local-ai/local-ai-runtime-error.ts";
const WORKBENCH_PATH = "src/lib/local-runtime/workbench.ts";
const COMMANDER_SCHEMA_PATH = "src/capabilities/commander-console/schema.ts";

const SOURCE_ROOTS = ["src"] as const;
const PRODUCT_SIGNAL_ALLOWED_PATHS = new Set([
  "src/types/local-ai.ts",
  PROMPT_REGISTRY_PATH,
  MODEL_CONFIG_PATH,
  RUNTIME_EXECUTION_PATH,
]);

const countOccurrences = (source: string, text: string): number => source.split(text).length - 1;

const findProductSignalViolations = async (sourceFiles: string[]) => {
  const violations: string[] = [];

  for (const file of sourceFiles) {
    if (PRODUCT_SIGNAL_ALLOWED_PATHS.has(file)) {
      continue;
    }

    const source = await readTextFile(pathFromRepoRoot(file));
    if (source.includes("product.signal_summary")) {
      violations.push(file);
    }
  }

  return violations;
};

export const inspectLocalAiRuntimeBoundary = async () => {
    const sourceFiles = (
      await Promise.all(
        SOURCE_ROOTS.map((root) => listFilesRecursive(pathFromRepoRoot(root), { extensions: [".ts", ".mjs", ".js"] })),
      )
    ).flat();
    const gatewaySource = await readTextFile(pathFromRepoRoot(GATEWAY_PATH));
    const runtimeExecutionSource = await readTextFile(pathFromRepoRoot(RUNTIME_EXECUTION_PATH));
    const promptRegistrySource = await readTextFile(pathFromRepoRoot(PROMPT_REGISTRY_PATH));
    const modelConfigSource = await readTextFile(pathFromRepoRoot(MODEL_CONFIG_PATH));
    const workbenchSource = await readTextFile(pathFromRepoRoot(WORKBENCH_PATH));
    const commanderSchemaSource = await readTextFile(pathFromRepoRoot(COMMANDER_SCHEMA_PATH));
    const findings = [];

    const requiredFiles = [
      GATEWAY_PATH,
      RUNTIME_EXECUTION_PATH,
      OLLAMA_ADAPTER_PATH,
      OCR_ADAPTER_PATH,
      RUNTIME_ERROR_PATH,
      WORKBENCH_PATH,
      COMMANDER_SCHEMA_PATH,
    ];
    const filePresenceChecks = await Promise.all(
      requiredFiles.map(async (file) => ({ file, exists: await fileExists(pathFromRepoRoot(file)) })),
    );
    for (const check of filePresenceChecks) {
      if (!check.exists) {
        findings.push(
          createFinding({
            lawId: "GRASSEYE-LOCAL-AI-RUNTIME-002-V1",
            file: check.file,
            line: 1,
            severity: "fatal",
            message: "Required Local AI runtime enforcement file is missing.",
          }),
        );
      }
    }

    const configExists = await fileExists(pathFromRepoRoot(CONFIG_PATH));
    if (!configExists) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-LOCAL-AI-RUNTIME-004-V1",
          file: CONFIG_PATH,
          line: 1,
          severity: "fatal",
          message: "Governed local AI model config is missing.",
        }),
      );
    }

    let configValidationPassed = false;
    if (configExists) {
      try {
        const configJson = await readJsonFile<unknown>(pathFromRepoRoot(CONFIG_PATH));
        validateLocalAiModelConfig(configJson);
        configValidationPassed = true;
      } catch (error) {
        if (error instanceof ZodError) {
          for (const issue of error.issues) {
            findings.push(
              createFinding({
                lawId: "GRASSEYE-LOCAL-AI-RUNTIME-004-V1",
                file: CONFIG_PATH,
                line: 1,
                severity: "error",
                message: `Local AI model config violation at ${issue.path.join(".") || "root"}: ${issue.message}`,
              }),
            );
          }
        } else {
          const message = error instanceof Error ? error.message : String(error);
          findings.push(
            createFinding({
              lawId: "GRASSEYE-LOCAL-AI-RUNTIME-004-V1",
              file: CONFIG_PATH,
              line: 1,
              severity: "error",
              message: `Local AI model config could not be validated: ${message}`,
            }),
          );
        }
      }
    }

    const externalFallbackFindings = await scanFilesForPatterns(sourceFiles, [
      {
        lawId: "GRASSEYE-LOCAL-AI-RUNTIME-001-V1",
        severity: "error",
        pattern: /api\.openai\.com|openai|anthropic|gemini|paid-api/i,
        message: "External AI provider keyword found in source tree.",
      },
      {
        lawId: "GRASSEYE-LOCAL-AI-RUNTIME-001-V1",
        severity: "error",
        pattern: /fallback[^\n]{0,80}(cloud|remote|openai|paid|anthropic|gemini)/i,
        message: "Automatic external AI fallback pattern found in source tree.",
      },
    ]);
    findings.push(...externalFallbackFindings);

    if (configExists) {
      const configText = await readTextFile(pathFromRepoRoot(CONFIG_PATH));
      if (/openai|anthropic|gemini|paid-api|apiKey/i.test(configText)) {
        findings.push(
          createFinding({
            lawId: "GRASSEYE-LOCAL-AI-RUNTIME-004-V1",
            file: CONFIG_PATH,
            line: 1,
            severity: "fatal",
            message: "Local AI model config contains forbidden cloud, paid API, or API key markers.",
          }),
        );
      }
    }

    const registryPassed =
      modelConfigSource.includes("loadLocalAiModelConfig") &&
      gatewaySource.includes("getPromptContract") &&
      gatewaySource.includes("getModelRoleConfig") &&
      promptRegistrySource.includes("promptVersion") &&
      promptRegistrySource.includes("schemaVersion") &&
      promptRegistrySource.includes("forbiddenOutputs") &&
      promptRegistrySource.includes("modelRole");

    if (!gatewaySource.includes("loadLocalAiModelConfig") || !gatewaySource.includes("getModelRoleConfig")) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-LOCAL-AI-RUNTIME-004-V1",
          file: GATEWAY_PATH,
          line: 1,
          severity: "error",
          message: "Local AI Gateway must load and resolve governed model config before executing tasks.",
        }),
      );
    }

    const heuristicMarkers = ["productHints", "negativeHints", "summary.toLowerCase()"];
    const usesHeuristicLogic = heuristicMarkers.some((marker) => gatewaySource.includes(marker));
    if (usesHeuristicLogic && (!gatewaySource.includes("implementationStatus") || !gatewaySource.includes("governed-heuristic"))) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-LOCAL-AI-RUNTIME-004-V1",
          file: GATEWAY_PATH,
          line: 1,
          severity: "error",
          message: "Gateway contains heuristic execution logic without explicit implementationStatus disclosure.",
        }),
      );
    }

    const runtimeWiringPassed =
      gatewaySource.includes("executeRuntimeTask") &&
      gatewaySource.includes("new OllamaRuntimeAdapter()") &&
      gatewaySource.includes("new LocalOcrRuntimeAdapter()") &&
      gatewaySource.includes("getRuntimeHealth") &&
      runtimeExecutionSource.includes("invokeVisionTask") &&
      runtimeExecutionSource.includes("invokeTextTask") &&
      runtimeExecutionSource.includes("invokeOcrTask");
    if (!runtimeWiringPassed) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-LOCAL-AI-RUNTIME-002-V1",
          file: GATEWAY_PATH,
          line: 1,
          severity: "error",
          message: "Local AI runtime must execute through real Ollama and OCR adapters, not config-only gateway wiring.",
        }),
      );
    }

    const realPlatformPathPassed =
      gatewaySource.includes("if (options?.executionMode && options.executionMode !== \"real-platform\")") &&
      gatewaySource.includes("return executeGovernedTask(request, roleConfig, new Date().toISOString())") &&
      gatewaySource.includes("const result = await executeRuntimeTask({") &&
      countOccurrences(gatewaySource, "executeGovernedTask(") === 1;
    if (!realPlatformPathPassed) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-LOCAL-AI-RUNTIME-002-V1",
          file: GATEWAY_PATH,
          line: 1,
          severity: "error",
          message: "Real-platform Local AI execution must default to runtime adapters and only allow governed-task heuristics in explicit non-real modes.",
        }),
      );
    }

    const productSignalViolations = await findProductSignalViolations(sourceFiles.filter((file) => file.startsWith("src/")));
    if (productSignalViolations.length > 0) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-LOCAL-AI-RUNTIME-003-V1",
          file: productSignalViolations[0] ?? RUNTIME_EXECUTION_PATH,
          line: 1,
          severity: "error",
          message: `Phase-03 runtime must not consume product.signal_summary outside governed Local AI contracts. Found references in: ${productSignalViolations.join(", ")}`,
        }),
      );
    }

    const phase3PolicyPassed =
      runtimeExecutionSource.includes("product.signal_summary is not allowed in phase-04 runtime flow") &&
      runtimeExecutionSource.includes("disabled_by_policy");
    if (!phase3PolicyPassed) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-LOCAL-AI-RUNTIME-003-V1",
          file: RUNTIME_EXECUTION_PATH,
          line: 1,
          severity: "error",
          message: "Phase-03 agent runtime must keep product.signal_summary blocked from the governed runtime execution path.",
        }),
      );
    }

    const healthVisibilityPassed =
      workbenchSource.includes("getRuntimeHealth") &&
      workbenchSource.includes("localAiHealth") &&
      workbenchSource.includes("lastTask=") &&
      workbenchSource.includes("lastFailure=") &&
      commanderSchemaSource.includes("lastAiFailureReason");
    if (!healthVisibilityPassed) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-LOCAL-AI-RUNTIME-004-V1",
          file: WORKBENCH_PATH,
          line: 1,
          severity: "error",
          message: "Workbench must expose real Local AI health, last task, and failure state instead of config-only or prototype placeholders.",
        }),
      );
    }

    return {
      findings,
      phases: [
        createPhase(
          "local-ai-contracts",
          registryPassed ? "PASS" : "LAW-SCRIPT DRIFT",
          registryPassed,
          registryPassed
            ? "Local AI gateway and prompt registry expose governed task contracts with prompt and schema versions."
            : "Local AI gateway or prompt registry is missing governed contract wiring.",
        ),
        createPhase(
          "local-ai-runtime-path",
          runtimeWiringPassed && realPlatformPathPassed ? "PASS" : "CODE VIOLATION",
          runtimeWiringPassed && realPlatformPathPassed,
          runtimeWiringPassed && realPlatformPathPassed
            ? "Real-platform Local AI calls default to runtime adapters and keep heuristic execution behind explicit non-real modes only."
            : "Local AI gateway still allows config-only or heuristic execution to masquerade as real-platform runtime.",
        ),
        createPhase(
          "phase3-policy-blocks",
          phase3PolicyPassed && productSignalViolations.length === 0 ? "PASS" : "CODE VIOLATION",
          phase3PolicyPassed && productSignalViolations.length === 0,
          phase3PolicyPassed && productSignalViolations.length === 0
            ? "Phase-03 runtime blocks product.signal_summary and uses pending-analysis evidence candidates instead."
            : "Phase-03 runtime still leaks product.signal_summary into live agent execution.",
        ),
        createPhase(
          "local-ai-model-config",
          configValidationPassed ? "PASS" : "CODE VIOLATION",
          configValidationPassed,
          configValidationPassed
            ? "Governed local AI model config exists, parses, and blocks cloud, paid, and mock acceptance paths."
            : "Local AI model config is missing or invalid.",
        ),
        createPhase(
          "local-ai-fallback-scan",
          findings.filter((finding) => finding.lawId === "GRASSEYE-LOCAL-AI-RUNTIME-001-V1").length === 0 ? "PASS" : "CODE VIOLATION",
          findings.filter((finding) => finding.lawId === "GRASSEYE-LOCAL-AI-RUNTIME-001-V1").length === 0,
          findings.filter((finding) => finding.lawId === "GRASSEYE-LOCAL-AI-RUNTIME-001-V1").length === 0
            ? "No obvious external AI fallback keyword was found in source files."
            : "External AI provider or fallback patterns were found in source files.",
        ),
        createPhase(
          "operator-health-visibility",
          healthVisibilityPassed ? "PASS" : "CODE VIOLATION",
          healthVisibilityPassed,
          healthVisibilityPassed
            ? "Operator surfaces expose real Local AI health, recent task identity, and failure reason."
            : "Workbench or runtime snapshot still hides Local AI health behind placeholders or stale fields.",
        ),
      ],
    };
};
