import assert from "node:assert/strict";
import { resolve } from "node:path";
import { Project } from "ts-morph";

import { scanGeneratedPlanCoverage } from "../audit/domains/audit-truth/components/scan-generated-plan-coverage.js";
import { createInspectorContextFixture } from "./fixtures/current-inspector-context.js";

const project = new Project({ useInMemoryFileSystem: true });
project.createSourceFile(resolve(process.cwd(), "scripts/audit/domains/orphan-owner/inspector.ts"), "export const inspectDomain = async () => ({ findings: [] });\n");
const context = createInspectorContextFixture(project, "audit-truth", ["LAW-AUDIT-TRUTH-001-V1"]);
const result = scanGeneratedPlanCoverage({ context, inspectedFiles: new Set<string>(), lawId: "LAW-AUDIT-TRUTH-001-V1" });
assert.ok(result.findings.some((finding) => finding.checkId === "audit-truth/missing-generated-plan-entry"));
console.log("audit-truth-coverage-acceptance-ok");
