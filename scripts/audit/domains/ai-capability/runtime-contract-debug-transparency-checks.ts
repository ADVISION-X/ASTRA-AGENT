import { Node, SyntaxKind, type Project, type SourceFile } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { hasStringLiteral } from "../_shared/ast-literal-queries.js";
import { hasCallExpression } from "../_shared/ast-helpers.js";

import { aiInspectionConstants } from "./inspection-constants.js";
import { aiInspectionUtils } from "./inspection-utils.js";
export {
  collectWorkbenchAiDebugChainFindings,
  findAiDebugTransparencyViolations,
} from "./runtime-contract-local-debug-checks.js";
import { collectRuntimeFailureReasonFindings } from "./runtime-result-shape.js";

const { AI_ROOT } = aiInspectionConstants;
const { getSourceOrThrow } = aiInspectionUtils;

const createAiDebugFinding = (lawId: string, file: string, message: string): Finding => createFinding({
  lawId,
  file,
  line: 1,
  severity: "fatal",
  message,
});

const hasObjectLiteralProperty = (sourceFile: SourceFile, propertyName: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => property.getName() === propertyName)
  || sourceFile.getDescendantsOfKind(SyntaxKind.ShorthandPropertyAssignment).some((property) => property.getName() === propertyName)
  || sourceFile.getDescendantsOfKind(SyntaxKind.PropertySignature).some((property) => property.getName() === propertyName);

const hasCallWithObjectProperty = (sourceFile: SourceFile, callName: string, propertyName: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    if (!Node.isIdentifier(expression) || expression.getText() !== callName) {
      return false;
    }
    return callExpression.getArguments().some((argument) =>
      Node.isObjectLiteralExpression(argument)
      && argument.getProperties().some((property) => Node.isPropertyAssignment(property) && property.getName() === propertyName),
    );
  });

const hasRuntimeDebugContractShape = (localAdapterSource: SourceFile, localDebugContractSource: SourceFile): boolean => {
  return hasCallExpression(localAdapterSource, "emitAiErrorDebug")
    && hasObjectLiteralProperty(localDebugContractSource, "implementationStatus")
    && hasObjectLiteralProperty(localDebugContractSource, "runtimeCallId")
    && hasObjectLiteralProperty(localDebugContractSource, "diagnosticPayloadRef");
};

const hasSeparatedRuntimeResponseDebugStages = (localDebugSource: SourceFile, localDebugContractSource: SourceFile): boolean => {
  return hasStringLiteral(localDebugSource, "AI_RAW_RESPONSE_DEBUG")
    && hasStringLiteral(localDebugSource, "AI_NORMALIZED_RESPONSE_DEBUG")
    && hasStringLiteral(localDebugContractSource, "AI_RAW_RESPONSE_DEBUG")
    && hasStringLiteral(localDebugContractSource, "AI_NORMALIZED_RESPONSE_DEBUG");
};

const hasDistinctRuntimeRequestDebugStages = (localDebugContractSource: SourceFile): boolean => {
  return hasStringLiteral(localDebugContractSource, "AI_INPUT_REQUEST_DEBUG")
    && hasStringLiteral(localDebugContractSource, "AI_PROMPT_REQUEST_DEBUG");
};

const collectRuntimeDebugShapeFindings = (project: Project): Finding[] => {
  const localAdapterSource = getSourceOrThrow(project, `${AI_ROOT}/runtime-adapters/local-ai-runtime-adapter.ts`);
  const localDebugSource = getSourceOrThrow(project, `${AI_ROOT}/runtime-adapters/local-ai-runtime-debug.ts`);
  const localDebugContractSource = getSourceOrThrow(project, `${AI_ROOT}/runtime-adapters/local-ai-runtime-debug-contract.ts`);
  const findings: Finding[] = [];

  if (!hasCallExpression(localDebugSource, "emitErrorDebug") || !hasStringLiteral(localDebugSource, "AI_ERROR_DEBUG")) {
    findings.push(createAiDebugFinding("GRASSEYE-AI-CAPABILITY-002-V1", `${AI_ROOT}/runtime-adapters/local-ai-runtime-debug.ts`, "Local AI debug session must emit AI_ERROR_DEBUG through the structured debug port."));
  }
  if (!hasRuntimeDebugContractShape(localAdapterSource, localDebugContractSource)) {
    findings.push(createAiDebugFinding("GRASSEYE-AI-CAPABILITY-002-V1", `${AI_ROOT}/runtime-adapters/local-ai-runtime-debug-contract.ts`, "AI runtime debug events must expose implementationStatus, runtimeCallId, and diagnosticPayloadRef without raw prompt/image payloads."));
  }
  if (!hasSeparatedRuntimeResponseDebugStages(localDebugSource, localDebugContractSource)) {
    findings.push(createAiDebugFinding("GRASSEYE-AI-CAPABILITY-007A-V1", `${AI_ROOT}/runtime-adapters/local-ai-runtime-debug.ts`, "AI debug must emit raw model response and normalized/assembled response as separate structured events before terminal AI_RESPONSE_DEBUG."));
  }
  if (!hasDistinctRuntimeRequestDebugStages(localDebugContractSource)) {
    findings.push(createAiDebugFinding("GRASSEYE-AI-CAPABILITY-007A-V1", `${AI_ROOT}/runtime-adapters/local-ai-runtime-debug-contract.ts`, "AI debug request stages must distinguish input parsing, prompt preparation, and actual model request start."));
  }

  return findings;
};

const collectRuntimeDebugEmitterFindings = (project: Project): Finding[] => {
  const runtimeFactorySource = getSourceOrThrow(project, `${AI_ROOT}/runtime-factory.ts`);
  const executionContextSource = getSourceOrThrow(project, `${AI_ROOT}/runtime/ai-execution-context.ts`);
  const providerAwareSource = getSourceOrThrow(project, `${AI_ROOT}/runtime-adapters/provider-aware-ai-runtime-adapter.ts`);
  const findings: Finding[] = [];

  if (!hasCallWithObjectProperty(runtimeFactorySource, "createProviderAwareAiRuntimePort", "emitDebugEvent")) {
    findings.push(createAiDebugFinding("GRASSEYE-AI-CAPABILITY-002-V1", `${AI_ROOT}/runtime-factory.ts`, "Configured AI runtime factory must inject emitDebugEvent into createProviderAwareAiRuntimePort."));
  }
  if (!hasCallWithObjectProperty(executionContextSource, "createProviderAwareAiRuntimePort", "emitDebugEvent")) {
    findings.push(createAiDebugFinding("GRASSEYE-AI-CAPABILITY-002-V1", `${AI_ROOT}/runtime/ai-execution-context.ts`, "createAiExecutionContext must support governed emitDebugEvent injection instead of constructing an opaque runtime."));
  }
  if (!hasCallWithObjectProperty(providerAwareSource, "createLocalAiRuntimePort", "emitDebugEvent")) {
    findings.push(createAiDebugFinding("GRASSEYE-AI-CAPABILITY-002-V1", `${AI_ROOT}/runtime-adapters/provider-aware-ai-runtime-adapter.ts`, "Provider-aware AI adapter must pass emitDebugEvent into the local AI runtime adapter."));
  }

  return findings;
};

export const findRuntimeDiagnosticTransparencyViolations = (project: Project): Finding[] => [
  ...collectRuntimeDebugEmitterFindings(project),
  ...collectRuntimeDebugShapeFindings(project),
  ...collectRuntimeFailureReasonFindings(project),
];