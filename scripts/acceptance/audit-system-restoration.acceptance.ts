import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";

const auditSystemFiles = readdirSync("scripts/audit/domains/audit-system").filter((name) => name !== "check.ts");
const auditTruthFiles = [
  ...readdirSync("scripts/audit/domains/audit-truth").filter((name) => name !== "check.ts" && name !== "components"),
  ...readdirSync("scripts/audit/domains/audit-truth/components").map((name) => `components/${name}`),
];
assert.equal(auditSystemFiles.length, 21);
assert.equal(auditTruthFiles.length, 7);
const runtimeLogFiles = [
  ...readdirSync("scripts/audit/domains/runtime-log-spine").filter((name) => name !== "check.ts" && name !== "ast"),
  ...readdirSync("scripts/audit/domains/runtime-log-spine/ast").map((name) => `ast/${name}`),
];
assert.equal(runtimeLogFiles.length, 28);
assert.ok(existsSync("scripts/audit/domains/audit-system/check.ts"));
assert.ok(existsSync("scripts/audit/domains/audit-truth/check.ts"));
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
assert.equal(pkg.scripts["audit:system:enforce"], "node --import tsx scripts/audit/domains/audit-system/check.ts");
assert.equal(pkg.scripts["audit:truth:enforce"], "node --import tsx scripts/audit/domains/audit-truth/check.ts");
assert.equal(pkg.scripts["audit:runtime-log-spine:enforce"], "node --import tsx scripts/audit/domains/runtime-log-spine/check.ts");
console.log("audit-system-restoration-acceptance-ok");
