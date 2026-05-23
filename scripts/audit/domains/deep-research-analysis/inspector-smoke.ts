import { existsSync, readFileSync } from "node:fs";

import {
  Node,
  Project,
  SyntaxKind,
  type ExportDeclaration,
  type Identifier,
  type PropertyAccessExpression,
  type SourceFile,
  type StringLiteral,
  type Symbol,
  type TypeChecker,
  type VariableDeclaration,
} from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { getRepoSourcePath } from "../../shared/source-files.js";

const hasStringLiteral = (sourceFile: SourceFile, value: string): boolean =>
  sourceFile
    .getDescendantsOfKind(SyntaxKind.StringLiteral)
    .some((literal) => literal.getLiteralValue() === value);

const countAstCoverageNodes = (project: Project, sourceFile: SourceFile): number => {
  const checker: TypeChecker = project.getTypeChecker();
  const variables: VariableDeclaration[] = sourceFile.getVariableDeclarations();
  const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  const properties: PropertyAccessExpression[] = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
  const strings: StringLiteral[] = sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral);
  const identifiers: Identifier[] = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier);
  const exports: ExportDeclaration[] = sourceFile.getExportDeclarations();
  const resolvedSymbols: Symbol[] = identifiers
    .map((identifier) => checker.getSymbolAtLocation(identifier))
    .filter((symbol): symbol is Symbol => Boolean(symbol));
  return variables.length + calls.length + properties.length + strings.length + identifiers.length + exports.length + resolvedSymbols.length;
};

const addMissingSymbolFindings = (input: {
  sourceFile: SourceFile;
  findings: InspectorFinding[];
  lawId: string;
  checkId: string;
  symbols: readonly string[];
  messagePrefix: string;
}): void => {
  const repoPath = getRepoSourcePath(input.sourceFile);
  for (const symbolName of input.symbols) {
    const present = input.sourceFile
      .getDescendantsOfKind(SyntaxKind.Identifier)
      .some((identifier) => identifier.getText() === symbolName);
    if (present) {
      continue;
    }
    input.findings.push(
      createFinding({
        checkId: input.checkId,
        lawId: input.lawId,
        filePath: repoPath,
        message: `${input.messagePrefix} ${symbolName}.`,
      }),
    );
  }
};

