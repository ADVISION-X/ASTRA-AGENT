import { ts, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

type ParsedSourceFile = ts.SourceFile & {
  parseDiagnostics?: readonly ts.Diagnostic[];
};

export type ParseDiagnosticScanSummary = {
  diagnosticCount: number;
  scannedFileCount: number;
};

const getScriptKind = (repoPath: string): ts.ScriptKind => {
  if (repoPath.endsWith(".tsx")) {
    return ts.ScriptKind.TSX;
  }
  if (repoPath.endsWith(".jsx")) {
    return ts.ScriptKind.JSX;
  }
  if (repoPath.endsWith(".js") || repoPath.endsWith(".mjs")) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
};

const flattenDiagnosticMessage = (diagnostic: ts.Diagnostic): string =>
  ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n").trim();

const summarizeDiagnostics = (diagnostics: readonly ts.Diagnostic[]): string => {
  const messages = diagnostics.slice(0, 3).map(flattenDiagnosticMessage);
  if (diagnostics.length <= 3) {
    return messages.join(" | ");
  }
  return `${messages.join(" | ")} | +${diagnostics.length - 3} more`;
};

const collectParseDiagnostics = (sourceFile: SourceFile): readonly ts.Diagnostic[] => {
  const repoPath = getRepoSourcePath(sourceFile);
  const parsed = ts.createSourceFile(
    repoPath,
    sourceFile.getFullText(),
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(repoPath),
  );
  return (parsed as ParsedSourceFile).parseDiagnostics ?? [];
};

export const inspectSourceParseDiagnostics = (input: {
  sourceFiles: readonly SourceFile[];
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): ParseDiagnosticScanSummary => {
  let diagnosticCount = 0;

  for (const sourceFile of input.sourceFiles) {
    const repoPath = getRepoSourcePath(sourceFile);
    input.inspectedFiles.add(repoPath);

    const diagnostics = collectParseDiagnostics(sourceFile);
    diagnosticCount += diagnostics.length;
    if (diagnostics.length === 0) {
      continue;
    }

    const firstDiagnostic = diagnostics[0];
    if (!firstDiagnostic) {
      continue;
    }
    const line = firstDiagnostic.start === undefined
      ? undefined
      : sourceFile.getLineAndColumnAtPos(firstDiagnostic.start).line;
    input.findings.push(createFinding({
      checkId: "deep-research/source-parse-diagnostics",
      lawId: input.lawId,
      filePath: repoPath,
      ...(line ? { line } : {}),
      message: `Deep Research active source must remain AST-parseable; found ${diagnostics.length} parse diagnostic(s).`,
      evidence: summarizeDiagnostics(diagnostics),
    }));
  }

  return {
    diagnosticCount,
    scannedFileCount: input.sourceFiles.length,
  };
};