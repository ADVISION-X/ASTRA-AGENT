import { readFileSync } from "node:fs";

import type { InspectorContext, InspectorResult } from "../../core/schema.js";
import { createFinding, createPhase, finalizeInspectorResult } from "../../core/result.js";
import { runDomainOwnerInspection } from "../_shared/owner-foundation-inspection.js";
import { createPageStateAuditProject } from "./audit-project.js";
import { runAntiEscape } from "./anti-escape.js";
import { runBoundaryAttack } from "./boundary-attack.js";
import { runEnforcementCoverage } from "./enforcement-coverage.js";
import { runForbiddenShape } from "./forbidden-shape.js";
import { runRequiredShape } from "./required-shape.js";
import { runTruthOwnership } from "./truth-ownership.js";

const AI_ONLY_PAGE_STATE_FILES = [
  "src/lib/local-runtime/workbench-page-state-dispatch-input.ts",
  "src/lib/local-runtime/workbench-page-state-proof-summary-registry.ts",
  "src/lib/local-runtime/workbench-visual-dispatch-input-next-item-target.ts",
  "src/lib/local-runtime/workbench-visual-dispatch-input-comments-target.ts",
  "src/capabilities/page-state/schema.ts",
  "src/capabilities/page-state/shared/page-state-profile.ts",
] as const;

const AI_ONLY_PAGE_STATE_FORBIDDEN = [
  "feedReady",
  "pageReady",
  "pageCorrect",
  "urlMatchesFeedPath",
  "feed-shell",
  "feed-ready",
  "safety_wall",
  "captcha-marker",
  "feed-shell-marker",
  "pageStateType",
  "platform_feed",
  'decision: "allow"',
  'decision="allow"',
  "Current URL matches",
  "Runtime session URL and platform profile indicate feed readiness",
] as const;

function runAiOnlyPageStateBoundary() {
  const findings = AI_ONLY_PAGE_STATE_FILES.flatMap((file) => {
    const text = readFileSync(file, "utf8");
    return AI_ONLY_PAGE_STATE_FORBIDDEN
      .filter((token) => text.includes(token))
      .map((token) => createFinding({
        lawId: "GRASSEYE-PAGE-STATE-AI-ONLY-INTERPRETATION-BOUNDARY-V1",
        file,
        line: 1,
        severity: "fatal" as const,
        message: `Page State and Workbench raw-observation paths must not contain non-AI page interpretation token "${token}".`,
      }));
  });

  return {
    findings,
    phase: createPhase(
      "ai-only-page-state-boundary",
      findings.length === 0 ? "PASS" : "CODE VIOLATION",
      findings.length === 0,
      findings.length === 0
        ? "Page State raw-observation boundary contains no forbidden page interpretation tokens."
        : "Page State raw-observation boundary still contains forbidden non-AI interpretation tokens.",
    ),
  };
}

function collectInspectorFindings(input: {
  base: Awaited<ReturnType<typeof runDomainOwnerInspection>>;
  required: Awaited<ReturnType<typeof runRequiredShape>>;
  forbidden: Awaited<ReturnType<typeof runForbiddenShape>>;
  boundary: Awaited<ReturnType<typeof runBoundaryAttack>>;
  truthOwnership: ReturnType<typeof runTruthOwnership>;
  antiEscape: Awaited<ReturnType<typeof runAntiEscape>>;
  aiOnlyBoundary: ReturnType<typeof runAiOnlyPageStateBoundary>;
  enforcementCoverage: Awaited<ReturnType<typeof runEnforcementCoverage>>;
}) {
  return [
    ...input.base.findings,
    ...input.required.findings,
    ...input.forbidden.findings,
    ...input.boundary.findings,
    ...input.truthOwnership.findings,
    ...input.antiEscape.findings,
    ...input.aiOnlyBoundary.findings,
    ...input.enforcementCoverage.findings,
  ];
}

function collectInspectorPhases(input: {
  base: Awaited<ReturnType<typeof runDomainOwnerInspection>>;
  required: Awaited<ReturnType<typeof runRequiredShape>>;
  forbidden: Awaited<ReturnType<typeof runForbiddenShape>>;
  boundary: Awaited<ReturnType<typeof runBoundaryAttack>>;
  truthOwnership: ReturnType<typeof runTruthOwnership>;
  antiEscape: Awaited<ReturnType<typeof runAntiEscape>>;
  aiOnlyBoundary: ReturnType<typeof runAiOnlyPageStateBoundary>;
  enforcementCoverage: Awaited<ReturnType<typeof runEnforcementCoverage>>;
}) {
  return [
    ...input.base.phases,
    input.required.phase,
    input.forbidden.phase,
    input.boundary.phase,
    input.truthOwnership.phase,
    input.antiEscape.phase,
    input.aiOnlyBoundary.phase,
    input.enforcementCoverage.phase,
  ];
}

export async function inspectPageStateCapability(context: InspectorContext): Promise<InspectorResult> {
  const base = await runDomainOwnerInspection(context, {
    capabilityDomain: "page-state-capability",
    inspectorId: "page-state-capability-owner",
    inspectorEntry: "scripts/audit/domains/page-state-capability/inspector.ts",
  });
  const project = createPageStateAuditProject();
  const required = await runRequiredShape(project);
  const forbidden = await runForbiddenShape(project);
  const boundary = await runBoundaryAttack(project);
  const truthOwnership = runTruthOwnership(project);
  const antiEscape = await runAntiEscape(project);
  const aiOnlyBoundary = runAiOnlyPageStateBoundary();
  const enforcementCoverage = await runEnforcementCoverage(context);
  const findings = collectInspectorFindings({ base, required, forbidden, boundary, truthOwnership, antiEscape, aiOnlyBoundary, enforcementCoverage });
  const phases = collectInspectorPhases({ base, required, forbidden, boundary, truthOwnership, antiEscape, aiOnlyBoundary, enforcementCoverage });

  return finalizeInspectorResult({
    inspector: "GrassEye Page State Capability Owner Inspector",
    inspectorId: "page-state-capability-owner",
    capabilityDomain: "page-state-capability",
    findings,
    phases,
    summary: findings.length === 0
      ? "page-state owner inspector passed required, forbidden, boundary, truth-ownership, anti-escape, and enforcement-coverage phases"
      : "page-state owner inspector found capability-boundary, enforcement, or governance violations",
  });
}
