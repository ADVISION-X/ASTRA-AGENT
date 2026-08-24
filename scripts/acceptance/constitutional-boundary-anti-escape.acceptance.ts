import assert from "node:assert/strict";
import { resolve } from "node:path";
import { Project } from "ts-morph";

import { inspectConstitutionalBoundary } from "../audit/domains/architecture-boundary/constitutional-boundary-inspector.js";
import { createInspectorContextFixture } from "./fixtures/current-inspector-context.js";

const project = new Project({ useInMemoryFileSystem: true });
project.createSourceFile(resolve(process.cwd(), "src/plugins/constitutional-mutant/task.ts"), `
declare function execute(value: unknown): void;
execute({ abilityGroupId: "private", childCapabilityId: "escape" });
`);
const context = createInspectorContextFixture(
  project,
  "architecture-boundary",
  ["LAW-ARCHITECTURE-BOUNDARY-001-V1"],
);
const result = await inspectConstitutionalBoundary(context);
assert.ok(result.findings.some((finding) => finding.checkId === "constitutional-boundary/private-capability-protocol"));
console.log("constitutional-boundary-anti-escape-acceptance-ok");
