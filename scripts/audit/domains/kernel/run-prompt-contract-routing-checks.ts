import {
  readTextFile,
} from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { kernelInspectionConstants } from "./inspection-constants.js";
import { collectPromptContractCatalogFindings } from "./prompt-contract-catalog-checks.js";

type BlueprintIdentity = {
  line: number;
  values: Map<string, string>;
  lineByKey: Map<string, number>;
};

const REQUIRED_BLUEPRINT_FIELDS = {
  owner: "ai-capability",
  notAbilityGroup: "true",
} as const;

const {
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
      message: "Prompt contract governance blueprint must declare ai-capability ownership and retired-map-free identity.",
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
    message: "Prompt contract governance blueprint must declare ai-capability ownership and retired-map-free identity.",
    detail: mismatches.join("; "),
  })];
}

export async function runPromptContractRoutingChecks(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const [blueprintFindings, promptContractFindings] = await Promise.all([
    collectBlueprintIdentityFindings(),
    collectPromptContractCatalogFindings(),
  ]);

  return {
    findings: [
      ...blueprintFindings,
      ...promptContractFindings,
    ],
    phases: [
      createPhase(
        "prompt-contract-governance-identity",
        blueprintFindings.length === 0 ? "PASS" : "CODE VIOLATION",
        blueprintFindings.length === 0,
        blueprintFindings.length === 0
          ? "Prompt contract governance blueprint keeps AI ownership and retired-map-free identity."
          : "Prompt contract governance blueprint drifted away from the required AI owner and retired-map-free identity.",
      ),
      createPhase(
        "prompt-contract-catalog-routing",
        promptContractFindings.length === 0 ? "PASS" : "CODE VIOLATION",
        promptContractFindings.length === 0,
        promptContractFindings.length === 0
          ? "Prompt contracts stay inside AI-owned catalog files and explicitly prohibit action execution."
          : "Prompt contract files drifted outside AI ownership or lost action-execution prohibitions.",
      ),
    ],
  };
}