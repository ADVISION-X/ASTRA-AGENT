import { Node, SyntaxKind, type Node as MorphNode, type Project } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getFunctionLike, getZodObjectPropertyNames } from "../_shared/ast-schema-queries.js";

import { LAW_IDS, PATHS } from "./config.js";
import { getSource } from "./project-access.js";

const EXPECTED_PROOF_REQUIRED_FIELDS = [
  "missionId",
  "runId",
  "sessionId",
  "stepId",
  "mapPackageId",
  "mapPackageVersion",
  "selectedMapId",
  "selectedMapVersion",
  "activationSnapshotRef",
  "capabilityCallId",
  "nerveBusEnvelopeId",
] as const;

const EXPECTED_PROOF_OPTIONAL_FIELDS = ["roundId", "videoVisitId"] as const;
const EXPECTED_RESULT_OPTIONAL_FIELDS = [...EXPECTED_PROOF_OPTIONAL_FIELDS, "diagnosticPayloadRef"] as const;

const unwrapExpression = (node: import("ts-morph").Node | undefined): import("ts-morph").Node | undefined => {
  if (!node) {
    return undefined;
  }

  if (Node.isAsExpression(node) || Node.isSatisfiesExpression(node) || Node.isParenthesizedExpression(node)) {
    return unwrapExpression(node.getExpression());
  }

  return node;
};

const getConstStringArrayValues = (project: Project, path: string, declarationName: string): string[] => {
  const source = getSource(project, path);
  const declaration = source.getVariableDeclaration(declarationName);
  const initializer = unwrapExpression(declaration?.getInitializer());
  return getStringArrayValues(initializer);
};

const getStringArrayValues = (node: import("ts-morph").Node | undefined): string[] => {
  if (!node) {
    return [];
  }
  if (Node.isArrayLiteralExpression(node)) {
    return node.getElements().flatMap((element) => getArrayElementValues(element));
  }
  return getIdentifierArrayValues(node);
};

const getArrayElementValues = (element: import("ts-morph").Node): string[] => {
  if (Node.isStringLiteral(element)) {
    return [element.getLiteralText()];
  }
  if (Node.isSpreadElement(element)) {
    return getIdentifierArrayValues(element.getExpression());
  }
  return [];
};

const getIdentifierArrayValues = (node: import("ts-morph").Node): string[] => {
  if (!Node.isIdentifier(node)) {
    return [];
  }
  return (node.getSymbol()?.getAliasedSymbol() ?? node.getSymbol())?.getDeclarations()
    .flatMap((declaration) => getDeclarationArrayValues(declaration)) ?? [];
};

const getDeclarationArrayValues = (declaration: import("ts-morph").Node): string[] => {
  if (!Node.isVariableDeclaration(declaration)) {
    return [];
  }
  return getStringArrayValues(unwrapExpression(declaration.getInitializer()));
};

const sameFields = (actual: string[], expected: readonly string[]): boolean => {
  return actual.length === expected.length && actual.every((field, index) => field === expected[index]);
};

const hasSuccessScopedPrepareAiInputScaleMappingGuard = (functionLike: MorphNode | null | undefined): boolean => {
  const ifStatements = functionLike?.getDescendantsOfKind(SyntaxKind.IfStatement) ?? [];

  return ifStatements.some((ifStatement) => {
    const condition = ifStatement.getExpression();
    const stringLiterals = condition.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralText());
    const negatedScaleMapping = condition.getDescendantsOfKind(SyntaxKind.PrefixUnaryExpression).some((expression) => {
      if (expression.getOperatorToken() !== SyntaxKind.ExclamationToken) {
        return false;
      }

      const operand = expression.getOperand();
      return Node.isPropertyAccessExpression(operand) && operand.getText() === "value.scaleMapping";
    });

    return stringLiterals.includes("success")
      && stringLiterals.includes("prepare-ai-input")
      && negatedScaleMapping;
  });
};

const callsPrepareAiInputScaleMappingGuard = (functionLike: MorphNode | null | undefined): boolean => {
  return (functionLike?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? []).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === "validatePrepareAiInputScaleMapping";
  });
};

const hasRequiredText = (sourceText: string, fragments: readonly string[]): boolean => {
  return fragments.every((fragment) => sourceText.includes(fragment));
};

