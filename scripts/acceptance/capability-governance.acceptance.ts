import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Project } from "ts-morph";

import {
  inspectCapabilityGovernanceProject,
} from "../audit/domains/capability-governance/inspector.js";
import {
  pushCapabilitySourceOfTruthFindings,
} from "../audit/domains/capability-governance/components/capability-governance-report.js";
import {
  loadCapabilitySourceOfTruth,
} from "../audit/domains/capability-governance/components/capability-source-of-truth.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import { blueprintMarkdownBodyValid } from "../audit/governance-json.js";

const projectWith = (files: Record<string, string>): Project => {
  const project = new Project({ useInMemoryFileSystem: true });
  for (const [file, source] of Object.entries(files)) project.createSourceFile(resolve(file), source);
  return project;
};

const findingIds = (files: Record<string, string>): Set<string> => new Set(
  inspectCapabilityGovernanceProject(projectWith(files), false).findings.map((finding) => finding.checkId),
);

assert.ok(findingIds({
  "src/capabilities/demo/index.ts": "export { decideBusinessOutcome } from './business-decision.ts';",
  "src/capabilities/demo/business-decision.ts": "export const decideBusinessOutcome = () => 'PASS';",
  "src/plugins/demo/index.ts": "import { decideBusinessOutcome } from '../../capabilities/demo/index.ts'; void decideBusinessOutcome;",
}).has("capability-group/facade-noncontract-value-export"));

assert.ok(findingIds({
  "src/capabilities/demo/children/first/handler.ts": "import { second } from '../second/handler.ts'; export const first = () => second();",
  "src/capabilities/demo/children/second/handler.ts": "export const second = () => 'done';",
  "src/capabilities/demo/index.ts": "export { first } from './children/first/handler.ts';",
  "src/plugins/demo/index.ts": "import { first } from '../../capabilities/demo/index.ts'; void first;",
}).has("capability-group/child-composes-child"));

assert.equal(findingIds({
  "src/capabilities/demo/children/first/handler.ts": "import { observeFirst } from './observation.ts'; export const first = () => observeFirst();",
  "src/capabilities/demo/children/first/observation.ts": "export const observeFirst = () => 'done';",
  "src/capabilities/demo/index.ts": "export const createDemo = () => ({});",
  "src/plugins/demo/index.ts": "import { createDemo } from '../../capabilities/demo/index.ts'; void createDemo;",
}).has("capability-group/child-composes-child"), false);

assert.ok(findingIds({
  "src/capabilities/demo/index.ts": "export const createDemo = () => ({});",
  "src/capabilities/demo/runtime/private.ts": "export const privateRuntime = true;",
  "src/plugins/demo/index.ts": "import { privateRuntime } from '../../capabilities/demo/runtime/private.ts'; void privateRuntime;",
}).has("capability-group/external-private-import"));

assert.ok(findingIds({
  "src/capabilities/demo/index.ts": "import { hidden } from '../../shared/workflow.ts'; export const createDemo = () => hidden;",
  "src/shared/workflow.ts": "export const hidden = true;",
}).has("capability-group/ownerless-generic-import"));

assert.ok(findingIds({
  "src/capabilities/demo/index.ts": "export const createDemo = () => ({}); export type UnusedContract = { value: string };",
  "src/plugins/demo/index.ts": "import { createDemo } from '../../capabilities/demo/index.ts'; void createDemo;",
}).has("capability-group/missing-production-export-consumer"));

const sourceOfTruth = loadCapabilitySourceOfTruth();
const sourceTruthFindings: Array<{ checkId: string }> = [];
pushCapabilitySourceOfTruthFindings({
  admissionLawId: "LAW-CAPABILITY-GOVERNANCE-001-V8",
  actualCapabilityRoots: new Set([...sourceOfTruth.lawActiveCapabilityRoots, "src/capabilities/amazon-legacy"]),
  pushFinding: (finding) => sourceTruthFindings.push(finding),
});
assert.ok(sourceTruthFindings.some((finding) => finding.checkId === "capability-group/unapproved-root"));

assert.ok(findingIds({
  "src/capabilities/demo/runtime/private.ts": "export const privateRuntime = true;",
  "src/plugins/demo/index.ts": "import { privateRuntime } from '../../capabilities/demo/runtime/private.ts'; void privateRuntime;",
}).has("capability-group/missing-public-facade"));

const blueprintSource = readFileSync(
  "docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md",
  "utf8",
);
assert.equal(blueprintMarkdownBodyValid(blueprintSource), true);
assert.equal(blueprintMarkdownBodyValid(`${blueprintSource}\nTODO\n`), false);
const blueprintWithoutAcceptanceEvidence = blueprintSource.replace(/验收|pass|fail|通过|证明|检查/giu, "确认");
assert.equal(blueprintMarkdownBodyValid(blueprintWithoutAcceptanceEvidence), false);

console.log("capability-governance-acceptance-ok");
emitQualityProofObservation({
  lawId: "LAW-CAPABILITY-GOVERNANCE-001-V8", evidenceMode: "exam.golden", clauses: ["forbidden:0","forbidden:1","forbidden:10","forbidden:11","forbidden:2","forbidden:3","forbidden:4","forbidden:5","forbidden:6","forbidden:7","forbidden:8","forbidden:9","summary"],
  locator: "acceptance:capability-governance:mutant-matrix",
  observedValue: "seven capability-governance clause mutants rejected by the capability-governance inspector",
});
