import { Node, SyntaxKind, type Project, type SourceFile } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { hasImportModuleSpecifier } from "../_shared/ast-helpers.js";

import { aiInspectionConstants } from "./inspection-constants.js";
import { aiInspectionUtils } from "./inspection-utils.js";

const { AI_ROOT } = aiInspectionConstants;
const { getSourceOrThrow } = aiInspectionUtils;

const REQUIRED_CHAIN_FIELD_NAMES = [
  "stepId",
  "capabilityCallId",
  "nerveBusEnvelopeId",
  "mapPackageId",
  "mapPackageVersion",
  "selectedMapId",
  "selectedMapVersion",
  "activationSnapshotRef",
  "promptCatalogVersion",
] as const;

const WORKBENCH_AI_REQUEST_BUILDER_FILE = "src/lib/local-runtime/workbench-nerve-bus-ai-request-builder.ts";

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
    && hasNamedPropertyInitializer(sourceFile, "buildWorkbenchAiAbilityRequest", "capabilityCallId", "envelope.requestId")
    && hasNamedPropertyInitializer(sourceFile, "buildWorkbenchAiAbilityRequest", "nerveBusEnvelopeId", "envelope.envelopeId")
    && hasNamedPropertyInitializer(sourceFile, "buildWorkbenchAiAbilityRequest", "selectedMapId", "envelope.mapId")
    && hasNamedPropertyInitializer(sourceFile, "buildWorkbenchAiAbilityRequest", "activationSnapshotRef", "requireChainField(mapRecord?.activationSnapshotRef)")
    && hasNamedPropertyInitializer(sourceFile, "buildWorkbenchAiAbilityRequest", "promptCatalogVersion", "requireChainField(mapRecord?.promptCatalogVersion)");
}

function hasProofBuilderChainFields(sourceFile: SourceFile): boolean {
  return hasNamedPropertyInitializer(sourceFile, "buildAiRuntimeProofIdentityFields", "capabilityCallId", "input.request.capabilityCallId")
    && hasNamedPropertyInitializer(sourceFile, "buildAiRuntimeProofChainFields", "nerveBusEnvelopeId", "input.request.nerveBusEnvelopeId")
    && hasNamedPropertyInitializer(sourceFile, "buildAiRuntimeProofChainFields", "activationSnapshotRef", "input.request.activationSnapshotRef")
    && hasNamedPropertyInitializer(sourceFile, "buildAiRuntimeProofChainFields", "promptContractVersion", "input.promptContract.promptVersion")
    && hasNamedPropertyInitializer(sourceFile, "buildAiRuntimeProofChainFields", "promptCatalogVersion", "input.request.promptCatalogVersion");
}

function hasIdempotencyChainFields(sourceFile: SourceFile): boolean {
  return hasNamedPropertyInitializer(sourceFile, "buildAiRuntimeCallIdentity", "stepId", "request.stepId")
    && hasNamedPropertyInitializer(sourceFile, "buildAiRuntimeCallIdentity", "capabilityCallId", "request.capabilityCallId")
    && hasNamedPropertyInitializer(sourceFile, "buildAiRuntimeCallIdentity", "activationSnapshotRef", "request.activationSnapshotRef")
    && hasNamedPropertyInitializer(sourceFile, "buildAiRuntimeCallIdentity", "promptCatalogVersion", "request.promptCatalogVersion");
}

const WORKBENCH_AI_DEBUG_SUPPORT_FILE = "src/lib/local-runtime/workbench-ai-debug-support.ts";
const AI_INPUT_GATE_FILE = `${AI_ROOT}/runtime/ai-input-gate.ts`;
const AI_EXECUTOR_FILE = `${AI_ROOT}/runtime/ai-executor.ts`;
const AI_REQUEST_DEBUG_FILE = `${AI_ROOT}/runtime/ai-execution-request-debug.ts`;
const AI_INPUT_DEBUG_FILE = `${AI_ROOT}/runtime/ai-execution-input-debug.ts`;
const AI_INPUT_DEBUG_REJECTED_FILE = `${AI_ROOT}/runtime/ai-execution-input-debug-rejected.ts`;
const AI_INPUT_PROOF_REGISTRY_FILE = `${AI_ROOT}/shared/ai-input-proof-registry.ts`;

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

function hasAiInputProofDebugChain(input: {
  requestDebugSource: SourceFile;
  inputDebugSource: SourceFile;
  rejectedDebugSource: SourceFile;
  inputGateSource: SourceFile;
  executorSource: SourceFile;
  registrySource: SourceFile;
}): boolean {
  return hasImportModuleSpecifier(input.requestDebugSource, "ai-input-proof-registry")
    && hasImportModuleSpecifier(input.inputDebugSource, "ai-input-proof-registry")
    && hasCallExpressionNamed(input.requestDebugSource, "resolveAiInputProofSummary")
    && hasCallExpressionNamed(input.inputDebugSource, "resolveAiInputProofSummary")
    && hasPropertyUsingText(input.requestDebugSource, "buildRequestDebugOutput", "sourceScreenshotEvidenceId", "proof?.sourceScreenshotEvidenceId")
    && hasPropertyUsingText(input.requestDebugSource, "buildRequestDebugOutput", "aiInputArtifactRef", "proof?.aiInputArtifactRef")
    && hasPropertyUsingText(input.inputDebugSource, "buildInputDebugOutput", "sourceScreenshotEvidenceId", "proof?.sourceScreenshotEvidenceId")
    && hasPropertyUsingText(input.inputDebugSource, "buildInputDebugOutput", "aiInputArtifactRef", "proof?.aiInputArtifactRef")
    && hasImportModuleSpecifier(input.inputGateSource, "ai-input-proof-registry")
    && hasCallExpressionNamed(input.inputGateSource, "resolveAiInputProofSummary")
    && hasStringLiteral(input.inputGateSource, "ai_input_ref_missing")
    && hasStringLiteral(input.inputGateSource, "ai_input_artifact_missing")
    && hasImportModuleSpecifier(input.executorSource, "ai-execution-input-debug-rejected")
    && hasCallExpressionNamed(input.executorSource, "buildRejectedInputDebug")
    && hasStringLiteral(input.rejectedDebugSource, "AI_INPUT_DEBUG_REJECTED")
    && Boolean(input.registrySource.getTypeAlias("AiInputProofSummary"))
    && Boolean(input.registrySource.getFunction("recordAiInputProofSummary"))
    && Boolean(input.registrySource.getFunction("resolveAiInputProofSummary"));
}

