import { SyntaxKind, type Project } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getSourceFileOrThrow, toRelativeSourcePath } from "../../core/ts-morph.js";

const SYSTEM_MANUAL_PATH = "src/muscle-memory/system-manual.ts";
const VISUAL_MISSION_TYPES_PATH = "src/types/visual-mission-action-plan.ts";
const EXECUTABLE_PLAN_WRAPPER_PATH = "src/muscle-memory/decoder/action-plan.schema.ts";
const AI_OUTPUT_SCHEMA_PATH = "src/visual-mission/action-plan/ai-output.schema.ts";
const PLATFORM_REGISTRY_PATH = "src/visual-mission/platform-target-registry.ts";
const PROMPT_BUILDER_PATH = "src/capabilities/ai/prompt-contracts/visual-mission-action-plan/prompt-builder.ts";
const PROMPT_CONTRACT_PATH = "src/capabilities/ai/prompt-contracts/builtins/visual-mission-action-plan-v1.prompt-contract.json";

const createCatalogSsotFinding = (file: string, message: string): Finding => createFinding({
  lawId: "GRASSEYE-AI-CAPABILITY-002-V1",
  file,
  line: 1,
  severity: "fatal",
  message,
});

const collectSystemManualSsotFindings = (input: {
  systemManualSource: ReturnType<typeof getSourceFileOrThrow>;
  visualMissionTypesSource: ReturnType<typeof getSourceFileOrThrow>;
  executablePlanWrapperSource: ReturnType<typeof getSourceFileOrThrow>;
}): Finding[] => {
  const findings: Finding[] = [];

  if (!input.systemManualSource.getFullText().includes("listAiActionPlanEntries(")) {
    findings.push(createCatalogSsotFinding(toRelativeSourcePath(input.systemManualSource), "Visual mission system manual must source governed action blocks from the generated muscle-memory catalog SSOT."));
  }
  if (!input.visualMissionTypesSource.getFullText().includes("../visual-mission/action-plan/ai-output.schema.js")) {
    findings.push(createCatalogSsotFinding(toRelativeSourcePath(input.visualMissionTypesSource), "Visual mission public request/output types must re-export the canonical AI output schema module."));
  }
  if (!input.executablePlanWrapperSource.getFullText().includes("../../visual-mission/action-plan/executable-plan.schema.js")) {
    findings.push(createCatalogSsotFinding(toRelativeSourcePath(input.executablePlanWrapperSource), "Visual mission executable plan wrapper must re-export the canonical executable plan schema module."));
  }

  return findings;
};

const collectPlatformSchemaSsotFindings = (input: {
  aiOutputSchemaSource: ReturnType<typeof getSourceFileOrThrow>;
  platformRegistrySource: ReturnType<typeof getSourceFileOrThrow>;
}): Finding[] => {
  return [
    ...collectPlatformRegistrySsotFindings(input.platformRegistrySource),
    ...collectAiOutputSchemaSsotFindings(input.aiOutputSchemaSource),
  ];
};

const collectPlatformRegistrySsotFindings = (
  platformRegistrySource: ReturnType<typeof getSourceFileOrThrow>,
): Finding[] => {
  const findings: Finding[] = [];
  const platformRegistryText = platformRegistrySource.getFullText();

  if (!platformRegistryText.includes("export const VISUAL_MISSION_PLATFORM_IDS") || !platformRegistryText.includes('"facebook-web"') || !platformRegistryText.includes('"tiktok-web"')) {
    findings.push(createCatalogSsotFinding(toRelativeSourcePath(platformRegistrySource), "Visual mission platform-target-registry must publish the governed platform id list as the SSOT for schema consumers."));
  }

  return findings;
};

