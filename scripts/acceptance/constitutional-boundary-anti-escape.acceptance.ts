import assert from "node:assert/strict";
import { resolve } from "node:path";
import { Project } from "ts-morph";

import { inspectDomain } from "../audit/domains/architecture-boundary/inspector.js";
import { createInspectorContextFixture } from "../audit/shared/inspector-context-acceptance-support.js";

const project = new Project({ tsConfigFilePath: "tsconfig.json" });
const mutantPath = "src/plugins/constitutional-mutant/task.ts";
project.createSourceFile(resolve(process.cwd(), mutantPath), `
declare function execute(value: unknown): void;
execute({ abilityGroupId: "private", childCapabilityId: "escape" });
`);
const targetPath = "scripts/audit/shared/quality-contract.ts";
const fixture = createInspectorContextFixture(
  project,
  "architecture-boundary",
  ["LAW-ARCHITECTURE-BOUNDARY-001-V3"],
);
const context = {
  ...fixture,
  targetPaths: [targetPath],
  lawRequirements: fixture.lawRequirements.map((requirement) => ({
    ...requirement,
    requiredStaticModes: ["static.ast", "static.dependency", "static.filesystem", "static.types"],
    targetPaths: [targetPath],
    targetSet: { queryRef: `scope:${requirement.lawId}#appliesTo-minus-excludes`, count: 1 },
  })),
};
const result = await inspectDomain(context);
assert.ok(result.lawResults[0]?.findings.some((finding) =>
  finding.checkId === "constitutional-boundary/private-capability-protocol"));
console.log("constitutional-boundary-anti-escape-acceptance-ok");
