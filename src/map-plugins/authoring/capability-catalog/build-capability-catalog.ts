import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { buildAiOpenEntries } from "./builders/build-ai-open-entries.js";
import { buildForensicsPageStateEntries } from "./builders/build-forensics-page-state-entries.js";
import { buildGeometryActionEntries } from "./builders/build-geometry-action-entries.js";
import { buildInputScrollEntries } from "./builders/build-input-scroll-entries.js";
import { buildPostActionEntries } from "./builders/build-post-action-entries.js";
import { buildVisualCaptureEntries } from "./builders/build-visual-capture-entries.js";
import {
  CapabilityCatalogDocumentSchema,
  CapabilityCatalogEntrySchema,
  type CapabilityCatalogDocument,
  type CapabilityCatalogEntry,
} from "./schema.js";

export const CAPABILITY_CATALOG_VERSION = "2026-04-map-prompt-contract-v1";
export const CAPABILITY_CATALOG_GENERATED_FROM = "src/map-plugins/authoring/capability-catalog/build-capability-catalog.ts";

const collectCapabilityEntries = (): unknown[] => [
  ...buildAiOpenEntries(),
  ...buildVisualCaptureEntries(),
  ...buildGeometryActionEntries(),
  ...buildInputScrollEntries(),
  ...buildForensicsPageStateEntries(),
  ...buildPostActionEntries(),
];

const normalizeEntries = (entries: unknown[]): CapabilityCatalogEntry[] =>
  entries.map((entry) => CapabilityCatalogEntrySchema.parse(entry));

const sortEntries = (entries: CapabilityCatalogEntry[]): CapabilityCatalogEntry[] =>
  [...entries].sort((left, right) => {
    if (left.abilityGroupId === right.abilityGroupId) {
      return left.childCapabilityId.localeCompare(right.childCapabilityId);
    }
    return left.abilityGroupId.localeCompare(right.abilityGroupId);
  });

export const buildCapabilityCatalog = (): CapabilityCatalogDocument => {
  const entries = sortEntries(normalizeEntries(collectCapabilityEntries()));
  return CapabilityCatalogDocumentSchema.parse({
    version: CAPABILITY_CATALOG_VERSION,
    generatedFrom: CAPABILITY_CATALOG_GENERATED_FROM,
    entries,
  });
};

export const writeCapabilityCatalogGeneratedFile = async (): Promise<void> => {
  const filePath = fileURLToPath(new URL("./capability-catalog.generated.json", import.meta.url));
  await writeFile(filePath, `${JSON.stringify(buildCapabilityCatalog(), null, 2)}\n`, "utf8");
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void writeCapabilityCatalogGeneratedFile();
}
