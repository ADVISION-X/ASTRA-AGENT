import type { Locale } from "../localization/dictionaries.js";
import { getLocalAppShellMapRegistry } from "../../map-plugins/registry/local-app-shell-map-registry.js";

import type { CommanderConsoleTaskTemplate } from "./types.js";

export function buildCommanderTaskTemplates(locale: Locale): CommanderConsoleTaskTemplate[] {
  const activeRegistry = getLocalAppShellMapRegistry().active;

  return activeRegistry.listOrdinaryTaskTemplates().map((definition) => {
    const template: CommanderConsoleTaskTemplate = {
      taskTemplateId: definition.taskTemplateId,
      version: definition.version,
      recommended: definition.recommended,
      taskCategory: definition.taskCategory,
      safetyLevel: definition.safetyLevel,
      userVisibleCapabilities: definition.userVisibleCapabilities,
      availability: definition.availability,
      displayName: definition.displayName,
      description: definition.description,
      defaultHumanGoal: definition.defaultHumanGoal,
    };

    return template;
  });
}
