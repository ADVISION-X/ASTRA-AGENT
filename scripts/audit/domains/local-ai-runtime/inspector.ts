import { ZodError } from "zod";

import { validateLocalAiModelConfig } from "../../../../src/lib/local-ai/model-config.js";
import { createFinding, createPhase } from "../../core/result.js";
import { fileExists, listFilesRecursive, readJsonFile, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { scanFilesForPatterns } from "../_shared/scan-for-patterns.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

const CONFIG_PATH = "config/local-ai.models.json";
const GATEWAY_PATH = "src/lib/local-ai/local-ai-gateway.ts";
const MODEL_CONFIG_PATH = "src/lib/local-ai/model-config.ts";
const PROMPT_REGISTRY_PATH = "src/lib/local-ai/prompt-registry.ts";

export default createPendingDomainInspector({
  inspector: "GrassEye Local AI Runtime Owner Inspector",
  inspectorId: "local-ai-runtime-owner",
  capabilityDomain: "local-ai-runtime",
  inspectorEntry: "scripts/audit/domains/local-ai-runtime/inspector.ts",
  ownedPaths: ["src/lib/local-ai"],
  pendingSummary: "local-ai-runtime implementation pending; manual-first law only; no local-AI code-level enforcement yet",
  implementedSummary: "local AI runtime is implemented through a governed gateway and prompt registry",
  extraChecks: async () => {
    const sourceFiles = await listFilesRecursive(pathFromRepoRoot("src"), { extensions: [".ts"] });
    const gatewaySource = await readTextFile(pathFromRepoRoot(GATEWAY_PATH));
    const promptRegistrySource = await readTextFile(pathFromRepoRoot(PROMPT_REGISTRY_PATH));
    const modelConfigSource = await readTextFile(pathFromRepoRoot(MODEL_CONFIG_PATH));
    const findings = [];

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
      }
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
      ],
    };
  },
});