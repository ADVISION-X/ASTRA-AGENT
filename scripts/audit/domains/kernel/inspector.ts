import { createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { InspectorContext } from "../../core/schema.js";
import { getAuditProject } from "../../core/ts-morph.js";
import { runDomainOwnerInspection } from "../_shared/owner-foundation-inspection.js";

import { kernelInspectionConstants } from "./inspection-constants.js";
import { runNegativeProofHarness } from "./negative-proof-harness.js";
import { runAntiFallbackBoundaryChecks } from "./run-anti-fallback-boundary-checks.js";
import { runChildContractGovernanceChecks } from "./run-child-contract-governance-checks.js";
import { runChildOwnershipChecks } from "./run-child-ownership-checks.js";
import { runDeletedOwnerBaselineChecks } from "./run-deleted-owner-baseline-checks.js";
import { runForbiddenOwnerRuntimeChecks } from "./run-forbidden-owner-runtime-checks.js";
import { runGeneratedSyncPrincipleChecks } from "./run-generated-sync-principle-checks.js";
import { runNegativeProofWiringChecks } from "./run-negative-proof-wiring-checks.js";
import { runKernelChecks } from "./run-kernel-checks.js";
import { runKernelOwnerSurfaceChecks } from "./run-owner-surface-checks.js";
import { runPromptContractRoutingChecks } from "./run-prompt-contract-routing-checks.js";

const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_KERNEL_NEGATIVE_PROOF";

export async function kernelInspector(_context: InspectorContext) {
  const base = await runDomainOwnerInspection(_context, {
    capabilityDomain: "kernel",
    inspectorId: "kernel-owner",
    inspectorEntry: "scripts/audit/domains/kernel/inspector.ts",
  });
  const surface = await runKernelOwnerSurfaceChecks();
  const kernelChecks = await runKernelChecks();
  const childOwnership = await runChildOwnershipChecks();
  const childContractGovernance = await runChildContractGovernanceChecks();
  const deletedOwnerBaseline = await runDeletedOwnerBaselineChecks();
  const generatedSyncPrinciples = await runGeneratedSyncPrincipleChecks();
  const antiFallback = await runAntiFallbackBoundaryChecks();
  const forbiddenOwnerRuntime = await runForbiddenOwnerRuntimeChecks();
  const promptContractRouting = await runPromptContractRoutingChecks();
  const negativeProofWiring = await runNegativeProofWiringChecks(getAuditProject());
  const negativeProof = process.env[SKIP_NEGATIVE_PROOF_ENV] === "1"
    ? {
        findings: [],
        phase: createPhase(
          "negative-proof-harness",
          "PASS",
          true,
          "Kernel negative-proof harness was skipped for nested inspector execution.",
        ),
      }
    : await runNegativeProofHarness();

  const findings = [
    ...base.findings,
    ...surface.findings,
    ...kernelChecks.findings,
    ...childOwnership.findings,
    ...childContractGovernance.findings,
    ...deletedOwnerBaseline.findings,
    ...generatedSyncPrinciples.findings,
    ...antiFallback.findings,
    ...forbiddenOwnerRuntime.findings,
    ...promptContractRouting.findings,
    ...negativeProofWiring.findings,
    ...negativeProof.findings,
  ];
  const phases = [
    ...base.phases,
    ...surface.phases,
    ...kernelChecks.phases,
    ...childOwnership.phases,
    ...childContractGovernance.phases,
    ...deletedOwnerBaseline.phases,
    ...generatedSyncPrinciples.phases,
    ...antiFallback.phases,
    ...forbiddenOwnerRuntime.phases,
    ...promptContractRouting.phases,
    ...negativeProofWiring.phases,
    negativeProof.phase,
  ];

  return finalizeInspectorResult({
    inspector: "GrassEye Kernel Routing Inspector",
    inspectorId: "kernel-owner",
    capabilityDomain: "kernel",
    findings,
    phases,
    summary: findings.length === 0
      ? "kernel independently enforces top-level owners, child ownership, and prompt-contract routing boundaries"
      : "kernel routing owner still has law, script, or source drift",
  });
}