import { writeGeneratedJson } from "../../../core/generated-artifact.js";
import { loadActiveLawRegistry } from "../../../core/law-registry.js";
import { createFinding } from "../../../core/result.js";
import type { Finding, LawRecord } from "../../../core/schema.js";

export type LawCensusResult = {
  laws: LawRecord[];
  findings: Finding[];
  lawCount: number;
  domainCount: number;
};

export const runLawCensus = (): LawCensusResult => {
  const registry = loadActiveLawRegistry();
  const findings = registry.violations.map((violation) => createFinding({
    lawId: violation.lawId ?? "GRASSEYE-AUDIT-SYSTEM-001-V1",
    file: violation.file,
    line: 1,
    severity: "fatal",
    message: violation.message,
    hint: "Normalize the active law record so owner coverage can close.",
  }));
  const domainCount = new Set(registry.laws.map((law) => law.capabilityDomain)).size;

  writeGeneratedJson("active-law-census.generated.json", {
    generatedAt: new Date().toISOString(),
    filesScanned: registry.filesScanned,
    lawCount: registry.laws.length,
    domainCount,
    laws: registry.laws,
    violations: registry.violations,
  });

  return {
    laws: registry.laws,
    findings,
    lawCount: registry.laws.length,
    domainCount,
  };
};