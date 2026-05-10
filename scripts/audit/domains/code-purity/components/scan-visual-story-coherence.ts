import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { fileExists, readTextFile } from "../../../core/filesystem.js";
import { pathFromRepoRoot } from "../../../core/paths.js";
import { createFinding } from "../../../core/result.js";
import type { Finding } from "../../../core/schema.js";

const VISUAL_STORY_COHERENCE_LAW_ID = "GRASSEYE-CODE-PURITY-VISUAL-STORY-COHERENCE-001-V1";

const COHERENCE_PATH_PREFIXES = [
  "src/app/",
  "src/lib/local-app-shell/",
  "src/lib/local-ai/",
  "src/lib/local-runtime/",
  "src/capabilities/ai/",
  "src/muscle-memory/",
  "src/platforms/",
  "src/visual-mission/",
] as const;

const DUAL_CHAIN_RULES = [
  {
    oldToken: "selectedMapId",
    newToken: "selectedPlatforms",
    coherenceKind: "dual-entry-chain",
    message: "Active source must not keep selectedMapId and selectedPlatforms as dual task-entry chains.",
  },
  {
    oldToken: "taskTemplateId",
    newToken: "userRequirementText",
    coherenceKind: "dual-entry-chain",
    message: "Active source must not keep taskTemplateId and userRequirementText as dual task-entry sources.",
  },
  {
    oldToken: "routePlanId",
    newToken: "actionCode",
    coherenceKind: "dual-action-source",
    message: "Active source must not keep routePlanId and actionCode as dual action sources.",
  },
  {
    oldToken: "routeLabel",
    newToken: "actionCode",
    coherenceKind: "route-label-survivor",
    message: "Active source must not keep routeLabel beside actionCode in the visual-story chain.",
  },
] as const;

const PROMPT_CONTRACT_PATH = "src/capabilities/ai/prompt-contracts/builtins/visual-mission-action-plan-v1.prompt-contract.json";
const LOCAL_AI_TASK_TYPES_PATH = "src/types/local-ai.ts";
const GENERATED_CATALOG_PATH = "src/muscle-memory/catalog/muscle-memory-catalog.generated.json";
const PLATFORM_TARGET_REGISTRY_PATH = "src/visual-mission/platform-target-registry.ts";

const isCoherencePath = (relativePath: string): boolean =>
  COHERENCE_PATH_PREFIXES.some((prefix) => relativePath.startsWith(prefix));

const createCoherenceFinding = (input: {
  file: string;
  line: number;
  message: string;
  detail?: string;
  coherenceKind: string;
  recommendedAction: string;
}): Finding => createFinding({
  lawId: VISUAL_STORY_COHERENCE_LAW_ID,
  file: input.file,
  line: input.line,
  severity: "fatal",
  message: input.message,
  detail: input.detail,
  zombieKind: input.coherenceKind,
  recommendedAction: input.recommendedAction,
});

const collectOccurrences = (sourceFile: SourceFile): Array<{ text: string; line: number }> => [
  ...sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => ({ text: node.getText(), line: node.getStartLineNumber() })),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => ({ text: node.getLiteralText(), line: node.getStartLineNumber() })),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((node) => ({ text: node.getLiteralText(), line: node.getStartLineNumber() })),
];

const findOccurrence = (occurrences: Array<{ text: string; line: number }>, token: string) =>
  occurrences.find((entry) => entry.text.includes(token)) ?? null;

const inspectDualChains = (relativePath: string, sourceFile: SourceFile): Finding[] => {
  if (!isCoherencePath(relativePath)) {
    return [];
  }

  const findings: Finding[] = [];
  const occurrences = collectOccurrences(sourceFile);
  for (const rule of DUAL_CHAIN_RULES) {
    const oldOccurrence = findOccurrence(occurrences, rule.oldToken);
    const newOccurrence = findOccurrence(occurrences, rule.newToken);
    if (!oldOccurrence || !newOccurrence) {
      continue;
    }

    findings.push(createCoherenceFinding({
      file: relativePath,
      line: oldOccurrence.line,
      message: rule.message,
      detail: `${rule.oldToken} + ${rule.newToken}`,
      coherenceKind: rule.coherenceKind,
      recommendedAction: `Delete ${rule.oldToken} from ${relativePath} and keep the APP -> PlatformRegistry -> actionCode visual-story chain only.`,
    }));
  }

  return findings;
};

const findLineNumberForToken = (text: string, token: string): number => {
  const lineIndex = text.split(/\r?\n/u).findIndex((line) => line.includes(token));
  return lineIndex >= 0 ? lineIndex + 1 : 1;
};

