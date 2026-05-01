import type { Project } from "ts-morph";

import { createIntegrationAuditProject } from "./audit-project.js";
import { runBoundaryAttack } from "./boundary-attack.js";
import { runForbiddenShape } from "./forbidden-shape.js";
import { runRequiredShape } from "./required-shape.js";

export async function runIntegrationPhaseBundle(project: Project = createIntegrationAuditProject()) {
  const required = await runRequiredShape(project);
  const forbidden = await runForbiddenShape(project);
  const boundary = runBoundaryAttack(project);

  return { required, forbidden, boundary };
}