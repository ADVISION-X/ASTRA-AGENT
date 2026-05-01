import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

import { geometryGuardInspectionConfig as config } from "./inspection-constants.js";
import { runGeometryGuardChecks } from "./run-geometry-guard-checks.js";

export const geometryGuardCapabilityInspector = createPendingDomainInspector({
  inspector: "GrassEye Geometry Guard Capability Owner Inspector",
  inspectorId: "geometry-guard-capability-owner",
  capabilityDomain: "geometry-guard-capability",
  inspectorEntry: "scripts/audit/domains/geometry-guard-capability/inspector.ts",
  ownedPaths: [config.ROOT],
  pendingSummary: "geometry-guard-capability law exists but production-grade coordinate-gate enforcement is not complete yet",
  implementedSummary: "geometry-guard-capability is enforced as a schema-first coordinate safety gate with AST-backed anti-escape checks",
  extraChecks: runGeometryGuardChecks,
});