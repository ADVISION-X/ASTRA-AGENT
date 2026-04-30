import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { LAW_ID, SCORECARD_ITEMS, readScorecardData } from "./ast-utils.js";

function claimsReady(result: string): boolean {
  return result.includes("READY") && !result.includes("NOT_READY");
}

export async function runScorecardGate(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];
  const scorecard = await readScorecardData().catch((error) => {
    findings.push(createFinding({ lawId: LAW_ID, file: "docs/audit/commander-console-mac-app-shell-scorecard.md", line: 1, severity: "fatal", message: error instanceof Error ? error.message : "Scorecard gate cannot read the scorecard." }));
    return null;
  });

  if (!scorecard) {
    return {
      findings,
      phase: createPhase("scorecard-gate", "FAKE ENFORCEMENT", false, "Scorecard gate could not parse the scorecard."),
    };
  }

  if (scorecard.items.length !== SCORECARD_ITEMS.length) {
    findings.push(createFinding({ lawId: LAW_ID, file: "docs/audit/commander-console-mac-app-shell-scorecard.md", line: 1, severity: "error", message: `Scorecard must contain exactly ${SCORECARD_ITEMS.length} scoring items.` }));
  }

  let hasBelowThreshold = false;
  for (const itemName of SCORECARD_ITEMS) {
    const item = scorecard.items.find((entry) => entry.name === itemName);
    if (!item) {
      continue;
    }

    if (item.score < 95) {
      hasBelowThreshold = true;
      findings.push(createFinding({ lawId: LAW_ID, file: "docs/audit/commander-console-mac-app-shell-scorecard.md", line: 1, severity: "error", message: "Scorecard item is below the required 95-point threshold.", detail: `${item.name}: ${item.score}` }));
    }

    if (item.evidence.length === 0 || item.filesInspected.length === 0 || item.touchedFiles.length === 0 || item.proof.length === 0) {
      findings.push(createFinding({ lawId: LAW_ID, file: "docs/audit/commander-console-mac-app-shell-scorecard.md", line: 1, severity: "error", message: "Scorecard item is missing evidence, inspected files, touched files, or proof.", detail: item.name }));
    }

    const combinedText = [...item.failedReasons, item.requiredFix].join(" ").toLowerCase();
    for (const forbiddenToken of ["todo", "later", "follow-up"]) {
      if (combinedText.includes(forbiddenToken)) {
        findings.push(createFinding({ lawId: LAW_ID, file: "docs/audit/commander-console-mac-app-shell-scorecard.md", line: 1, severity: "error", message: "Scorecard contains a forbidden placeholder token.", detail: `${item.name}: ${forbiddenToken}` }));
      }
    }
  }

  if (claimsReady(scorecard.result) && hasBelowThreshold) {
    findings.push(createFinding({ lawId: LAW_ID, file: "docs/audit/commander-console-mac-app-shell-scorecard.md", line: 1, severity: "error", message: "Scorecard cannot claim READY while any item remains below 95." }));
  }

  return {
    findings,
    phase: createPhase(
      "scorecard-gate",
      findings.length === 0 ? "PASS" : "CODE VIOLATION",
      findings.length === 0,
      findings.length === 0
        ? `All ${SCORECARD_ITEMS.length} Mac app shell scorecard items are evidenced and score at least 95.`
        : "Mac app shell scorecard still contains under-95 items or incomplete evidence, so READY cannot be claimed.",
    ),
  };
}