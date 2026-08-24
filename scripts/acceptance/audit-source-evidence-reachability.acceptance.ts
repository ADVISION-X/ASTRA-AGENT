import assert from "node:assert/strict";
import { Project } from "ts-morph";

import { inspectPrimaryEvidence } from "../audit/domains/audit-system/primary-evidence-inspector.js";

const project = new Project({ useInMemoryFileSystem: true });

const functionBody = (mutation: "baseline" | "decoy" | "no-validation" | "wrong-payload" | "wrong-order", release = false): string => {
  if (mutation === "decoy") return `
    const decoy = () => { const items = []; const mutants = []; const candidateFingerprint = candidateSnapshot(); validateQualityReport({}); };
    const report = { laws: [], mutants: [], outcome: "PASS" };
    writeFileSync("report.json", canonicalBytes(report));
  `;
  const validation = mutation === "no-validation" ? "" : "validateQualityReport(report);";
  const payload = mutation === "wrong-payload" ? "canonicalBytes({ outcome: 'PASS' })" : "canonicalBytes(report)";
  const write = `writeFileSync("report.json", ${payload});`;
  return `
    const items = laws.map((law: { lawId: string }) => lawItem(law, checks, ${release ? "proofs" : "[]"}));
    const mutants = mutantCatalog(laws);
    const report = { candidateFingerprint: candidateSnapshot(), laws: items, mutants, outcome: items.some((item) => item.outcome === "FAIL") || mutants.some((item) => item.outcome === "FAIL") ? "FAIL" : "PASS" };
    ${mutation === "wrong-order" ? `${write}${validation}` : `${validation}${write}`}
  `;
};

const sourceFor = (mutation: "baseline" | "decoy" | "no-validation" | "wrong-payload" | "wrong-order") => project.createSourceFile(
  `/repo/${mutation}.ts`,
  `
    declare const candidateSnapshot: () => string;
    declare const lawItem: (law: unknown, checks: unknown, proofs: unknown) => { outcome: string };
    declare const mutantCatalog: (laws: unknown) => Array<{ outcome: string }>;
    declare const validateQualityReport: (report: unknown) => void;
    declare const writeFileSync: (path: string, data: unknown) => void;
    declare const canonicalBytes: (value: unknown) => Uint8Array;
    type Claim = { lawId: string; evidenceModes: string[] };
    type Check = { claims: Claim[]; outcome: string; evidenceRef: string; finding: string | null };
    declare const checkClaimForLaw: (check: Check, lawId: string) => Claim | undefined;
    function writeReport(laws: Array<{ lawId: string }>, checks: Check[]) { ${functionBody(mutation)} }
    function writeReleaseReport(laws: Array<{ lawId: string }>, checks: Check[], proofs: Array<{ lawIds: string[]; evidenceModes: string[]; evidenceRefs: string[] }>) { ${functionBody(mutation, true)} }
  `,
  { overwrite: true },
);

assert.deepEqual(inspectPrimaryEvidence(sourceFor("baseline")), [], "canonical evidence must reach the validated serialized report");
for (const mutation of ["decoy", "no-validation", "wrong-payload", "wrong-order"] as const) {
  assert.ok(inspectPrimaryEvidence(sourceFor(mutation)).length > 0, `${mutation} evidence laundering must fail closed`);
}

process.stdout.write("audit-source-evidence-reachability-acceptance-ok\n");
