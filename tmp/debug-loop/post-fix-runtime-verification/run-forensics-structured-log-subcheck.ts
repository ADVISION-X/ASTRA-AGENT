import { createAuditProject } from "../../../scripts/audit/domains/_shared/ast-helpers.js";
import { runForensicsStructuredLogRuntimeChecks } from "../../../scripts/audit/domains/forensics-persistence-capability/run-forensics-structured-log-runtime-checks.js";

const project = createAuditProject();
const findings = runForensicsStructuredLogRuntimeChecks(project);
console.log(JSON.stringify(findings, null, 2));
process.exit(findings.length === 0 ? 0 : 1);
