import type { LocateDomElementInput } from "../schema.js";
import { DOM_SNAPSHOT_FIXTURE } from "./dom-snapshot.fixture.js";

const DOM_LOCATOR_FIXTURE: LocateDomElementInput = {
  snapshot: DOM_SNAPSHOT_FIXTURE,
  targetKind: "search-input",
  hints: ["Search records", "Search"],
  requiredText: "Search",
};

void DOM_LOCATOR_FIXTURE;