export function inspectScreenshotRuntimeProofParity(project: Project): Finding[] {
  const proofRequiredFields = getConstStringArrayValues(project, PATHS.GOVERNANCE, "SCREENSHOT_PROOF_REQUIRED_CHAIN_FIELD_NAMES");
  const proofOptionalFields = getConstStringArrayValues(project, PATHS.GOVERNANCE, "SCREENSHOT_PROOF_OPTIONAL_CHAIN_FIELD_NAMES");
  const resultRequiredFields = getConstStringArrayValues(project, PATHS.GOVERNANCE, "SCREENSHOT_RESULT_REQUIRED_CHAIN_FIELD_NAMES");
  const resultOptionalFields = getConstStringArrayValues(project, PATHS.GOVERNANCE, "SCREENSHOT_RESULT_OPTIONAL_CHAIN_FIELD_NAMES");
  const schemaSource = getSource(project, PATHS.SCHEMA);
  const refinementsSource = getSource(project, PATHS.SCHEMA_REFINEMENTS ?? "src/capabilities/screenshot/screenshot-schema-refinements.ts");
  return [
    ...collectGovernanceFieldFindings(proofRequiredFields, proofOptionalFields, resultRequiredFields, resultOptionalFields),
    ...collectSchemaFieldFindings(schemaSource),
    ...collectRefinementFieldFindings(refinementsSource),
    ...collectPrepareAiInputScaleMappingFindings(refinementsSource),
    ...collectBrowserViewportCaptureTruthFindings(project, schemaSource),
  ];
}

const collectGovernanceFieldFindings = (
  proofRequiredFields: string[],
  proofOptionalFields: string[],
  resultRequiredFields: string[],
  resultOptionalFields: string[],
): Finding[] => {
  const findings: Finding[] = [];
  if (!sameFields(proofRequiredFields, EXPECTED_PROOF_REQUIRED_FIELDS)) {
    findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.GOVERNANCE, line: 1, severity: "fatal", message: "Screenshot governance must keep videoVisitId out of runtimeProof required chain fields." }));
  }
  if (!sameFields(proofOptionalFields, EXPECTED_PROOF_OPTIONAL_FIELDS)) {
    findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.GOVERNANCE, line: 1, severity: "fatal", message: "Screenshot governance must keep roundId/videoVisitId inside optional runtimeProof chain fields." }));
  }
  if (!sameFields(resultRequiredFields, EXPECTED_PROOF_REQUIRED_FIELDS)) {
    findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.GOVERNANCE, line: 1, severity: "fatal", message: "Screenshot result required chain fields must match runtimeProof required chain fields." }));
  }
  if (!sameFields(resultOptionalFields, EXPECTED_RESULT_OPTIONAL_FIELDS)) {
    findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.GOVERNANCE, line: 1, severity: "fatal", message: "Screenshot result optional chain fields must keep roundId, videoVisitId, and diagnosticPayloadRef nullable." }));
  }
  return findings;
};

const collectSchemaFieldFindings = (schemaSource: ReturnType<typeof getSource>): Finding[] => {
  const proofIdentityProperties = getZodObjectPropertyNames(schemaSource, "ScreenshotRuntimeProofIdentitySchema");
  const capturePolicyProperties = getZodObjectPropertyNames(schemaSource, "ScreenshotCapturePolicySchema");
  return !proofIdentityProperties.has("videoVisitId") || !capturePolicyProperties.has("allowMissingVideoVisitId")
    ? [createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Screenshot schema must declare nullable videoVisitId and allowMissingVideoVisitId policy together." })]
    : [];
};

const collectRefinementFieldFindings = (refinementsSource: ReturnType<typeof getSource>): Finding[] => {
  const runtimeProofChain = getFunctionLike(refinementsSource, "validateScreenshotRuntimeProofChain");
  const resultChain = getFunctionLike(refinementsSource, "validateResultChainFields");
  const runtimeProofIdentifiers = runtimeProofChain?.getDescendantsOfKind(SyntaxKind.Identifier).map((identifier) => identifier.getText()) ?? [];
  const findings: Finding[] = [];
  if (!runtimeProofIdentifiers.includes("SCREENSHOT_PROOF_REQUIRED_CHAIN_FIELD_NAMES") || runtimeProofIdentifiers.includes("SCREENSHOT_PROOF_CHAIN_FIELD_NAMES")) {
    findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: "src/capabilities/screenshot/screenshot-schema-refinements.ts", line: 1, severity: "fatal", message: "Screenshot runtimeProof refine must require only the governed required chain fields, not nullable videoVisitId." }));
  }

  const resultChainIdentifiers = resultChain?.getDescendantsOfKind(SyntaxKind.Identifier).map((identifier) => identifier.getText()) ?? [];
  if (!resultChainIdentifiers.includes("SCREENSHOT_RESULT_REQUIRED_CHAIN_FIELD_NAMES") || !resultChainIdentifiers.includes("SCREENSHOT_RESULT_CHAIN_FIELD_NAMES")) {
    findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: "src/capabilities/screenshot/screenshot-schema-refinements.ts", line: 1, severity: "fatal", message: "Screenshot result refine must separate required chain fields from nullable parity-only fields." }));
  }
  return findings;
};

