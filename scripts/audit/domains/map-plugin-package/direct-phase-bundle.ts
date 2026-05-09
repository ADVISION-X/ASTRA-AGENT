import type { Project } from "ts-morph";

import { runAuthoringInputPackage } from "./authoring-input-package.js";
import { runBoundaryAttack } from "./boundary-attack.js";
import { runForbiddenShape } from "./forbidden-shape.js";
import { runMuscleMemoryGovernance } from "./muscle-memory-governance.js";
import { runRequiredShape } from "./required-shape.js";
import { runRoutePlanEntrySpine } from "./route-plan-entry-spine.js";
import { runStartupPreparationEntrySpine } from "./startup-preparation-entry-spine.js";
import { runTaskTemplateRunLimitGovernance } from "./task-template-run-limit-governance.js";

export async function runDirectPhaseBundle(project: Project) {
  const required = await runRequiredShape(project);
  const authoringInput = await runAuthoringInputPackage(project);
  const forbidden = await runForbiddenShape(project);
  const taskTemplateRunLimits = await runTaskTemplateRunLimitGovernance(project);
  const boundary = runBoundaryAttack(project);
  const routePlanEntry = await runRoutePlanEntrySpine();
  const startupPreparation = await runStartupPreparationEntrySpine();
  const muscleMemory = await runMuscleMemoryGovernance();

  return {
    required,
    authoringInput,
    forbidden,
    taskTemplateRunLimits,
    boundary,
    routePlanEntry,
    startupPreparation,
    muscleMemory,
  };
}