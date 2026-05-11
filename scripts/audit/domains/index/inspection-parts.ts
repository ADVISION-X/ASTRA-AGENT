import type { InspectorContext } from "../../core/schema.js";

import { runIndexRoutingChecks } from "./run-index-routing-checks.js";
import { runIndexOwnerSurfaceChecks } from "./run-owner-surface-checks.js";

export async function collectIndexInspection(context: InspectorContext) {
  const ownerSurface = await runIndexOwnerSurfaceChecks(context);
  const routingChecks = await runIndexRoutingChecks();

  return {
    findings: [
      ...ownerSurface.findings,
      ...routingChecks.findings,
    ],
    phases: [
      ...ownerSurface.phases,
      ...routingChecks.phases,
    ],
  };
}

export const buildIndexInspectionSummary = (findingsCount: number): string =>
  findingsCount === 0
    ? "index routing owner keeps repo-local law routing wired and enforceable"
    : "index routing owner has owner-surface or law-routing drift";