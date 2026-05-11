/**
 * AI Action Plan Decoder — converts the AI output plan into an orchestration execution plan.
 *
 * Moved from muscle-memory/decoder. Decoding belongs to Orchestration, not the registry.
 * The registry (MuscleMemory catalog) is queried here for ability lookup only.
 *
 * CLICK_CELL → CLICK_BROWSER_COORDINATE chain has been removed.
 * The registry no longer contains CLICK_CELL or CLICK_BROWSER_COORDINATE.
 */

import type { RegisteredAtomicAbility } from "../../../muscle-memory/catalog.js";
import { assertRegisteredAbility, loadMuscleMemoryCatalog } from "../../../muscle-memory/catalog.js";
import { MuscleMemoryGridCellSchema, MuscleMemoryPressKeySchema } from "../../../muscle-memory/schema.js";
import {
  buildVisualMissionActionRuntimeContext,
  enrichVisualMissionActionInput,
  type VisualMissionActionRuntimeContext,
} from "../../../visual-mission/action-plan/action-context-enricher.js";
import {
  getAiRequiredActionFields,
  getAiVisibleActionFields,
  isAiForbiddenActionField,
} from "../../../visual-mission/action-plan/action-field-policy.js";
import type {
  VisualMissionExecutablePlan,
  VisualMissionExecutablePlanContextRefs,
} from "../../../visual-mission/action-plan/executable-plan.schema.js";

// ─── Execution plan types ──────────────────────────────────────────────────

type ExecutionAction = {
  resolvedActionId: string;
  sourceActionCode: string;
  type: "atomic";
  abilityGroupId: string;
  childCapabilityId: string;
  outputSchemaRef: string;
  input: Record<string, unknown>;
  successOutputRefs: string[];
  required: boolean;
  onFailure: "continue" | "stop" | "review_required";
  requiredPayloadRefs?: string[];
};

type ExecutionPlan = {
  executionPlanId: string;
  sourceAiResultRef: string | null;
  actions: ExecutionAction[];
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function isGridCellInputField(field: string): boolean {
  return field === "gridCell" || field.endsWith("GridCell");
}

function assertCatalogVersion(plan: VisualMissionExecutablePlan) {
  const catalogVersion = loadMuscleMemoryCatalog().catalogVersion;
  if (plan.muscleMemoryCatalogVersion !== catalogVersion) {
    throw new Error(
      `Action plan catalogVersion ${plan.muscleMemoryCatalogVersion} does not match runtime catalog ${catalogVersion}.`,
    );
  }
}

function assertAiRequiredFields(actionCode: string, input: Record<string, unknown>, entry: RegisteredAtomicAbility) {
  for (const field of getAiRequiredActionFields(entry)) {
    if (!(field in input)) {
      throw new Error(`${actionCode} is missing required input field ${field}.`);
    }
  }
}

function assertAiVisibleInputFields(actionCode: string, input: Record<string, unknown>, entry: RegisteredAtomicAbility) {
  const visibleFields = getAiVisibleActionFields(entry);
  for (const field of Object.keys(input)) {
    if (entry.inputContract.forbiddenFields.includes(field) || isAiForbiddenActionField(field)) {
      throw new Error(`${actionCode} received forbidden input field ${field}.`);
    }
    if (!visibleFields.has(field)) {
      throw new Error(`${actionCode} does not allow input field ${field}.`);
    }
  }
}

function assertGovernedInputValues(actionCode: string, input: Record<string, unknown>) {
  for (const [field, value] of Object.entries(input)) {
    if (field === "key" && !MuscleMemoryPressKeySchema.safeParse(value).success) {
      throw new Error(`${actionCode} requires a governed input.key value.`);
    }
    if (isGridCellInputField(field) && !MuscleMemoryGridCellSchema.safeParse(value).success) {
      throw new Error(`${actionCode} requires a governed input.${field} value.`);
    }
  }
}

function assertActionPlanInput(actionCode: string, input: Record<string, unknown>, entry: RegisteredAtomicAbility) {
  assertAiRequiredFields(actionCode, input, entry);
  assertAiVisibleInputFields(actionCode, input, entry);
  assertGovernedInputValues(actionCode, input);
}

function assertRequiredFields(input: Record<string, unknown>, entry: RegisteredAtomicAbility) {
  for (const field of entry.inputContract.requiredFields) {
    if (!(field in input)) {
      throw new Error(`${entry.actionCode} is missing required input field ${field}.`);
    }
  }
}

function buildAtomicExecutionAction(input: {
  actionCode: string;
  entry: RegisteredAtomicAbility;
  actionInput: Record<string, unknown>;
  runtimeContext: VisualMissionActionRuntimeContext;
  index: number;
  required: boolean;
  onFailure: "continue" | "stop" | "review_required";
}): ExecutionAction {
  assertActionPlanInput(input.actionCode, input.actionInput, input.entry);
  const enrichedInput = enrichVisualMissionActionInput({
    entry: input.entry,
    actionInput: input.actionInput,
    runtimeContext: input.runtimeContext,
  });
  assertRequiredFields(enrichedInput, input.entry);

  return {
    resolvedActionId: `resolved-action-${input.index}`,
    sourceActionCode: input.actionCode,
    type: "atomic",
    abilityGroupId: input.entry.abilityGroupId,
    childCapabilityId: input.entry.childCapabilityId,
    outputSchemaRef: input.entry.outputSchemaRef,
    input: enrichedInput,
    successOutputRefs: input.entry.successOutputRefs,
    required: input.required,
    onFailure: input.onFailure,
  };
}

// ─── Public API ────────────────────────────────────────────────────────────

export function decodeVisualMissionActionPlan(input: {
  plan: VisualMissionExecutablePlan;
  sourceAiResultRef: string | null;
  runtimeContext: {
    payloadRefs: Record<string, unknown>;
    planContextRefs?: VisualMissionExecutablePlanContextRefs;
  };
}): ExecutionPlan {
  const plan = input.plan;
  assertCatalogVersion(plan);

  const runtimeContext = buildVisualMissionActionRuntimeContext({
    plan,
    payloadRefs: input.runtimeContext.payloadRefs,
    sourceAiResultRef: input.sourceAiResultRef,
  });

  const actions: ExecutionAction[] = [];
  for (const action of plan.actions) {
    const entry = assertRegisteredAbility(action.actionCode);
    if (entry.type !== "atomic") {
      throw new Error(`AI action plan must only dispatch atomic actionCode. "${action.actionCode}" is not atomic.`);
    }
    if (!entry.allowedForAiActionPlan) {
      throw new Error(`AI action plan must not dispatch non-AI actionCode ${action.actionCode}.`);
    }
    actions.push(buildAtomicExecutionAction({
      actionCode: action.actionCode,
      entry,
      actionInput: { ...(action.input ?? {}) },
      runtimeContext,
      index: actions.length + 1,
      required: action.required,
      onFailure: entry.failurePolicy,
    }));
  }

  return {
    executionPlanId: `execution-plan:${plan.userRequirementRef ?? input.sourceAiResultRef ?? "unknown"}:${actions.length}`,
    sourceAiResultRef: input.sourceAiResultRef ?? null,
    actions,
  };
}

export type { ExecutionPlan, ExecutionAction };
