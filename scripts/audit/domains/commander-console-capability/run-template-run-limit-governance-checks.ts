import { SyntaxKind } from "ts-morph";

import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";

const FORBIDDEN_IDENTIFIERS = ["defaultRunLimit", "maxAllowedRunLimit"] as const;
const FORBIDDEN_FILES = [
  "src/lib/local-app-shell/commander-console-shell-client-support.ts",
  "src/lib/local-app-shell/modules/TaskTemplateLauncher.ts",
  "src/lib/local-app-shell/modules/command/TaskTemplateLauncher.ts",
  "src/lib/local-app-shell/modules/RunLimitMiniForm.ts",
  "src/lib/local-app-shell/view-model/summary-sections.ts",
] as const;

export function runTemplateRunLimitGovernanceChecks(project: import("ts-morph").Project) {
  const findings = FORBIDDEN_FILES.flatMap((filePath) => {
    const source = project.addSourceFileAtPathIfExists(pathFromRepoRoot(filePath));
    if (!source) {
      return [createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V2", file: filePath, line: 1, severity: "fatal", message: "Commander run-limit governance audit cannot load required source file." })];
    }
    const identifiers = new Set(source.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()));
    return FORBIDDEN_IDENTIFIERS.flatMap((identifier) => {
      return identifiers.has(identifier)
        ? [createFinding({
            lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V2",
            file: filePath,
            line: 1,
            severity: "fatal",
            message: `Commander start UX must not consume template-owned run-limit field ${identifier}.`,
          })]
        : [];
    });
  });
  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "template-run-limit-governance",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Commander launcher uses app-owned run-limit defaults and no longer reads template-owned maxima or defaults."
        : "Commander launcher still reads template-owned run-limit defaults or maxima.",
    ),
  };
}