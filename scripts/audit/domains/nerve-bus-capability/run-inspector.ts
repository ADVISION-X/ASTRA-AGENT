import { nerveBusCapabilityInspector } from "./inspector.js";
import type { InspectorContext } from "../../core/schema.js";

// Minimal stub context for standalone run
const stubContext = {
  repoRoot: process.cwd(),
  manifestsByDomain: new Map(),
  matrixOwnersByDomain: new Map(),
  planOwnersByDomain: new Map(),
  lawRegistry: null,
  enforcementMatrix: null,
  childCapabilityStrengthInventory: null,
  auditPlan: null,
  staticClauseCoverage: null,
} as unknown as InspectorContext;

nerveBusCapabilityInspector(stubContext).then((result) => {
  for (const finding of result.findings) {
    console.error(`❌ [${finding.lawId}] ${finding.message}`);
  }
  if (result.passed) {
    console.log(`✅ Nerve Bus governance: PASSED — ${result.summary}`);
  } else {
    console.error(`\n❌ Nerve Bus governance: FAILED — ${result.summary}`);
    process.exit(1);
  }
}).catch((err) => {
  console.error("Inspector error:", err);
  process.exit(1);
});
