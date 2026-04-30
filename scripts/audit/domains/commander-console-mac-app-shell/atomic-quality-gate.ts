import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { ATOMIC_QUALITY_ITEMS, LAW_ID, MISSING_BLUEPRINT_PATH, readAtomicQualityData } from "./ast-utils.js";

function claimsReady(result: string): boolean {
  return result.includes("READY") && !result.includes("NOT_READY");
}

async function loadAtomicQuality(findings: Finding[]) {
  return readAtomicQualityData().catch((error) => {
    findings.push(createFinding({ lawId: LAW_ID, file: "docs/audit/commander-console-ui-atomic-quality.md", line: 1, severity: "fatal", message: error instanceof Error ? error.message : "Atomic quality gate cannot read the document." }));
    return null;
  });
}

function collectItemCountFindings(atomicQuality: NonNullable<Awaited<ReturnType<typeof readAtomicQualityData>>>): Finding[] {
  return atomicQuality.items.length !== ATOMIC_QUALITY_ITEMS.length
    ? [createFinding({ lawId: LAW_ID, file: "docs/audit/commander-console-ui-atomic-quality.md", line: 1, severity: "error", message: `Atomic quality document must contain exactly ${ATOMIC_QUALITY_ITEMS.length} items.` })]
    : [];
}

function collectPlaceholderFindings(item: NonNullable<Awaited<ReturnType<typeof readAtomicQualityData>>>["items"][number]): Finding[] {
  const findings: Finding[] = [];
  const combinedText = [...item.failedReasons, item.requiredFix].join(" ").toLowerCase();
  for (const forbiddenToken of ["todo", "later", "follow-up"]) {
    if (combinedText.includes(forbiddenToken)) {
      findings.push(createFinding({ lawId: LAW_ID, file: "docs/audit/commander-console-ui-atomic-quality.md", line: 1, severity: "error", message: "Atomic quality document contains a forbidden placeholder token.", detail: `${item.name}: ${forbiddenToken}` }));
    }
  }
  return findings;
}

function collectAtomicItemFindings(item: NonNullable<Awaited<ReturnType<typeof readAtomicQualityData>>>["items"][number]): Finding[] {
  const findings: Finding[] = [];
  if (item.evidence.length === 0 || item.filesInspected.length === 0 || item.touchedFiles.length === 0 || item.proof.length === 0) {
    findings.push(createFinding({ lawId: LAW_ID, file: "docs/audit/commander-console-ui-atomic-quality.md", line: 1, severity: "error", message: "Atomic quality item is missing evidence, inspected files, touched files, or proof.", detail: item.name }));
  }
  findings.push(...collectPlaceholderFindings(item));
  return findings;
}

function collectItemFindings(atomicQuality: NonNullable<Awaited<ReturnType<typeof readAtomicQualityData>>>): Finding[] {
  const findings = [...collectItemCountFindings(atomicQuality)];
  for (const itemName of ATOMIC_QUALITY_ITEMS) {
    const item = atomicQuality.items.find((entry) => entry.name === itemName);
    if (item) {
      findings.push(...collectAtomicItemFindings(item));
    }
  }

  return findings;
}

function collectConclusionFindings(atomicQuality: NonNullable<Awaited<ReturnType<typeof readAtomicQualityData>>>): Finding[] {
  const findings: Finding[] = [];
  if (!atomicQuality.missingReferences.includes(MISSING_BLUEPRINT_PATH)) {
    findings.push(createFinding({ lawId: LAW_ID, file: "docs/audit/commander-console-ui-atomic-quality.md", line: 1, severity: "error", message: "Atomic quality document must record the missing Commander page blueprint." }));
  }
  if (claimsReady(atomicQuality.result) && atomicQuality.missingReferences.length > 0) {
    findings.push(createFinding({ lawId: LAW_ID, file: "docs/audit/commander-console-ui-atomic-quality.md", line: 1, severity: "error", message: "Atomic quality document cannot claim READY while missing references still exist." }));
  }
  return findings;
}

export async function runAtomicQualityGate(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];
  const atomicQuality = await loadAtomicQuality(findings);

  if (!atomicQuality) {
    return {
      findings,
      phase: createPhase("atomic-quality-gate", "FAKE ENFORCEMENT", false, "Atomic quality gate could not parse the document."),
    };
  }
  findings.push(...collectItemFindings(atomicQuality));
  findings.push(...collectConclusionFindings(atomicQuality));

  return {
    findings,
    phase: createPhase(
      "atomic-quality-gate",
      findings.length === 0 ? "PASS" : "CODE VIOLATION",
      findings.length === 0,
      findings.length === 0
        ? `Atomic quality document is complete and records all ${ATOMIC_QUALITY_ITEMS.length} required items plus the missing reference truth.`
        : "Atomic quality document is incomplete, contains placeholders, or hides the missing blueprint truth.",
    ),
  };
}