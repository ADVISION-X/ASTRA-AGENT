import { createFinding, createPhase } from "../../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";

const collectLawManifestOwnershipFindings = (context: InspectorContext, lawIdsByDomain: Map<string, Set<string>>): Finding[] => {
  const findings: Finding[] = [];

  for (const law of context.lawRegistry.laws) {
    const manifest = context.manifestsByDomain.get(law.capabilityDomain);
    if (!manifest) {
      findings.push(
        createFinding({
          lawId: law.lawId,
          file: law.relativeFilePath,
          line: law.line,
          severity: "fatal",
          message: "Active law capabilityDomain has no manifest owner.",
        }),
      );
      continue;
    }

    if (!manifest.allowedLawIds.includes(law.lawId)) {
      findings.push(
        createFinding({
          lawId: law.lawId,
          file: manifest.manifestPath,
          line: 1,
          severity: "error",
          message: "Manifest missing owned lawId.",
        }),
      );
    }

    if (!manifest.readsLawFiles.includes(law.relativeFilePath)) {
      findings.push(
        createFinding({
          lawId: law.lawId,
          file: manifest.manifestPath,
          line: 1,
          severity: "error",
          message: "Manifest readsLawFiles does not include the owned law file.",
        }),
      );
    }
  }

  return findings;
};

const collectAuditPlanOwnerOwnershipFindings = (context: InspectorContext, lawIdsByDomain: Map<string, Set<string>>): Finding[] => {
  const findings: Finding[] = [];

  for (const owner of context.auditPlan.owners) {
    const manifest = context.manifestsByDomain.get(owner.capabilityDomain);
    if (!manifest) {
      findings.push(
        createFinding({
          lawId: owner.lawIds[0] ?? "GRASSEYE-AUDIT-SYSTEM-001-V1",
          file: owner.entry,
          line: 1,
          severity: "fatal",
          message: "Audit plan owner has no matching manifest owner.",
        }),
      );
      continue;
    }

    if (manifest.inspectorId !== owner.inspectorId || manifest.entry !== owner.entry) {
      findings.push(
        createFinding({
          lawId: owner.lawIds[0] ?? "GRASSEYE-AUDIT-SYSTEM-001-V1",
          file: manifest.manifestPath,
          line: 1,
          severity: "error",
          message: "Audit plan owner does not map to the manifest owner entry.",
        }),
      );
    }

    const domainLawIds = lawIdsByDomain.get(owner.capabilityDomain) ?? new Set<string>();
    for (const lawId of owner.lawIds) {
      if (!domainLawIds.has(lawId)) {
        findings.push(
          createFinding({
            lawId,
            file: owner.entry,
            line: 1,
            severity: "error",
            message: "Audit plan owner lawIds must map to real active laws for the same capabilityDomain.",
          }),
        );
      }
    }
  }

  return findings;
};

const collectManifestOwnershipFindings = (context: InspectorContext): Finding[] => {
  const lawIdsByDomain = new Map<string, Set<string>>();

  for (const law of context.lawRegistry.laws) {
    const lawIds = lawIdsByDomain.get(law.capabilityDomain) ?? new Set<string>();
    lawIds.add(law.lawId);
    lawIdsByDomain.set(law.capabilityDomain, lawIds);
  }

  return [
    ...collectLawManifestOwnershipFindings(context, lawIdsByDomain),
    ...collectAuditPlanOwnerOwnershipFindings(context, lawIdsByDomain),
  ];
};

const createManifestOwnershipPhase = (findings: Finding[]): InspectorPhase =>
  createPhase(
    "manifest-ownership",
    findings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
    findings.length === 0,
    findings.length === 0
      ? "Each active capabilityDomain resolves to one manifest owner."
      : "Law and manifest ownership drift exists.",
  );

export const validateManifestOwnership = async (
  context: InspectorContext,
): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const findings = collectManifestOwnershipFindings(context);
  return { findings, phases: [createManifestOwnershipPhase(findings)] };
};