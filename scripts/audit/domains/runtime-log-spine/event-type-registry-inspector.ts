import { SyntaxKind } from "ts-morph";

import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../shared/source-files.js";
import { RuntimeLogSpineLaw, type RuntimeLogSpineFinding } from "./constants.js";

const isExcluded = (repoPath: string): boolean => repoPath === "src/lib/runtime-logs/event-types.ts";

export const collectEventTypeRegistryFindings = (context: InspectorContext): {
  findings: RuntimeLogSpineFinding[];
  inspectedFiles: string[];
} => {
  const findings: RuntimeLogSpineFinding[] = [];
  const inspectedFiles: string[] = [];
  for (const sourceFile of context.project.getSourceFiles()) {
    const repoPath = getRepoSourcePath(sourceFile);
    if (!repoPath.startsWith("src/") || !repoPath.endsWith(".ts") || isExcluded(repoPath)) continue;
    inspectedFiles.push(repoPath);
    for (const property of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
      if (property.getName() !== "eventType") continue;
      const initializer = property.getInitializer();
      if (!initializer?.asKind(SyntaxKind.StringLiteral)) continue;
      findings.push({
        checkId: "runtime-log-spine/event-type-registry",
        lawId: RuntimeLogSpineLaw.EVENT_REGISTRY,
        file: repoPath,
        line: property.getStartLineNumber(),
        severity: "fatal",
        message: "runtime log eventType uses an unregistered string literal",
        hint: "Add event type to RuntimeLogEventType registry and reference it as RuntimeLogEventType.X.",
      });
    }
  }
  return { findings, inspectedFiles: inspectedFiles.sort() };
};
