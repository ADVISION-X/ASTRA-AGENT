import assert from "node:assert/strict";

import { Project } from "ts-morph";

import { inspectDeepResearchCompletedContract } from "../audit/domains/runtime-truth/inspector.js";

const LAW_ID = "APEX-RUNTIME-TRUTH-001-V1";

const project = new Project({ useInMemoryFileSystem: true });

const createResultSource = (fileName: string, resultBody: string) =>
  project.createSourceFile(
    fileName,
    `
import { z } from "zod";

const DeepResearchFinalAdjudicationSchema = z.object({ ok: z.boolean() }).strict();
const DeepResearchResultSchema = z.object({
  jobId: z.string(),
  ${resultBody}
}).strict();
`,
    { overwrite: true },
  );

const failingCases = [
  createResultSource("nullable-default.ts", `
    status: z.literal("success"),
    jobStatus: z.literal("completed"),
    finalAdjudication: DeepResearchFinalAdjudicationSchema.nullable().default(null),
    recordHashes: z.record(z.string(), z.string()).default({}),`),
  createResultSource("missing-evidence.ts", `
    status: z.literal("success"),
    jobStatus: z.literal("completed"),`),
  createResultSource("optional-evidence.ts", `
    status: z.literal("success"),
    jobStatus: z.literal("completed"),
    finalAdjudication: DeepResearchFinalAdjudicationSchema.optional(),
    recordHashes: z.record(z.string(), z.string()).optional(),`),
  createResultSource("wrong-discriminants.ts", `
    status: z.enum(["success", "failed"]),
    jobStatus: z.literal("review_required"),
    finalAdjudication: DeepResearchFinalAdjudicationSchema,
    recordHashes: z.record(z.string(), z.string()),`),
];

const lawfulDeepResearch = createResultSource("lawful.ts", `
  status: z.literal("success"),
  jobStatus: z.literal("completed"),
  finalAdjudication: DeepResearchFinalAdjudicationSchema,
  recordHashes: z.record(z.string(), z.string()),`);

for (const failingDeepResearch of failingCases) {
  assert.equal(inspectDeepResearchCompletedContract(failingDeepResearch, LAW_ID).some(
    (finding) => finding.checkId === "runtime-truth/deep-research-completed-contract",
  ), true, `runtime-truth should fail incomplete contract ${failingDeepResearch.getBaseName()}.`);
}
assert.equal(
  inspectDeepResearchCompletedContract(lawfulDeepResearch, LAW_ID).length,
  0,
  "runtime-truth should allow Deep Research completed contracts that require report and record-hash evidence.",
);
console.log("runtime-truth-completed-evidence-acceptance-ok");
