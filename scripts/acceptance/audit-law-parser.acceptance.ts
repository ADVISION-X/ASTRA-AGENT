import assert from "node:assert/strict";

import { rejectDuplicateJsonKeys } from "../audit/governance-v32.js";

assert.doesNotThrow(() => rejectDuplicateJsonKeys('{"lawId":"LAW-DEMO-001-V1","forbidden":["不得放行"]}', "valid"));
assert.throws(() => rejectDuplicateJsonKeys('{"lawId":"LAW-DEMO-001-V1","lawId":"LAW-DEMO-002-V1"}', "duplicate"), /duplicate JSON key lawId/u);
assert.throws(() => rejectDuplicateJsonKeys('{"lawId":"LAW-DEMO-001-V1"} trailing', "trailing"), /JSON trailing/u);
console.log("audit-law-parser-acceptance-ok");
