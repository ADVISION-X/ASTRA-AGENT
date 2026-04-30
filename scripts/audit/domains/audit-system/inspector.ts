import { finalizeInspectorResult } from "../../core/result.js";
import type { InspectorContext } from "../../core/schema.js";
import { runDomainOwnerInspection } from "../_shared/run-domain-owner-inspection.js";
import { validateGeneratedArtifacts } from "./components/validate-generated-artifacts.js";
import { validateLawHome } from "./components/validate-law-home.js";
import { validateManifestOwnership } from "./components/validate-manifest-ownership.js";
import { validateNoSimulatedProductionPaths } from "./components/validate-no-simulated-production-paths.js";
import { validateOwnerEvidence } from "./components/validate-owner-evidence.js";
import { validateNoTestArtifacts } from "./components/validate-no-test-artifacts.js";
import { validateOwnedLawExecution } from "./components/validate-owned-law-execution.js";
import { validateRequiredPhaseDomains } from "./components/validate-required-phase-domains.js";
import { validateRunnerBoundary } from "./components/validate-runner-boundary.js";
import { inspectCodePurity } from "../code-purity/components/inspect-code-purity.js";

export default async function inspectAuditSystem(context: InspectorContext) {
  const base = await runDomainOwnerInspection(context, {
    capabilityDomain: "audit-system",
    inspectorId: "audit-system-owner",
    inspectorEntry: "scripts/audit/domains/audit-system/inspector.ts",
  });

  const parts = await Promise.all([
    validateLawHome(context),
    validateManifestOwnership(context),
    validateGeneratedArtifacts(context),
    validateRequiredPhaseDomains(context),
    validateRunnerBoundary(context),
    validateOwnerEvidence(context),
    validateNoTestArtifacts(context),
    validateOwnedLawExecution(context),
    validateNoSimulatedProductionPaths(context),
    inspectCodePurity(context),
  ]);

  const findings = [...base.findings, ...parts.flatMap((part) => part.findings)];
  const phases = [...base.phases, ...parts.flatMap((part) => part.phases)];

  return finalizeInspectorResult({
    inspector: "GrassEye Audit System Owner Inspector",
    inspectorId: "audit-system-owner",
    capabilityDomain: "audit-system",
    findings,
    phases,
    summary:
      findings.length === 0
        ? "audit main chain is generated, routed, owner-boundary clean, and purity red lines are enforced"
        : "audit main chain has blocking law, manifest, runner, or purity-red-line defects",
  });
}
