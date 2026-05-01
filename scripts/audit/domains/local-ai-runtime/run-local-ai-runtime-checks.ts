import { ZodError } from "zod";

import { validateLocalAiModelConfig } from "../../../../src/lib/local-ai/model-config.js";
import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { fileExists, listFilesRecursive, readJsonFile, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { scanFilesForPatterns } from "../_shared/scan-for-patterns.js";

import {
  LOCAL_AI_REQUIRED_FILES,
  localAiRuntimeInspectionConstants as config,
} from "./inspection-constants.js";
import { createLocalAiRuntimePhases } from "./local-ai-runtime-phases.js";
import { collectProductSignalFindings, type ProductSignalCheckResult } from "./product-signal-checks.js";

type LoadedLocalAiSources = {
  sourceFiles: string[];
  gatewaySource: string;
  runtimeExecutionSource: string;
  promptRegistrySource: string;
  modelConfigSource: string;
  workbenchSource: string;
  commanderSchemaSource: string;
};

type ConfigCheckResult = {
  findings: Finding[];
  configValidationPassed: boolean;
};

type ContractCheckResult = {
  findings: Finding[];
  registryPassed: boolean;
};

type RuntimePathCheckResult = {
  findings: Finding[];
  runtimeWiringPassed: boolean;
  realPlatformPathPassed: boolean;
};

type HealthVisibilityCheckResult = {
  findings: Finding[];
  healthVisibilityPassed: boolean;
};

const countOccurrences = (source: string, text: string): number => source.split(text).length - 1;

const readRepoText = async (filePath: string): Promise<string> => {
  return readTextFile(pathFromRepoRoot(filePath));
};

const loadSourceFiles = async (): Promise<string[]> => {
  return (await Promise.all(
    config.SOURCE_ROOTS.map((root) => listFilesRecursive(pathFromRepoRoot(root), { extensions: [".ts", ".mjs", ".js"] })),
  )).flat();
};

const loadLocalAiSources = async (sourceFiles: string[]): Promise<LoadedLocalAiSources> => {
  const [gatewaySource, runtimeExecutionSource, promptRegistrySource, modelConfigSource, workbenchSource, commanderSchemaSource] = await Promise.all([
    readRepoText(config.GATEWAY_PATH),
    readRepoText(config.RUNTIME_EXECUTION_PATH),
    readRepoText(config.PROMPT_REGISTRY_PATH),
    readRepoText(config.MODEL_CONFIG_PATH),
    readRepoText(config.WORKBENCH_PATH),
    readRepoText(config.COMMANDER_SCHEMA_PATH),
  ]);

  return {
    sourceFiles,
    gatewaySource,
    runtimeExecutionSource,
    promptRegistrySource,
    modelConfigSource,
    workbenchSource,
    commanderSchemaSource,
  };
};

const collectRequiredFileFindings = async (): Promise<Finding[]> => {
  const filePresenceChecks = await Promise.all(
    LOCAL_AI_REQUIRED_FILES.map(async (file) => ({ file, exists: await fileExists(pathFromRepoRoot(file)) })),
  );

  return filePresenceChecks.flatMap((check) => {
    return check.exists
      ? []
      : [createFinding({
          lawId: "GRASSEYE-LOCAL-AI-RUNTIME-002-V1",
          file: check.file,
          line: 1,
          severity: "fatal",
          message: "Required Local AI runtime enforcement file is missing.",
        })];
  });
};

const collectConfigFindings = async (): Promise<ConfigCheckResult> => {
  const findings: Finding[] = [];
  const configExists = await fileExists(pathFromRepoRoot(config.CONFIG_PATH));
  if (!configExists) {
    findings.push(createFinding({
      lawId: "GRASSEYE-LOCAL-AI-RUNTIME-004-V1",
      file: config.CONFIG_PATH,
      line: 1,
      severity: "fatal",
      message: "Governed local AI model config is missing.",
    }));
    return { findings, configValidationPassed: false };
  }

  let configValidationPassed = false;
  try {
    const configJson = await readJsonFile<unknown>(pathFromRepoRoot(config.CONFIG_PATH));
    validateLocalAiModelConfig(configJson);
    configValidationPassed = true;
  } catch (error) {
    findings.push(...toConfigValidationFindings(error));
  }

  const configText = await readRepoText(config.CONFIG_PATH);
  if (/openai|anthropic|gemini|paid-api|apiKey/i.test(configText)) {
    findings.push(createFinding({
      lawId: "GRASSEYE-LOCAL-AI-RUNTIME-004-V1",
      file: config.CONFIG_PATH,
      line: 1,
      severity: "fatal",
      message: "Local AI model config contains forbidden cloud, paid API, or API key markers.",
    }));
  }

  return { findings, configValidationPassed };
};

const toConfigValidationFindings = (error: unknown): Finding[] => {
  if (error instanceof ZodError) {
    return error.issues.map((issue) => createFinding({
      lawId: "GRASSEYE-LOCAL-AI-RUNTIME-004-V1",
      file: config.CONFIG_PATH,
      line: 1,
      severity: "error",
      message: `Local AI model config violation at ${issue.path.join(".") || "root"}: ${issue.message}`,
    }));
  }

  const message = error instanceof Error ? error.message : String(error);
  return [createFinding({
    lawId: "GRASSEYE-LOCAL-AI-RUNTIME-004-V1",
    file: config.CONFIG_PATH,
    line: 1,
    severity: "error",
    message: `Local AI model config could not be validated: ${message}`,
  })];
};

const collectExternalFallbackFindings = async (sourceFiles: string[]): Promise<Finding[]> => {
  return scanFilesForPatterns(sourceFiles, [
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
};

const collectContractFindings = (sources: LoadedLocalAiSources): ContractCheckResult => {
  const findings: Finding[] = [];
  const registryPassed = [
    sources.modelConfigSource.includes("loadLocalAiModelConfig"),
    sources.gatewaySource.includes("getPromptContract"),
    sources.gatewaySource.includes("getModelRoleConfig"),
    sources.promptRegistrySource.includes("promptVersion"),
    sources.promptRegistrySource.includes("schemaVersion"),
    sources.promptRegistrySource.includes("forbiddenOutputs"),
    sources.promptRegistrySource.includes("modelRole"),
  ].every(Boolean);

  if (!sources.gatewaySource.includes("loadLocalAiModelConfig") || !sources.gatewaySource.includes("getModelRoleConfig")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-LOCAL-AI-RUNTIME-004-V1",
      file: config.GATEWAY_PATH,
      line: 1,
      severity: "error",
      message: "Local AI Gateway must load and resolve governed model config before executing tasks.",
    }));
  }

  const heuristicMarkers = ["productHints", "negativeHints", "summary.toLowerCase()"];
  const usesHeuristicLogic = heuristicMarkers.some((marker) => sources.gatewaySource.includes(marker));
  if (usesHeuristicLogic && (!sources.gatewaySource.includes("implementationStatus") || !sources.gatewaySource.includes("governed-heuristic"))) {
    findings.push(createFinding({
      lawId: "GRASSEYE-LOCAL-AI-RUNTIME-004-V1",
      file: config.GATEWAY_PATH,
      line: 1,
      severity: "error",
      message: "Gateway contains heuristic execution logic without explicit implementationStatus disclosure.",
    }));
  }

  return { findings, registryPassed };
};

