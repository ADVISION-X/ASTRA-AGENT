import assert from "node:assert/strict";

import { ownerReceiptIdsAreCanonical } from "../audit/domains/audit-system/owner-registration-inspector.js";

export const runOwnerAssertionSetAliasAttack = (): void => {
  assert.equal(ownerReceiptIdsAreCanonical(
    "local-browser-session",
    ["browser-authority/terminal-authority"],
    new Set(["browser-authority/terminal-authority"]),
  ), false, "receipt governance must reject a manifest and plan that agree on a noncanonical alias.");
  assert.equal(ownerReceiptIdsAreCanonical(
    "local-browser-session",
    ["local-browser-session/owner-assertion-set"],
    new Set(["local-browser-session/owner-assertion-set"]),
  ), true, "receipt governance must accept exactly the canonical owner assertion-set identity.");
};
