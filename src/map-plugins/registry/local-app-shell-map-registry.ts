import { loadBuiltinMapPackages } from "../builtins/index.js";
import { passMapPackageAutomationGate } from "../import/map-package-automation-gate.js";
import {
  createMapPluginRegistry,
  getDevelopmentMapPluginRegistry,
  type MapPluginRegistry,
} from "./map-plugin-registry.js";

const LOCAL_APP_SHELL_IMPORTER = "local-app-shell-development-seed";

let fallbackRegistry: MapPluginRegistry | null = null;

function shouldActivateBuiltinPackage(builtinPackage: (ReturnType<typeof loadBuiltinMapPackages>)[number]) {
  return builtinPackage.manifest.activationGateStatus === "gate_passed"
    && builtinPackage.taskTemplate.availabilityPolicy === "active";
}

function buildFallbackRegistry(): MapPluginRegistry {
  const registry = createMapPluginRegistry();

  for (const builtinPackage of loadBuiltinMapPackages()) {
    const imported = registry.importPackage(builtinPackage, LOCAL_APP_SHELL_IMPORTER);
    if (!imported.imported || !shouldActivateBuiltinPackage(builtinPackage)) {
      continue;
    }

    const gateResult = passMapPackageAutomationGate({
      registry,
      packageId: builtinPackage.manifest.packageId,
      packageVersion: builtinPackage.manifest.packageVersion,
      gateActor: LOCAL_APP_SHELL_IMPORTER,
    });
    if (!gateResult.gatePassed) {
      continue;
    }

    const activated = registry.activatePackage(
      builtinPackage.manifest.packageId,
      builtinPackage.manifest.packageVersion,
      LOCAL_APP_SHELL_IMPORTER,
      "local app shell fallback builtin activation",
    );
    if (activated.activated === false) {
      continue;
    }
  }

  return registry;
}

export function getLocalAppShellMapRegistry(): MapPluginRegistry {
  try {
    return getDevelopmentMapPluginRegistry();
  } catch {
    fallbackRegistry ??= buildFallbackRegistry();
    return fallbackRegistry;
  }
}