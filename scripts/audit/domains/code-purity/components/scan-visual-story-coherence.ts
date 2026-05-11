import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { fileExists, readTextFile } from "../../../core/filesystem.js";
import { pathFromRepoRoot } from "../../../core/paths.js";
import { createFinding } from "../../../core/result.js";
import type { Finding } from "../../../core/schema.js";
import { retiredMapCodePurityTokens } from "./retired-map-code-purity-tokens.js";
import { FORBIDDEN_RETIRED_PROMPT_BUILTIN_PATHS, inspectPromptContract, inspectPromptContractRegistry, LOCAL_AI_TASK_TYPES_PATH } from "./scan-visual-story-coherence-prompt-checks.js";

const VISUAL_STORY_COHERENCE_LAW_ID = "GRASSEYE-RETIRED-AUTHORITY-NO-REGRESSION-V1";
const {
  RETIRED_MAP_LAYER_OWNER,
  RETIRED_MAP_PLUGIN_PACKAGE_OWNER,
  RETIRED_ROUTE_LABEL_FIELD,
  RETIRED_ROUTE_PLAN_ID_FIELD,
  RETIRED_SELECTION_ID_FIELD,
  RETIRED_TASK_TEMPLATE_ID_FIELD,
} = retiredMapCodePurityTokens;

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
    oldToken: RETIRED_SELECTION_ID_FIELD,
    newToken: "selectedPlatforms",
    coherenceKind: "dual-entry-chain",
    message: `Active source must not keep ${RETIRED_SELECTION_ID_FIELD} and selectedPlatforms as dual task-entry chains.`,
  },
  {
    oldToken: RETIRED_TASK_TEMPLATE_ID_FIELD,
    newToken: "userRequirementText",
    coherenceKind: "dual-entry-chain",
    message: `Active source must not keep ${RETIRED_TASK_TEMPLATE_ID_FIELD} and userRequirementText as dual task-entry sources.`,
  },
  {
    oldToken: RETIRED_ROUTE_PLAN_ID_FIELD,
    newToken: "actionCode",
    coherenceKind: "dual-action-source",
    message: `Active source must not keep ${RETIRED_ROUTE_PLAN_ID_FIELD} and actionCode as dual action sources.`,
  },
  {
    oldToken: RETIRED_ROUTE_LABEL_FIELD,
    newToken: "actionCode",
    coherenceKind: "route-label-survivor",
    message: `Active source must not keep ${RETIRED_ROUTE_LABEL_FIELD} beside actionCode in the visual-story chain.`,
  },
] as const;

const GENERATED_CATALOG_PATH = "src/muscle-memory/catalog/muscle-memory-catalog.generated.json";
const PLATFORM_TARGET_REGISTRY_PATH = "src/visual-mission/platform-target-registry.ts";
const CI_FULL_SUMMARY_PATH = "scripts/audit/generated/ci-full-summary.generated.json";

const FORBIDDEN_RETIRED_BLUEPRINT_PATHS = [
  "docs/法案辅助文件/GrassEye 地图插件包治理施工图.md",
  "docs/法案辅助文件/GrassEye Map Prompt Contract Governance 施工图.md",
  "docs/法案辅助文件/GrassEye Map Authoring Input Package 施工图_FINAL.md",
  "docs/法案辅助文件/GrassEye Route Plan 肌肉记忆施工图.md",
] as const;

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
  ...(input.detail ? { detail: input.detail } : {}),
  zombieKind: input.coherenceKind,
  recommendedAction: input.recommendedAction,
});

type StoryOccurrence = { text: string; line: number; node: Node };

const collectOccurrences = (sourceFile: SourceFile): StoryOccurrence[] => [
  ...sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => ({ text: node.getText(), line: node.getStartLineNumber(), node })),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => ({ text: node.getLiteralText(), line: node.getStartLineNumber(), node })),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((node) => ({ text: node.getLiteralText(), line: node.getStartLineNumber(), node })),
];

const getPropertyAssignmentName = (node: Node): string | null => {
  if (!Node.isPropertyAssignment(node)) {
    return null;
  }

  const nameNode = node.getNameNode();
  if (Node.isIdentifier(nameNode)) {
    return nameNode.getText();
  }
  if (Node.isStringLiteral(nameNode) || Node.isNoSubstitutionTemplateLiteral(nameNode)) {
    return nameNode.getLiteralText();
  }

  return null;
};

