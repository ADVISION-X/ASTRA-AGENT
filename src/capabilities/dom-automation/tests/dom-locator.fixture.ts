import { LocateDomElementInputSchema } from "../schema.js";
import type { LocateDomElementInput } from "../schema.js";

import { createDomSnapshotFixture } from "./dom-snapshot.fixture.js";

export function createLocateDomElementInputFixture(): LocateDomElementInput {
  return LocateDomElementInputSchema.parse({
    snapshot: createDomSnapshotFixture(),
    targetKind: "search-input",
    hints: ["order search", "search orders"],
    requiredText: "order",
  });
}