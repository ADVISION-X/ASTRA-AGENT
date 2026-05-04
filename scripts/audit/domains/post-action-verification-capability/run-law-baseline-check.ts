import { readFile } from "node:fs/promises";

import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { LAW_IDS } from "./config.js";

const LAW_FILE = ".github/instructions/cursor-rules/modules/module-post-action-verification-capability.instructions.md";

export async function runLawBaselineCheck(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const content = await readFile(pathFromRepoRoot(LAW_FILE), "utf8");
  const findings: Finding[] = [];

  if (content.includes("enforcementMode: manual-first")) {
    findings.push(createFinding({ lawId: LAW_IDS.PACKAGE, file: LAW_FILE, line: 1, severity: "fatal", message: "Post Action Verification active laws must remain machine-blocking." }));
  }
  if (content.includes("tier: P1")) {
    findings.push(createFinding({ lawId: LAW_IDS.PACKAGE, file: LAW_FILE, line: 1, severity: "fatal", message: "Post Action Verification active laws must remain P0." }));
  }
  if (content.includes("evidenceMode: law\n") || content.includes("evidenceMode: law\r\n")) {
    findings.push(createFinding({ lawId: LAW_IDS.PACKAGE, file: LAW_FILE, line: 1, severity: "fatal", message: "Post Action Verification active laws must keep law+inspector+negative-proof evidence mode." }));
  }

  return {
    findings,
    phase: createPhase(
      "law-baseline",
      findings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
      findings.length === 0,
      findings.length === 0
        ? "Post Action Verification active laws remain machine-blocking, P0, and negative-proof backed."
        : "Post Action Verification law baseline drifted away from the active enforcement contract.",
    ),
  };
}