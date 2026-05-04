import { loadBuiltinMapPackages } from "../../map-plugins/builtins/index.js";
import { approveMapPackage } from "../../map-plugins/import/map-package-approval.js";
import {
  createMapPluginRegistry,
  getDevelopmentMapPluginRegistry,
  type MapPluginRegistry,
} from "../../map-plugins/registry/map-plugin-registry.js";

const LOCAL_APP_SHELL_IMPORTER = "local-app-shell-development-seed";

let fallbackRegistry: MapPluginRegistry | null = null;

function shouldActivateBuiltinPackage(builtinPackage: (ReturnType<typeof loadBuiltinMapPackages>)[number]) {
  return builtinPackage.manifest.approvalStatus === "approved"
    && builtinPackage.taskTemplate.availabilityPolicy === "active";
}

function buildFallbackRegistry(): MapPluginRegistry {
  const registry = createMapPluginRegistry();

  for (const builtinPackage of loadBuiltinMapPackages()) {
    const imported = registry.importPackage(builtinPackage, LOCAL_APP_SHELL_IMPORTER);
    if (!imported.imported || !shouldActivateBuiltinPackage(builtinPackage)) {
      continue;
    }

    const approved = approveMapPackage({
      registry,
      packageId: builtinPackage.manifest.packageId,
      packageVersion: builtinPackage.manifest.packageVersion,
      approvedBy: LOCAL_APP_SHELL_IMPORTER,
    });
    if (!approved.approved) {
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