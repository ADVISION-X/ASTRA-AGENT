import type { DomainInspector } from "../../core/schema.js";
import type { Project } from "ts-morph";

import { runIntegrationPhaseBundle } from "../map-plugin-orchestration-integration/phase-bundle.js";
import { runAntiEscape } from "./anti-escape.js";
import { runScorecardGate } from "./scorecard-gate.js";

export async function runSupplementalPhaseBundle(project: Project, context: Parameters<DomainInspector>[0]) {
  const antiEscape = await runAntiEscape(project, context);
  const scorecard = await runScorecardGate();
  const integrationPhases = await runIntegrationPhaseBundle();

  return { antiEscape, scorecard, integrationPhases };
}