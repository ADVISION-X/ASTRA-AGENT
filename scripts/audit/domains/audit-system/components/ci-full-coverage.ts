import { readFileSync } from "node:fs";

import { buildCiFullSteps } from "../../../core/ci-full-plan.js";
import { getSourceFileOrThrow } from "../../../core/ts-morph.js";
import { createFinding } from "../../../core/result.js";
import type { Finding, OwnerManifest, OwnerMatrixDomain } from "../../../core/schema.js";
import { getAuditProject } from "../../../core/ts-morph.js";
import { pathFromRepoRoot } from "../../../core/paths.js";

const finding = (file: string, message: string, hint: string): Finding =>
  createFinding({
    lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
    file,
    line: 1,
    severity: "fatal",
    message,
    hint,
  });

export const runCiFullCoverage = (
  manifests: OwnerManifest[],
  matrixDomains: OwnerMatrixDomain[],
): { findings: Finding[] } => {
  const findings: Finding[] = [];
  const packageJson = JSON.parse(readFileSync(pathFromRepoRoot("package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  const scripts = packageJson.scripts ?? {};
  if (scripts["ci:full"] !== "node --import tsx scripts/audit/ci-full.ts") {
    findings.push(finding("package.json", "ci:full is not the unique authoritative CI entrypoint", "Keep ci:full mapped to scripts/audit/ci-full.ts only."));
  }

  const extraCiScripts = Object.keys(scripts).filter((scriptName) => scriptName.startsWith("ci:") && scriptName !== "ci:full");
  for (const scriptName of extraCiScripts) {
    findings.push(finding("package.json", `second CI entrypoint exposed: ${scriptName}`, "Keep ci:full as the only complete quality-gate entrypoint."));
  }

  const plannedSteps = buildCiFullSteps();
  for (const manifest of manifests.filter((item) => item.capabilityDomain !== "audit-system")) {
    if (!plannedSteps.some((step) => step.name === manifest.inspectorId)) {
      findings.push(finding("scripts/audit/core/ci-full-plan.ts", `CI-FULL does not execute owner inspector ${manifest.inspectorId}`, "Load owner manifests inside the CI-FULL plan."));
    }
  }

  const unauthorizedSteps = plannedSteps.filter((step) => step.layer === "owner-layer")
    .filter((step) => !manifests.some((manifest) => manifest.inspectorId === step.name));
  for (const step of unauthorizedSteps) {
    findings.push(finding("scripts/audit/core/ci-full-plan.ts", `CI-FULL executes an unauthorized owner step: ${step.name}`, "Only matrix-backed owner manifests may become owner-layer CI steps."));
  }

  const ciFullSource = getSourceFileOrThrow(getAuditProject(), "scripts/audit/ci-full.ts");
  const planSource = getSourceFileOrThrow(getAuditProject(), "scripts/audit/core/ci-full-plan.ts");
  const ciFullHasBuilder = ciFullSource.getImportDeclarations().some((decl) =>
    decl.getModuleSpecifierValue() === "./core/ci-full-plan.js"
      && decl.getNamedImports().some((namedImport) => namedImport.getName() === "buildCiFullSteps"),
  );
  if (!ciFullHasBuilder) {
    findings.push(finding("scripts/audit/ci-full.ts", "ci-full.ts does not import buildCiFullSteps", "Drive CI-FULL execution from the governed owner plan."));
  }

  const planLoadsManifests = planSource.getImportDeclarations().some((decl) =>
    decl.getModuleSpecifierValue() === "./owner-manifests.js"
      && decl.getNamedImports().some((namedImport) => namedImport.getName() === "loadOwnerManifests"),
  );
  if (!planLoadsManifests) {
    findings.push(finding("scripts/audit/core/ci-full-plan.ts", "ci-full plan does not load owner manifests", "Build owner-layer steps from governed manifests, not a hand-maintained list."));
  }

  if (matrixDomains.some((domain) => domain.status !== "covered")) {
    findings.push(finding("scripts/audit/generated/owner-inspector-matrix.generated.json", "owner-inspector matrix has uncovered capability domains", "Close manifest coverage before CI-FULL can pass."));
  }

  return { findings };
};