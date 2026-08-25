import assert from "node:assert/strict";
import { Project } from "ts-morph";

import { inspectActivePluginMediators } from "../audit/domains/architecture-boundary/components/scan-active-plugin-mediators.js";
import type { InspectorFinding } from "../audit/shared/inspector-contracts.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

const findings: InspectorFinding[] = [];
inspectActivePluginMediators({
  entries: [{
    pluginId: "mutant",
    status: "active",
    mediatorRoute: "src/mediator/not-canonical.ts",
    allowedEntrypoints: [],
    mediatorBindings: [],
  }],
  findings,
  inspectedFiles: new Set<string>(),
  lawId: "LAW-ARCHITECTURE-BOUNDARY-001-V1",
  project: new Project({ useInMemoryFileSystem: true }),
});
assert.ok(findings.some((finding) => finding.checkId === "architecture/active-plugin-mediator-noncanonical"));
console.log("architecture-active-plugin-mediators-acceptance-ok");
emitQualityProofObservation({ lawId: "LAW-CAPABILITY-GOVERNANCE-001-V1", evidenceMode: "exam.golden", locator: "acceptance:capability-governance:mediator-mutant", observedValue: "noncanonical active plugin mediator mutant rejected" });
