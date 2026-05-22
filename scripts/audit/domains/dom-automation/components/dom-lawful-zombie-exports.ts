import { domSurface, requiredChildFunctionExports } from "./dom-inspector-constants.js";

export const allowedMigrationFunctionExports = ["locateDomElementResultOnce"] as const;

export const lawfulDomZombieExportsByFile: Readonly<Record<string, readonly string[]>> = {
  [domSurface.publicFacade]: requiredChildFunctionExports,
  "src/capabilities/dom-automation/runtime/dom-locator.ts": allowedMigrationFunctionExports,
};