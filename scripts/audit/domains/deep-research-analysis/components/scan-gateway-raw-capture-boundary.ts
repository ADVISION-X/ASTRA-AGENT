import {
  Node,
  SyntaxKind,
  type CallExpression,
  type SourceFile,
} from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../../shared/paths.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

type InspectInput = {
  context: InspectorContext;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
};

const flowSharedPath = "src/plugins/deep-research-analysis/deep-research-analysis.flow-shared.ts";
const smokePath = "scripts/acceptance/deep-research-analysis-smoke.ts";
const rawCaptureAcceptancePath = "scripts/acceptance/deep-research-analysis-raw-capture-boundary.ts";

const getSourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const isAiGatewayExecuteCall = (call: CallExpression): boolean => {
  const expression = call.getExpression();
  return Node.isPropertyAccessExpression(expression)
    && expression.getName() === "execute"
    && Node.isIdentifier(expression.getExpression())
    && expression.getExpression().getText() === "aiInputGateway";
};

const hasRawOnlyExpectedOutputSchemaRef = (sourceFile: SourceFile): boolean => {
  const executeCall = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
    .find(isAiGatewayExecuteCall);
  const executeArg = executeCall?.getArguments()[0];
  if (!executeArg || !Node.isObjectLiteralExpression(executeArg)) return false;
  const property = executeArg.getProperty("expectedOutputSchemaRef");
  if (!property || !Node.isPropertyAssignment(property)) return false;
  return property.getInitializer()?.getKind() === SyntaxKind.NullKeyword;
};

const hasForbiddenPromptContractPreparse = (sourceFile: SourceFile): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment)
    .some((property) =>
      property.getName() === "expectedOutputSchemaRef"
      && property.getInitializer()?.getText() === "promptPackage.promptContractId",
    );

const hasRawOnlyAcceptanceHelper = (sourceFile: SourceFile): boolean => {
  const hasMalformedAdapter = Boolean(sourceFile.getClass("MalformedPositiveFixtureAdapter"));
  const hasBoundaryAcceptance = Boolean(
    sourceFile.getFunction("verifyMalformedProviderJsonFailsAtParseNotCapture")
      ?? sourceFile.getVariableDeclaration("verifyMalformedProviderJsonFailsAtParseNotCapture"),
  );
  const requiredStageLiterals = new Set(["POSITIVE_CAPTURE", "POSITIVE_PARSE"]);
  const presentStageLiterals = new Set(sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral)
    .map((literal) => literal.getLiteralValue())
    .filter((literal) => requiredStageLiterals.has(literal)));
  return hasMalformedAdapter
    && hasBoundaryAcceptance
    && [...requiredStageLiterals].every((literal) => presentStageLiterals.has(literal));
};

const smokeCallsRawOnlyAcceptance = (sourceFile: SourceFile): boolean => {
  const importsAcceptance = sourceFile.getImportDeclarations()
    .some((declaration) =>
      declaration.getModuleSpecifierValue().endsWith("./deep-research-analysis-raw-capture-boundary.js")
      && declaration.getNamedImports().some((namedImport) =>
        namedImport.getName() === "verifyMalformedProviderJsonFailsAtParseNotCapture"));
  const callsAcceptance = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((call) => {
      const expression = call.getExpression();
      return Node.isIdentifier(expression)
        && expression.getText() === "verifyMalformedProviderJsonFailsAtParseNotCapture";
    });
  return importsAcceptance && callsAcceptance;
};

export const inspectGatewayRawCaptureBoundary = (input: InspectInput): void => {
  const flowSharedFile = getSourceFile(input.context, flowSharedPath);
  const smokeFile = getSourceFile(input.context, smokePath);
  const rawCaptureAcceptanceFile = getSourceFile(input.context, rawCaptureAcceptancePath);
  if (flowSharedFile) input.inspectedFiles.add(getRepoSourcePath(flowSharedFile));
  if (smokeFile) input.inspectedFiles.add(getRepoSourcePath(smokeFile));
  if (rawCaptureAcceptanceFile) input.inspectedFiles.add(getRepoSourcePath(rawCaptureAcceptanceFile));

  if (!flowSharedFile
    || !hasRawOnlyExpectedOutputSchemaRef(flowSharedFile)
    || hasForbiddenPromptContractPreparse(flowSharedFile)) {
    input.findings.push(createFinding({
      checkId: "deep-research/gateway-raw-capture-boundary",
      lawId: input.lawId,
      filePath: flowSharedPath,
      message: "Deep Research must call AI Gateway with expectedOutputSchemaRef: null so CAPTURE transports raw output and business parsing happens only in Deep Research PARSE.",
    }));
  }

  if (!smokeFile
    || !rawCaptureAcceptanceFile
    || !smokeCallsRawOnlyAcceptance(smokeFile)
    || !hasRawOnlyAcceptanceHelper(rawCaptureAcceptanceFile)) {
    input.findings.push(createFinding({
      checkId: "deep-research/gateway-raw-capture-acceptance",
      lawId: input.lawId,
      filePath: rawCaptureAcceptancePath,
      message: "Deep Research smoke must prove malformed provider JSON completes POSITIVE_CAPTURE and fails at POSITIVE_PARSE.",
    }));
  }
};
