import { passMapPackageAutomationGate } from "../../../map-plugins/import/map-package-automation-gate.js";
import { getDevelopmentMapPluginRegistry } from "../../../map-plugins/registry/map-plugin-registry.js";
import type { MapLabActivationResult, MapLabAutomationGateResult, MapLabGenerateDraftResult } from "./map-lab-types.js";

type MapLabRegistry = ReturnType<typeof getDevelopmentMapPluginRegistry>;
type MapLabImportedPackage = NonNullable<MapLabGenerateDraftResult["mapPackage"]>;

function createAutomationGateResult(
  automationGated: ReturnType<typeof passMapPackageAutomationGate>,
  input: { packageId: string; packageVersion: string },
): MapLabAutomationGateResult {
  if (!automationGated.gatePassed) {
    return {
      status: "failed",
      reason: automationGated.reason,
      packageId: input.packageId,
      packageVersion: input.packageVersion,
    };
  }

  return {
    status: "success",
    reason: null,
    packageId: automationGated.mapPackage.manifest.packageId,
    packageVersion: automationGated.mapPackage.manifest.packageVersion,
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
    passAutomationGate: (input: { packageId: string; packageVersion: string; gateActor: string }) =>
      createAutomationGateResult(passMapPackageAutomationGate({ registry, ...input }), input),
    activateDraft: (input: { packageId: string; packageVersion: string; gateActor: string; reason: string }) =>
      createActivationResult(
        registry.activatePackage(input.packageId, input.packageVersion, input.gateActor, input.reason),
        input,
      ),
  };
}
