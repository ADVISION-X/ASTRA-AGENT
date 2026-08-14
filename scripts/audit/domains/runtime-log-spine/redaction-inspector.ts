import { existsSync } from "node:fs";

import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { RuntimeLogSpineLaw, type RuntimeLogSpineFinding } from "./constants.js";

const requiredPatternDeclarations = [
  "API_KEY_PATTERN",
  "SECRET_KEYS",
  "BASE64_PATTERN",
  "SIGNED_URL_QUERY_KEY",
  "INLINE_SECRET_VALUE",
] as const;

const pushFinding = (findings: RuntimeLogSpineFinding[], file: string, checkId: string, hint: string): void => {
  findings.push({
    checkId,
    lawId: RuntimeLogSpineLaw.REDACTION,
    file,
    line: 1,
    severity: "fatal",
    message: "runtime log redaction is missing or bypassed",
    hint,
  });
};

const sinkCallsCanonicalRedaction = (sinks: SourceFile): boolean => sinks
  .getDescendantsOfKind(SyntaxKind.CallExpression)
  .some((call) => {
    const expression = call.getExpression();
    if (!Node.isIdentifier(expression)) return false;
    const symbol = expression.getSymbol();
    const resolved = symbol?.getAliasedSymbol() ?? symbol;
    return resolved?.getDeclarations().some((declaration) =>
      declaration.getSourceFile().getFilePath() === resolveFromRepo("src/lib/runtime-logs/redaction.ts")
      && declaration.getSymbol()?.getName() === "redactRuntimeLogEvent") ?? false;
  });

export const collectRedactionFindings = (context: InspectorContext): {
  findings: RuntimeLogSpineFinding[];
  inspectedFiles: string[];
} => {
  const findings: RuntimeLogSpineFinding[] = [];
  const redactionPath = "src/lib/runtime-logs/redaction.ts";
  const sinksPath = "src/lib/runtime-logs/sinks.ts";
  const acceptancePath = "scripts/acceptance/runtime-log-redaction.acceptance.ts";
  const redaction = context.project.getSourceFile(resolveFromRepo(redactionPath));
  const sinks = context.project.getSourceFile(resolveFromRepo(sinksPath));

  if (!redaction) {
    pushFinding(findings, redactionPath, "runtime-log-spine/redaction-file", "Restore the canonical redaction owner.");
  } else {
    for (const name of requiredPatternDeclarations) {
      const declaration = redaction.getVariableDeclaration(name);
      if (declaration?.getInitializerIfKind(SyntaxKind.RegularExpressionLiteral)) continue;
      pushFinding(findings, redactionPath, "runtime-log-spine/redaction-pattern", `Redaction must keep AST-visible pattern declaration ${name}.`);
    }
    if (!redaction.getExportedDeclarations().has("redactRuntimeLogEvent")) {
      pushFinding(findings, redactionPath, "runtime-log-spine/redaction-export", "Redaction must export redactRuntimeLogEvent.");
    }
  }
  if (!sinks || !sinkCallsCanonicalRedaction(sinks)) {
    pushFinding(findings, sinksPath, "runtime-log-spine/sink-redaction", "Every sink path must call the canonical redactRuntimeLogEvent symbol before write.");
  }
  if (!existsSync(resolveFromRepo(acceptancePath))) {
    pushFinding(findings, acceptancePath, "runtime-log-spine/redaction-acceptance", "Restore the redaction acceptance.");
  }
  return { findings, inspectedFiles: [redactionPath, sinksPath, acceptancePath] };
};
