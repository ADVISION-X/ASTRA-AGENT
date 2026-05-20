import { writeAuditArtifactProvenance } from "./core/generated-provenance.js";
import { repoRoot } from "./core/path-roots.js";
import { runAuditSystemInspector } from "./domains/audit-system/inspector.js";

await runAuditSystemInspector({ repoRoot });
writeAuditArtifactProvenance();
await runAuditSystemInspector({ repoRoot });
writeAuditArtifactProvenance();

process.stdout.write("[AUDIT-BUILD][PASS] generated audit artifacts rebuilt.\n");