const isPromptContractNegativeRuleOccurrence = (relativePath: string, occurrence: StoryOccurrence): boolean => {
  if (relativePath.startsWith("src/capabilities/ai/prompt-contracts/") && relativePath.endsWith(".prompt-contract.json")) {
    const propertyNames = occurrence.node
      .getAncestors()
      .map(getPropertyAssignmentName)
      .filter((name): name is string => name !== null);

    return propertyNames.includes("forbiddenOutputs")
      || (propertyNames.includes("outputSchema") && propertyNames.includes("forbidden"));
  }

  if (relativePath.startsWith("src/lib/local-ai/prompts/")) {
    return /(?:^|\b)(?:never|do not|must not|forbid|forbidden)\b/i.test(occurrence.text);
  }

  return false;
};

const findOccurrence = (
  relativePath: string,
  occurrences: StoryOccurrence[],
  token: string,
  options?: { ignoreNegativeRuleOccurrences?: boolean },
) => occurrences.find((entry) => entry.text.includes(token) && !(options?.ignoreNegativeRuleOccurrences && isPromptContractNegativeRuleOccurrence(relativePath, entry))) ?? null;

const findExactStringLiteral = (sourceFile: SourceFile, token: string) =>
  sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).find((node) => node.getLiteralText() === token) ?? null;

