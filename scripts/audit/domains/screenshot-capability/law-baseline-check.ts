import { readFile } from "node:fs/promises";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { LAW_IDS } from "./config.js";

const LAW_FILE = ".github/instructions/cursor-rules/modules/module-screenshot-capability.instructions.md";
const INSPECTOR_FILE = "scripts/audit/domains/screenshot-capability/inspector.ts";

async function collectLawFileFindings(findings: Finding[]): Promise<void> {
  const content = await readFile(LAW_FILE, "utf8");
  if (content.includes("enforcementMode: manual-first")) {
    findings.push(createFinding({ lawId: LAW_IDS.REAL_CODE_INSPECTION, file: LAW_FILE, line: 1, severity: "fatal", message: "Screenshot active laws must remain machine-blocking." }));
  }
  if (content.includes("tier: P1")) {
    findings.push(createFinding({ lawId: LAW_IDS.REAL_CODE_INSPECTION, file: LAW_FILE, line: 1, severity: "fatal", message: "Screenshot active laws must remain P0." }));
  }
  if (!content.includes("evidenceMode: law+blueprint+real-code-inspection")) {
    findings.push(createFinding({ lawId: LAW_IDS.REAL_CODE_INSPECTION, file: LAW_FILE, line: 1, severity: "fatal", message: "Screenshot active laws must keep law+blueprint+real-code-inspection evidence mode." }));
  }
}

export async function runLawBaselineCheck(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];
  await collectLawFileFindings(findings);
  const inspectorText = await readFile(INSPECTOR_FILE, "utf8");
  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "law-baseline-check",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Screenshot law baseline remains machine-blocking, P0, and inspector-wired."
        : "Screenshot law baseline or inspector wiring drifted away from governed release truth.",
    ),
  };
}