export function findProofChainViolations(project: Project): Finding[] {
  const chainFieldSource = getSourceOrThrow(project, `${AI_ROOT}/schema-chain-fields.ts`);
  const inputSchemaSource = getSourceOrThrow(project, `${AI_ROOT}/schema-core.schema.ts`);
  const runtimeSchemaSource = getSourceOrThrow(project, `${AI_ROOT}/schema-runtime.schema.ts`);
  const workbenchRequestSource = getSourceOrThrow(project, WORKBENCH_AI_REQUEST_BUILDER_FILE);
  const proofBuilderSource = getSourceOrThrow(project, `${AI_ROOT}/runtime/ai-proof-builder.ts`);
  const idempotencySource = getSourceOrThrow(project, `${AI_ROOT}/runtime/ai-idempotency.ts`);
  const aiDebugSupportSource = getSourceOrThrow(project, WORKBENCH_AI_DEBUG_SUPPORT_FILE);
  const requestDebugSource = getSourceOrThrow(project, AI_REQUEST_DEBUG_FILE);
  const inputDebugSource = getSourceOrThrow(project, AI_INPUT_DEBUG_FILE);
  const rejectedDebugSource = getSourceOrThrow(project, AI_INPUT_DEBUG_REJECTED_FILE);
  const inputGateSource = getSourceOrThrow(project, AI_INPUT_GATE_FILE);
  const executorSource = getSourceOrThrow(project, AI_EXECUTOR_FILE);
  const registrySource = getSourceOrThrow(project, AI_INPUT_PROOF_REGISTRY_FILE);
  const findings: Finding[] = [];

  if (!hasChainFieldSchemaContract(chainFieldSource)) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-007A-V1", file: `${AI_ROOT}/schema-chain-fields.ts`, line: 1, severity: "fatal", message: "AI chain field schema must define step, envelope, activation, map, and prompt proof fields as governed required fields." }));
  }
  if (!hasImportModuleSpecifier(inputSchemaSource, "schema-chain-fields") || !hasImportModuleSpecifier(runtimeSchemaSource, "schema-chain-fields")) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-007A-V1", file: `${AI_ROOT}/schema-core.schema.ts`, line: 1, severity: "fatal", message: "AI input and runtime proof schemas must import the governed chain-field schema helper." }));
  }
  if (!hasWorkbenchChainFields(workbenchRequestSource)) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-007A-V1", file: WORKBENCH_AI_REQUEST_BUILDER_FILE, line: 1, severity: "fatal", message: "Workbench AI requests must inject step, capability call, envelope, map activation, and prompt catalog chain fields from Nerve Bus and active map registry context." }));
  }
  if (!hasProofBuilderChainFields(proofBuilderSource)) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-007A-V1", file: `${AI_ROOT}/runtime/ai-proof-builder.ts`, line: 1, severity: "fatal", message: "AI runtime proof must carry capabilityCallId, nerveBusEnvelopeId, activationSnapshotRef, promptContractVersion, and promptCatalogVersion from governed request context." }));
  }
  if (!hasIdempotencyChainFields(idempotencySource)) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-007A-V1", file: `${AI_ROOT}/runtime/ai-idempotency.ts`, line: 1, severity: "fatal", message: "AI runtime call identity must hash step and activation chain fields, not just task and payload input." }));
  }
  if (!hasAiDebugTraceStepSafeAssignment(aiDebugSupportSource)) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-007A-V1", file: WORKBENCH_AI_DEBUG_SUPPORT_FILE, line: 1, severity: "fatal", message: "AI debug trace builder must use the computed RoundLifecycleStep-safe step value for the structured-event step field; using input.stepId directly causes StructuredRuntimeEventSchema Zod parse failures for orchestration step IDs and silently suppresses AI_REQUEST_DEBUG." }));
  }
  if (!hasAiInputProofDebugChain({ requestDebugSource, inputDebugSource, rejectedDebugSource, inputGateSource, executorSource, registrySource })) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-007A-V1", file: AI_REQUEST_DEBUG_FILE, line: 1, severity: "fatal", message: "AI request debug must resolve promptInputRef through the governed AI input proof registry, emit sourceScreenshotEvidenceId and aiInputArtifactRef, and reject missing prompt/artifact proof with AI_INPUT_DEBUG_REJECTED before runtime success." }));
  }

  return findings;
}
