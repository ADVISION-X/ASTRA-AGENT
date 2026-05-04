import {
  listFilesRecursive,
  readJsonFile,
  readTextFile,
} from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { kernelInspectionConstants } from "./inspection-constants.js";

type JsonRecord = Record<string, unknown>;
type BlueprintIdentity = {
  line: number;
  values: Map<string, string>;
  lineByKey: Map<string, number>;
};

type ForbiddenPromptKeyHit = {
  key: string;
  path: string;
};

const REQUIRED_BLUEPRINT_FIELDS = {
  owner: "ai-capability",
  relatedSupportDomain: "map-plugin-package",
  notAbilityGroup: "true",
} as const;

const REQUIRED_PROHIBITED_ACTIONS = ["click", "scroll", "type", "open_page", "dispatch_action"] as const;
const FORBIDDEN_MAP_PROMPT_KEYS = new Set(["rawPrompt", "systemPrompt", "userPrompt", "promptText"]);
const PROMPT_BINDING_ALLOWED_KEYS = new Set([
  "stepId",
  "promptContractId",
  "requiredInputRefs",
  "outputSchemaRef",
  "confidencePolicy",
  "reviewPolicy",
  "failureBranch",
]);

const {
  AI_PROMPT_CONTRACT_ROOT,
  MAP_PLUGIN_ROOT,
  PROMPT_CONTRACT_GOVERNANCE_BLUEPRINT_FILE,
  REQUIREMENT_ID_003,
} = kernelInspectionConstants;

const createRequirementFinding = (input: {
  file: string;
  line: number;
  message: string;
  detail?: string;
}): Finding => createFinding({
  lawId: REQUIREMENT_ID_003,
  file: input.file,
  line: input.line,
  severity: "fatal",
  message: input.message,
  ...(input.detail ? { detail: input.detail } : {}),
});

const asJsonRecord = (value: unknown): JsonRecord | null => {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return null;
  }

  return value as JsonRecord;
};

const parseFirstYamlFence = (content: string): BlueprintIdentity | null => {
  const lines = content.split(/\r?\n/);
  let fenceStart = -1;

  for (const [index, line] of lines.entries()) {
    if (line.trim() === "```yaml") {
      fenceStart = index;
      break;
    }
  }

  if (fenceStart === -1) {
    return null;
  }

  const values = new Map<string, string>();
  const lineByKey = new Map<string, number>();
  for (let index = fenceStart + 1; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? "";
    if (rawLine.trim() === "```") {
      return {
        line: fenceStart + 1,
        values,
        lineByKey,
      };
    }

    const separatorIndex = rawLine.indexOf(":");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = rawLine.slice(0, separatorIndex).trim();
    const value = rawLine.slice(separatorIndex + 1).trim();
    if (!key) {
      continue;
    }

    values.set(key, value);
    lineByKey.set(key, index + 1);
  }

  return null;
};

async function collectBlueprintIdentityFindings(): Promise<Finding[]> {
  const relativeFile = PROMPT_CONTRACT_GOVERNANCE_BLUEPRINT_FILE;
  const content = await readTextFile(pathFromRepoRoot(relativeFile));
  const identity = parseFirstYamlFence(content);
  if (!identity) {
    return [createRequirementFinding({
      file: relativeFile,
      line: 1,
      message: "Prompt contract governance blueprint must declare ai-capability ownership and map-plugin-package reference-only status.",
      detail: "Missing or malformed YAML identity fence.",
    })];
  }

  const mismatches = Object.entries(REQUIRED_BLUEPRINT_FIELDS)
    .filter(([key, expected]) => identity.values.get(key) !== expected)
    .map(([key, expected]) => `${key}=${identity.values.get(key) ?? "<missing>"}, expected=${expected}`);

  if (mismatches.length === 0) {
    return [];
  }

  const firstMismatchedKey = Object.keys(REQUIRED_BLUEPRINT_FIELDS)
    .find((key) => identity.values.get(key) !== REQUIRED_BLUEPRINT_FIELDS[key as keyof typeof REQUIRED_BLUEPRINT_FIELDS]);

  return [createRequirementFinding({
    file: relativeFile,
    line: firstMismatchedKey ? (identity.lineByKey.get(firstMismatchedKey) ?? identity.line) : identity.line,
    message: "Prompt contract governance blueprint must declare ai-capability ownership and map-plugin-package reference-only status.",
    detail: mismatches.join("; "),
  })];
}

