import { finalizeInspectorResult } from "../../core/result.js";
import type { InspectorContext } from "../../core/schema.js";
import { readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createPhase } from "../../core/result.js";
import { runDomainOwnerInspection } from "../_shared/run-domain-owner-inspection.js";
import { inspectAgentRuntimeAst } from "./components/inspect-agent-runtime-ast.js";

export default async function inspectAgentRuntime(context: InspectorContext) {
  const base = await runDomainOwnerInspection(context, {
    capabilityDomain: "agent-runtime",
    inspectorId: "agent-runtime-owner",
    inspectorEntry: "scripts/audit/domains/agent-runtime/inspector.ts",
  });

  const astInspection = await inspectAgentRuntimeAst();
  const agentServiceSource = await readTextFile(pathFromRepoRoot("src/features/agent/agent-service.ts"));
  const reviewGatePassed =
    agentServiceSource.includes('browseDecision.mustReview') &&
    agentServiceSource.includes('const likeResult = await this.adapter.likeOrSaveCandidate') &&
    agentServiceSource.includes('openCommentsResult.status === "failed"') &&
    agentServiceSource.includes('comments_unavailable_candidate_created');
  const runtimeBoundaryPassed =
    !agentServiceSource.includes("point:") &&
    !agentServiceSource.includes("screenX") &&
    agentServiceSource.includes("this.adapter.likeOrSaveCandidate") &&
    agentServiceSource.includes("this.adapter.openComments");

  const findings = [...base.findings, ...astInspection.findings];
  const phases = [
    ...base.phases,
    ...astInspection.phases,
    createPhase(
      "review-gate-markers",
      reviewGatePassed ? "PASS" : "LAW-SCRIPT DRIFT",
      reviewGatePassed,
      reviewGatePassed
        ? "Runtime keeps explicit review gates while preserving the governed video-only candidate path for comment failures."
        : "Agent runtime is missing governed review or comment-failure routing markers.",
    ),
    createPhase(
      "runtime-action-abstraction",
      runtimeBoundaryPassed ? "PASS" : "LAW-SCRIPT DRIFT",
      runtimeBoundaryPassed,
      runtimeBoundaryPassed
        ? "Agent runtime still requests abstract adapter actions and does not own coordinates."
        : "Agent runtime appears to own raw coordinate details or lost adapter-boundary action flow.",
    ),
  ];

  return finalizeInspectorResult({
    inspector: "GrassEye Agent Runtime Owner Inspector",
    inspectorId: "agent-runtime-owner",
    capabilityDomain: "agent-runtime",
    findings,
    phases,
    summary:
      findings.length === 0
        ? "agent runtime is AST-enforced as one bounded observe-classify-act-record loop"
        : "agent runtime lost a bounded-loop, owner-boundary, or anti-escape invariant",
  });
}