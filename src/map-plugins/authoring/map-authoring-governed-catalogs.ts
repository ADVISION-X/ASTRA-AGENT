import { readFileSync } from "node:fs";

import {
  AI_PROMPT_CONTRACT_CATALOG_VERSION,
  listAiPromptContractCatalogEntries,
  type AiPromptContractCatalogEntry,
} from "../../capabilities/ai/prompt-contract-catalog-port.js";
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
  promptContractCatalog: AiPromptContractCatalogEntry[];
};

export const MAP_AUTHORING_GOVERNED_PROMPT_CONTRACT_CATALOG_VERSION = AI_PROMPT_CONTRACT_CATALOG_VERSION;

export const listMapAuthoringGovernedPromptContracts = (): AiPromptContractCatalogEntry[] => {
  return listAiPromptContractCatalogEntries();
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
    promptContractCatalog: listMapAuthoringGovernedPromptContracts(),
  };
}