async function collectPromptContractCatalogFindings(): Promise<Finding[]> {
  const findings: Finding[] = [];
  const allJsonFiles = await listFilesRecursive(pathFromRepoRoot("src"), { extensions: [".json"] });
  const promptContractFiles = allJsonFiles.filter((filePath) => filePath.endsWith(".prompt-contract.json"));
  const outsideAiRoot = promptContractFiles
    .map((filePath) => toRepoRelativePath(filePath))
    .filter((relativePath) => !relativePath.startsWith(`${AI_PROMPT_CONTRACT_ROOT}/`));

  if (outsideAiRoot.length > 0) {
    findings.push(createRequirementFinding({
      file: outsideAiRoot[0] ?? "src",
      line: 1,
      message: "Prompt contracts must live only under the AI capability prompt-contract catalog.",
      detail: outsideAiRoot.join(", "),
    }));
  }

  const aiPromptContractFiles = promptContractFiles
    .filter((filePath) => toRepoRelativePath(filePath).startsWith(`${AI_PROMPT_CONTRACT_ROOT}/`))
    .sort();

  if (aiPromptContractFiles.length === 0) {
    findings.push(createRequirementFinding({
      file: AI_PROMPT_CONTRACT_ROOT,
      line: 1,
      message: "Prompt contracts must live only under the AI capability prompt-contract catalog.",
      detail: "No governed prompt contract JSON files were found.",
    }));
    return findings;
  }

  for (const filePath of aiPromptContractFiles) {
    const relativeFile = toRepoRelativePath(filePath);
    const contract = asJsonRecord(await readJsonFile<unknown>(filePath));
    if (!contract) {
      findings.push(createRequirementFinding({
        file: relativeFile,
        line: 1,
        message: "AI prompt contract files must remain machine-readable data contracts.",
      }));
      continue;
    }

    const promptContractId = typeof contract.promptContractId === "string"
      ? contract.promptContractId
      : null;
    const prohibitedActions = Array.isArray(contract.prohibitedActions)
      ? contract.prohibitedActions.filter((item): item is string => typeof item === "string")
      : null;

    if (!promptContractId) {
      findings.push(createRequirementFinding({
        file: relativeFile,
        line: 1,
        message: "AI prompt contract files must remain machine-readable data contracts.",
        detail: "Missing promptContractId.",
      }));
      continue;
    }

    if (!prohibitedActions) {
      findings.push(createRequirementFinding({
        file: relativeFile,
        line: 1,
        message: `Prompt contract ${promptContractId} must prohibit executing actions.`,
        detail: "Missing prohibitedActions array.",
      }));
      continue;
    }

    const missingActions = REQUIRED_PROHIBITED_ACTIONS.filter((action) => !prohibitedActions.includes(action));
    if (missingActions.length > 0) {
      findings.push(createRequirementFinding({
        file: relativeFile,
        line: 1,
        message: `Prompt contract ${promptContractId} must prohibit executing actions.`,
        detail: `missing prohibitedActions: ${missingActions.join(", ")}`,
      }));
    }
  }

  return findings;
}

const collectForbiddenPromptKeyHits = (
  value: unknown,
  currentPath: string,
  hits: ForbiddenPromptKeyHit[],
): void => {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      collectForbiddenPromptKeyHits(item, `${currentPath}[${index}]`, hits);
    }
    return;
  }

  const record = asJsonRecord(value);
  if (!record) {
    return;
  }

  for (const [key, child] of Object.entries(record)) {
    const nextPath = currentPath ? `${currentPath}.${key}` : key;
    if (FORBIDDEN_MAP_PROMPT_KEYS.has(key)) {
      hits.push({ key, path: nextPath });
    }
    collectForbiddenPromptKeyHits(child, nextPath, hits);
  }
};

