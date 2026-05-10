import { Node, SyntaxKind, type Project, type SourceFile } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { hasImportModuleSpecifier } from "../_shared/ast-helpers.js";
import {
  RETIRED_ACTIVATION_REF_FIELD,
  RETIRED_PACKAGE_ID_FIELD,
  RETIRED_PACKAGE_VERSION_FIELD,
  RETIRED_SELECTION_ID_FIELD,
  RETIRED_SELECTION_VERSION_FIELD,
} from "../_shared/retired-map-field-names.js";

import { aiInspectionConstants } from "./inspection-constants.js";
import { aiInspectionUtils } from "./inspection-utils.js";

const { AI_ROOT } = aiInspectionConstants;
const { getSourceOrThrow } = aiInspectionUtils;

const REQUIRED_CHAIN_FIELD_NAMES = [
  "stepId",
  "capabilityCallId",
  "nerveBusEnvelopeId",
  RETIRED_PACKAGE_ID_FIELD,
  RETIRED_PACKAGE_VERSION_FIELD,
  RETIRED_SELECTION_ID_FIELD,
  RETIRED_SELECTION_VERSION_FIELD,
  RETIRED_ACTIVATION_REF_FIELD,
  "promptCatalogVersion",
] as const;

const WORKBENCH_AI_REQUEST_BUILDER_FILE = "src/lib/local-runtime/workbench-nerve-bus-ai-request-builder.ts";
const WORKBENCH_AI_INPUT_PROOF_SUPPORT_FILE = "src/lib/local-runtime/workbench-nerve-bus-ai-input-proof-support.ts";

const getNamedObjectLiteral = (sourceFile: SourceFile, declarationName: string) => {
  const initializer = sourceFile.getVariableDeclaration(declarationName)?.getInitializer();
  const expression = initializer && Node.isAsExpression(initializer) ? initializer.getExpression() : initializer;
  return expression && Node.isObjectLiteralExpression(expression) ? expression : undefined;
};

const getNamedCallable = (sourceFile: SourceFile, name: string) =>
  sourceFile.getFunction(name)
  ?? sourceFile.getVariableDeclaration(name)?.getInitializerIfKind(SyntaxKind.ArrowFunction)
  ?? sourceFile.getVariableDeclaration(name)?.getInitializerIfKind(SyntaxKind.FunctionExpression);

const hasObjectField = (sourceFile: SourceFile, declarationName: string, fieldName: string): boolean =>
  getNamedObjectLiteral(sourceFile, declarationName)?.getProperties().some((property) => Node.isPropertyAssignment(property) && property.getName() === fieldName) ?? false;

const hasObjectSpread = (sourceFile: SourceFile, declarationName: string, spreadName: string): boolean =>
  getNamedObjectLiteral(sourceFile, declarationName)?.getProperties().some((property) => Node.isSpreadAssignment(property) && property.getExpression().getText() === spreadName) ?? false;

const hasNamedPropertyInitializer = (sourceFile: SourceFile, ownerName: string, propertyName: string, initializerText: string): boolean =>
  getNamedCallable(sourceFile, ownerName)?.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) =>
    property.getName() === propertyName && property.getInitializer()?.getText() === initializerText,
  ) ?? false;

function hasChainFieldSchemaContract(sourceFile: SourceFile): boolean {
  return REQUIRED_CHAIN_FIELD_NAMES.every((fieldName) => hasObjectField(sourceFile, "AiChainFieldSchemas", fieldName))
    && hasObjectSpread(sourceFile, "AiRuntimeProofChainFieldSchemas", "AiChainFieldSchemas")
    && hasObjectField(sourceFile, "AiRuntimeProofChainFieldSchemas", "promptContractVersion");
}

function hasWorkbenchChainFields(sourceFile: SourceFile): boolean {
  return hasNamedPropertyInitializer(sourceFile, "buildWorkbenchAiAbilityRequest", "stepId", "envelope.stepId")
    && hasNamedPropertyInitializer(sourceFile, "buildWorkbenchAiAbilityRequest", "runId", "envelope.runId")
    && hasNamedPropertyInitializer(sourceFile, "buildWorkbenchAiAbilityRequest", "capabilityCallId", "envelope.capabilityCallId")
    && hasNamedPropertyInitializer(sourceFile, "buildWorkbenchAiAbilityRequest", "nerveBusEnvelopeId", "envelope.envelopeId")
    && hasNamedPropertyInitializer(sourceFile, "buildWorkbenchAiAbilityRequest", RETIRED_SELECTION_ID_FIELD, "envelope.mapId")
    && hasNamedPropertyInitializer(
      sourceFile,
      "buildWorkbenchAiAbilityRequest",
      RETIRED_ACTIVATION_REF_FIELD,
      ["requireChainField(mapRecord?.", RETIRED_ACTIVATION_REF_FIELD, ")"].join(""),
    )
    && hasNamedPropertyInitializer(sourceFile, "buildWorkbenchAiAbilityRequest", "promptCatalogVersion", "requireChainField(mapRecord?.promptCatalogVersion)");
}

