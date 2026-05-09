import { readFile } from "node:fs/promises";

import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { LAW_IDS } from "./config.js";

const LAW_FILE = ".github/instructions/cursor-rules/modules/module-post-action-verification-capability.instructions.md";

const collectLawBaselineFindings = (content: string): Finding[] => {
  const findings: Finding[] = [];

  if (content.includes("enforcementMode: manual-first")) {
    findings.push(createFinding({ lawId: LAW_IDS.PACKAGE, file: LAW_FILE, line: 1, severity: "fatal", message: "Post Action Verification active laws must remain machine-blocking." }));
  }
  if (content.includes("tier: P1")) {
    findings.push(createFinding({ lawId: LAW_IDS.PACKAGE, file: LAW_FILE, line: 1, severity: "fatal", message: "Post Action Verification active laws must remain P0." }));
  }
  if (content.includes("evidenceMode: law\n") || content.includes("evidenceMode: law\r\n")) {
    findings.push(createFinding({ lawId: LAW_IDS.PACKAGE, file: LAW_FILE, line: 1, severity: "fatal", message: "Post Action Verification active laws must keep law+inspector evidence mode." }));
  }
  if (content.includes("No action can be considered verified without a Post-action Verification result or explicit governed review.")) {
    findings.push(createFinding({ lawId: LAW_IDS.PACKAGE, file: LAW_FILE, line: 1, severity: "fatal", message: "PAV law must not allow explicit governed review as a substitute for verifying real actions." }));
  }
  if (!content.includes("Explicit governed review is not a valid substitute for PAV in production automation.")) {
    findings.push(createFinding({ lawId: LAW_IDS.PACKAGE, file: LAW_FILE, line: 1, severity: "fatal", message: "PAV law must explicitly forbid governed review from replacing PAV for production actions." }));
  }

  return findings;
};

export async function runLawBaselineCheck(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const content = await readFile(pathFromRepoRoot(LAW_FILE), "utf8");
  const findings = collectLawBaselineFindings(content);

  return {
    findings,
    phase: createPhase(
      "law-baseline",
      findings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
      findings.length === 0,
      findings.length === 0
        ? "Post Action Verification active laws remain machine-blocking, P0, and inspector backed."
        : "Post Action Verification law baseline drifted away from the active enforcement contract.",
    ),
  };
}
