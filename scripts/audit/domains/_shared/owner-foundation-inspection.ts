import type { InspectorContext } from "../../core/schema.js";
import {
  collectDomainOwnerInspectionFindings,
  createMissingManifestResult,
  createOwnerFoundationPhase,
  type DomainOwnerInspectionOptions,
  type DomainOwnerInspectionResult,
} from "./domain-owner-inspection-findings.js";

export const runDomainOwnerInspection = async (
  context: InspectorContext,
  options: DomainOwnerInspectionOptions,
): Promise<DomainOwnerInspectionResult> => {
  const manifest = context.manifestsByDomain.get(options.capabilityDomain);

  if (!manifest) {
    return createMissingManifestResult(options);
  }

  const findings = await collectDomainOwnerInspectionFindings(context, manifest, options);
  return {
    manifest,
    findings,
    phases: [createOwnerFoundationPhase(findings)],
  };
};