const collectPrepareAiInputScaleMappingFindings = (refinementsSource: ReturnType<typeof getSource>): Finding[] => {
  const prepareAiInputScaleMapping = getFunctionLike(refinementsSource, "validatePrepareAiInputScaleMapping");
  const prepareAiInputRuntimeProof = getFunctionLike(refinementsSource, "validateScreenshotRuntimeProofPrepareAiInput");
  if (!hasSuccessScopedPrepareAiInputScaleMappingGuard(prepareAiInputScaleMapping) || !callsPrepareAiInputScaleMappingGuard(prepareAiInputRuntimeProof)) {
    return [createFinding({
      lawId: LAW_IDS.TRANSFORM,
      file: PATHS.SCHEMA_REFINEMENTS,
      line: 1,
      severity: "fatal",
      message: "Screenshot prepare-ai-input refine must require scaleMapping only for success proofs and keep failure/review diagnostics on the non-success path.",
    })];
  }
  return [];
};

const collectBrowserViewportCaptureTruthFindings = (project: Project, schemaSource: ReturnType<typeof getSource>): Finding[] => {
  const browserCaptureProperties = getZodObjectPropertyNames(schemaSource, "ScreenshotBrowserCaptureSchema");
  const browserControllerSource = getSource(project, "src/lib/browser/current-chrome-browser-controller.ts");
  const browserScreenshotSource = getSource(project, "src/lib/browser/current-chrome-browser-screenshot.ts");
  const browserTruthSource = getSource(project, "src/capabilities/screenshot/runtime/screenshot-browser-capture-truth.ts");
  const successHelpersSource = getSource(project, PATHS.SUCCESS_HELPERS);
  const findings: Finding[] = [];

  if (!browserCaptureProperties.has("viewportWidth") || !browserCaptureProperties.has("viewportHeight")) {
    findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Screenshot browser capture schema must carry viewportWidth/viewportHeight alongside measured artifact width/height." }));
  }

  if (!hasRequiredText(browserControllerSource.getFullText(), ["captureCurrentChromeScreenshot({", "width: screenshot.dimensions.width", "height: screenshot.dimensions.height", "viewportWidth: geometry.viewportWidth", "viewportHeight: geometry.viewportHeight"]) || !hasRequiredText(browserScreenshotSource.getFullText(), ["readImageSize(screenshotPath)", "const dimensions = await readImageSize(screenshotPath);", "return { screenshotPath, dimensions };"])) {
    findings.push(createFinding({ lawId: LAW_IDS.TRANSFORM, file: "src/lib/browser/current-chrome-browser-controller.ts", line: 1, severity: "fatal", message: "Current Chrome browser capture must measure real screenshot pixels and must not reuse viewport geometry as artifact width/height truth." }));
  }

  if (!hasRequiredText(browserTruthSource.getFullText(), ['targetCoordinateSpace: "source_image_pixels"', 'sourceCoordinateSpace: "browser_viewport_pixels"', "capture.viewportWidth", "capture.viewportHeight"]) || !hasRequiredText(successHelpersSource.getFullText(), ["resolveBrowserCaptureScaleMapping", "resolveBrowserCaptureCoordinateSpace"])) {
    findings.push(createFinding({ lawId: LAW_IDS.TRANSFORM, file: PATHS.SUCCESS_HELPERS, line: 1, severity: "fatal", message: "Screenshot browser capture success path must bridge browser_viewport_pixels to source_image_pixels when measured artifact pixels differ from viewport geometry." }));
  }

  return findings;
};
