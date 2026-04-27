import { fileExists } from "../../core/filesystem.js";
import { createFinding, createPhase } from "../../core/result.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import type { Finding, InspectorContext, InspectorPhase, ResolvedDomainManifest } from "../../core/schema.js";

interface DomainOwnerInspectionOptions {
  capabilityDomain: string;
  inspectorId: string;
  inspectorEntry: string;
}

export interface DomainOwnerInspectionResult {
  manifest?: ResolvedDomainManifest;
  findings: Finding[];
  phases: InspectorPhase[];
}

export const runDomainOwnerInspection = async (
  context: InspectorContext,
  options: DomainOwnerInspectionOptions,
): Promise<DomainOwnerInspectionResult> => {
  const findings: Finding[] = [];
  const phases: InspectorPhase[] = [];
  const manifest = context.manifestsByDomain.get(options.capabilityDomain);

  if (!manifest) {
    findings.push(
      createFinding({
        lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
        file: `scripts/audit/domains/${options.capabilityDomain}/manifest.json`,
        line: 1,
        severity: "fatal",
        message: "Owner manifest is missing for capability domain.",
        hint: "Create one manifest.json per capabilityDomain.",
      }),
    );

    phases.push(
      createPhase("owner-manifest", "LAW GAP", false, "Owner manifest is missing, so the domain cannot be enforced."),
    );

    return { findings, phases };
  }

  if (manifest.inspectorId !== options.inspectorId) {
    findings.push(
      createFinding({
        lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
        file: manifest.manifestPath,
        line: 1,
        severity: "error",
        message: "Manifest inspectorId does not match the owner inspector.",
      }),
    );
  }

  if (manifest.capabilityDomain !== options.capabilityDomain) {
    findings.push(
      createFinding({
        lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
        file: manifest.manifestPath,
        line: 1,
        severity: "fatal",
        message: "Manifest capabilityDomain does not match inspector capabilityDomain.",
      }),
    );
  }

  if (manifest.entry !== options.inspectorEntry) {
    findings.push(
      createFinding({
        lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
        file: manifest.manifestPath,
        line: 1,
        severity: "error",
        message: "Manifest entry does not match the real inspector file.",
      }),
    );
  }

  if (!manifest.owner) {
    findings.push(
      createFinding({
        lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
        file: manifest.manifestPath,
        line: 1,
        severity: "error",
        message: "Manifest must declare owner: true.",
      }),
    );
  }

  if (!(await fileExists(pathFromRepoRoot(manifest.entry)))) {
    findings.push(
      createFinding({
        lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
        file: manifest.entry,
        line: 1,
        severity: "fatal",
        message: "Manifest entry file does not exist.",
      }),
    );
  }

  if (manifest.readsLawFiles.length === 0) {
    findings.push(
      createFinding({
        lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
        file: manifest.manifestPath,
        line: 1,
        severity: "error",
        message: "Manifest must declare readsLawFiles for its owned laws.",
      }),
    );
  }

  for (const readLawFile of manifest.readsLawFiles) {
    if (!(await fileExists(pathFromRepoRoot(readLawFile)))) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
          file: readLawFile,
          line: 1,
          severity: "fatal",
          message: "Manifest references a law file that does not exist.",
        }),
      );
    }
  }

  const activeLawIds = new Set(context.lawRegistry.laws.map((law) => law.lawId));
  for (const allowedLawId of manifest.allowedLawIds) {
    if (!activeLawIds.has(allowedLawId)) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
          file: manifest.manifestPath,
          line: 1,
          severity: "error",
          message: "Manifest allowedLawIds references a non-existent active law.",
          detail: allowedLawId,
        }),
      );
    }
  }

  const matrixOwner = context.matrixOwnersByDomain.get(options.capabilityDomain);
  if (!matrixOwner) {
    findings.push(
      createFinding({
        lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
        file: manifest.manifestPath,
        line: 1,
        severity: "fatal",
        message: "Generated enforcement matrix does not contain this owner.",
      }),
    );
  }

  const planOwner = context.planOwnersByDomain.get(options.capabilityDomain);
  if (!planOwner) {
    findings.push(
      createFinding({
        lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
        file: manifest.manifestPath,
        line: 1,
        severity: "fatal",
        message: "Generated audit plan does not contain this owner.",
      }),
    );
  }

  for (const blueprintFile of manifest.readsBlueprintFiles ?? []) {
    if (!(await fileExists(pathFromRepoRoot(blueprintFile)))) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
          file: blueprintFile,
          line: 1,
          severity: "error",
          message: "Manifest references a blueprint file that does not exist.",
        }),
      );
    }
  }

  phases.push(
    createPhase(
      "owner-foundation",
      findings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
      findings.length === 0,
      findings.length === 0
        ? "Manifest, generated matrix, and generated audit plan agree on this owner."
        : "Owner foundation has manifest or generated-artifact drift.",
    ),
  );

  return {
    manifest,
    findings,
    phases,
  };
};