async function collectMapPackagePromptFindings(): Promise<Finding[]> {
  const findings: Finding[] = [];
  const mapPackageFiles = (await listFilesRecursive(pathFromRepoRoot(MAP_PLUGIN_ROOT), { extensions: [".json"] }))
    .filter((filePath) => filePath.endsWith(".map-package.json"))
    .sort();

  for (const filePath of mapPackageFiles) {
    const relativeFile = toRepoRelativePath(filePath);
    const mapPackage = asJsonRecord(await readJsonFile<unknown>(filePath));
    if (!mapPackage) {
      findings.push(createRequirementFinding({
        file: relativeFile,
        line: 1,
        message: "Map packages must remain machine-readable prompt reference data.",
      }));
      continue;
    }

    const forbiddenPromptKeyHits: ForbiddenPromptKeyHit[] = [];
    collectForbiddenPromptKeyHits(mapPackage, "", forbiddenPromptKeyHits);
    if (forbiddenPromptKeyHits.length > 0) {
      findings.push(createRequirementFinding({
        file: relativeFile,
        line: 1,
        message: "Map packages must reference promptContractId only; raw prompt fields are forbidden in map packages.",
        detail: forbiddenPromptKeyHits.map((hit) => `${hit.key}@${hit.path}`).join(", "),
      }));
    }

    const promptBindingsRecord = asJsonRecord(mapPackage.promptBindings);
    const bindings = Array.isArray(promptBindingsRecord?.bindings) ? promptBindingsRecord.bindings : [];
    const bindingProblems: string[] = [];

    for (const [index, binding] of bindings.entries()) {
      const bindingRecord = asJsonRecord(binding);
      const bindingPath = `promptBindings.bindings[${index}]`;
      if (!bindingRecord) {
        bindingProblems.push(`${bindingPath}=non-object`);
        continue;
      }

      if (typeof bindingRecord.promptContractId !== "string" || bindingRecord.promptContractId.length === 0) {
        bindingProblems.push(`${bindingPath}.promptContractId=<missing>`);
      }

      const unexpectedKeys = Object.keys(bindingRecord).filter((key) => !PROMPT_BINDING_ALLOWED_KEYS.has(key));
      if (unexpectedKeys.length > 0) {
        bindingProblems.push(`${bindingPath} unexpected keys: ${unexpectedKeys.join(", ")}`);
      }
    }

    if (bindingProblems.length > 0) {
      findings.push(createRequirementFinding({
        file: relativeFile,
        line: 1,
        message: "Map packages must reference promptContractId only; prompt bindings must stay reference-only.",
        detail: bindingProblems.join("; "),
      }));
    }
  }

  return findings;
}

export async function runPromptContractRoutingChecks(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const [blueprintFindings, promptContractFindings, mapPackageFindings] = await Promise.all([
    collectBlueprintIdentityFindings(),
    collectPromptContractCatalogFindings(),
    collectMapPackagePromptFindings(),
  ]);

  return {
    findings: [
      ...blueprintFindings,
      ...promptContractFindings,
      ...mapPackageFindings,
    ],
    phases: [
      createPhase(
        "prompt-contract-governance-identity",
        blueprintFindings.length === 0 ? "PASS" : "CODE VIOLATION",
        blueprintFindings.length === 0,
        blueprintFindings.length === 0
          ? "Prompt contract governance blueprint keeps AI ownership and map reference-only identity."
          : "Prompt contract governance blueprint drifted away from the required AI owner and map reference-only identity.",
      ),
      createPhase(
        "prompt-contract-catalog-routing",
        promptContractFindings.length === 0 ? "PASS" : "CODE VIOLATION",
        promptContractFindings.length === 0,
        promptContractFindings.length === 0
          ? "Prompt contracts stay inside AI-owned catalog files and explicitly prohibit action execution."
          : "Prompt contract files drifted outside AI ownership or lost action-execution prohibitions.",
      ),
      createPhase(
        "map-package-prompt-reference-only",
        mapPackageFindings.length === 0 ? "PASS" : "CODE VIOLATION",
        mapPackageFindings.length === 0,
        mapPackageFindings.length === 0
          ? "Map packages keep prompt bindings reference-only and do not embed prompt bodies."
          : "Map packages embed prompt bodies or drift away from reference-only prompt bindings.",
      ),
    ],
  };
}