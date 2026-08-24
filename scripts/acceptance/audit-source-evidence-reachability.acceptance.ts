import assert from "node:assert/strict";
import { Project } from "ts-morph";

import { inspectPrimaryEvidence } from "../audit/domains/audit-system/primary-evidence-inspector.js";

const project = new Project({ useInMemoryFileSystem: true });

const functionBody = (mutation: "baseline" | "decoy" | "no-validation" | "wrong-payload" | "wrong-order", release = false): string => {
  if (mutation === "decoy") return `
    const decoy = () => { const applicableEvidenceModes = []; const evidenceRefs = []; const findings = []; const missing = []; const outcome = "PASS"; validateQualityReport({}); };
    const report = { laws: [], outcome: "PASS" };
    writeFileSync("report.json", canonicalBytes(report));
  `;
  const validation = mutation === "no-validation" ? "" : "validateQualityReport(report);";
  const payload = mutation === "wrong-payload" ? "canonicalBytes({ outcome: 'PASS' })" : "canonicalBytes(report)";
  const write = `writeFileSync("report.json", ${payload});`;
  const evidence = release ? `
      const staticChecks = checks.flatMap((check) => {
        const claim = checkClaimForLaw(check, law.lawId);
        return claim ? [{ check, claim }] : [];
      });
      const lawProofs = proofs.filter((proof) => proof.lawIds.includes(law.lawId));
      const covered = new Set([
        ...staticChecks.filter(({ check }) => check.outcome === "PASS").flatMap(({ claim }) => claim.evidenceModes),
        ...lawProofs.flatMap((proof) => proof.evidenceModes),
      ]);
      const missing = applicable.filter((mode: string) => !covered.has(mode));
      const failed = staticChecks.filter(({ check }) => check.outcome === "FAIL");
      const findings = [...missing, ...failed.flatMap(({ check }) => check.finding ?? [])];
      const evidenceRefs = [
        ...staticChecks.filter(({ check }) => check.outcome === "PASS").map(({ check }) => check.evidenceRef),
        ...lawProofs.flatMap((proof) => proof.evidenceRefs),
      ];
  ` : `
      const relevant = checks.flatMap((check) => {
        const claim = checkClaimForLaw(check, law.lawId);
        return claim ? [{ check, claim }] : [];
      });
      const covered = new Set(relevant.filter(({ check }) => check.outcome === "PASS").flatMap(({ claim }) => claim.evidenceModes));
      const missing = applicable.filter((mode: string) => !covered.has(mode));
      const failed = relevant.filter(({ check }) => check.outcome === "FAIL");
      const findings = [...missing, ...failed.flatMap(({ check }) => check.finding ?? [])];
      const evidenceRefs = relevant.filter(({ check }) => check.outcome === "PASS").map(({ check }) => check.evidenceRef);
  `;
  return `
    const items = laws.map((law: { lawId: string }) => {
      const { applicableEvidenceModes: applicable, deferredEvidenceModes: deferred } = evidencePlan(law);
      ${evidence}
      return { lawId: law.lawId, applicableEvidenceModes: applicable, deferredEvidenceModes: deferred, outcome: findings.length ? "FAIL" : "PASS", evidenceRefs, findings };
    });
    const report = { laws: items, outcome: items.some((item) => item.outcome === "FAIL") ? "FAIL" : "PASS" };
    ${mutation === "wrong-order" ? `${write}${validation}` : `${validation}${write}`}
  `;
};

const sourceFor = (mutation: "baseline" | "decoy" | "no-validation" | "wrong-payload" | "wrong-order") => project.createSourceFile(
  `/repo/${mutation}.ts`,
  `
    declare const evidencePlan: (law: unknown) => { applicableEvidenceModes: string[]; deferredEvidenceModes: string[] };
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
