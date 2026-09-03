import assert from "../audit/shared/governance-exam-assert.js";
import { resolve } from "node:path";

import { Project } from "ts-morph";

import { inspectProductAcceptanceBoundaries } from "../audit/domains/architecture-boundary/components/scan-product-acceptance-boundaries.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

const lawId = "LAW-ARCHITECTURE-BOUNDARY-001-V4";
const centralPath = resolve("scripts/acceptance/architecture-boundary.acceptance.ts");

const mutants: ReadonlyArray<Readonly<{
  checkId: string;
  source: string;
}>> = [
  {
    checkId: "architecture/central-product-sequence",
    source: "const x = [\"write_exact_gpt_prompt\", \"submit_exact_gpt_turn_once\"];",
  },
  {
    checkId: "architecture/central-product-fixed-cardinality",
    source: "assert.equal(testIds.length, 12);",
  },
  {
    checkId: "architecture/central-product-business-content",
    source: "const x = \"Product prompt body\";",
  },
  {
    checkId: "architecture/central-product-business-content",
    source: "const x = { resumePoint: \"child-2\" };",
  },
];

for (const mutant of mutants) {
  const project = new Project({ tsConfigFilePath: "tsconfig.json" });
  const sourceFile = project.getSourceFileOrThrow(centralPath);
  sourceFile.replaceWithText(`${sourceFile.getFullText()}\n${mutant.source}\n`);
  const findings: Parameters<typeof inspectProductAcceptanceBoundaries>[0]["findings"] = [];
  inspectProductAcceptanceBoundaries({ findings, inspectedFiles: new Set(), lawId, project });
  assert.ok(findings.some((finding) => finding.checkId === mutant.checkId),
    `${mutant.source} must emit ${mutant.checkId}`);
}

process.stdout.write("[ACCEPTANCE][architecture-boundary:anti-escape] PASS\n");
emitQualityProofObservation({
  lawId,
  evidenceMode: "exam.golden",
  clauses: ["forbidden:8"],
  locator: "acceptance:architecture-boundary:anti-escape",
  observedValue: "renamed GPT Child sequence, fixed Product cardinality, Product Prompt body, and recovery-field mutants were rejected",
});
