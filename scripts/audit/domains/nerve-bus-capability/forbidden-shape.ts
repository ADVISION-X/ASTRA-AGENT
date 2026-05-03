import { Node, SyntaxKind } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasCallExpression } from "../_shared/ast-helpers.js";
import { FORBIDDEN_TEXT_TOKENS, LAW_IDS, PATHS } from "./config.js";
import { getNerveBusSourceFiles, getSourceFile, makeProject, toRepoPath } from "./project-access.js";
import { sourceHasDynamicImport, sourceHasExportStar, sourceHasForbiddenImport, sourceHasNewDateOutsideClock, sourceHasRequire } from "./source-rules.js";

const BUSINESS_DECISION_TOKENS = ["nextStepId", "productDecision", "actionVerified", "candidateDisposition"] as const;

function sourceHasModuleLevelSequenceMap(relativePath: string, sourceFile: Parameters<typeof sourceHasExportStar>[0]): boolean {
  return relativePath === PATHS.SEQUENCE_POLICY
    && sourceFile.getVariableDeclarations().some((declaration) => declaration.getName() === "lastSequenceByScope");
}

function isDefaultInjectedProperty(propertyName: string): boolean {
  return ["requestedPlatformId", "selectedMapId", "targetRecordRef", "activationId"].includes(propertyName);
}

function isSupportedDefaultLiteral(node: Node): boolean {
  return Node.isStringLiteral(node)
    || Node.isNoSubstitutionTemplateLiteral(node)
    || Node.isNumericLiteral(node)
    || node.getKind() === SyntaxKind.TrueKeyword
    || node.getKind() === SyntaxKind.FalseKeyword;
}

function isDefaultingBinaryExpression(node: Node | undefined): node is import("ts-morph").BinaryExpression {
  if (!node || !Node.isBinaryExpression(node)) {
    return false;
  }

  const operator = node.getOperatorToken().getText();
  return operator === "??" || operator === "||";
}

function sourceHasDefaultInjection(sourceFile: Parameters<typeof sourceHasExportStar>[0]): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => {
    const propertyName = property.getName();
    if (!isDefaultInjectedProperty(propertyName)) {
      return false;
    }

    const initializer = property.getInitializer();
    if (!isDefaultingBinaryExpression(initializer)) {
      return false;
    }

    return isSupportedDefaultLiteral(initializer.getRight());
  });
}

function sourceHasBusinessDecisionField(relativePath: string, sourceText: string): boolean {
  if (!relativePath.startsWith(`${PATHS.ROOT}/`)) {
    return false;
  }

  return BUSINESS_DECISION_TOKENS.some((token) => sourceText.includes(token));
}

function sourceHasDirectCommanderBypass(relativePath: string, sourceFile: Parameters<typeof sourceHasExportStar>[0]): boolean {
  return relativePath === PATHS.COMMANDER_COMMAND_TRANSPORT
    && (hasCallExpression(sourceFile, "executeMissionControlCommand") || hasCallExpression(sourceFile, "setCandidateDisposition"));
}

