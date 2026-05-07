import { SyntaxKind } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getAuditProject, getNodeLine, toRelativeSourcePath } from "../../core/ts-morph.js";

import { capabilityGroupGovernanceConstants } from "./inspection-constants.js";

const {
  LAW_ID_009,
  AI_ONLY_MEDIA_CHANGE_TARGETS,
  AI_ONLY_MEDIA_CHANGE_FORBIDDEN_DECLARATION_STEMS,
  AI_ONLY_MEDIA_CHANGE_FORBIDDEN_LITERALS,
} = capabilityGroupGovernanceConstants;

const matchesTargetSurface = (relativePath: string): boolean => (
  AI_ONLY_MEDIA_CHANGE_TARGETS.some((target) => relativePath === target || relativePath.startsWith(target))
);

const resolveForbiddenStem = (name: string): string | null => (
  AI_ONLY_MEDIA_CHANGE_FORBIDDEN_DECLARATION_STEMS.find((stem) => name.includes(stem)) ?? null
);

const collectDeclarationFindings = (
  relativePath: string,
  sourceFile: ReturnType<ReturnType<typeof getAuditProject>["getSourceFiles"]>[number],
): Finding[] => {
  const findings: Finding[] = [];
  const declarations = [
    ...sourceFile.getFunctions(),
    ...sourceFile.getClasses(),
    ...sourceFile.getTypeAliases(),
    ...sourceFile.getInterfaces(),
    ...sourceFile.getEnums(),
    ...sourceFile.getVariableDeclarations(),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.MethodDeclaration),
  ];

  for (const declaration of declarations) {
    const name = declaration.getName();
    if (!name) {
      continue;
    }

    const forbiddenStem = resolveForbiddenStem(name);
    if (forbiddenStem === null) {
      continue;
    }

    findings.push(createFinding({
      lawId: LAW_ID_009,
      file: relativePath,
      line: getNodeLine(declaration),
      severity: "fatal",
      message: "Non-AI capability or support code must not declare local video-change cognition helpers.",
      detail: `${name} matched forbidden stem ${forbiddenStem}`,
    }));
  }

  return findings;
};

const collectLiteralFindings = (
  relativePath: string,
  sourceFile: ReturnType<ReturnType<typeof getAuditProject>["getSourceFiles"]>[number],
): Finding[] => {
  const findings: Finding[] = [];
  const stringLiterals = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
  ];

  for (const literal of stringLiterals) {
    const literalText = literal.getLiteralText();
    const forbiddenLiteral = AI_ONLY_MEDIA_CHANGE_FORBIDDEN_LITERALS.find((value) => literalText === value);
    if (!forbiddenLiteral) {
      continue;
    }

    findings.push(createFinding({
      lawId: LAW_ID_009,
      file: relativePath,
      line: getNodeLine(literal),
      severity: "fatal",
      message: "Non-AI capability or support code must not revive verify-video-changed-after-scroll or related non-AI video-change outputs.",
      detail: `forbidden literal ${forbiddenLiteral}`,
    }));
  }

  return findings;
};

export function runAiOnlyMediaChangeChecks(project: ReturnType<typeof getAuditProject>): { findings: Finding[]; phases: InspectorPhase[] } {
  const findings: Finding[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const relativePath = toRelativeSourcePath(sourceFile);
    if (!matchesTargetSurface(relativePath)) {
      continue;
    }

    findings.push(...collectDeclarationFindings(relativePath, sourceFile));
    findings.push(...collectLiteralFindings(relativePath, sourceFile));
  }

  return {
    findings,
    phases: [
      createPhase(
        "ai-only-media-change-boundary",
        findings.length === 0 ? "PASS" : "CODE VIOLATION",
        findings.length === 0,
        findings.length === 0
          ? "Non-AI capability and support code no longer exposes retired video-change cognition surfaces."
          : "Non-AI capability or support code still exposes retired video-change cognition surfaces.",
      ),
    ],
  };
}