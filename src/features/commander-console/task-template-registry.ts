import type { Locale } from "../../lib/localization/dictionaries.js";
import { getDefaultMapPluginRegistry } from "../../map-plugins/registry/map-plugin-registry.js";

import { localizeCommanderText } from "./locale.js";
import type { CommanderConsoleTaskTemplate } from "./types.js";

export function buildCommanderTaskTemplates(locale: Locale): CommanderConsoleTaskTemplate[] {
  const activeRegistry = getDefaultMapPluginRegistry().active;

  return activeRegistry.listOrdinaryTaskTemplates().map((definition) => {
    const developerBinding = activeRegistry.getTaskTemplateDeveloperBinding(definition.taskTemplateId);
    const template: CommanderConsoleTaskTemplate = {
      taskTemplateId: definition.taskTemplateId,
      version: definition.version,
      recommended: definition.recommended,
      taskCategory: definition.taskCategory,
      defaultRunLimit: definition.defaultRunLimit,
      maxAllowedRunLimit: definition.maxAllowedRunLimit,
      safetyLevel: definition.safetyLevel,
      ...(developerBinding
        ? {
            developerBinding: {
              requestedPlatformId: developerBinding.requestedPlatformId,
              platformProfileRef: developerBinding.platformProfileRef,
              targetProfileRef: developerBinding.targetProfileRef,
              mapId: developerBinding.mapId,
            },
          }
        : {}),
      userVisibleCapabilities: definition.userVisibleCapabilities,
      advancedFields: {
        aiMode: localizeCommanderText(locale, "受控地图包", "governed map package"),
        logLevel: "debug",
      },
      availability: definition.availability,
      displayName: definition.displayName,
      description: definition.description,
      defaultHumanGoal: definition.defaultHumanGoal,
    };

    return template;
  });
}