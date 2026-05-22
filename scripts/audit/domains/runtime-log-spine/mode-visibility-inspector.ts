import { SyntaxKind } from "ts-morph";

import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../shared/source-files.js";
import { RuntimeLogSpineLaw, type RuntimeLogSpineFinding } from "./constants.js";

const heavyPayloadKeys = /\b(payload|raw|dom|html|bodyText|comments|signature|candidate|rawOutput|prompt)\b/u;

export const collectModeVisibilityFindings = (context: InspectorContext): {
  findings: RuntimeLogSpineFinding[];
  inspectedFiles: string[];
} => {
  const findings: RuntimeLogSpineFinding[] = [];
  const inspectedFiles: string[] = [];
  for (const sourceFile of context.project.getSourceFiles()) {
    const repoPath = getRepoSourcePath(sourceFile);
    if (!repoPath.startsWith("src/") || !/\.(?:ts|tsx)$/u.test(repoPath)) continue;
    inspectedFiles.push(repoPath);
    for (const property of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
      if (property.getName() !== "modeVisibility") continue;
      const initializer = property.getInitializer();
      const text = initializer?.getText() ?? "";
      const arrayLiteral = initializer?.asKind(SyntaxKind.ArrayLiteralExpression);
      if (arrayLiteral) {
        const invalid = arrayLiteral.getElements().some((element) => {
          const value = element.asKind(SyntaxKind.StringLiteral)?.getLiteralValue();
          return value !== undefined && !["FLOW", "DEBUG", "TRACE"].includes(value);
        });
        if (invalid || arrayLiteral.getElements().length === 0) {
        findings.push({
          checkId: "runtime-log-spine/mode-visibility-values",
          lawId: RuntimeLogSpineLaw.MODE_VISIBILITY,
          file: repoPath,
          line: property.getStartLineNumber(),
          severity: "fatal",
          message: "runtime log event has invalid modeVisibility values",
          hint: "modeVisibility must contain only FLOW, DEBUG, and TRACE.",
        });
      }
      }
      const objectText = property.getFirstAncestorByKind(SyntaxKind.ObjectLiteralExpression)?.getText() ?? "";
      const nearbyText = sourceFile.getText().slice(Math.max(0, property.getStart() - 700), property.getEnd() + 700);
      if (/\bFLOW\b/u.test(text) && heavyPayloadKeys.test(objectText) && !/isDebugEnabled\(|isTraceEnabled\(/u.test(nearbyText)) {
        findings.push({
          checkId: "runtime-log-spine/heavy-payload-flow-guard",
          lawId: RuntimeLogSpineLaw.MODE_VISIBILITY,
          file: repoPath,
          line: property.getStartLineNumber(),
          severity: "fatal",
          message: "runtime log event is missing modeVisibility or exposes debug payload to FLOW",
          hint: "Add correct modeVisibility and guard heavy payload construction with isDebugEnabled/isTraceEnabled.",
        });
      }
    }
  }
  return { findings, inspectedFiles: inspectedFiles.sort() };
};
