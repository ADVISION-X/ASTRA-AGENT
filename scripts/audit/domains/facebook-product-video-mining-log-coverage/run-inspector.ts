import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { loadGeneratedAuditPlan } from "../../core/load-audit-plan.js";
import { createAuditProject } from "../../shared/project.js";
import { inspectDomain } from "./inspector.js";

buildAuditArtifacts();
const planEntry = loadGeneratedAuditPlan().find((entry) => entry.capabilityDomain === "facebook-product-video-mining-log-coverage");
if (!planEntry) {
  throw new Error("facebook-product-video-mining-log-coverage audit plan entry is missing.");
}
const output = await inspectDomain({
  project: createAuditProject(),
  planEntry,
  generatedPlan: [planEntry],
  completedReports: {},
});
if (output.findings.length > 0) {
  throw new Error(`facebook-product-video-mining-log-coverage failed with ${output.findings.length} finding(s).`);
}
process.stdout.write("[AUDIT] facebook-product-video-mining-log-coverage PASS\n");
