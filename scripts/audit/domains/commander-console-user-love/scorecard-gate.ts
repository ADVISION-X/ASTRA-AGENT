import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { LAW_ID, SCORECARD_ITEMS, readScorecardData } from "./ast-utils.js";

async function loadScorecard(findings: Finding[]) {
  return readScorecardData().catch((error) => {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: "docs/audit/commander-console-user-love-scorecard.md",
      line: 1,
      severity: "fatal",
      message: error instanceof Error ? error.message : "Scorecard gate cannot read the scorecard.",
    }));
    return null;
  });
}

function collectItemCountFindings(scorecard: NonNullable<Awaited<ReturnType<typeof readScorecardData>>>): Finding[] {
  return scorecard.items.length !== SCORECARD_ITEMS.length
    ? [createFinding({ lawId: LAW_ID, file: "docs/audit/commander-console-user-love-scorecard.md", line: 1, severity: "error", message: `Scorecard must contain exactly ${SCORECARD_ITEMS.length} scoring items.` })]
    : [];
}

function collectPlaceholderFindings(item: NonNullable<Awaited<ReturnType<typeof readScorecardData>>>["items"][number]): Finding[] {
  const findings: Finding[] = [];
  const combinedText = [...item.failedReasons, item.requiredFix, item.userFacingAcceptance, item.developerFacingAcceptance].join(" ").toLowerCase();
  for (const forbiddenToken of ["todo", "later", "follow-up"]) {
    if (combinedText.includes(forbiddenToken)) {
      findings.push(createFinding({ lawId: LAW_ID, file: "docs/audit/commander-console-user-love-scorecard.md", line: 1, severity: "error", message: "Scorecard contains a forbidden placeholder token.", detail: `${item.name}: ${forbiddenToken}` }));
    }
  }
  return findings;
}

function collectScorecardItemFindings(item: NonNullable<Awaited<ReturnType<typeof readScorecardData>>>["items"][number]): Finding[] {
  const findings: Finding[] = [];
  if (item.score < 95) {
    findings.push(createFinding({ lawId: LAW_ID, file: "docs/audit/commander-console-user-love-scorecard.md", line: 1, severity: "error", message: "Scorecard item is below the required 95-point threshold.", detail: `${item.name}: ${item.score}` }));
  }
  if (item.evidence.length === 0 || item.filesInspected.length === 0 || item.touchedFiles.length === 0 || item.proof.length === 0) {
    findings.push(createFinding({ lawId: LAW_ID, file: "docs/audit/commander-console-user-love-scorecard.md", line: 1, severity: "error", message: "Scorecard item is missing evidence, inspected files, touched files, or proof.", detail: item.name }));
  }
  findings.push(...collectPlaceholderFindings(item));
  return findings;
}

function collectItemFindings(scorecard: NonNullable<Awaited<ReturnType<typeof readScorecardData>>>): Finding[] {
  const findings = [...collectItemCountFindings(scorecard)];
  for (const itemName of SCORECARD_ITEMS) {
    const item = scorecard.items.find((entry) => entry.name === itemName);
    if (item) {
      findings.push(...collectScorecardItemFindings(item));
    }
  }
  return findings;
}

export async function runScorecardGate(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];
  const scorecard = await loadScorecard(findings);

  if (!scorecard) {
    return {
      findings,
      phase: createPhase("scorecard-gate", "FAKE ENFORCEMENT", false, "Scorecard gate could not parse the scorecard."),
    };
  }
  findings.push(...collectItemFindings(scorecard));

  return {
    findings,
    phase: createPhase(
      "scorecard-gate",
      findings.length === 0 ? "PASS" : "CODE VIOLATION",
      findings.length === 0,
      findings.length === 0
        ? `All ${SCORECARD_ITEMS.length} user-love scorecard items are evidenced and score at least 95.`
        : "The user-love scorecard still contains under-95 items or missing evidence, so READY cannot be claimed.",
    ),
  };
}