import { domSurface, requiredChildFunctionExports } from "./dom-inspector-constants.js";

export const allowedMigrationFunctionExports = ["locateDomElementResultOnce"] as const;

const lawfulDomZombieExportEntries = [
  {
    filePath: domSurface.publicFacade,
    exportNames: requiredChildFunctionExports,
  },
  {
    filePath: "src/capabilities/dom-automation/runtime/dom-locator.ts",
    exportNames: allowedMigrationFunctionExports,
  },
] as const;

export const getLawfulDomZombieExports = (filePath: string): readonly string[] =>
  lawfulDomZombieExportEntries.find((entry) => entry.filePath === filePath)?.exportNames ?? [];