import type { AtomicMuscleMemoryEntry, CompositeMuscleMemoryStep, MuscleMemoryEntry } from "../catalog/muscle-memory-catalog.schema.js";
import { findMuscleMemoryEntry, loadMuscleMemoryCatalog } from "../catalog/muscle-memory-catalog.js";
import { VisualMissionActionPlanSchema, type VisualMissionActionPlan } from "./action-plan.schema.js";
import {
  buildVisualMissionActionRuntimeContext,
  enrichVisualMissionActionInput,
  type VisualMissionActionRuntimeContext,
} from "../../visual-mission/action-plan/action-context-enricher.js";

type ExecutionAction = {
  resolvedActionId: string;
  sourceActionCode: string;
  type: "atomic";
  abilityGroupId: string;
  childCapabilityId: string;
  outputSchemaRef: string;
  input: Record<string, unknown>;
  requiresPostActionVerification: boolean;
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

const FORBIDDEN_AI_FIELDS = new Set(["abilityGroupId", "childCapabilityId", "x", "y", "clientX", "clientY"]);

function assertCatalogVersion(plan: VisualMissionActionPlan) {
  if (plan.muscleMemoryCatalogVersion !== loadMuscleMemoryCatalog().catalogVersion) {
    throw new Error(`Action plan catalogVersion ${plan.muscleMemoryCatalogVersion} does not match runtime catalog ${loadMuscleMemoryCatalog().catalogVersion}.`);
  }
}

function assertNoForbiddenInputFields(input: Record<string, unknown>, entry: AtomicMuscleMemoryEntry) {
  for (const field of entry.inputContract.forbiddenFields) {
    if (field in input) {
      throw new Error(`${entry.actionCode} received forbidden input field ${field}.`);
    }
  }
  for (const field of Object.keys(input)) {
    if (FORBIDDEN_AI_FIELDS.has(field)) {
      throw new Error(`${entry.actionCode} must not receive raw execution field ${field} from AI output.`);
    }
  }
}

function assertRequiredFields(input: Record<string, unknown>, entry: AtomicMuscleMemoryEntry) {
  for (const field of entry.inputContract.requiredFields) {
    if (!(field in input)) {
      throw new Error(`${entry.actionCode} is missing required input field ${field}.`);
    }
  }
}

function resolveMappingValue(mapping: string, actionInput: Record<string, unknown>): unknown {
  if (mapping.startsWith("$const:")) {
    return mapping.slice("$const:".length);
  }
  return actionInput[mapping] ?? null;
}

function mergeMappedInput(step: CompositeMuscleMemoryStep, actionInput: Record<string, unknown>): Record<string, unknown> {
  if (!step.inputMapping) {
    return { ...actionInput };
  }

  return Object.fromEntries(
    Object.entries(step.inputMapping).map(([targetField, sourceField]) => [targetField, resolveMappingValue(sourceField, actionInput)]),
  );
}

function resolveAtomicEntry(actionCode: string): AtomicMuscleMemoryEntry {
  const entry = findMuscleMemoryEntry(actionCode);
  if (!entry || entry.type !== "atomic") {
    throw new Error(`Expected atomic actionCode ${actionCode} in muscle-memory catalog.`);
  }
  return entry;
}

function buildAtomicExecutionAction(input: {
  actionCode: string;
  entry: AtomicMuscleMemoryEntry;
  actionInput: Record<string, unknown>;
  runtimeContext: VisualMissionActionRuntimeContext;
  index: number;
  required: boolean;
  onFailure: "continue" | "stop" | "review_required";
}): ExecutionAction {
  assertNoForbiddenInputFields(input.actionInput, input.entry);
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
    requiresPostActionVerification: input.entry.requiresPostActionVerification,
    successOutputRefs: input.entry.successOutputRefs,
    required: input.required,
    onFailure: input.onFailure,
  };
}

function buildClickCellFollowUpAction(input: {
  sourceActionCode: string;
  resolvedActionId: string;
  required: boolean;
  onFailure: "continue" | "stop" | "review_required";
}): ExecutionAction {
  const clickEntry = resolveAtomicEntry("CLICK_BROWSER_COORDINATE");
  return {
    resolvedActionId: `${input.resolvedActionId}:mouse-click`,
    sourceActionCode: input.sourceActionCode,
    type: "atomic",
    abilityGroupId: clickEntry.abilityGroupId,
    childCapabilityId: clickEntry.childCapabilityId,
    outputSchemaRef: clickEntry.outputSchemaRef,
    input: {},
    requiresPostActionVerification: clickEntry.requiresPostActionVerification,
    successOutputRefs: clickEntry.successOutputRefs,
    required: input.required,
    onFailure: input.onFailure,
    requiredPayloadRefs: ["geometryGuardResultRef"],
  };
}

