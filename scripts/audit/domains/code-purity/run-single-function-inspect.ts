import path from "path";
import { Project, SyntaxKind, type SourceFile } from "ts-morph";
import { getFunctionNodes, getFunctionMetrics, getLogicalLineCount, getFunctionName, getBooleanLikeParameterCount, isSilentCatchClause } from "./components/purity-function-analysis.js";

type FunctionNode = ReturnType<typeof getFunctionNodes>[number];

const readTargetPath = (): string => {
  const targetPath = process.argv[2];
  if (!targetPath) {
    console.error("Usage: node --import tsx run-single-function-inspect.ts <file> <startLine>");
    process.exit(2);
  }

  return targetPath;
};

const resolveSourceFile = (project: Project, targetPath: string): SourceFile => {
  const sourceFile = project.getSourceFile(targetPath);
  if (!sourceFile) {
    console.error("Source file not found:", targetPath);
    process.exit(2);
  }

  return sourceFile;
};

const findFunctionNode = (sourceFile: SourceFile, targetPath: string, targetLine: number): FunctionNode => {
  const functions = getFunctionNodes(sourceFile);
  for (const fn of functions) {
    const startLine = fn.getStartLineNumber?.() ?? fn.getStartLineNumber();
    if (startLine === targetLine) {
      return fn;
    }

    const name = getFunctionName(fn, targetPath);
    if (name === "executeNerveBusChild") {
      return fn;
    }
  }

  console.error("Function node not found at line", targetLine);
  process.exit(2);
};

const buildInspectionResult = (found: FunctionNode, targetPath: string) => {
  const logicalLines = getLogicalLineCount(found);
  const params = found.getParameters().length;
  const booleanLikeParameterCount = getBooleanLikeParameterCount(found);
  const metrics = getFunctionMetrics(found);
  const catchClauses = found.getDescendantsOfKind(SyntaxKind.CatchClause);
  const silentCatch = catchClauses.some((c) => isSilentCatchClause(c));

  return {
    file: targetPath,
    functionName: getFunctionName(found, targetPath),
    startLine: found.getStartLineNumber(),
    logicalLines,
    params,
    booleanLikeParameterCount,
    maxDepth: metrics.maxDepth,
    complexity: metrics.complexity,
    cognitive: metrics.cognitive,
    silentCatch,
  };
};

const writeInspectionResult = (result: ReturnType<typeof buildInspectionResult>): void => {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
};

const main = async (): Promise<void> => {
  const targetPath = readTargetPath();
  const targetLine = Number(process.argv[3]);
  const project = new Project({ tsConfigFilePath: path.resolve(process.cwd(), "tsconfig.json") });
  const sourceFile = resolveSourceFile(project, targetPath);
  const found = findFunctionNode(sourceFile, targetPath, targetLine);
  writeInspectionResult(buildInspectionResult(found, targetPath));
};

void main().catch((err) => {
  console.error(err);
  process.exit(2);
});