const collectRuntimePathFindings = (sources: LoadedLocalAiSources): RuntimePathCheckResult => {
  const findings: Finding[] = [];
  const runtimeWiringPassed = [
    sources.gatewaySource.includes("executeRuntimeTask"),
    sources.gatewaySource.includes("new OllamaRuntimeAdapter()"),
    sources.gatewaySource.includes("new LocalOcrRuntimeAdapter()"),
    sources.gatewaySource.includes("getRuntimeHealth"),
    sources.runtimeExecutionSource.includes("invokeVisionTask"),
    sources.runtimeExecutionSource.includes("invokeTextTask"),
    sources.runtimeExecutionSource.includes("invokeOcrTask"),
  ].every(Boolean);
  const realPlatformPathPassed = [
    sources.gatewaySource.includes('if (options?.executionMode && options.executionMode !== "real-platform")'),
    sources.gatewaySource.includes('return executeGovernedTask(request, roleConfig, new Date().toISOString())'),
    sources.gatewaySource.includes("const result = await executeRuntimeTask({"),
    countOccurrences(sources.gatewaySource, "executeGovernedTask(") === 1,
  ].every(Boolean);

  if (!runtimeWiringPassed) {
    findings.push(createFinding({
      lawId: "GRASSEYE-LOCAL-AI-RUNTIME-002-V1",
      file: config.GATEWAY_PATH,
      line: 1,
      severity: "error",
      message: "Local AI runtime must execute through real Ollama and OCR adapters, not config-only gateway wiring.",
    }));
  }
  if (!realPlatformPathPassed) {
    findings.push(createFinding({
      lawId: "GRASSEYE-LOCAL-AI-RUNTIME-002-V1",
      file: config.GATEWAY_PATH,
      line: 1,
      severity: "error",
      message: "Real-platform Local AI execution must default to runtime adapters and only allow governed-task heuristics in explicit non-real modes.",
    }));
  }

  return { findings, runtimeWiringPassed, realPlatformPathPassed };
};