const collectAiOutputSchemaSsotFindings = (
  aiOutputSchemaSource: ReturnType<typeof getSourceFileOrThrow>,
): Finding[] => {
  const findings: Finding[] = [];
  const platformRegistryImport = aiOutputSchemaSource.getImportDeclaration((declaration) => declaration.getModuleSpecifierValue() === "../platform-target-registry.js");
  const importsPlatformIds = platformRegistryImport?.getNamedImports().some((specifier) => specifier.getName() === "VISUAL_MISSION_PLATFORM_IDS") ?? false;
  const platformSchemaDeclaration = aiOutputSchemaSource.getVariableDeclaration("VisualMissionPlatformSchema");
  const platformSchemaInitializer = platformSchemaDeclaration?.getInitializerIfKind(SyntaxKind.CallExpression);
  const aiOutputText = aiOutputSchemaSource.getFullText();

  if (!importsPlatformIds || platformSchemaInitializer?.getArguments()[0]?.getText() !== "VISUAL_MISSION_PLATFORM_IDS") {
    findings.push(createCatalogSsotFinding(toRelativeSourcePath(aiOutputSchemaSource), "Visual mission AI output schema must derive platform ids from visual-mission/platform-target-registry instead of hardcoding a second enum."));
  }
  if (!aiOutputSchemaSource.getFullText().includes("isAiActionPlanAllowedActionCode")) {
    findings.push(createCatalogSsotFinding(toRelativeSourcePath(aiOutputSchemaSource), "Visual mission AI output schema must gate actionCode through the generated catalog allow-list."));
  }
  if (!aiOutputText.includes("nonExecutableClickTargets") || aiOutputText.includes("clickTargets: z.array(")) {
    findings.push(createCatalogSsotFinding(toRelativeSourcePath(aiOutputSchemaSource), "Visual mission AI output schema must expose nonExecutableClickTargets only and must not keep clickTargets as an execution-shaped field."));
  }

  return findings;
};

const collectPromptSurfaceSsotFindings = (input: {
  promptBuilderSource: ReturnType<typeof getSourceFileOrThrow>;
  promptContractSource: ReturnType<typeof getSourceFileOrThrow>;
}): Finding[] => {
  const findings: Finding[] = [];
  const promptBuilderText = input.promptBuilderSource.getFullText();
  const promptContractText = input.promptContractSource.getFullText();

  if (!promptBuilderText.includes("Execution uses actions[] only.") || !promptBuilderText.includes("nonExecutableClickTargets") || promptBuilderText.includes('"clickTargets"')) {
    findings.push(createCatalogSsotFinding(toRelativeSourcePath(input.promptBuilderSource), "Visual mission prompt builder must describe nonExecutableClickTargets as hint-only and keep actions[] as the only execution source."));
  }
  if (!promptContractText.includes("nonExecutableClickTargets") || promptContractText.includes('"clickTargets"')) {
    findings.push(createCatalogSsotFinding(toRelativeSourcePath(input.promptContractSource), "Visual mission prompt contract must publish nonExecutableClickTargets as a hint-only field and must not keep clickTargets in the active output schema."));
  }

  return findings;
};

export const inspectVisualMissionCatalogSsot = (project: Project): Finding[] => {
  const systemManualSource = getSourceFileOrThrow(project, SYSTEM_MANUAL_PATH);
  const visualMissionTypesSource = getSourceFileOrThrow(project, VISUAL_MISSION_TYPES_PATH);
  const executablePlanWrapperSource = getSourceFileOrThrow(project, EXECUTABLE_PLAN_WRAPPER_PATH);
  const aiOutputSchemaSource = getSourceFileOrThrow(project, AI_OUTPUT_SCHEMA_PATH);
  const platformRegistrySource = getSourceFileOrThrow(project, PLATFORM_REGISTRY_PATH);
  const promptBuilderSource = getSourceFileOrThrow(project, PROMPT_BUILDER_PATH);
  const promptContractSource = getSourceFileOrThrow(project, PROMPT_CONTRACT_PATH);
  return [
    ...collectSystemManualSsotFindings({ systemManualSource, visualMissionTypesSource, executablePlanWrapperSource }),
    ...collectPlatformSchemaSsotFindings({ aiOutputSchemaSource, platformRegistrySource }),
    ...collectPromptSurfaceSsotFindings({ promptBuilderSource, promptContractSource }),
  ];
};