function hasProofBuilderChainFields(sourceFile: SourceFile): boolean {
  return hasNamedPropertyInitializer(sourceFile, "buildAiRuntimeProofIdentityFields", "capabilityCallId", "input.request.capabilityCallId")
    && hasNamedPropertyInitializer(sourceFile, "buildAiRuntimeProofChainFields", "nerveBusEnvelopeId", "input.request.nerveBusEnvelopeId")
    && hasNamedPropertyInitializer(
      sourceFile,
      "buildAiRuntimeProofChainFields",
      RETIRED_ACTIVATION_REF_FIELD,
      ["input.request.", RETIRED_ACTIVATION_REF_FIELD].join(""),
    )
    && hasNamedPropertyInitializer(sourceFile, "buildAiRuntimeProofChainFields", "promptContractVersion", "input.promptContract.promptVersion")
    && hasNamedPropertyInitializer(sourceFile, "buildAiRuntimeProofChainFields", "promptCatalogVersion", "input.request.promptCatalogVersion");
}

function hasIdempotencyChainFields(sourceFile: SourceFile): boolean {
  return hasNamedPropertyInitializer(sourceFile, "buildAiRuntimeCallIdentity", "stepId", "request.stepId")
    && hasNamedPropertyInitializer(sourceFile, "buildAiRuntimeCallIdentity", "capabilityCallId", "request.capabilityCallId")
    && hasNamedPropertyInitializer(
      sourceFile,
      "buildAiRuntimeCallIdentity",
      RETIRED_ACTIVATION_REF_FIELD,
      ["request.", RETIRED_ACTIVATION_REF_FIELD].join(""),
    )
    && hasNamedPropertyInitializer(sourceFile, "buildAiRuntimeCallIdentity", "promptCatalogVersion", "request.promptCatalogVersion");
}

const WORKBENCH_AI_DEBUG_SUPPORT_FILE = "src/lib/local-runtime/workbench-ai-debug-support.ts";
const AI_INPUT_GATE_FILE = `${AI_ROOT}/runtime/ai-input-gate.ts`;
const AI_EXECUTOR_FILE = `${AI_ROOT}/runtime/ai-executor.ts`;
const AI_REQUEST_DEBUG_FILE = `${AI_ROOT}/runtime/ai-execution-request-debug.ts`;
const AI_INPUT_DEBUG_FILE = `${AI_ROOT}/runtime/ai-execution-input-debug.ts`;
const AI_INPUT_DEBUG_REJECTED_FILE = `${AI_ROOT}/runtime/ai-execution-input-debug-rejected.ts`;
const AI_INPUT_PROOF_REGISTRY_FILE = `${AI_ROOT}/shared/ai-input-proof-registry.ts`;

type AiInputProofDebugSources = {
  requestDebugSource: SourceFile;
  inputDebugSource: SourceFile;
  rejectedDebugSource: SourceFile;
  inputGateSource: SourceFile;
  executorSource: SourceFile;
  registrySource: SourceFile;
  workbenchRequestSource: SourceFile;
  workbenchInputProofSupportSource: SourceFile;
};

type AiProofChainSources = AiInputProofDebugSources & {
  chainFieldSource: SourceFile;
  inputSchemaSource: SourceFile;
  runtimeSchemaSource: SourceFile;
  proofBuilderSource: SourceFile;
  idempotencySource: SourceFile;
  aiDebugSupportSource: SourceFile;
};

function hasAiDebugTraceStepSafeAssignment(sourceFile: SourceFile): boolean {
  // buildAiDebugTraceFields is a const arrow function.
  const callable = getNamedCallable(sourceFile, "buildAiDebugTraceFields");
  if (!callable) return false;

  // Shorthand property `step,` (= step: step) is always safe — no input.stepId.
  // Regular PropertyAssignment `step: <expr>` is only safe when the initializer
  // does NOT reference input.stepId (which is an orchestration map step ID that
  // fails RoundLifecycleStepSchema Zod validation at runtime).
  const unsafeStepProp = callable.getDescendantsOfKind(SyntaxKind.PropertyAssignment).find(
    (prop) => prop.getName() === "step" && (prop.getInitializer()?.getText() ?? "").includes("input.stepId"),
  );
  return unsafeStepProp === undefined;
}

function hasCallExpressionNamed(sourceFile: SourceFile, name: string): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => call.getExpression().getText() === name);
}

function hasStringLiteral(sourceFile: SourceFile, literal: string): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).some((node) => node.getLiteralText() === literal);
}