const collectHealthVisibilityFindings = (sources: LoadedLocalAiSources): HealthVisibilityCheckResult => {
  const healthVisibilityPassed = [
    sources.workbenchSource.includes("getRuntimeHealth"),
    sources.workbenchSource.includes("localAiHealth"),
    sources.workbenchSource.includes("lastTask="),
    sources.workbenchSource.includes("lastFailure="),
    sources.commanderSchemaSource.includes("lastAiFailureReason"),
  ].every(Boolean);

  return {
    findings: healthVisibilityPassed
      ? []
      : [createFinding({
          lawId: "GRASSEYE-LOCAL-AI-RUNTIME-004-V1",
          file: config.WORKBENCH_PATH,
          line: 1,
          severity: "error",
          message: "Workbench must expose real Local AI health, last task, and failure state instead of config-only or prototype placeholders.",
        })],
    healthVisibilityPassed,
  };
};

export const inspectLocalAiRuntimeBoundary = async () => {
  const sourceFiles = await loadSourceFiles();
  const sources = await loadLocalAiSources(sourceFiles);
  const requiredFileFindings = await collectRequiredFileFindings();
  const configResult = await collectConfigFindings();
  const externalFallbackFindings = await collectExternalFallbackFindings(sourceFiles);
  const contractResult = collectContractFindings(sources);
  const runtimePathResult = collectRuntimePathFindings(sources);
  const productSignalResult = await collectProductSignalFindings({
    sourceFiles,
    runtimeExecutionSource: sources.runtimeExecutionSource,
  });
  const healthVisibilityResult = collectHealthVisibilityFindings(sources);
  const findings = [
    ...requiredFileFindings,
    ...configResult.findings,
    ...externalFallbackFindings,
    ...contractResult.findings,
    ...runtimePathResult.findings,
    ...productSignalResult.findings,
    ...healthVisibilityResult.findings,
  ];

  return {
    findings,
    phases: createLocalAiRuntimePhases({
      hasFallbackViolations: findings.some((finding) => finding.lawId === "GRASSEYE-LOCAL-AI-RUNTIME-001-V1"),
      registryPassed: contractResult.registryPassed,
      runtimeWiringPassed: runtimePathResult.runtimeWiringPassed,
      realPlatformPathPassed: runtimePathResult.realPlatformPathPassed,
      hasProductSignalViolations: productSignalResult.productSignalViolations.length > 0,
      phase3PolicyPassed: productSignalResult.phase3PolicyPassed,
      configValidationPassed: configResult.configValidationPassed,
      healthVisibilityPassed: healthVisibilityResult.healthVisibilityPassed,
    }),
  };
};