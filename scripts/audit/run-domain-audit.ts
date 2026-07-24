import { runGeneratedPlanFiltered } from "./core/run-generated-plan.js";

const capabilityDomain = process.argv[2];
if (!capabilityDomain) {
  throw new Error("Usage: node --import tsx scripts/audit/run-domain-audit.ts <capability-domain>");
}

const result = await runGeneratedPlanFiltered({ capabilityDomains: [capabilityDomain] });
process.exitCode = result.hasFailures ? 1 : 0;
