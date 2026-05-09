import { SyntaxKind } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getAuditProject, getNodeLine, toRelativeSourcePath } from "../../core/ts-morph.js";

import { capabilityGroupGovernanceConstants } from "./inspection-constants.js";

const {
  LAW_ID_010,
  AI_ONLY_COGNITION_TARGETS,
  AI_ONLY_COGNITION_FORBIDDEN_PATH_SEGMENTS,
  AI_ONLY_COGNITION_FORBIDDEN_IDENTIFIER_STEMS,
  AI_ONLY_COGNITION_FORBIDDEN_LITERAL_PREFIXES,
  AI_ONLY_COGNITION_FORBIDDEN_LITERALS,
} = capabilityGroupGovernanceConstants;

const PRODUCT_PRESENCE_DECISION_PATH = "src/lib/local-runtime/workbench-nerve-bus-ai-decision.ts";

const matchesTargetSurface = (relativePath: string): boolean => (
  AI_ONLY_COGNITION_TARGETS.some((target) => relativePath === target || relativePath.startsWith(target))
);

const collectExportedIdentifierTexts = (
  sourceFile: ReturnType<ReturnType<typeof getAuditProject>["getSourceFiles"]>[number],
): string[] => {
  const exportedTexts = new Set<string>();

  for (const declarations of sourceFile.getExportedDeclarations().values()) {
    for (const declaration of declarations) {
      for (const identifier of declaration.getDescendantsOfKind(SyntaxKind.Identifier)) {
        exportedTexts.add(identifier.getText());
      }
    }
  }

  return [...exportedTexts];
};

const resolveForbiddenPathSegment = (relativePath: string): string | null => (
  AI_ONLY_COGNITION_FORBIDDEN_PATH_SEGMENTS.find((segment) => relativePath.includes(segment)) ?? null
);

const matchesForbiddenIdentifierStem = (text: string, stem: string): boolean => {
  if (stem === "Detect") {
    return text.startsWith(stem);
  }

  return text.includes(stem);
};

const collectPathFinding = (relativePath: string): Finding[] => {
  const forbiddenSegment = resolveForbiddenPathSegment(relativePath);
  if (forbiddenSegment === null) {
    return [];
  }

  return [createFinding({
    lawId: LAW_ID_010,
    file: relativePath,
    line: 1,
    severity: "fatal",
    message: "Non-AI ability code must not ship cognition-labelled runtime, child, or support surfaces.",
    detail: `matched forbidden path segment ${forbiddenSegment}`,
  })];
};

const collectIdentifierFinding = (
  relativePath: string,
  sourceFile: ReturnType<ReturnType<typeof getAuditProject>["getSourceFiles"]>[number],
): Finding[] => {
  for (const text of collectExportedIdentifierTexts(sourceFile)) {
    const forbiddenStem = AI_ONLY_COGNITION_FORBIDDEN_IDENTIFIER_STEMS.find((stem) => matchesForbiddenIdentifierStem(text, stem));
    if (!forbiddenStem) {
      continue;
    }

    const matchNode = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).find((identifier) => identifier.getText() === text);

    return [createFinding({
      lawId: LAW_ID_010,
      file: relativePath,
      line: matchNode ? getNodeLine(matchNode) : 1,
      severity: "fatal",
      message: "Non-AI ability code must not expose AI-owned detect, classification, freshness, threshold, ambiguity-policy, or local sensitive-text cognition surfaces.",
      detail: `${text} matched forbidden stem ${forbiddenStem}`,
    })];
  }

  return [];
};

const collectLiteralFinding = (
  relativePath: string,
  sourceFile: ReturnType<ReturnType<typeof getAuditProject>["getSourceFiles"]>[number],
): Finding[] => {
  const stringLiterals = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
  ];

  for (const literal of stringLiterals) {
    const literalText = literal.getLiteralText();
    const forbiddenLiteral = AI_ONLY_COGNITION_FORBIDDEN_LITERALS.find((value) => literalText === value);
    const forbiddenPrefix = AI_ONLY_COGNITION_FORBIDDEN_LITERAL_PREFIXES.find((value) => literalText.startsWith(value));
    if (!forbiddenLiteral && !forbiddenPrefix) {
      continue;
    }

    return [createFinding({
      lawId: LAW_ID_010,
      file: relativePath,
      line: getNodeLine(literal),
      severity: "fatal",
      message: "Non-AI ability code must not publish detect-* child ids, legacy cognition field names, local selection-policy literals, or wall/domain verdict literals.",
      detail: forbiddenLiteral ? `forbidden literal ${forbiddenLiteral}` : `forbidden literal prefix ${forbiddenPrefix}`,
    })];
  }

  return [];
};

const collectTargetSurfaceFindings = (
  relativePath: string,
  sourceFile: ReturnType<ReturnType<typeof getAuditProject>["getSourceFiles"]>[number],
): Finding[] => ([
  ...collectPathFinding(relativePath),
  ...collectIdentifierFinding(relativePath, sourceFile),
  ...collectLiteralFinding(relativePath, sourceFile),
]);

const collectProductPresenceDecisionFindings = (project: ReturnType<typeof getAuditProject>): Finding[] => {
  const productDecisionSource = project.getSourceFile(PRODUCT_PRESENCE_DECISION_PATH);
  const productDecisionText = productDecisionSource?.getFullText() ?? "";
  if (
    !productDecisionText.includes("PRODUCT_PRESENCE_MIN_CONFIDENCE")
    && !productDecisionText.includes("lowConfidence")
    && !productDecisionText.includes("input.confidence <")
    && !productDecisionText.includes("confidence <")
  ) {
    return [];
  }

  return [createFinding({
    lawId: LAW_ID_010,
    file: PRODUCT_PRESENCE_DECISION_PATH,
    line: 1,
    severity: "fatal",
    message: "Product-presence routing code must not judge low confidence or product truth; only AI output may decide product_yes/product_no.",
  })];
};

const createAiOnlyCognitionSurfacePhase = (findingCount: number): InspectorPhase => createPhase(
  "ai-only-cognition-surface-boundary",
  findingCount === 0 ? "PASS" : "CODE VIOLATION",
  findingCount === 0,
  findingCount === 0
    ? "Non-AI cognition purge targets no longer publish banned cognition-labelled surfaces, including visual-target threshold or detect policy remnants."
    : "Non-AI cognition purge targets still publish banned cognition-labelled surfaces.",
);

export function runAiOnlyCognitionSurfaceChecks(project: ReturnType<typeof getAuditProject>): { findings: Finding[]; phases: InspectorPhase[] } {
  const findings: Finding[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const relativePath = toRelativeSourcePath(sourceFile);
    if (!matchesTargetSurface(relativePath)) {
      continue;
    }

    findings.push(...collectTargetSurfaceFindings(relativePath, sourceFile));
  }

  findings.push(...collectProductPresenceDecisionFindings(project));

  return {
    findings,
    phases: [createAiOnlyCognitionSurfacePhase(findings.length)],
  };
}
