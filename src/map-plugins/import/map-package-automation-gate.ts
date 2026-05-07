import { PROMPT_CONTRACT_CATALOG_VERSION } from "../../capabilities/ai/prompt-contracts/index.js";
import { CAPABILITY_CATALOG_VERSION } from "../authoring/capability-catalog/index.js";
import type { MapPluginRegistry } from "../registry/map-plugin-registry.js";
import type { MapPackageValidationIssue } from "../shared/map-package-failure.js";
import type { MapPackage } from "../shared/map-package-types.js";

type AutomationGateFailureReason = "map_not_found" | "map_validation_failed";

type AutomationGateFailure = {
  gatePassed: false;
  reason: AutomationGateFailureReason;
  validationIssues: MapPackageValidationIssue[];
};

function createAutomationGateFailure(reason: AutomationGateFailureReason, validationIssues: MapPackageValidationIssue[] = []): AutomationGateFailure {
  return { gatePassed: false, reason, validationIssues };
}

function buildAutomationGateRef(packageId: string, packageVersion: string, gateActor: string): string {
  return `automation-gate://${packageId}/${packageVersion}/${gateActor}`;
}

function buildValidationReportRef(packageId: string, packageVersion: string): string {
  return `audit://map-plugin-package/${packageId}/validation/${packageVersion}`;
}

function buildGatePassedMapPackage(mapPackage: MapPackage, gateActor: string): MapPackage {
  return {
    ...mapPackage,
    manifest: {
      ...mapPackage.manifest,
      activationGateStatus: "gate_passed",
      automationGateRef: mapPackage.manifest.automationGateRef ?? buildAutomationGateRef(
        mapPackage.manifest.packageId,
        mapPackage.manifest.packageVersion,
        gateActor,
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

export function passMapPackageAutomationGate(input: {
  registry: MapPluginRegistry;
  packageId: string;
  packageVersion: string;
  gateActor: string;
}) {
  const quarantined = input.registry.quarantined.get(input.packageId, input.packageVersion);
  const existing = input.registry.versions.get(input.packageId, input.packageVersion);
  if (!quarantined || !existing) {
    return createAutomationGateFailure("map_not_found");
  }
  if (quarantined.validationIssues.length > 0) {
    return createAutomationGateFailure("map_validation_failed", quarantined.validationIssues);
  }

  const gatePassedMapPackage = buildGatePassedMapPackage(existing, input.gateActor);
  input.registry.versions.set(gatePassedMapPackage);
  input.registry.quarantined.set({
    ...quarantined,
    mapPackage: gatePassedMapPackage,
  });
  return {
    gatePassed: true as const,
    mapPackage: gatePassedMapPackage,
  };
}
