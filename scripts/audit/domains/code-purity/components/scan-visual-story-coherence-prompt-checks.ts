import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { fileExists, readTextFile } from "../../../core/filesystem.js";
import { pathFromRepoRoot } from "../../../core/paths.js";
import { createFinding } from "../../../core/result.js";
import type { Finding } from "../../../core/schema.js";
import { retiredMapCodePurityTokens } from "./retired-map-code-purity-tokens.js";

const VISUAL_STORY_COHERENCE_LAW_ID = "GRASSEYE-CODE-PURITY-VISUAL-STORY-COHERENCE-001-V1";
const {
  RETIRED_ROUTE_LABEL_FIELD,
  RETIRED_ROUTE_PLAN_ID_FIELD,
  RETIRED_SELECTION_ID_FIELD,
  RETIRED_TASK_TEMPLATE_ID_FIELD,
} = retiredMapCodePurityTokens;

const PROMPT_CONTRACT_PATH = "src/capabilities/ai/prompt-contracts/builtins/visual-mission-action-plan-v1.prompt-contract.json";
const PROMPT_CONTRACT_REGISTRY_PATH = "src/capabilities/ai/prompt-contracts/registry.ts";
const FORBIDDEN_RETIRED_PROMPT_CONTRACT_FILES = [
  "map.authoring.v1.prompt-contract.json",
  "vision.pagePreparation.v1.prompt-contract.json",
  "vision.nextItemAdvanced.v1.prompt-contract.json",
  "vision.productPresence.v1.prompt-contract.json",
  "vision.nextItemTargetCandidate.v1.prompt-contract.json",
  "vision.commentsEntryTargetCandidate.v1.prompt-contract.json",
] as const;
const FORBIDDEN_RETIRED_PROMPT_OUTPUT_REQUIREMENTS = [
  {
    legacyToken: RETIRED_ROUTE_LABEL_FIELD,
    acceptedMarkers: [RETIRED_ROUTE_LABEL_FIELD, "retiredBranchToken"],
    message: "Visual mission prompt contract must forbid retired branch-token fields.",
    recommendedAction: "Keep forbiddenOutputs covering the retired branch-token marker and keep visual mission output limited to governed actionCode records.",
    coherenceKind: "route-label-survivor",
  },
  {
    legacyToken: RETIRED_ROUTE_PLAN_ID_FIELD,
    acceptedMarkers: [RETIRED_ROUTE_PLAN_ID_FIELD, "retiredRouteIdentifier"],
    message: "Visual mission prompt contract must forbid retired route identifier fields.",
    recommendedAction: "Keep forbiddenOutputs covering the retired route identifier marker and keep visual mission output limited to governed actionCode records.",
    coherenceKind: "visual-story-drift",
  },
  {
    legacyToken: RETIRED_SELECTION_ID_FIELD,
    acceptedMarkers: [RETIRED_SELECTION_ID_FIELD, "retiredSelectionIdentifier"],
    message: "Visual mission prompt contract must forbid retired selection identifier fields.",
    recommendedAction: "Keep forbiddenOutputs covering the retired selection marker and keep visual mission output limited to governed actionCode records.",
    coherenceKind: "visual-story-drift",
  },
  {
    legacyToken: RETIRED_TASK_TEMPLATE_ID_FIELD,
    acceptedMarkers: [RETIRED_TASK_TEMPLATE_ID_FIELD, "retiredTemplateIdentifier"],
    message: "Visual mission prompt contract must forbid retired template identifier fields.",
    recommendedAction: "Keep forbiddenOutputs covering the retired template marker and keep visual mission output limited to governed actionCode records.",
    coherenceKind: "visual-story-drift",
  },
  {
    legacyToken: "raw x",
    acceptedMarkers: ["raw x"],
    message: "Visual mission prompt contract must forbid raw x.",
    recommendedAction: "Keep raw x in forbiddenOutputs and keep visual mission output limited to governed actionCode records.",
    coherenceKind: "visual-story-drift",
  },
  {
    legacyToken: "raw y",
    acceptedMarkers: ["raw y"],
    message: "Visual mission prompt contract must forbid raw y.",
    recommendedAction: "Keep raw y in forbiddenOutputs and keep visual mission output limited to governed actionCode records.",
    coherenceKind: "visual-story-drift",
  },
] as const;

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

const findLineNumberForToken = (text: string, token: string): number => {
  const lineIndex = text.split(/\r?\n/u).findIndex((line) => line.includes(token));
  return lineIndex >= 0 ? lineIndex + 1 : 1;
};

const findExactStringLiteral = (sourceFile: SourceFile, token: string) =>
  sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).find((node) => node.getLiteralText() === token) ?? null;

const inspectRegistryImports = (sourceFile: SourceFile): Finding[] => {
  const findings: Finding[] = [];
  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    const moduleSpecifier = importDeclaration.getModuleSpecifierValue();
    if (!moduleSpecifier.includes("map-plugins/")) {
      continue;
    }
    findings.push(createCoherenceFinding({
      file: PROMPT_CONTRACT_REGISTRY_PATH,
      line: importDeclaration.getStartLineNumber(),
      message: "AI prompt contract registry must not import retired map-system templates or src/map-plugins/**.",
      detail: moduleSpecifier,
      coherenceKind: "retired-prompt-registry",
      recommendedAction: "Delete the src/map-plugins import and keep the active prompt catalog inside the Visual Mission AI boundary only.",
    }));
  }
  return findings;
};

