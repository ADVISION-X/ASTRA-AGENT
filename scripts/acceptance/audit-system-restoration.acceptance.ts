import assert from "node:assert/strict";

import { inspectAuditSystem, readDomainRoutes, validateDomainRoutes, validatePackageScripts } from "../audit/domains/audit-system/inspector.js";

assert.deepEqual(inspectAuditSystem(), []);

const packageMutant = validatePackageScripts({
  "audit:code-purity:enforce": "node --import tsx scripts/audit/domains/code-purity/check.ts",
  "audit:system:enforce": "node --import tsx scripts/audit/domains/audit-system/check.ts",
  "ci:full": "echo PASS",
  "quality:check": "node --import tsx scripts/audit/governance-v32.ts quality",
  "quality:shadow": "echo PASS",
});
assert.equal(packageMutant.some((item) => item.code === "AUDIT_COMMAND_SURFACE_INVALID"), true);
assert.equal(packageMutant.some((item) => item.code === "AUDIT_SECOND_QUALITY_SURFACE"), true);

const routes = readDomainRoutes("scripts/audit/governance-v32.ts");
assert.deepEqual(validateDomainRoutes(routes), []);
assert.equal(validateDomainRoutes({ ...routes, "code-purity": [] }).some((item) => item.code === "AUDIT_OWNER_ROUTE_MISSING"), true);

console.log("audit-system-restoration-acceptance-ok");
