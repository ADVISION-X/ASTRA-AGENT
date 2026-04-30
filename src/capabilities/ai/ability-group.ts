import type { AiAbilityGroup } from "./contract.js";
import type { AiExecutionContext } from "./contract.js";
import { AiHealthReportSchema, AiResultSchema, parseAiInput } from "./schema.js";
import { createAiCapabilityRegistry, listAiChildren } from "./registry.js";
import { dispatchAiFailure } from "./runtime/ai-dispatch-failure.js";
import { createAiExecutionContext } from "./runtime/ai-execution-context.js";
import { routeAiTaskToChild } from "./task-router.js";

const dispatchInvalidAiInput = (context: AiExecutionContext, inputValue: unknown) =>
  dispatchAiFailure({
    rawInput: inputValue,
    context,
    childCapabilityId: null,
    taskType: null,
    providerKind: null,
    failureReason: "input_schema_invalid",
    statusMessage: "AI rejected invalid input schema.",
  });

const dispatchAiRouteFailure = (context: AiExecutionContext, inputValue: Parameters<typeof routeAiTaskToChild>[0]) =>
  dispatchAiFailure({
    rawInput: inputValue,
    context,
    childCapabilityId: null,
    taskType: inputValue,
    providerKind: null,
    failureReason: "task_route_unavailable",
    statusMessage: `AI task route is unavailable for ${inputValue}.`,
  });

const dispatchAiRegistryFailure = (
  context: AiExecutionContext,
  childCapabilityId: string,
  taskType: Parameters<typeof routeAiTaskToChild>[0],
) =>
  dispatchAiFailure({
    rawInput: { taskType },
    context,
    childCapabilityId,
    taskType,
    providerKind: null,
    failureReason: "unknown_child_capability",
    statusMessage: `AI child capability is not registered for ${childCapabilityId}.`,
  });

const dispatchAiExecutableFailure = (
  context: AiExecutionContext,
  rawInput: { taskType: Parameters<typeof routeAiTaskToChild>[0] },
  childCapabilityId: string,
  providerKind: string | null,
) =>
  dispatchAiFailure({
    rawInput,
    context,
    childCapabilityId,
    taskType: rawInput.taskType,
    providerKind,
    failureReason: "child_not_executable",
    statusMessage: `AI child capability is not executable for ${childCapabilityId}.`,
  });

const dispatchAiExecutionFailure = (
  input: {
    context: AiExecutionContext;
    rawInput: { taskType: Parameters<typeof routeAiTaskToChild>[0] };
    childCapabilityId: string;
    providerKind: string | null;
    error: unknown;
  },
) =>
  dispatchAiFailure({
    rawInput: input.rawInput,
    context: input.context,
    childCapabilityId: input.childCapabilityId,
    taskType: input.rawInput.taskType,
    providerKind: input.providerKind,
    failureReason: "runtime_execution_failed",
    statusMessage: input.error instanceof Error ? input.error.message : "AI child execution failed.",
  });

const parseAiExecutionInput = (context: AiExecutionContext, inputValue: unknown) => {
  const parsed = parseAiInput(inputValue);
  return parsed.success ? parsed.data : dispatchInvalidAiInput(context, inputValue);
};

const resolveAiRegistryEntry = (
  context: AiExecutionContext,
  registry: ReturnType<typeof createAiCapabilityRegistry>,
  parsedData: { taskType: Parameters<typeof routeAiTaskToChild>[0] },
) => {
  const childCapabilityId = routeAiTaskToChild(parsedData.taskType);
  if (childCapabilityId === null) {
    return dispatchAiRouteFailure(context, parsedData.taskType);
  }

  const entry = registry.get(childCapabilityId);
  if (!entry) {
    return dispatchAiRegistryFailure(context, childCapabilityId, parsedData.taskType);
  }

  return { childCapabilityId, entry };
};

const executeAiRequest = async (
  context: AiExecutionContext,
  registry: ReturnType<typeof createAiCapabilityRegistry>,
  inputValue: unknown,
) => {
  const parsedData = parseAiExecutionInput(context, inputValue);
  if ("status" in parsedData) {
    return parsedData;
  }

  const resolvedEntry = resolveAiRegistryEntry(context, registry, parsedData);
  if ("status" in resolvedEntry) {
    return resolvedEntry;
  }

  if (!resolvedEntry.entry.executable || !resolvedEntry.entry.implementation.execute) {
    return dispatchAiExecutableFailure(context, parsedData, resolvedEntry.childCapabilityId, resolvedEntry.entry.contract.providerKind);
  }

  try {
    return AiResultSchema.parse(await resolvedEntry.entry.implementation.execute(parsedData, context));
  } catch (error) {
    return dispatchAiExecutionFailure({
      context,
      rawInput: parsedData,
      childCapabilityId: resolvedEntry.childCapabilityId,
      providerKind: resolvedEntry.entry.contract.providerKind,
      error,
    });
  }
};

const buildAiHealthReport = async (
  context: AiExecutionContext,
  registry: ReturnType<typeof createAiCapabilityRegistry>,
) => {
  const [runtimeHealth, childStatuses] = await Promise.all([
    context.runtime.getHealth(),
    Promise.all([...registry.values()].map((entry) => entry.implementation.checkReadiness(context))),
  ]);
  return AiHealthReportSchema.parse({
    ...runtimeHealth,
    childStatuses,
  });
};

export function createAiAbilityGroup(context: AiExecutionContext = createAiExecutionContext()): AiAbilityGroup {
  const registry = createAiCapabilityRegistry();

  return {
    listChildCapabilityIds() {
      return listAiChildren();
    },
    async execute(inputValue) {
      return executeAiRequest(context, registry, inputValue);
    },
    async getHealth() {
      return buildAiHealthReport(context, registry);
    },
    async getRuntimeHealth() {
      return context.runtime.getRuntimeHealth();
    },
  };
}