const inspectPromptContract = async (): Promise<Finding[]> => {
  const absolutePath = pathFromRepoRoot(PROMPT_CONTRACT_PATH);
  if (!(await fileExists(absolutePath))) {
    return [];
  }

  const text = await readTextFile(absolutePath);
  const contract = JSON.parse(text) as {
    schemaVersion?: string;
    forbiddenOutputs?: string[];
    outputSchema?: { schemaVersion?: string; actions?: unknown };
  };

  const findings: Finding[] = [];
  if (contract.schemaVersion !== "visualMissionActionPlan.v1") {
    findings.push(createCoherenceFinding({
      file: PROMPT_CONTRACT_PATH,
      line: findLineNumberForToken(text, '"schemaVersion"'),
      message: "Visual mission prompt contract schemaVersion must match visualMissionActionPlan.v1.",
      detail: contract.schemaVersion,
      coherenceKind: "visual-story-drift",
      recommendedAction: "Set the prompt contract schemaVersion and outputSchema.schemaVersion to visualMissionActionPlan.v1 and regenerate the prompt contract hash.",
    }));
  }

  const forbiddenOutputs = new Set(contract.forbiddenOutputs ?? []);
  for (const token of ["routeLabel", "routePlanId", "selectedMapId", "taskTemplateId", "raw x", "raw y"]) {
    if (forbiddenOutputs.has(token)) {
      continue;
    }
    findings.push(createCoherenceFinding({
      file: PROMPT_CONTRACT_PATH,
      line: findLineNumberForToken(text, '"forbiddenOutputs"'),
      message: `Visual mission prompt contract must forbid ${token}.`,
      detail: token,
      coherenceKind: token === "routeLabel" ? "route-label-survivor" : "visual-story-drift",
      recommendedAction: `Add ${token} to forbiddenOutputs and keep visual mission output limited to governed actionCode records.`,
    }));
  }

  if (contract.outputSchema?.schemaVersion !== "visualMissionActionPlan.v1") {
    findings.push(createCoherenceFinding({
      file: PROMPT_CONTRACT_PATH,
      line: findLineNumberForToken(text, '"outputSchema"'),
      message: "Visual mission prompt contract outputSchema.schemaVersion must match visualMissionActionPlan.v1.",
      detail: contract.outputSchema?.schemaVersion,
      coherenceKind: "visual-story-drift",
      recommendedAction: "Align outputSchema.schemaVersion with the governed visual mission output schema.",
    }));
  }

  return findings;
};

const inspectTargetedTextFile = async (input: {
  relativePath: string;
  token: string;
  message: string;
  coherenceKind: string;
  recommendedAction: string;
}): Promise<Finding[]> => {
  const absolutePath = pathFromRepoRoot(input.relativePath);
  if (!(await fileExists(absolutePath))) {
    return [];
  }

  const text = await readTextFile(absolutePath);
  if (!text.includes(input.token)) {
    return [];
  }

  return [createCoherenceFinding({
    file: input.relativePath,
    line: findLineNumberForToken(text, input.token),
    message: input.message,
    detail: input.token,
    coherenceKind: input.coherenceKind,
    recommendedAction: input.recommendedAction,
  })];
};

export const inspectVisualStoryCoherence = async (
  relativePaths: string[],
  sourceFiles: Map<string, SourceFile>,
): Promise<Finding[]> => {
  const findings: Finding[] = [];

  for (const relativePath of relativePaths) {
    const sourceFile = sourceFiles.get(relativePath);
    if (!sourceFile) {
      continue;
    }
    findings.push(...inspectDualChains(relativePath, sourceFile));
  }

  findings.push(...await inspectPromptContract());
  findings.push(...await inspectTargetedTextFile({
    relativePath: LOCAL_AI_TASK_TYPES_PATH,
    token: "visual-mission-action-plan.schema.v1",
    message: "Local AI visual mission task request schemaVersion must use visualMissionActionPlan.v1.",
    coherenceKind: "visual-story-drift",
    recommendedAction: "Align src/types/local-ai.ts with the governed visual mission output schemaVersion.",
  }));
  findings.push(...await inspectTargetedTextFile({
    relativePath: GENERATED_CATALOG_PATH,
    token: "PREPARE_VISUAL_INPUT",
    message: "Generated MuscleMemoryCatalog must not retain PREPARE_VISUAL_INPUT after the visual-story actionCode rename.",
    coherenceKind: "visual-story-drift",
    recommendedAction: "Rebuild the muscle-memory catalog so PREPARE_VISUAL_MISSION_INPUT is the only active actionCode spelling.",
  }));
  findings.push(...await inspectTargetedTextFile({
    relativePath: PLATFORM_TARGET_REGISTRY_PATH,
    token: "openActionCode",
    message: "Platform target registry must not retain the retired openActionCode shadow field.",
    coherenceKind: "visual-story-drift",
    recommendedAction: "Delete openActionCode from platform-target-registry and keep only platform profile facts plus target defaults.",
  }));

  return findings;
};