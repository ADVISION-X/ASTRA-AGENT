import { PROMPT_CONTRACT_CATALOG_VERSION } from "../../capabilities/ai/prompt-contracts/index.js";
import { CAPABILITY_CATALOG_VERSION } from "../authoring/capability-catalog/index.js";
import type { MapPluginRegistry } from "../registry/map-plugin-registry.js";
import type { MapPackageValidationIssue } from "../shared/map-package-failure.js";
import type { MapPackage } from "../shared/map-package-types.js";

type ApprovalFailureReason = "map_not_found" | "map_validation_failed";

type ApprovalFailure = {
  approved: false;
  reason: ApprovalFailureReason;
  validationIssues: MapPackageValidationIssue[];
};

function createApprovalFailure(reason: ApprovalFailureReason, validationIssues: MapPackageValidationIssue[] = []): ApprovalFailure {
  return { approved: false, reason, validationIssues };
}

function buildApprovalRef(packageId: string, packageVersion: string, approvedBy: string): string {
  return `approval://${packageId}/${packageVersion}/${approvedBy}`;
}

function buildValidationReportRef(packageId: string, packageVersion: string): string {
  return `audit://map-plugin-package/${packageId}/validation/${packageVersion}`;
}

function buildApprovedMapPackage(mapPackage: MapPackage, approvedBy: string): MapPackage {
  return {
    ...mapPackage,
    manifest: {
      ...mapPackage.manifest,
      approvalStatus: "approved",
      humanApprovalRef: mapPackage.manifest.humanApprovalRef ?? buildApprovalRef(
        mapPackage.manifest.packageId,
        mapPackage.manifest.packageVersion,
        approvedBy,
      ),
      validationReportRef: mapPackage.manifest.validationReportRef ?? buildValidationReportRef(
        mapPackage.manifest.packageId,
        mapPackage.manifest.packageVersion,
      ),
      capabilityCatalogVersion: mapPackage.manifest.capabilityCatalogVersion ?? CAPABILITY_CATALOG_VERSION,
      promptCatalogVersion: mapPackage.manifest.promptCatalogVersion ?? PROMPT_CONTRACT_CATALOG_VERSION,
    },
    taskTemplate: {
      ...mapPackage.taskTemplate,
      availabilityPolicy: "active",
    },
  };
}

export function approveMapPackage(input: {
  registry: MapPluginRegistry;
  packageId: string;
  packageVersion: string;
  approvedBy: string;
}) {
  const quarantined = input.registry.quarantined.get(input.packageId, input.packageVersion);
  const existing = input.registry.versions.get(input.packageId, input.packageVersion);
  if (!quarantined || !existing) {
    return createApprovalFailure("map_not_found");
  }
  if (quarantined.validationIssues.length > 0) {
    return createApprovalFailure("map_validation_failed", quarantined.validationIssues);
  }

  const approvedMapPackage = buildApprovedMapPackage(existing, input.approvedBy);
  input.registry.versions.set(approvedMapPackage);
  input.registry.quarantined.set({
    ...quarantined,
    mapPackage: approvedMapPackage,
  });
  return {
    approved: true as const,
    mapPackage: approvedMapPackage,
  };
}
