import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { Project } from "ts-morph";

import {
  agentPluginCapabilityManifest,
  productionPluginCatalog,
} from "../../src/lib/local-runtime/production/catalog.js";
import { inspectProductAcceptanceBoundaries } from "../audit/domains/architecture-boundary/components/scan-product-acceptance-boundaries.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

const lawId = "LAW-ARCHITECTURE-BOUNDARY-001-V4";
const testDirectory = resolve("scripts/acceptance/product-plugins");
const catalogIds = productionPluginCatalog.map((plugin) => plugin.pluginId).sort();
const manifestIds = agentPluginCapabilityManifest.plugins.map((plugin) => plugin.plugin_id).sort();
const testIds = readdirSync(testDirectory)
  .filter((name) => name.endsWith(".acceptance.ts"))
  .map((name) => name.slice(0, -".acceptance.ts".length))
  .sort();

assert(catalogIds.length > 0, "the current Catalog must publish at least one Product Plugin");
assert.deepEqual(manifestIds, catalogIds,
  "the current Capability Manifest and Catalog must publish the same Plugin identities");
assert.deepEqual(testIds, catalogIds,
  "every current Product Plugin must have exactly one independently named acceptance file");

for (const testId of testIds) {
  const testPath = resolve(testDirectory, `${testId}.acceptance.ts`);
  const child = spawnSync(process.execPath, ["--import", "tsx", testPath], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
  });
  assert.equal(child.status, 0,
    `${testId} acceptance failed\n${child.stdout}\n${child.stderr}`);
}

const mutants: ReadonlyArray<Readonly<{ checkId: string; source: string }>> = [
  { checkId: "architecture/central-product-sequence",
    source: "const x = [\"write_exact_gpt_prompt\", \"submit_exact_gpt_turn_once\"];" },
  { checkId: "architecture/central-product-fixed-cardinality", source: "assert.equal(testIds.length, 12);" },
  { checkId: "architecture/central-product-business-content", source: "const x = \"Product prompt body\";" },
  { checkId: "architecture/central-product-business-content", source: "const x = { resumePoint: \"child-2\" };" },
];
for (const mutant of mutants) {
  const project = new Project({ tsConfigFilePath: "tsconfig.json" });
  const sourceFile = project.getSourceFileOrThrow(resolve("scripts/acceptance/architecture-boundary.acceptance.ts"));
  sourceFile.replaceWithText(`${sourceFile.getFullText()}\n${mutant.source}\n`);
  const findings: Parameters<typeof inspectProductAcceptanceBoundaries>[0]["findings"] = [];
  inspectProductAcceptanceBoundaries({ findings, inspectedFiles: new Set(), lawId, project });
  assert.ok(findings.some((finding) => finding.checkId === mutant.checkId),
    `${mutant.source} must emit ${mutant.checkId}`);
}

process.stdout.write("[ACCEPTANCE][architecture-boundary] PASS\n");
emitQualityProofObservation({
  lawId,
  evidenceMode: "exam.golden",
  clauses: ["forbidden:8", "summary"],
  locator: "acceptance:architecture-boundary",
  observedValue: "Catalog and Capability Manifest identities match independent Product acceptances, every Product acceptance passed, and central sequence, fixed-cardinality, business-content, and recovery-field mutants were rejected",
});
