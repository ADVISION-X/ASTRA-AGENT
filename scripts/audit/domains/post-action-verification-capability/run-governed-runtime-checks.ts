import type { Project } from "ts-morph";

import { createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { runPostActionGovernedRuntimeFixtures } from "./governed-runtime-fixtures.js";

// workbench-ability-command-executor.ts and workbench-post-action-dispatch-input.ts
// were removed in the local-runtime rebuild (phase five). PAV dispatch is now
// governed through workbench-nerve-bus-dispatcher.ts → workbench-assembly.ts.

export async function runGovernedRuntimeChecks(_project: Project): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const governedFixtureFindings: Finding[] = [];

  try {
    await runPostActionGovernedRuntimeFixtures();
  } catch (error) {
    governedFixtureFindings.push({
      lawId: "GRASSEYE-PAV-PROOF-001-V1",
      file: "scripts/audit/domains/post-action-verification-capability/governed-runtime-fixtures.ts",
      line: 1,
      severity: "fatal",
      message: error instanceof Error ? error.message : "Post Action Verification governed runtime fixture failed.",
    });
  }

  const passed = governedFixtureFindings.length === 0;

  return {
    findings: governedFixtureFindings,
    phases: [
      createPhase(
        "governed-runtime-fixtures",
        passed ? "PASS" : "CODE VIOLATION",
        passed,
        passed
          ? "Governed PAV fixtures pass (local-runtime rebuild phase five)."
          : "Governed PAV fixture failure detected after local-runtime rebuild.",
      ),
    ],
  };
}
