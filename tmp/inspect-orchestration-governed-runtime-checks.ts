import { Node, Project, SyntaxKind } from "ts-morph";

import {
  getBooleanLikeParameterCount,
  getFunctionMetrics,
  getFunctionName,
  getFunctionNodes,
  getLogicalLineCount,
} from "../scripts/audit/domains/code-purity/components/purity-function-analysis.ts";

const relativePath = "scripts/audit/domains/orchestration-capability/run-governed-runtime-checks.ts";

const countIfChain = (statement: import("ts-morph").IfStatement): number => {
  let count = 1;
  let current: import("ts-morph").IfStatement | undefined = statement;
  while (current) {
    const elseStatement = current.getElseStatement();
    if (!elseStatement || !Node.isIfStatement(elseStatement)) {
      break;
    }
    count += 1;
    current = elseStatement;
  }
  return count;
};

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
  skipAddingFilesFromTsConfig: false,
  compilerOptions: {
    allowJs: true,
  },
});

const sourceFile = project.addSourceFileAtPath(relativePath);

const offenders = getFunctionNodes(sourceFile).flatMap((functionNode) => {
  const name = getFunctionName(functionNode, relativePath);
  const metrics = getFunctionMetrics(functionNode);
  const body = functionNode.getBody();
  const statements = body ? (Node.isBlock(body) ? body.getStatements().length : 1) : 0;
  const returns = functionNode.getDescendantsOfKind(SyntaxKind.ReturnStatement).length;
  const switchCases = functionNode.getDescendantsOfKind(SyntaxKind.CaseClause).length;
  const ifChain = Math.max(0, ...functionNode.getDescendantsOfKind(SyntaxKind.IfStatement).map((statement) => countIfChain(statement)));
  const booleanParameters = getBooleanLikeParameterCount(functionNode);
  const logicalLines = getLogicalLineCount(functionNode);
  const over = {
    logicalLines: logicalLines > 40,
    statements: statements > 35,
    parameters: functionNode.getParameters().length > 4,
    returns: returns > 5,
    depth: metrics.maxDepth > 3,
    complexity: metrics.complexity > 8,
    switchCases: switchCases > 8,
    ifChain: ifChain > 5,
    booleanParameters: booleanParameters > 1,
  };

  if (!Object.values(over).some(Boolean)) {
    return [];
  }

  return [{
    name,
    line: functionNode.getStartLineNumber(),
    logicalLines,
    statements,
    parameters: functionNode.getParameters().length,
    returns,
    depth: metrics.maxDepth,
    complexity: metrics.complexity,
    switchCases,
    ifChain,
    booleanParameters,
    over: Object.entries(over)
      .filter(([, enabled]) => enabled)
      .map(([metric]) => metric),
  }];
});

process.stdout.write(JSON.stringify({ lineCount: sourceFile.getEndLineNumber(), offenders }, null, 2));