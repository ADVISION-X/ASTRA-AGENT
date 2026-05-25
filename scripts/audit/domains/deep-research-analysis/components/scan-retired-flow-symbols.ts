import { SyntaxKind, type SourceFile } from "ts-morph";
import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const decode = (value: string): string => Buffer.from(value, "base64").toString("utf8");

const forbiddenSymbols = new Set([
  decode("bGVnYWN5XzFfbl9uXzE="),
  decode("ZmluYWxfc3ludGhlc2lz"),
  decode("ZGVja19leHBvcnRfcGFydGlhbA=="),
  decode("cnVuQnVzaW5lc3NEZWNrUGhhc2U="),
  decode("cnVuUHB0QXJ0aWZhY3RQaGFzZQ=="),
  decode("cmVuZGVyRGVlcFJlc2VhcmNoQnVzaW5lc3NQcHRBcnRpZmFjdFByb21wdA=="),
  decode("cGFyc2VBbmREb3dubG9hZEJ1c2luZXNzUHB0QXJ0aWZhY3Q="),
  decode("Z2VuZXJhdGVEZWVwUmVzZWFyY2hCdXNpbmVzc0RlY2tQcHR4"),
  decode("YnVpbGRDb25mbGljdE1hdHJpeA=="),
  decode("cG9zaXRpdmVBbnN3ZXJSZWNvcmRz"),
  decode("ZmFsc2lmaWNhdGlvbkFuc3dlclJlY29yZHM="),
  decode("bGVnYWN5TWlzc2luZ1Bvc2l0aXZlRmFsc2lmaWNhdGlvblN1YlF1ZXN0aW9uSWRz"),
  decode("c2VsZWN0T3B0aW9uYWxQcmVzZW50YXRpb25EZWNr"),
]);

export const inspectRetiredFlowSymbols = (input: {
  sourceFiles: readonly SourceFile[];
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  for (const sourceFile of input.sourceFiles) {
    const repoPath = getRepoSourcePath(sourceFile);
    input.inspectedFiles.add(repoPath);
    const found = [
      ...sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).map((identifier) => identifier.getText()),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralValue()),
    ].filter((value) => forbiddenSymbols.has(value));
    if (found.length === 0) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/no-retired-flow-symbols",
      lawId: input.lawId,
      filePath: repoPath,
      message: `Forbidden flow symbol remains: ${[...new Set(found)].join(", ")}.`,
    }));
  }
};