const inspectDualChains = (relativePath: string, sourceFile: SourceFile): Finding[] => {
  if (!isCoherencePath(relativePath)) {
    return [];
  }

  const findings: Finding[] = [];
  const occurrences = collectOccurrences(sourceFile);
  for (const rule of DUAL_CHAIN_RULES) {
    const oldOccurrence = findOccurrence(relativePath, occurrences, rule.oldToken, { ignoreNegativeRuleOccurrences: true });
    const newOccurrence = findOccurrence(relativePath, occurrences, rule.newToken);
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

const inspectForbiddenActiveFiles = async (input: {
  relativePaths: readonly string[];
  message: (relativePath: string) => string;
  recommendedAction: (relativePath: string) => string;
  coherenceKind: string;
}): Promise<Finding[]> => {
  const findings: Finding[] = [];
  for (const relativePath of input.relativePaths) {
    const absolutePath = pathFromRepoRoot(relativePath);
    if (!(await fileExists(absolutePath))) {
      continue;
    }

    findings.push(createCoherenceFinding({
      file: relativePath,
      line: 1,
      message: input.message(relativePath),
      detail: relativePath,
      coherenceKind: input.coherenceKind,
      recommendedAction: input.recommendedAction(relativePath),
    }));
  }
  return findings;
};

const inspectCiFullSummary = async (): Promise<Finding[]> => {
  if (process.env.GRASSEYE_CI_FULL_STEP_NAME === "code-purity") {
    return [];
  }

  const absolutePath = pathFromRepoRoot(CI_FULL_SUMMARY_PATH);
  if (!(await fileExists(absolutePath))) {
    return [];
  }

  const text = await readTextFile(absolutePath);
  const summary = JSON.parse(text) as {
    status?: string;
    layers?: Array<{ label?: string; steps?: Array<{ name?: string }> }>;
  };

  const findings: Finding[] = [];
  if (summary.layers?.some((layer) => layer.label === RETIRED_MAP_LAYER_OWNER)) {
    findings.push(createCoherenceFinding({
      file: CI_FULL_SUMMARY_PATH,
      line: findLineNumberForToken(text, JSON.stringify(RETIRED_MAP_LAYER_OWNER)),
      message: `CI-FULL generated summary must not retain ${RETIRED_MAP_LAYER_OWNER} after the visual-story cutover.`,
      detail: RETIRED_MAP_LAYER_OWNER,
      coherenceKind: "stale-generated-proof",
      recommendedAction: `Remove retired ${RETIRED_MAP_LAYER_OWNER} steps from the active CI-FULL plan and regenerate the summary.`,
    }));
  }

  if (summary.layers?.some((layer) => layer.steps?.some((step) => step.name === RETIRED_MAP_PLUGIN_PACKAGE_OWNER))) {
    findings.push(createCoherenceFinding({
      file: CI_FULL_SUMMARY_PATH,
      line: findLineNumberForToken(text, JSON.stringify(RETIRED_MAP_PLUGIN_PACKAGE_OWNER)),
      message: `CI-FULL generated summary must not retain ${RETIRED_MAP_PLUGIN_PACKAGE_OWNER} after the visual-story cutover.`,
      detail: RETIRED_MAP_PLUGIN_PACKAGE_OWNER,
      coherenceKind: "stale-generated-proof",
      recommendedAction: `Delete ${RETIRED_MAP_PLUGIN_PACKAGE_OWNER} from the active CI-FULL layers and regenerate the summary.`,
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
  requirePresence?: boolean;
}): Promise<Finding[]> => {
  const absolutePath = pathFromRepoRoot(input.relativePath);
  if (!(await fileExists(absolutePath))) {
    return [];
  }

  const text = await readTextFile(absolutePath);
  const hasToken = text.includes(input.token);
  if (input.requirePresence ? hasToken : !hasToken) {
    return [];
  }

  return [createCoherenceFinding({
    file: input.relativePath,
    line: input.requirePresence ? 1 : findLineNumberForToken(text, input.token),
    message: input.message,
    detail: input.token,
    coherenceKind: input.coherenceKind,
    recommendedAction: input.recommendedAction,
  })];
};

const inspectRetiredArtifacts = async (): Promise<Finding[]> => {
  const findings: Finding[] = [];
  findings.push(...await inspectForbiddenActiveFiles({
    relativePaths: FORBIDDEN_RETIRED_PROMPT_BUILTIN_PATHS,
    message: (relativePath) => `Retired AI prompt builtin must not survive in active source: ${relativePath}.`,
    recommendedAction: () => "Delete the builtin from src/capabilities/ai/prompt-contracts/builtins or move it to docs/archive/retired-ai-prompts/ outside the active registry.",
    coherenceKind: "retired-prompt-registry",
  }));
  findings.push(...await inspectForbiddenActiveFiles({
    relativePaths: FORBIDDEN_RETIRED_BLUEPRINT_PATHS,
    message: (relativePath) => `Retired map-system blueprint must not survive in active 法案辅助文件: ${relativePath}.`,
    recommendedAction: () => "Delete the active blueprint or move it under docs/archive so it no longer acts as production governance truth.",
    coherenceKind: "visual-story-drift",
  }));
  findings.push(...await inspectCiFullSummary());
  return findings;
};

const inspectTargetedVisualStoryFiles = async (): Promise<Finding[]> => [
  ...await inspectTargetedTextFile({
    relativePath: LOCAL_AI_TASK_TYPES_PATH,
    token: "visualMissionActionPlan.v1",
    message: "Local AI visual mission task request schemaVersion must use visualMissionActionPlan.v1.",
    coherenceKind: "visual-story-drift",
    recommendedAction: "Align src/types/local-ai.ts with the governed visual mission output schemaVersion.",
    requirePresence: true,
  }),
  ...await inspectTargetedTextFile({
    relativePath: GENERATED_CATALOG_PATH,
    token: "PREPARE_VISUAL_INPUT",
    message: "Generated MuscleMemoryCatalog must not retain PREPARE_VISUAL_INPUT after the visual-story actionCode rename.",
    coherenceKind: "visual-story-drift",
    recommendedAction: "Rebuild the muscle-memory catalog so PREPARE_VISUAL_MISSION_INPUT is the only active actionCode spelling.",
  }),
  ...await inspectTargetedTextFile({
    relativePath: PLATFORM_TARGET_REGISTRY_PATH,
    token: "openActionCode",
    message: "Platform target registry must not retain the retired openActionCode shadow field.",
    coherenceKind: "visual-story-drift",
    recommendedAction: "Delete openActionCode from platform-target-registry and keep only platform profile facts plus target defaults.",
  }),
];

export const inspectVisualStoryCoherence = async (
  relativePaths: string[],
  sourceFiles: Map<string, SourceFile>,
): Promise<Finding[]> => {
  const dualChainFindings = relativePaths.flatMap((relativePath) => {
    const sourceFile = sourceFiles.get(relativePath);
    return sourceFile ? inspectDualChains(relativePath, sourceFile) : [];
  });
  return [
    ...dualChainFindings,
    ...inspectPromptContractRegistry(sourceFiles),
    ...await inspectPromptContract(),
    ...await inspectRetiredArtifacts(),
    ...await inspectTargetedVisualStoryFiles(),
  ];
};