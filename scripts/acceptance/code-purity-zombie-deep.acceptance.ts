import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";

const restored = [
  ...readdirSync("scripts/audit/domains/code-purity").filter((name) => name !== "check.ts" && name !== "components" && !["commented-code.ts", "liveness.ts", "module-graph.ts", "structural.ts", "types.ts"].includes(name)),
  ...readdirSync("scripts/audit/domains/code-purity/components").map((name) => `components/${name}`),
];
assert.equal(restored.length, 36);
assert.ok(existsSync("scripts/audit/domains/code-purity/check.ts"));
assert.ok(restored.includes("components/scan-zombie-internal-subgraphs.ts"));
assert.ok(restored.includes("components/zombie-symbol-graph.ts"));
assert.ok(restored.includes("components/zombie-commented-code.ts"));
console.log("code-purity-zombie-deep-acceptance-ok");
