import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { loadGeneratedAuditPlan } from "../../core/load-audit-plan.js";
import { createAuditProject } from "../../shared/project.js";
import { inspectDomain } from "./inspector.js";

buildAuditArtifacts();
const planEntry = loadGeneratedAuditPlan().find((entry) => entry.capabilityDomain === "media-processing-capability");
if (!planEntry) {
  throw new Error("media-processing-capability audit plan entry is missing.");
}
const output = await inspectDomain({
  project: createAuditProject(),
  planEntry,
  generatedPlan: [planEntry],
  completedReports: {},
});
if (output.findings.length > 0) {
  throw new Error(`media-processing-capability failed with ${output.findings.length} finding(s).`);
}
process.stdout.write("[AUDIT] media-processing-capability PASS\n");
