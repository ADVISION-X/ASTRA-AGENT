import { loadBuiltinMapPackages } from "../../../src/map-plugins/builtins/index.js";
import { createMapPluginRegistry } from "../../../src/map-plugins/registry/map-plugin-registry.js";

type ReadinessResult = {
  status: "ready" | "failed";
  ownerResponsible: "map-plugin-package";
  checkedPackageCount: number;
  refs: string[];
  failureReason: string | null;
  actionableMessage: string | null;
};

const toFailureResult = (error: unknown): ReadinessResult => {
  const shaped = error as {
    packageFile?: unknown;
    receivedPackageKind?: unknown;
    expectedPackageKind?: unknown;
    actionableMessage?: unknown;
    message?: unknown;
  };
  const packageFile = typeof shaped.packageFile === "string" ? shaped.packageFile : "unknown";
  const receivedPackageKind = typeof shaped.receivedPackageKind === "string" ? shaped.receivedPackageKind : "unknown";
  const expectedPackageKind = typeof shaped.expectedPackageKind === "string" ? shaped.expectedPackageKind : "operational-map-package";
  const message = typeof shaped.message === "string" ? shaped.message : "Map package readiness failed.";
  return {
    status: "failed",
    ownerResponsible: "map-plugin-package",
    checkedPackageCount: 0,
    refs: [`packageFile=${packageFile}`, `expectedPackageKind=${expectedPackageKind}`, `receivedPackageKind=${receivedPackageKind}`],
    failureReason: message,
    actionableMessage: typeof shaped.actionableMessage === "string"
      ? shaped.actionableMessage
      : "Fix the builtin map package and rerun npm run audit:map-plugin-package.",
  };
};

const verifyDevelopmentBootstrap = (packages: ReturnType<typeof loadBuiltinMapPackages>): void => {
  const registry = createMapPluginRegistry();
  for (const mapPackage of packages) {
    const imported = registry.importPackage(mapPackage, "startup-map-package-readiness");
    if (!imported.imported) {
      throw new Error(`MAP_PACKAGE_STARTUP_IMPORT_FAILED packageId=${mapPackage.manifest.packageId}`);
    }
    if (mapPackage.manifest.activationGateStatus === "gate_passed" && mapPackage.taskTemplate.availabilityPolicy === "active") {
      const activated = registry.activatePackage(mapPackage.manifest.packageId, mapPackage.manifest.packageVersion, "startup-map-package-readiness", "startup readiness probe");
      if (!activated.activated) {
        throw new Error(`MAP_PACKAGE_STARTUP_ACTIVATION_FAILED packageId=${mapPackage.manifest.packageId}`);
      }
    }
  }
};

function runProbe(): ReadinessResult {
  try {
    const packages = loadBuiltinMapPackages();
    verifyDevelopmentBootstrap(packages);
    return {
      status: "ready",
      ownerResponsible: "map-plugin-package",
      checkedPackageCount: packages.length,
      refs: packages.map((mapPackage) => `packageId=${mapPackage.manifest.packageId}`),
      failureReason: null,
      actionableMessage: null,
    };
  } catch (error) {
    return toFailureResult(error);
  }
}

const result = runProbe();
process.stdout.write(`${JSON.stringify(result)}\n`);
process.exitCode = result.status === "ready" ? 0 : 1;