const inspectCatalogVersion = (sourceFile: SourceFile): Finding[] => {
  const versionDeclaration = sourceFile.getVariableDeclaration("PROMPT_CONTRACT_CATALOG_VERSION");
  const initializer = versionDeclaration?.getInitializer();
  if (!(initializer && Node.isStringLiteral(initializer) && initializer.getLiteralValue().includes("map"))) {
    return [];
  }
  return [createCoherenceFinding({
    file: PROMPT_CONTRACT_REGISTRY_PATH,
    line: initializer.getStartLineNumber(),
    message: "AI prompt contract catalog version must not retain map vocabulary.",
    detail: initializer.getLiteralValue(),
    coherenceKind: "retired-prompt-registry",
    recommendedAction: "Rename the catalog version to ai-prompt-contract-catalog.v1 or visual-mission-prompt-contract-catalog.v1.",
  })];
};

const inspectRetiredPromptContractLiterals = (sourceFile: SourceFile): Finding[] =>
  FORBIDDEN_RETIRED_PROMPT_CONTRACT_FILES.flatMap((fileName) => {
    const literal = findExactStringLiteral(sourceFile, fileName);
    return literal
      ? [createCoherenceFinding({
        file: PROMPT_CONTRACT_REGISTRY_PATH,
        line: literal.getStartLineNumber(),
        message: `AI prompt contract registry must not register retired prompt contract ${fileName}.`,
        detail: fileName,
        coherenceKind: "retired-prompt-registry",
        recommendedAction: "Delete the retired prompt from the active registry and move history to docs/archive/retired-ai-prompts/ only if historical retention is required.",
      })]
      : [];
  });

type PromptContractDocument = {
  schemaVersion?: string;
  forbiddenOutputs?: string[];
  outputSchema?: { schemaVersion?: string; actions?: unknown };
};

const inspectPromptSchemaVersion = (text: string, contract: PromptContractDocument): Finding[] => {
  if (contract.schemaVersion === "visualMissionActionPlan.v1") {
    return [];
  }
  return [createCoherenceFinding({
    file: PROMPT_CONTRACT_PATH,
    line: findLineNumberForToken(text, '"schemaVersion"'),
    message: "Visual mission prompt contract schemaVersion must match visualMissionActionPlan.v1.",
    ...(contract.schemaVersion ? { detail: contract.schemaVersion } : {}),
    coherenceKind: "visual-story-drift",
    recommendedAction: "Set the prompt contract schemaVersion and outputSchema.schemaVersion to visualMissionActionPlan.v1 and regenerate the prompt contract hash.",
  })];
};

const inspectPromptForbiddenOutputs = (text: string, contract: PromptContractDocument): Finding[] => {
  const forbiddenOutputs = new Set(contract.forbiddenOutputs ?? []);
  return FORBIDDEN_RETIRED_PROMPT_OUTPUT_REQUIREMENTS.flatMap((requirement) =>
    requirement.acceptedMarkers.some((token) => forbiddenOutputs.has(token))
      ? []
      : [createCoherenceFinding({
        file: PROMPT_CONTRACT_PATH,
        line: findLineNumberForToken(text, '"forbiddenOutputs"'),
        message: requirement.message,
        detail: requirement.legacyToken,
        coherenceKind: requirement.coherenceKind,
        recommendedAction: requirement.recommendedAction,
      })],
  );
};

const inspectPromptOutputSchemaVersion = (text: string, contract: PromptContractDocument): Finding[] => {
  if (contract.outputSchema?.schemaVersion === "visualMissionActionPlan.v1") {
    return [];
  }
  return [createCoherenceFinding({
    file: PROMPT_CONTRACT_PATH,
    line: findLineNumberForToken(text, '"outputSchema"'),
    message: "Visual mission prompt contract outputSchema.schemaVersion must match visualMissionActionPlan.v1.",
    ...(contract.outputSchema?.schemaVersion ? { detail: contract.outputSchema.schemaVersion } : {}),
    coherenceKind: "visual-story-drift",
    recommendedAction: "Align outputSchema.schemaVersion with the governed visual mission output schema.",
  })];
};

export const inspectPromptContractRegistry = (sourceFiles: Map<string, SourceFile>): Finding[] => {
  const sourceFile = sourceFiles.get(PROMPT_CONTRACT_REGISTRY_PATH);
  if (!sourceFile) {
    return [];
  }
  return [
    ...inspectRegistryImports(sourceFile),
    ...inspectCatalogVersion(sourceFile),
    ...inspectRetiredPromptContractLiterals(sourceFile),
  ];
};

export const inspectPromptContract = async (): Promise<Finding[]> => {
  const absolutePath = pathFromRepoRoot(PROMPT_CONTRACT_PATH);
  if (!(await fileExists(absolutePath))) {
    return [];
  }
  const text = await readTextFile(absolutePath);
  const contract = JSON.parse(text) as PromptContractDocument;
  return [
    ...inspectPromptSchemaVersion(text, contract),
    ...inspectPromptForbiddenOutputs(text, contract),
    ...inspectPromptOutputSchemaVersion(text, contract),
  ];
};

export const FORBIDDEN_RETIRED_PROMPT_BUILTIN_PATHS = FORBIDDEN_RETIRED_PROMPT_CONTRACT_FILES.map(
  (fileName) => `src/capabilities/ai/prompt-contracts/builtins/${fileName}`,
);

export const LOCAL_AI_TASK_TYPES_PATH = "src/types/local-ai.ts";