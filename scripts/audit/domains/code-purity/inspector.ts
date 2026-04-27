import { finalizeInspectorResult } from "../../core/result.js";
import type { InspectorContext } from "../../core/schema.js";
import { runDomainOwnerInspection } from "../_shared/run-domain-owner-inspection.js";
import { inspectCodePurity } from "./components/inspect-code-purity.js";

export default async function inspectCodePurityOwner(context: InspectorContext) {
  const base = await runDomainOwnerInspection(context, {
    capabilityDomain: "code-purity",
    inspectorId: "code-purity-owner",
    inspectorEntry: "scripts/audit/domains/code-purity/inspector.ts",
  });

  const purity = await inspectCodePurity();
  const findings = [...base.findings, ...purity.findings];
  const phases = [...base.phases, ...purity.phases];

  return finalizeInspectorResult({
    inspector: "GrassEye Code Purity Owner Inspector",
    inspectorId: "code-purity-owner",
    capabilityDomain: "code-purity",
    findings,
    phases,
    summary:
      findings.length === 0
        ? "code-purity owner is active in the runner and enforces scoped AST-backed purity checks"
        : "code-purity owner found blocking purity violations or phase-routing drift",
  });
}