import { approveMapPackage } from "../../../map-plugins/import/map-package-approval.js";
import { getDevelopmentMapPluginRegistry } from "../../../map-plugins/registry/map-plugin-registry.js";
import type { MapLabActivationResult, MapLabApprovalResult, MapLabGenerateDraftResult } from "./map-lab-types.js";

type MapLabRegistry = ReturnType<typeof getDevelopmentMapPluginRegistry>;
type MapLabImportedPackage = NonNullable<MapLabGenerateDraftResult["mapPackage"]>;

function createApprovalResult(
  approved: ReturnType<typeof approveMapPackage>,
  input: { packageId: string; packageVersion: string },
): MapLabApprovalResult {
  if (!approved.approved) {
    return {
      status: "failed",
      reason: approved.reason,
      packageId: input.packageId,
      packageVersion: input.packageVersion,
    };
  }

  return {
    status: "success",
    reason: null,
    packageId: approved.mapPackage.manifest.packageId,
    packageVersion: approved.mapPackage.manifest.packageVersion,
  };
}

function createActivationResult(
  activated: ReturnType<MapLabRegistry["activatePackage"]>,
  input: { packageId: string; packageVersion: string },
): MapLabActivationResult {
  if (activated.activated === false && "reason" in activated) {
    return {
      status: "failed",
      reason: activated.reason,
      packageId: input.packageId,
      packageVersion: input.packageVersion,
      activationId: null,
    };
  }

  return {
    status: "success",
    reason: null,
    packageId: activated.mapPackage.manifest.packageId,
    packageVersion: activated.mapPackage.manifest.packageVersion,
    activationId: activated.activationRecord.activationId,
  };
}

export function createMapLabRegistrySupport() {
  const registry = getDevelopmentMapPluginRegistry();
  return {
    registry: registry as {
      listDeveloperCatalog: MapLabRegistry["listDeveloperCatalog"];
      importPackage: (
        mapPackage: MapLabImportedPackage,
        source: string,
      ) => {
        imported: boolean;
        mapPackage: MapLabImportedPackage | null;
        validationIssues: Array<{ message: string }>;
      };
    },
    listDeveloperCatalog: () => registry.listDeveloperCatalog(),
    approveDraft: (input: { packageId: string; packageVersion: string; approvedBy: string }) =>
      createApprovalResult(approveMapPackage({ registry, ...input }), input),
    activateDraft: (input: { packageId: string; packageVersion: string; approvedBy: string; reason: string }) =>
      createActivationResult(
        registry.activatePackage(input.packageId, input.packageVersion, input.approvedBy, input.reason),
        input,
      ),
  };
}