function hasPropertyUsingText(sourceFile: SourceFile, callableName: string, propertyName: string, requiredText: string): boolean {
  return getNamedCallable(sourceFile, callableName)?.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) =>
    property.getName() === propertyName && (property.getInitializer()?.getText() ?? "").includes(requiredText),
  ) ?? false;
}

const hasRequestDebugInputProofFields = (input: AiInputProofDebugSources): boolean => {
  return hasImportModuleSpecifier(input.requestDebugSource, "ai-input-proof-registry")
    && hasCallExpressionNamed(input.requestDebugSource, "resolveAiInputProofSummary")
    && hasPropertyUsingText(input.requestDebugSource, "buildRequestDebugOutput", "sourceScreenshotEvidenceId", "firstProof?.sourceScreenshotEvidenceId")
    && hasPropertyUsingText(input.requestDebugSource, "buildRequestDebugOutput", "aiInputArtifactRef", "firstProof?.aiInputArtifactRef")
    && hasPropertyUsingText(input.requestDebugSource, "buildRequestDebugOutput", "imageInputs", "proofs.map")
    && hasPropertyUsingText(input.requestDebugSource, "buildRequestDebugOutput", "filePath", "proof.aiInputStorageRef")
    && hasStringLiteral(input.requestDebugSource, "AI_PROMPT_REQUEST_DEBUG");
};

const hasInputDebugProofFields = (input: AiInputProofDebugSources): boolean => {
  return hasImportModuleSpecifier(input.inputDebugSource, "ai-input-proof-registry")
    && hasCallExpressionNamed(input.inputDebugSource, "resolveAiInputProofSummary")
    && hasPropertyUsingText(input.inputDebugSource, "buildInputDebugOutput", "sourceScreenshotEvidenceId", "firstProof?.sourceScreenshotEvidenceId")
    && hasPropertyUsingText(input.inputDebugSource, "buildInputDebugOutput", "aiInputArtifactRef", "firstProof?.aiInputArtifactRef")
    && hasPropertyUsingText(input.inputDebugSource, "buildInputDebugOutput", "imageInputs", "proofs.map")
    && hasPropertyUsingText(input.inputDebugSource, "buildInputDebugOutput", "filePath", "proof.aiInputStorageRef")
    && hasStringLiteral(input.inputDebugSource, "AI_INPUT_REQUEST_DEBUG");
};

const hasWorkbenchInputProofFields = (input: AiInputProofDebugSources): boolean => {
  return hasCallExpressionNamed(input.workbenchRequestSource, "buildWorkbenchAiInputRefs")
    && hasCallExpressionNamed(input.workbenchRequestSource, "ensureWorkbenchAiInputProof")
    && hasPropertyUsingText(input.workbenchInputProofSupportSource, "buildWorkbenchAiInputRefs", "filePath", "proof.aiInputStorageRef")
    && hasCallExpressionNamed(input.workbenchInputProofSupportSource, "ensureSingleWorkbenchAiInputProof");
};

const hasGateAndRejectedInputProofFields = (input: AiInputProofDebugSources): boolean => {
  return hasImportModuleSpecifier(input.inputGateSource, "ai-input-proof-registry")
    && hasCallExpressionNamed(input.inputGateSource, "resolveAiInputProofSummary")
    && hasStringLiteral(input.inputGateSource, "ai_input_ref_missing")
    && hasStringLiteral(input.inputGateSource, "ai_input_artifact_missing")
    && hasImportModuleSpecifier(input.executorSource, "ai-execution-input-debug-rejected")
    && hasCallExpressionNamed(input.executorSource, "buildRejectedInputDebug")
    && hasStringLiteral(input.rejectedDebugSource, "AI_INPUT_DEBUG_REJECTED");
};

const hasRegistryInputProofSummaryShape = (registrySource: SourceFile): boolean => {
  const proofSummaryAlias = registrySource.getTypeAlias("AiInputProofSummary");
  return Boolean(proofSummaryAlias)
    && proofSummaryAlias?.getText().includes("aiInputStorageRef") === true
    && Boolean(registrySource.getFunction("recordAiInputProofSummary"))
    && Boolean(registrySource.getFunction("resolveAiInputProofSummary"));
};

function hasAiInputProofDebugChain(input: AiInputProofDebugSources): boolean {
  return hasRequestDebugInputProofFields(input)
    && hasInputDebugProofFields(input)
    && hasWorkbenchInputProofFields(input)
    && hasGateAndRejectedInputProofFields(input)
    && hasRegistryInputProofSummaryShape(input.registrySource);
}

const createProofChainFinding = (file: string, message: string): Finding => createFinding({
  lawId: "GRASSEYE-AI-CAPABILITY-007A-V1",
  file,
  line: 1,
  severity: "fatal",
  message,
});