const inspectSmokeScripts = (input: {
  smokeFile: SourceFile;
  ciFullFile: SourceFile | undefined;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  const packagePath = "package.json";
  const ciFullPath = "scripts/audit/ci-full.ts";
  const packageJson = JSON.parse(readFileSync(resolveFromRepo(packagePath), "utf8")) as {
    scripts?: Record<string, string>;
  };
  if (!packageJson.scripts?.["acceptance:deep-research-analysis-smoke"]) {
    input.findings.push(
      createFinding({
        checkId: "deep-research/smoke-package-script",
        lawId: input.lawId,
        filePath: packagePath,
        message: "package.json must expose acceptance:deep-research-analysis-smoke.",
      }),
    );
  }
  if (!input.ciFullFile || !hasStringLiteral(input.ciFullFile, "acceptance:deep-research-analysis-smoke")) {
    input.findings.push(
      createFinding({
        checkId: "deep-research/smoke-ci-full",
        lawId: input.lawId,
        filePath: ciFullPath,
        message: "ci-full.ts must call acceptance:deep-research-analysis-smoke.",
      }),
    );
  }
};

const inspectSmokeAssertions = (input: {
  smokeFile: SourceFile;
  findings: InspectorFinding[];
  lawId: string;
  smokePath: string;
}): void => {
  const assertCalls = input.smokeFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter(
      (call) =>
        Node.isIdentifier(call.getExpression())
        && call.getExpression().getText() === "assert",
    );
  if (assertCalls.length < 8) {
    input.findings.push(
      createFinding({
        checkId: "deep-research/smoke-assertions",
        lawId: input.lawId,
        filePath: input.smokePath,
        message: "Smoke must use assertions and must not only print PASS.",
      }),
    );
  }
  const processExitZero = input.smokeFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .some(
      (call) =>
        Node.isPropertyAccessExpression(call.getExpression())
        && call.getExpression().getText() === "process.exit"
        && call.getArguments().some((argument) => argument.getText() === "0"),
    );
  const swallowedCatch = input.smokeFile
    .getDescendantsOfKind(SyntaxKind.CatchClause)
    .some((clause) => clause.getDescendantsOfKind(SyntaxKind.ThrowStatement).length === 0);
  if (processExitZero || swallowedCatch) {
    input.findings.push(
      createFinding({
        checkId: "deep-research/smoke-fake-pass",
        lawId: input.lawId,
        filePath: input.smokePath,
        message: "Smoke must not swallow catch branches or force process.exit(0).",
      }),
    );
  }
};

const inspectSmokeRealSurface = (input: {
  smokeFile: SourceFile;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  addMissingSymbolFindings({
    sourceFile: input.smokeFile,
    findings: input.findings,
    lawId: input.lawId,
    checkId: "deep-research/smoke-real-surface",
    symbols: [
      "parseDeepResearchPositiveResponse",
      "parseDeepResearchFalsificationResponse",
      "parseDeepResearchFinalReportResponse",
      "createDeepResearchRecordStore",
      "buildDeepResearchFinalPackage",
      "exportDeepResearchArtifacts",
      "runDeepResearchAnalysis",
    ],
    messagePrefix: "Smoke must import or call real Deep Research surface",
  });
};

const inspectSmokeExportAssertions = (input: {
  smokeFile: SourceFile;
  findings: InspectorFinding[];
  lawId: string;
  smokePath: string;
}): void => {
  for (const exportFile of [
    "final-report.md",
    "research-bundle.json",
    "evidence-index.json",
  ]) {
    if (hasStringLiteral(input.smokeFile, exportFile)) {
      continue;
    }
    input.findings.push(
      createFinding({
        checkId: "deep-research/smoke-export-assertion",
        lawId: input.lawId,
        filePath: input.smokePath,
        message: `Smoke must verify ${exportFile}.`,
      }),
    );
  }
};

const inspectSmokeRuntimeSignals = (input: {
  smokeFile: SourceFile;
  findings: InspectorFinding[];
  lawId: string;
  smokePath: string;
}): void => {
  for (const runtimeSignal of [
    "DEEP_RESEARCH_JOB_STARTED",
    "DEEP_RESEARCH_JOB_COMPLETED",
    "RUNTIME_STAGE_STARTED",
  ]) {
    if (hasStringLiteral(input.smokeFile, runtimeSignal)) {
      continue;
    }
    input.findings.push(
      createFinding({
        checkId: "deep-research/smoke-runtime-log",
        lawId: input.lawId,
        filePath: input.smokePath,
        message: `Smoke must verify runtime log signal ${runtimeSignal}.`,
      }),
    );
  }
};

const inspectSmokeAstCoverage = (input: {
  hasAstCoverage: boolean;
  findings: InspectorFinding[];
  lawId: string;
  smokePath: string;
}): void => {
  if (input.hasAstCoverage) {
    return;
  }
  input.findings.push(
    createFinding({
      checkId: "deep-research/smoke-ast-symbol",
      lawId: input.lawId,
      filePath: input.smokePath,
      message: "Smoke inspector must exercise ts-morph AST and symbol evidence.",
    }),
  );
};

export const inspectSmokeAcceptance = (input: {
  smokeFile: SourceFile | undefined;
  ciFullFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  const smokePath = "scripts/acceptance/deep-research-analysis-smoke.ts";
  const packagePath = "package.json";
  const ciFullPath = "scripts/audit/ci-full.ts";
  input.inspectedFiles.add(smokePath);
  input.inspectedFiles.add(packagePath);
  input.inspectedFiles.add(ciFullPath);
  if (!existsSync(resolveFromRepo(smokePath)) || !input.smokeFile) {
    input.findings.push(
      createFinding({
        checkId: "deep-research/smoke-file",
        lawId: input.lawId,
        filePath: smokePath,
        message: "Deep Research smoke acceptance file must exist.",
      }),
    );
    return;
  }

  inspectSmokeScripts({
    smokeFile: input.smokeFile,
    ciFullFile: input.ciFullFile,
    findings: input.findings,
    lawId: input.lawId,
  });
  inspectSmokeAssertions({
    smokeFile: input.smokeFile,
    findings: input.findings,
    lawId: input.lawId,
    smokePath,
  });
  inspectSmokeRealSurface({
    smokeFile: input.smokeFile,
    findings: input.findings,
    lawId: input.lawId,
  });
  inspectSmokeExportAssertions({
    smokeFile: input.smokeFile,
    findings: input.findings,
    lawId: input.lawId,
    smokePath,
  });
  inspectSmokeRuntimeSignals({
    smokeFile: input.smokeFile,
    findings: input.findings,
    lawId: input.lawId,
    smokePath,
  });
  inspectSmokeAstCoverage({
    hasAstCoverage: countAstCoverageNodes(input.smokeFile.getProject(), input.smokeFile) > 0,
    findings: input.findings,
    lawId: input.lawId,
    smokePath,
  });
};
