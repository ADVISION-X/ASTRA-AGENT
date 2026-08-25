import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { RuntimeLogSpineLaw, type RuntimeLogSpineFinding } from "./constants.js";

const requiredDebugBundleLiterals = [
  "runtime-log.jsonl",
  "mission-summary.json",
  "index.json",
  "round-summary.json",
  "stage-timeline.json",
  "recovery-trail.json",
] as const;

const requiredFiles = [
  "src/lib/runtime-logs/debug-bundle.ts",
  "src/lib/runtime-logs/debug-bundle-index.ts",
] as const;

const literalValues = (source: SourceFile): Set<string> => new Set([
  ...source.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralText()),
  ...source.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((literal) => literal.getLiteralText()),
]);

const hasCallToRedaction = (source: SourceFile): boolean => source
  .getDescendantsOfKind(SyntaxKind.CallExpression)
  .some((call) => {
    const expression = call.getExpression();
    if (!Node.isIdentifier(expression)) return false;
    const symbol = expression.getSymbol();
    const resolved = symbol?.getAliasedSymbol() ?? symbol;
    return resolved?.getDeclarations().some((declaration) =>
      declaration.getSourceFile().getFilePath() === resolveFromRepo("src/lib/runtime-logs/redaction.ts")
      && (declaration.getSymbol()?.getName() === "redactRuntimeLogEvent"
        || declaration.getSymbol()?.getName() === "redactRuntimeLogRecord")) ?? false;
  });

const pushFinding = (findings: RuntimeLogSpineFinding[], file: string, hint: string): void => {
  findings.push({
    checkId: "runtime-log-spine/debug-bundle-contract",
    lawId: RuntimeLogSpineLaw.DEBUG_BUNDLE,
    file,
    line: 1,
    severity: "fatal",
    message: "debug bundle replay infrastructure is missing or incomplete",
    hint,
  });
};

export const collectDebugBundleFindings = (context: InspectorContext): {
  findings: RuntimeLogSpineFinding[];
  inspectedFiles: string[];
} => {
  const findings: RuntimeLogSpineFinding[] = [];
  const inspectedFiles = [...requiredFiles];
  const sources = requiredFiles.map((repoPath) => ({ repoPath, source: context.project.getSourceFile(resolveFromRepo(repoPath)) }));

  for (const { repoPath, source } of sources) {
    if (source) continue;
    pushFinding(findings, repoPath, `Restore the governed debug bundle owner file ${repoPath}.`);
  }
  const combinedLiterals = new Set(sources.flatMap(({ source }) => source ? [...literalValues(source)] : []));
  for (const literal of requiredDebugBundleLiterals) {
    if (combinedLiterals.has(literal)) continue;
    pushFinding(findings, "src/lib/runtime-logs/debug-bundle.ts", `Debug bundle must own exact artifact name ${literal}.`);
  }
  const debugBundleSource = sources.find(({ repoPath }) => repoPath === "src/lib/runtime-logs/debug-bundle.ts")?.source;
  if (debugBundleSource && !hasCallToRedaction(debugBundleSource)) {
    pushFinding(findings, "src/lib/runtime-logs/debug-bundle.ts", "Debug bundle writes must call the canonical runtime-log redaction exports.");
  }
  return { findings, inspectedFiles };
};
