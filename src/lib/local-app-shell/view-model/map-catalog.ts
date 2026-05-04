import type { Locale } from "../../localization/dictionaries.js";
import { getLocalAppShellMapRegistry } from "../local-app-shell-map-registry.js";

import { localizeCommanderText } from "../locale.js";
import type { CommanderConsoleMapView } from "../types.js";

function getValidationSummary(locale: Locale, validationIssueCount: number): string {
  return validationIssueCount === 0
    ? localizeCommanderText(locale, "校验通过", "validation passed")
    : localizeCommanderText(locale, `${validationIssueCount} 个校验问题`, `${validationIssueCount} validation findings`);
}

function getReadinessTone(lifecycleStatus: string): CommanderConsoleMapView["readiness"] {
  if (lifecycleStatus === "active") {
    return "ok";
  }

  if (lifecycleStatus === "quarantined") {
    return "attention";
  }

  return "blocked";
}

export function buildMapCatalog(locale: Locale): CommanderConsoleMapView[] {
  return getLocalAppShellMapRegistry().listDeveloperCatalog().map((mapPackage) => ({
    packageId: mapPackage.packageId,
    version: mapPackage.packageVersion,
    mapId: mapPackage.mapId,
    title: mapPackage.title,
    readiness: getReadinessTone(mapPackage.lifecycleStatus),
    summary: mapPackage.summary,
    approvalStatus: mapPackage.approvalStatus,
    lifecycleStatus: mapPackage.lifecycleStatus,
    validationSummary: getValidationSummary(locale, mapPackage.validationIssues.length),
    activationId: mapPackage.activationId,
    draftOnly: mapPackage.draftOnly,
    chain: mapPackage.chain,
  }));
}