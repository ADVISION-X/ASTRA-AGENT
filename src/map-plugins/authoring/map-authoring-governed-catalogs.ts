import { readFileSync } from "node:fs";

import {
  listPromptContractCatalogEntries,
  type PromptContractCatalogEntry,
} from "../../capabilities/ai/prompt-contracts/index.js";
import {
  buildCapabilityCatalog,
  CapabilityCatalogDocumentSchema,
  type CapabilityCatalogDocument,
} from "./capability-catalog/index.js";

const GENERATED_CAPABILITY_CATALOG_URL = new URL(
  "./capability-catalog/capability-catalog.generated.json",
  import.meta.url,
);

export type MapAuthoringGovernedCatalogs = {
  capabilityCatalog: CapabilityCatalogDocument;
  promptContractCatalog: PromptContractCatalogEntry[];
};

function readGeneratedCapabilityCatalog(): CapabilityCatalogDocument {
  return CapabilityCatalogDocumentSchema.parse(
    JSON.parse(readFileSync(GENERATED_CAPABILITY_CATALOG_URL, "utf8")),
  );
}

function assertCapabilityCatalogFreshness(
  capabilityCatalog: CapabilityCatalogDocument,
): void {
  const generatedCapabilityCatalog = readGeneratedCapabilityCatalog();
  if (
    JSON.stringify(generatedCapabilityCatalog)
    !== JSON.stringify(capabilityCatalog)
  ) {
    throw new Error("BLOCKED_CAPABILITY_CATALOG_STALE");
  }
}

export function buildMapAuthoringGovernedCatalogs(): MapAuthoringGovernedCatalogs {
  const capabilityCatalog = buildCapabilityCatalog();
  assertCapabilityCatalogFreshness(capabilityCatalog);

  return {
    capabilityCatalog,
    promptContractCatalog: listPromptContractCatalogEntries(),
  };
}