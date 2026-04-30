import type { InspectorContext, InspectorResult } from "../../core/schema.js";
import { finalizeInspectorResult } from "../../core/result.js";
import { createPageStateAuditProject } from "./ast-utils.js";
import { runAntiEscape } from "./anti-escape.js";
import { runBoundaryAttack } from "./boundary-attack.js";
import { runForbiddenShape } from "./forbidden-shape.js";
import { runRequiredShape } from "./required-shape.js";

export default async function inspectPageStateCapability(_context: InspectorContext): Promise<InspectorResult> {
  const project = createPageStateAuditProject();
  const required = await runRequiredShape(project);
  const forbidden = await runForbiddenShape(project);
  const boundary = await runBoundaryAttack(project);
  const antiEscape = await runAntiEscape(project);
  const findings = [
    ...required.findings,
    ...forbidden.findings,
    ...boundary.findings,
    ...antiEscape.findings,
  ];
  const phases = [required.phase, forbidden.phase, boundary.phase, antiEscape.phase];

  return finalizeInspectorResult({
    inspector: "GrassEye Page State Capability Owner Inspector",
    inspectorId: "page-state-capability-owner",
    capabilityDomain: "page-state-capability",
    findings,
    phases,
    summary: findings.length === 0
      ? "page-state owner inspector passed required, forbidden, boundary, and anti-escape phases"
      : "page-state owner inspector found capability-boundary or governance violations",
  });
}