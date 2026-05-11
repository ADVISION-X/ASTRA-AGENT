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
  return getLocalAppShellMapRegistry().listDeveloperCatalog().map((catalogEntry) => ({
    packageId: catalogEntry.packageId,
    version: catalogEntry.packageVersion,
    mapId: catalogEntry.mapId,
    title: catalogEntry.title,
    readiness: getReadinessTone(catalogEntry.lifecycleStatus),
    summary: catalogEntry.summary,
    activationGateStatus: catalogEntry.activationGateStatus,
    lifecycleStatus: catalogEntry.lifecycleStatus,
    validationSummary: getValidationSummary(locale, catalogEntry.validationIssues.length),
    bindingActivationRef: catalogEntry.bindingActivationRef,
    draftOnly: catalogEntry.draftOnly,
    chain: catalogEntry.chain,
  }));
}