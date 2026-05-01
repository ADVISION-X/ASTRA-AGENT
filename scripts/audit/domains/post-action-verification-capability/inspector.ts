import type { InspectorContext, InspectorResult } from "../../core/schema.js";
import { finalizeInspectorResult } from "../../core/result.js";
import { runDomainOwnerInspection } from "../_shared/owner-foundation-inspection.js";
import { createPostActionAuditProject } from "./project-access.js";
import { runAntiEscape } from "./anti-escape.js";
import { runBoundaryAttack } from "./boundary-attack.js";
import { runForbiddenShape } from "./forbidden-shape.js";
import { runRequiredShape } from "./required-shape.js";

export async function inspectPostActionVerificationCapability(context: InspectorContext): Promise<InspectorResult> {
  const base = await runDomainOwnerInspection(context, {
    capabilityDomain: "post-action-verification-capability",
    inspectorId: "post-action-verification-capability-owner",
    inspectorEntry: "scripts/audit/domains/post-action-verification-capability/inspector.ts",
  });
  const project = createPostActionAuditProject();
  const required = await runRequiredShape(project);
  const forbidden = await runForbiddenShape(project);
  const boundary = await runBoundaryAttack(project);
  const antiEscape = await runAntiEscape(project);
  const findings = [
    ...base.findings,
    ...required.findings,
    ...forbidden.findings,
    ...boundary.findings,
    ...antiEscape.findings,
  ];
  const phases = [...base.phases, required.phase, forbidden.phase, boundary.phase, antiEscape.phase];

  return finalizeInspectorResult({
    inspector: "GrassEye Post-action Verification Capability Owner Inspector",
    inspectorId: "post-action-verification-capability-owner",
    capabilityDomain: "post-action-verification-capability",
    findings,
    phases,
    summary: findings.length === 0
      ? "post-action-verification owner inspector passed required, forbidden, boundary, and anti-escape phases"
      : "post-action-verification owner inspector found capability-boundary or governance violations",
  });
}
