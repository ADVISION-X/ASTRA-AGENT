import {
  Node,
  SyntaxKind,
  type ArrowFunction,
  type FunctionDeclaration,
  type FunctionExpression,
  type ReturnStatement,
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

const analysisPath = "src/plugins/deep-research-analysis/deep-research-analysis.analysis-sub-questions.ts";
const finalPackagePath = "src/plugins/deep-research-analysis/deep-research-analysis.final-package.ts";
const smokePath = "scripts/acceptance/deep-research-analysis-smoke.ts";
const helperPath = "scripts/acceptance/deep-research-analysis-sub-question-fault-isolation.ts";

const getSourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const trackSourceFile = (inspectedFiles: Set<string>, sourceFile: SourceFile | undefined): void => {
  if (sourceFile) {
    inspectedFiles.add(getRepoSourcePath(sourceFile));
  }
};

const getFunctionLike = (
  sourceFile: SourceFile,
  functionName: string,
): FunctionDeclaration | ArrowFunction | FunctionExpression | undefined => {
  const functionDeclaration = sourceFile.getFunction(functionName);
  if (functionDeclaration) {
    return functionDeclaration;
  }
  const initializer = sourceFile.getVariableDeclaration(functionName)?.getInitializer();
  if (!initializer) {
    return undefined;
  }
  if (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer)) {
    return initializer;
  }
  return undefined;
};

const functionHasReturn = (
  sourceFile: SourceFile,
  functionName: string,
  predicate: (statement: ReturnStatement) => boolean,
): boolean => {
  const declaration = getFunctionLike(sourceFile, functionName);
  if (!declaration) {
    return false;
  }
  return declaration
    .getDescendantsOfKind(SyntaxKind.ReturnStatement)
    .some(predicate);
};

const smokeImportsHelper = (sourceFile: SourceFile): boolean =>
  sourceFile.getImportDeclarations().some((declaration) =>
    declaration.getModuleSpecifierValue().endsWith("./deep-research-analysis-sub-question-fault-isolation.js")
    && declaration.getNamedImports().some((namedImport) =>
      namedImport.getName() === "verifySingleSubQuestionFailureDoesNotKillJob"));

const smokeCallsHelper = (sourceFile: SourceFile): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((call) => {
      const expression = call.getExpression();
      return Node.isIdentifier(expression)
        && expression.getText() === "verifySingleSubQuestionFailureDoesNotKillJob";
    });

const inspectAnalysisFile = (input: InspectInput, analysisFile: SourceFile | undefined): void => {
  const hasForbiddenSubQuestionTerminal = analysisFile
    ? functionHasReturn(
      analysisFile,
      "runSubQuestionPhase",
      (statement) => statement.getText().includes("finishPromptFailure"),
    )
    : false;
  const hasCompletedFalseReturn = analysisFile
    ? functionHasReturn(
      analysisFile,
      "runSubQuestionPhase",
      (statement) => statement.getText().includes("completed: false"),
    )
    : false;
  const hasLoopEarlyReturn = analysisFile
    ? functionHasReturn(
      analysisFile,
      "runSubQuestionPhases",
      (statement) => statement.getText().includes("outcome"),
    )
    : false;
  if (!analysisFile || hasForbiddenSubQuestionTerminal || !hasCompletedFalseReturn || hasLoopEarlyReturn) {
    input.findings.push(createFinding({
      checkId: "deep-research/sub-question-fault-isolation",
      lawId: input.lawId,
      filePath: analysisPath,
      message: "Sub-question parse failure must stay local: runSubQuestionPhase may mark the current sub-question incomplete, but runSubQuestionPhases must not terminate the whole job on the first failure.",
    }));
  }
};

const inspectFinalPackageFile = (input: InspectInput, finalPackageFile: SourceFile | undefined): void => {
  const hasMissingSubQuestionIds = finalPackageFile
    ? finalPackageFile.getDescendantsOfKind(SyntaxKind.Identifier)
      .some((identifier) => identifier.getText() === "missingSubQuestionIds")
    : false;
  if (!finalPackageFile || !hasMissingSubQuestionIds) {
    input.findings.push(createFinding({
      checkId: "deep-research/final-package-missing-sub-questions",
      lawId: input.lawId,
      filePath: finalPackagePath,
      message: "Final package must carry missingSubQuestionIds so final synthesis can surface evidence gaps instead of failing the whole job early.",
    }));
  }
};

const inspectSmokeHelper = (input: InspectInput, smokeFile: SourceFile | undefined, helperFile: SourceFile | undefined): void => {
  const helperExportsCheck = helperFile
    ? Boolean(
      helperFile.getFunction("verifySingleSubQuestionFailureDoesNotKillJob")
      ?? helperFile.getVariableDeclaration("verifySingleSubQuestionFailureDoesNotKillJob"),
    )
    : false;
  const helperHasEvidenceGapAssertion = helperFile
    ? helperFile.getDescendantsOfKind(SyntaxKind.StringLiteral)
      .some((literal) => literal.getLiteralValue().includes("Missing structured positive or falsification record"))
    : false;
  const smokeWiresHelper = smokeFile
    ? smokeImportsHelper(smokeFile) && smokeCallsHelper(smokeFile)
    : false;
  if (!helperFile || !helperExportsCheck || !helperHasEvidenceGapAssertion || !smokeFile || !smokeWiresHelper) {
    input.findings.push(createFinding({
      checkId: "deep-research/sub-question-fault-isolation-smoke",
      lawId: input.lawId,
      filePath: helperPath,
      message: "Smoke must import and run verifySingleSubQuestionFailureDoesNotKillJob, and the helper must assert that one failed sub-question still yields a final report with explicit evidence gaps.",
    }));
  }
};

export const inspectSubQuestionFaultIsolation = (input: InspectInput): void => {
  const analysisFile = getSourceFile(input.context, analysisPath);
  const finalPackageFile = getSourceFile(input.context, finalPackagePath);
  const smokeFile = getSourceFile(input.context, smokePath);
  const helperFile = getSourceFile(input.context, helperPath);
  [analysisFile, finalPackageFile, smokeFile, helperFile].forEach((sourceFile) => trackSourceFile(input.inspectedFiles, sourceFile));
  inspectAnalysisFile(input, analysisFile);
  inspectFinalPackageFile(input, finalPackageFile);
  inspectSmokeHelper(input, smokeFile, helperFile);
};