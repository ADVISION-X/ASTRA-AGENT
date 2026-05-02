import { Node, SyntaxKind, type Project, type SourceFile } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";

import { aiInspectionConstants } from "./inspection-constants.js";
import { aiInspectionUtils } from "./inspection-utils.js";

const { AI_ROOT } = aiInspectionConstants;
const { getSourceOrThrow } = aiInspectionUtils;
const PROMPT_POLICY_FIELDS = ["confidencePolicy", "reviewPolicy", "failurePolicy", "debugPolicy"] as const;

const hasPromptRegistryResolutionType = (sourceFile: SourceFile): boolean => {
  const resolveMethod = sourceFile.getInterface("AiPromptRegistryPort")?.getMethod("resolvePromptContract");
  return resolveMethod?.getReturnTypeNode()?.getText() === "AiPromptRegistryResolution"
    && sourceFile.getTypeAlias("AiPromptRegistryResolution") !== undefined;
};

const hasThrowStatement = (sourceFile: SourceFile): boolean => sourceFile.getDescendantsOfKind(SyntaxKind.ThrowStatement).length > 0;

const hasStringSchemaProperty = (
  sourceFile: SourceFile,
  schemaName: string,
  propertyName: (typeof PROMPT_POLICY_FIELDS)[number],
): boolean => {
  const declaration = sourceFile.getVariableDeclaration(schemaName);
  const schemaObject = declaration?.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression).at(0);
  const property = schemaObject?.getProperty(propertyName);
  return Node.isPropertyAssignment(property)
    && property.getInitializer()?.getText().startsWith("z.string") === true;
};

const hasStringTypeProperty = (
  sourceFile: SourceFile,
  typeName: string,
  propertyName: (typeof PROMPT_POLICY_FIELDS)[number],
): boolean => {
  const typeAlias = sourceFile.getTypeAlias(typeName);
  const property = typeAlias
    ?.getTypeNode()
    ?.getDescendantsOfKind(SyntaxKind.PropertySignature)
    .find((signature) => signature.getName() === propertyName);
  return property?.getTypeNode()?.getText() === "string";
};

const referencesPromptCatalogModule = (sourceFile: SourceFile, moduleSpecifier: string): boolean => {
  const hasImport = sourceFile.getImportDeclarations().some((declaration) => declaration.getModuleSpecifierValue() === moduleSpecifier);
  const hasExport = sourceFile.getExportDeclarations().some((declaration) => declaration.getModuleSpecifierValue() === moduleSpecifier);
  return hasImport || hasExport;
};

const usesPromptBridgeCall = (sourceFile: SourceFile, functionName: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((expression) => expression.getExpression().getText() === functionName);

const findPromptPolicyShapeViolations = (input: {
  promptRegistryPortSource: SourceFile;
  promptCatalogSchemaSource: SourceFile;
}): Finding[] => {
  const findings: Finding[] = [];
  if (!hasPromptRegistryResolutionType(input.promptRegistryPortSource)) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006A-V1", file: `${AI_ROOT}/ports/ai-prompt-registry-port.ts`, line: 1, severity: "fatal", message: "AI prompt registry port must expose a typed prompt resolution union." }));
  }
  if (PROMPT_POLICY_FIELDS.some((field) => hasStringSchemaProperty(input.promptCatalogSchemaSource, "PromptContractCatalogEntrySchema", field))) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006A-V1", file: `${AI_ROOT}/prompt-contracts/schema.ts`, line: 1, severity: "fatal", message: "Prompt contract catalog policies must be machine-readable objects, never free-form strings." }));
  }
  if (PROMPT_POLICY_FIELDS.some((field) => hasStringTypeProperty(input.promptRegistryPortSource, "ResolvedAiPromptContract", field))) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006A-V1", file: `${AI_ROOT}/ports/ai-prompt-registry-port.ts`, line: 1, severity: "fatal", message: "Resolved AI prompt contracts must expose structured prompt policy objects, never string policy fields." }));
  }
  return findings;
};

const findLocalPromptRegistryViolations = (sourceFile: SourceFile): Finding[] => {
  const findings: Finding[] = [];
  if (sourceFile.getVariableDeclaration("LOCAL_PROMPT_CONTRACTS") || !referencesPromptCatalogModule(sourceFile, "../../capabilities/ai/prompt-contracts/local-ai-task-contracts.js")) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006A-V1", file: "src/lib/local-ai/prompt-registry.ts", line: 1, severity: "fatal", message: "Local AI prompt registry must derive prompt metadata from the AI prompt contract catalog and must not keep a second local prompt catalog." }));
  }
  return findings;
};

const findLocalTaskContractViolations = (sourceFile: SourceFile): Finding[] => {
  if (PROMPT_POLICY_FIELDS.some((field) => hasStringTypeProperty(sourceFile, "PromptContract", field))) {
    return [createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006A-V1", file: `${AI_ROOT}/prompt-contracts/local-ai-task-contracts.ts`, line: 1, severity: "fatal", message: "Local AI prompt contract metadata must preserve structured prompt policy objects instead of string policy fields." })];
  }

  return [];
};

const findRuntimeMapperPromptViolations = (sourceFile: SourceFile): Finding[] => {
  if (
    referencesPromptCatalogModule(sourceFile, "../prompt-contracts/local-ai-task-contracts.js")
    && usesPromptBridgeCall(sourceFile, "resolvePromptContractCatalogEntryByLocalTaskType")
    && !usesPromptBridgeCall(sourceFile, "getPromptContractCatalogEntryByLocalTaskType")
  ) {
    return [];
  }

  return [createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006A-V1", file: `${AI_ROOT}/runtime-adapters/local-ai-runtime-mapper.ts`, line: 1, severity: "fatal", message: "Local AI runtime mapper must use governed typed prompt resolution and must not call throw-based legacy prompt helpers." })];
};

export const findPromptGovernanceViolations = (project: Project): Finding[] => {
  const promptRegistryPortSource = getSourceOrThrow(project, `${AI_ROOT}/ports/ai-prompt-registry-port.ts`);
  const promptCatalogSchemaSource = getSourceOrThrow(project, `${AI_ROOT}/prompt-contracts/schema.ts`);
  const promptRegistrySource = getSourceOrThrow(project, `${AI_ROOT}/runtime/ai-prompt-registry.ts`);
  const localPromptRegistrySource = getSourceOrThrow(project, "src/lib/local-ai/prompt-registry.ts");
  const localTaskContractSource = getSourceOrThrow(project, `${AI_ROOT}/prompt-contracts/local-ai-task-contracts.ts`);
  const localRuntimeMapperSource = getSourceOrThrow(project, `${AI_ROOT}/runtime-adapters/local-ai-runtime-mapper.ts`);

  return [
    ...findPromptPolicyShapeViolations({ promptRegistryPortSource, promptCatalogSchemaSource }),
    ...(hasThrowStatement(promptRegistrySource)
      ? [createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006A-V1", file: `${AI_ROOT}/runtime/ai-prompt-registry.ts`, line: 1, severity: "fatal", message: "AI prompt registry must return governed typed failures instead of throwing." })]
      : []),
    ...findLocalPromptRegistryViolations(localPromptRegistrySource),
    ...findLocalTaskContractViolations(localTaskContractSource),
    ...findRuntimeMapperPromptViolations(localRuntimeMapperSource),
  ];
};