const loadProofChainSources = (project: Project): AiProofChainSources => ({
  chainFieldSource: getSourceOrThrow(project, `${AI_ROOT}/schema-chain-fields.ts`),
  inputSchemaSource: getSourceOrThrow(project, `${AI_ROOT}/schema-core.schema.ts`),
  runtimeSchemaSource: getSourceOrThrow(project, `${AI_ROOT}/schema-runtime.schema.ts`),
  workbenchRequestSource: getSourceOrThrow(project, WORKBENCH_AI_REQUEST_BUILDER_FILE),
  workbenchInputProofSupportSource: getSourceOrThrow(project, WORKBENCH_AI_INPUT_PROOF_SUPPORT_FILE),
  proofBuilderSource: getSourceOrThrow(project, `${AI_ROOT}/runtime/ai-proof-builder.ts`),
  idempotencySource: getSourceOrThrow(project, `${AI_ROOT}/runtime/ai-idempotency.ts`),
  aiDebugSupportSource: getSourceOrThrow(project, WORKBENCH_AI_DEBUG_SUPPORT_FILE),
  requestDebugSource: getSourceOrThrow(project, AI_REQUEST_DEBUG_FILE),
  inputDebugSource: getSourceOrThrow(project, AI_INPUT_DEBUG_FILE),
  rejectedDebugSource: getSourceOrThrow(project, AI_INPUT_DEBUG_REJECTED_FILE),
  inputGateSource: getSourceOrThrow(project, AI_INPUT_GATE_FILE),
  executorSource: getSourceOrThrow(project, AI_EXECUTOR_FILE),
  registrySource: getSourceOrThrow(project, AI_INPUT_PROOF_REGISTRY_FILE),
});

const getSchemaContractFindings = (sources: AiProofChainSources): Finding[] => {
  const findings: Finding[] = [];
  if (!hasChainFieldSchemaContract(sources.chainFieldSource)) {
    findings.push(createProofChainFinding(`${AI_ROOT}/schema-chain-fields.ts`, "AI chain field schema must define step, envelope, activation, map, and prompt proof fields as governed required fields."));
  }
  if (!hasImportModuleSpecifier(sources.inputSchemaSource, "schema-chain-fields") || !hasImportModuleSpecifier(sources.runtimeSchemaSource, "schema-chain-fields")) {
    findings.push(createProofChainFinding(`${AI_ROOT}/schema-core.schema.ts`, "AI input and runtime proof schemas must import the governed chain-field schema helper."));
  }
  return findings;
};

const getRuntimeChainFindings = (sources: AiProofChainSources): Finding[] => {
  const findings: Finding[] = [];
  if (!hasWorkbenchChainFields(sources.workbenchRequestSource)) {
    findings.push(createProofChainFinding(WORKBENCH_AI_REQUEST_BUILDER_FILE, "Workbench AI requests must inject step, capability call, envelope, map activation, and prompt catalog chain fields from Nerve Bus and active map registry context."));
  }
  if (!hasProofBuilderChainFields(sources.proofBuilderSource)) {
    findings.push(createProofChainFinding(
      `${AI_ROOT}/runtime/ai-proof-builder.ts`,
      `AI runtime proof must carry capabilityCallId, nerveBusEnvelopeId, ${RETIRED_ACTIVATION_REF_FIELD}, promptContractVersion, and promptCatalogVersion from governed request context.`,
    ));
  }
  if (!hasIdempotencyChainFields(sources.idempotencySource)) {
    findings.push(createProofChainFinding(`${AI_ROOT}/runtime/ai-idempotency.ts`, "AI runtime call identity must hash step and activation chain fields, not just task and payload input."));
  }
  return findings;
};

const getDebugProofChainFindings = (sources: AiProofChainSources): Finding[] => {
  const findings: Finding[] = [];
  if (!hasAiDebugTraceStepSafeAssignment(sources.aiDebugSupportSource)) {
    findings.push(createProofChainFinding(WORKBENCH_AI_DEBUG_SUPPORT_FILE, "AI debug trace builder must use the computed RoundLifecycleStep-safe step value for the structured-event step field; using input.stepId directly causes StructuredRuntimeEventSchema Zod parse failures for orchestration step IDs and silently suppresses AI_REQUEST_DEBUG."));
  }
  if (!hasAiInputProofDebugChain(sources)) {
    findings.push(createProofChainFinding(AI_REQUEST_DEBUG_FILE, "AI request debug must resolve promptInputRef through the governed AI input proof registry, emit sourceScreenshotEvidenceId and aiInputArtifactRef, and reject missing prompt/artifact proof with AI_INPUT_DEBUG_REJECTED before runtime success."));
  }
  return findings;
};

export function findProofChainViolations(project: Project): Finding[] {
  const sources = loadProofChainSources(project);
  return [
    ...getSchemaContractFindings(sources),
    ...getRuntimeChainFindings(sources),
    ...getDebugProofChainFindings(sources),
  ];
}