function buildAtomicExecutionActions(input: {
  actionCode: string;
  entry: AtomicMuscleMemoryEntry;
  actionInput: Record<string, unknown>;
  runtimeContext: VisualMissionActionRuntimeContext;
  index: number;
  required: boolean;
  onFailure: "continue" | "stop" | "review_required";
}): ExecutionAction[] {
  const baseAction = buildAtomicExecutionAction(input);
  if (input.entry.actionCode !== "CLICK_CELL") {
    return [baseAction];
  }

  return [
    baseAction,
    buildClickCellFollowUpAction({
      sourceActionCode: baseAction.sourceActionCode,
      resolvedActionId: baseAction.resolvedActionId,
      required: input.required,
      onFailure: input.onFailure,
    }),
  ];
}

function expandEntry(input: {
  entry: MuscleMemoryEntry;
  actionCode: string;
  actionInput: Record<string, unknown>;
  actions: ExecutionAction[];
  stack: string[];
  depth: number;
  runtimeContext: VisualMissionActionRuntimeContext;
  required: boolean;
  onFailure: "continue" | "stop" | "review_required";
}) {
  if (input.stack.includes(input.actionCode)) {
    throw new Error(`Composite action cycle detected: ${[...input.stack, input.actionCode].join(" -> ")}.`);
  }

  if (input.entry.type === "atomic") {
    input.actions.push(...buildAtomicExecutionActions({
      actionCode: input.actionCode,
      entry: input.entry,
      actionInput: input.actionInput,
      runtimeContext: input.runtimeContext,
      index: input.actions.length + 1,
      required: input.required,
      onFailure: input.onFailure,
    }));
    return;
  }

  if (input.depth >= input.entry.maxExpansionDepth) {
    throw new Error(`${input.actionCode} exceeded maxExpansionDepth ${input.entry.maxExpansionDepth}.`);
  }

  for (const step of input.entry.steps) {
    const nestedEntry = findMuscleMemoryEntry(step.actionCode);
    if (!nestedEntry) {
      throw new Error(`Composite action ${input.actionCode} references unknown actionCode ${step.actionCode}.`);
    }
    expandEntry({
      entry: nestedEntry,
      actionCode: step.actionCode,
      actionInput: mergeMappedInput(step, input.actionInput),
      actions: input.actions,
      stack: [...input.stack, input.actionCode],
      depth: input.depth + 1,
      runtimeContext: input.runtimeContext,
      required: step.required,
      onFailure: step.onFailure,
    });
  }
}

export function decodeVisualMissionActionPlan(input: {
  plan: unknown;
  sourceAiResultRef?: string | null;
  runtimeContext?: { payloadRefs?: Record<string, unknown> };
}): ExecutionPlan {
  const plan = VisualMissionActionPlanSchema.parse(input.plan);
  assertCatalogVersion(plan);
  const runtimeContext = buildVisualMissionActionRuntimeContext({
    plan,
    ...(input.runtimeContext?.payloadRefs ? { payloadRefs: input.runtimeContext.payloadRefs } : {}),
    sourceAiResultRef: input.sourceAiResultRef ?? null,
  });

  const actions: ExecutionAction[] = [];
  for (const action of plan.actions) {
    const entry = findMuscleMemoryEntry(action.actionCode);
    if (!entry) {
      throw new Error(`Unknown actionCode: ${action.actionCode}.`);
    }
    if (!entry.allowedForAiActionPlan) {
      throw new Error(`AI action plan must not dispatch non-AI actionCode ${action.actionCode}.`);
    }
    expandEntry({
      entry,
      actionCode: action.actionCode,
      actionInput: { ...(action.input ?? {}) },
      actions,
      stack: [],
      depth: 0,
      runtimeContext,
      required: action.required,
      onFailure: entry.failurePolicy,
    });
  }

  return {
    executionPlanId: `execution-plan:${plan.userRequirementRef ?? input.sourceAiResultRef ?? "unknown"}:${actions.length}`,
    sourceAiResultRef: input.sourceAiResultRef ?? null,
    actions,
  };
}

export type { ExecutionAction, ExecutionPlan };