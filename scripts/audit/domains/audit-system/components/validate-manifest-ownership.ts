import { createFinding, createPhase } from "../../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";

const collectManifestOwnershipFindings = (context: InspectorContext): Finding[] => {
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