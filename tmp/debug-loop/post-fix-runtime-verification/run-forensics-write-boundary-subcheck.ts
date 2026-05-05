import { createAuditProject } from "../../../scripts/audit/domains/_shared/ast-helpers.js";
import { runForensicsStructuredLogRuntimeChecks } from "../../../scripts/audit/domains/forensics-persistence-capability/run-forensics-structured-log-runtime-checks.js";

const TARGET_FILE = "src/capabilities/forensics-persistence/shared/forensics-write-boundary-events.ts";
const TARGET_LAW = "GRASSEYE-STRUCTURED-LOGGING-001-V1";

const project = createAuditProject();
const findings = runForensicsStructuredLogRuntimeChecks(project).filter((finding) => {
  return finding.file === TARGET_FILE && finding.lawId === TARGET_LAW;
});

console.log(JSON.stringify(findings, null, 2));
process.exit(findings.length === 0 ? 0 : 1);
