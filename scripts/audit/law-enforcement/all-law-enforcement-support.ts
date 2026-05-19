import { createFinding } from "../core/result.js";
import type { Finding, LawRecord, OwnerManifest } from "../core/schema.js";
import type { ClauseSource, ParsedClause } from "./clause-parser.js";
import { parseLawClauses } from "./clause-parser.js";
import type { BinaryLawResult, LawEnforcementLevel } from "./all-law-enforcement-types.js";

export const finding = (lawId: string, file: string, message: string, hint: string): Finding =>
  createFinding({ lawId, file, line: 1, severity: "fatal", message, hint });

export const toBinary = (value: boolean): BinaryLawResult => value ? "PASS" : "FAIL";

export const toEnforcementLevel = (source: ClauseSource): LawEnforcementLevel => {
  if (source === "forbidden") return "anti_escape";
  if (source === "acceptance") return "runtime_smoke";
  if (source === "manifest") return "symbol";
  if (source === "generated") return "generated_consistency";
  return "ast";
};

export const collectOwnerAssignments = (laws: LawRecord[], manifests: OwnerManifest[]) => {
  const ownersByLawId = new Map<string, OwnerManifest[]>();
  for (const manifest of manifests) {
    for (const lawId of manifest.allowedLawIds) {
      const current = ownersByLawId.get(lawId) ?? [];
      current.push(manifest);
      ownersByLawId.set(lawId, current);
    }
  }

  return {
    ownersByLawId,
    missingOwners: laws
      .filter((law) => (ownersByLawId.get(law.lawId) ?? []).length === 0)
      .map((law) => law.lawId),
    multipleOwners: laws
      .filter((law) => (ownersByLawId.get(law.lawId) ?? []).length > 1)
      .map((law) => law.lawId),
  };
};


export const collectLawClauses = (laws: LawRecord[]): { clauses: ParsedClause[]; findings: Finding[] } => {
  const clauses: ParsedClause[] = [];
  const findings: Finding[] = [];
  for (const law of laws) {
    const parsed = parseLawClauses(law);
    if (parsed.parseFailure) {
      findings.push(finding(law.lawId, law.lawFile, parsed.parseFailure, "Normalize the law structure so clauses can be parsed."));
      continue;
    }
    clauses.push(...parsed.clauses);
  }
  return { clauses, findings };
};

export const buildManifestClauses = (manifests: OwnerManifest[]): ParsedClause[] =>
  manifests.flatMap((manifest) => manifest.allowedLawIds.map((lawId) => ({
    lawId,
    lawFilePath: `scripts/audit/domains/${manifest.capabilityDomain}/manifest.json`,
    clauseId: `${lawId}.manifest.01.${manifest.capabilityDomain}`,
    clauseSource: "manifest" as const,
    clauseText: `owner manifest ${manifest.capabilityDomain} declares ${lawId}`,
  })));

export const buildGeneratedClauses = (laws: LawRecord[]): ParsedClause[] => laws.flatMap((law) => [
  {
    lawId: law.lawId,
    lawFilePath: law.lawFile,
    clauseId: `${law.lawId}.generated.01.active-law-census`,
    clauseSource: "generated" as const,
    clauseText: "generated active law census tracks this active law",
  },
  {
    lawId: law.lawId,
    lawFilePath: law.lawFile,
    clauseId: `${law.lawId}.generated.02.owner-inspector-matrix`,
    clauseSource: "generated" as const,
    clauseText: "generated owner-inspector matrix tracks this active law",
  },
]);
