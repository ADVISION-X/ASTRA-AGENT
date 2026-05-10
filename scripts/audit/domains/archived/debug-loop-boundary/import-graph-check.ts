import { Node, Project, SyntaxKind, type SourceFile } from "ts-morph";

import type { Finding } from "../../core/schema.js";
import { toRepoRelativePath } from "../../core/paths.js";
import { buildFinding } from "./inspection-utils.js";

const FORBIDDEN_IMPORT_GRAPH_SEGMENTS = [
  "src/capabilities/mouse-click/",
  "src/capabilities/text-input/",
  "src/capabilities/screenshot/",
  "src/capabilities/visual-target/",
  "src/capabilities/geometry-guard/",
  "src/capabilities/mouse-scroll/",
  "src/capabilities/post-action-verification/",
  "src/capabilities/orchestration/runtime",
  "src/capabilities/orchestration/dispatcher",
  "src/capabilities/nerve-bus/",
  "src/capabilities/forensics-persistence/",
] as const;

const getImportLikeLiteral = (sourceFile: SourceFile): string[] => {
  const staticImports = sourceFile.getImportDeclarations().map((declaration) => declaration.getModuleSpecifierValue());
  const dynamicImports = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
    .flatMap((callExpression) => callExpression.getArguments())
    .filter((argument): argument is import("ts-morph").StringLiteral => Node.isStringLiteral(argument))
    .map((argument) => argument.getLiteralText());
  return [...staticImports, ...dynamicImports];
};

const getForbiddenLiteral = (sourceFile: SourceFile): string | undefined =>
  getImportLikeLiteral(sourceFile)
    .find((literal) => FORBIDDEN_IMPORT_GRAPH_SEGMENTS.some((segment) => literal.includes(segment)));

export const collectDebugLoopImportGraphFindings = (debugLoopFiles: string[]): Finding[] => {
  const project = new Project({ compilerOptions: { allowJs: true } });
  const findings: Finding[] = [];
  for (const absoluteFile of debugLoopFiles) {
    const forbiddenLiteral = getForbiddenLiteral(project.addSourceFileAtPath(absoluteFile));
    if (forbiddenLiteral) {
      findings.push(buildFinding({
        lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-002-V1",
        file: toRepoRelativePath(absoluteFile),
        line: 1,
        message: "debug-loop import graph must not reach production ability owners.",
        detail: forbiddenLiteral,
      }));
    }
  }
  return findings;
};