function getInspectedSourceFiles(project: ReturnType<typeof makeProject>) {
  const extraFiles = [
    PATHS.HUMAN_COMMAND_DISPATCH,
    PATHS.COMMANDER_COMMAND_TRANSPORT,
    PATHS.ORCHESTRATION_ADAPTER,
  ]
    .map((path) => getSourceFile(project, path))
    .filter((sourceFile): sourceFile is NonNullable<typeof sourceFile> => sourceFile !== null);

  const seen = new Set<string>();
  return [...getNerveBusSourceFiles(project), ...extraFiles].filter((sourceFile) => {
    const key = sourceFile.getFilePath();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function collectStructuralFindings(relativePath: string, sourceText: string, sourceFile: Parameters<typeof sourceHasExportStar>[0]): Finding[] {
  const findings: Finding[] = [];
  if (sourceHasExportStar(sourceFile)) {
    findings.push(createFinding({ lawId: LAW_IDS.ENFORCEMENT, file: relativePath, line: 1, severity: "fatal", message: "Nerve Bus must not use export *." }));
  }
  if (sourceHasDynamicImport(sourceFile)) {
    findings.push(createFinding({ lawId: LAW_IDS.ENFORCEMENT, file: relativePath, line: 1, severity: "fatal", message: "Nerve Bus must not use dynamic import escape paths." }));
  }
  if (sourceHasRequire(sourceFile)) {
    findings.push(createFinding({ lawId: LAW_IDS.ENFORCEMENT, file: relativePath, line: 1, severity: "fatal", message: "Nerve Bus must not use require escape paths." }));
  }
  for (const token of FORBIDDEN_TEXT_TOKENS) {
    if (sourceText.includes(token)) {
      findings.push(createFinding({ lawId: token === "promptRef" ? LAW_IDS.AI : LAW_IDS.ENFORCEMENT, file: relativePath, line: 1, severity: "fatal", message: `Nerve Bus contains forbidden token ${token}.` }));
    }
  }
  return findings;
}

function collectClockBoundaryFinding(input: {
  relativePath: string;
  sourceFile: Parameters<typeof sourceHasExportStar>[0];
}): Finding | null {
  return input.relativePath.startsWith(`${PATHS.ROOT}/`)
    && input.relativePath !== PATHS.RUNNER
    && input.relativePath !== PATHS.CLOCK_PORT
    && sourceHasNewDateOutsideClock(input.sourceFile)
    ? createFinding({ lawId: LAW_IDS.BOUNDARY, file: input.relativePath, line: 1, severity: "fatal", message: "Nerve Bus must source time from the clock port and runtime context only." })
    : null;
}

function collectForbiddenImportBoundaryFinding(input: {
  relativePath: string;
  sourceFile: Parameters<typeof sourceHasExportStar>[0];
}): Finding | null {
  return sourceHasForbiddenImport(input.sourceFile)
    ? createFinding({ lawId: LAW_IDS.BOUNDARY, file: input.relativePath, line: 1, severity: "fatal", message: "Nerve Bus must not import forbidden capability internals." })
    : null;
}

function collectSequenceBoundaryFinding(input: {
  relativePath: string;
  sourceFile: Parameters<typeof sourceHasExportStar>[0];
}): Finding | null {
  return sourceHasModuleLevelSequenceMap(input.relativePath, input.sourceFile)
    ? createFinding({ lawId: LAW_IDS.PIPELINE, file: input.relativePath, line: 1, severity: "fatal", message: "Nerve Bus sequence policy must not use module-level mutable state." })
    : null;
}

function collectDefaultInjectionBoundaryFinding(input: {
  relativePath: string;
  sourceFile: Parameters<typeof sourceHasExportStar>[0];
}): Finding | null {
  return sourceHasDefaultInjection(input.sourceFile)
    ? createFinding({ lawId: LAW_IDS.CHAIN, file: input.relativePath, line: 1, severity: "fatal", message: "Nerve Bus transport builders must not inject silent defaults into governed envelope fields." })
    : null;
}

function collectCommanderBypassBoundaryFinding(input: {
  relativePath: string;
  sourceFile: Parameters<typeof sourceHasExportStar>[0];
}): Finding | null {
  return sourceHasDirectCommanderBypass(input.relativePath, input.sourceFile)
    ? createFinding({ lawId: LAW_IDS.PUBLIC, file: input.relativePath, line: 1, severity: "fatal", message: "Commander command transport must not bypass Nerve Bus by calling Orchestration directly." })
    : null;
}

function collectBusinessDecisionBoundaryFinding(input: {
  relativePath: string;
  sourceText: string;
}): Finding | null {
  return sourceHasBusinessDecisionField(input.relativePath, input.sourceText)
    ? createFinding({ lawId: LAW_IDS.RESULT, file: input.relativePath, line: 1, severity: "fatal", message: "Nerve Bus transport files must not add business decision fields." })
    : null;
}

const collectBoundaryRuleFindings = (input: {
  relativePath: string;
  sourceText: string;
  sourceFile: Parameters<typeof sourceHasExportStar>[0];
}): Array<Finding | null> => [
  collectClockBoundaryFinding(input),
  collectForbiddenImportBoundaryFinding(input),
  collectSequenceBoundaryFinding(input),
  collectDefaultInjectionBoundaryFinding(input),
  collectCommanderBypassBoundaryFinding(input),
  collectBusinessDecisionBoundaryFinding(input),
];

function collectBoundaryFindings(relativePath: string, sourceText: string, sourceFile: Parameters<typeof sourceHasExportStar>[0]): Finding[] {
  return collectBoundaryRuleFindings({ relativePath, sourceText, sourceFile }).filter((finding): finding is Finding => Boolean(finding));
}

export function runForbiddenShapeAttack(): { findings: Finding[]; phase: InspectorPhase } {
  const project = makeProject();
  const findings: Finding[] = [];

  for (const sourceFile of getInspectedSourceFiles(project)) {
    const relativePath = toRepoPath(sourceFile, project);
    const fullText = sourceFile.getFullText();
    findings.push(...collectStructuralFindings(relativePath, fullText, sourceFile));
    findings.push(...collectBoundaryFindings(relativePath, fullText, sourceFile));
  }

  const phasePassed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "forbidden-shape",
      phasePassed ? "PASS" : "CODE VIOLATION",
      phasePassed,
      phasePassed
        ? "Nerve Bus avoids raw prompt keys, default injection, direct commander bypass, and boundary escapes."
        : "Nerve Bus still contains forbidden prompt, default-injection, or boundary-escape shapes.",
    ),
  };
}