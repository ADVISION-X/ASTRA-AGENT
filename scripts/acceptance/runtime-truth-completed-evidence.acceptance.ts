import assert from "node:assert/strict";

import { Project } from "ts-morph";

import {
  inspectDeepResearchCompletedContract,
  inspectFacebookCompletedContract,
} from "../audit/domains/runtime-truth/inspector.js";

const LAW_ID = "APEX-RUNTIME-TRUTH-001-V1";

const project = new Project({ useInMemoryFileSystem: true });

const failingDeepResearch = project.createSourceFile(
  "deep-research-analysis.result.ts",
  `
import { z } from "zod";

const DeepResearchFinalReportSchema = z.object({ ok: z.boolean() }).strict();
const DeepResearchResultSchema = z.object({
  jobId: z.string(),
  status: z.enum(["success", "review_required", "failed"]),
  jobStatus: z.enum(["completed", "review_required", "failed"]),
  report: DeepResearchFinalReportSchema.nullable().default(null),
  recordHashes: z.record(z.string(), z.string()).default({}),
}).strict();
`,
  { overwrite: true },
);

const lawfulDeepResearch = project.createSourceFile(
  "deep-research-analysis.result.good.ts",
  `
import { z } from "zod";

const DeepResearchFinalReportSchema = z.object({ ok: z.boolean() }).strict();
const DeepResearchResultSchema = z.object({
  jobId: z.string(),
  status: z.enum(["success", "review_required", "failed"]),
  jobStatus: z.enum(["completed", "review_required", "failed"]),
  report: DeepResearchFinalReportSchema,
  recordHashes: z.record(z.string(), z.string()),
}).strict();
`,
  { overwrite: true },
);

const failingFacebook = project.createSourceFile(
  "facebook-product-video-mining.schema.ts",
  `
import { z } from "zod";

const FacebookProductVideoMiningRunStatusSchema = z.object({
  runId: z.string(),
  status: z.enum(["running", "completed"]),
  startedAt: z.string(),
  endedAt: z.string().nullable().default(null),
  savedProductCount: z.number(),
}).strict();
`,
  { overwrite: true },
);

const lawfulFacebook = project.createSourceFile(
  "facebook-product-video-mining.schema.good.ts",
  `
import { z } from "zod";

const FacebookProductVideoMiningRunStatusSchema = z.object({
  runId: z.string(),
  status: z.enum(["running", "completed"]),
  startedAt: z.string(),
  endedAt: z.string().nullable().default(null),
  savedProductCount: z.number(),
  videoArtifactRef: z.string().nullable().default(null),
}).strict();
`,
  { overwrite: true },
);

assert.equal(
  inspectDeepResearchCompletedContract(failingDeepResearch, LAW_ID).some(
    (finding) => finding.checkId === "runtime-truth/deep-research-completed-contract",
  ),
  true,
  "runtime-truth should fail Deep Research completed contracts that default evidence to null or empty proof.",
);
assert.equal(
  inspectDeepResearchCompletedContract(lawfulDeepResearch, LAW_ID).length,
  0,
  "runtime-truth should allow Deep Research completed contracts that require report and record-hash evidence.",
);
assert.equal(
  inspectFacebookCompletedContract(failingFacebook, LAW_ID).some(
    (finding) => finding.checkId === "runtime-truth/facebook-completed-contract",
  ),
  true,
  "runtime-truth should fail Facebook completed contracts without video evidence fields.",
);
assert.equal(
  inspectFacebookCompletedContract(lawfulFacebook, LAW_ID).length,
  0,
  "runtime-truth should allow Facebook completed contracts that carry video evidence fields.",
);

console.log("runtime-truth-completed-evidence-acceptance-ok");