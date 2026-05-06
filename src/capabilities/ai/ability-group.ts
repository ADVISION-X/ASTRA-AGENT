import type {
  AiAbilityGroup,
  AiAbilityOutcome,
  AiChildCapabilityId,
  AiChildCapabilityRegistryEntry,
  AiExecutionContext,
  AiProviderKind,
  AiTaskType,
  ParsedAiAbilityInput,
} from "./contract.js";
import { AiHealthReportSchema, AiResultSchema, parseAiInput } from "./schema.js";
import { buildStableAiRef } from "./shared/ai-types.js";
import { createAiCapabilityRegistry, listAiChildren } from "./registry.js";
import { dispatchAiFailure } from "./runtime/ai-dispatch-failure.js";
import { emitAiExecutionFailureDebug } from "./runtime/ai-execution-failure-debug.js";
import { emitAiExecutionInputDebug } from "./runtime/ai-execution-input-debug.js";
import { executeAiChild } from "./runtime/ai-executor.js";
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
  childCapabilityId: AiChildCapabilityId,
  taskType: AiTaskType,
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
  rawInput: { taskType: AiTaskType },
  childCapabilityId: AiChildCapabilityId,
  providerKind: AiProviderKind | null,
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

const dispatchAiDebugEmitterMissing = (
  context: AiExecutionContext,
  rawInput: unknown,
) =>
  dispatchAiFailure({
    rawInput,
    context,
    childCapabilityId: null,
    taskType: null,
    providerKind: null,
    failureReason: "ai_debug_emitter_missing",
    statusMessage: "AI debug emitter is required before ASK AI execution.",
    implementationStatus: "debug_emitter_missing",
    errorKind: "DebugEmitterMissing",
    diagnosticPayloadRef: buildStableAiRef("ai-runtime-execution-diagnostic", [
      "debug-emitter-missing",
    ]),
    rawOutputHash: "debug_emitter_missing",
  });

const dispatchAiExecutionFailure = (
  input: {
    context: AiExecutionContext;
    rawInput: ParsedAiAbilityInput;
    childCapabilityId: AiChildCapabilityId;
    providerKind: AiProviderKind | null;
    error: unknown;
  },
) =>
  {
    const statusMessage = input.error instanceof Error ? input.error.message : "AI child execution failed.";
    const originalErrorName = input.error instanceof Error ? input.error.name : "UnknownError";
    const diagnosticPayloadRef = buildStableAiRef("ai-runtime-execution-diagnostic", [
      input.rawInput.missionId,
      input.rawInput.sessionId,
      input.rawInput.taskType,
      originalErrorName,
    ]);
    const runtimeCallId = buildStableAiRef("ai-runtime-call", [
      input.rawInput.sessionId,
      input.rawInput.taskType,
      input.rawInput.stepId,
      input.rawInput.capabilityCallId,
      originalErrorName,
    ]);

    return dispatchAiFailure({
      rawInput: input.rawInput,
      context: input.context,
      childCapabilityId: input.childCapabilityId,
      taskType: input.rawInput.taskType,
      providerKind: input.providerKind,
      failureReason: "runtime_execution_failed",
      statusMessage,
      implementationStatus: "runtime_execution_failed",
      errorKind: originalErrorName,
      runtimeCallId,
      diagnosticPayloadRef,
      rawOutputHash: originalErrorName,
    });
  };

const parseAiExecutionInput = (context: AiExecutionContext, inputValue: unknown) => {
  const parsed = parseAiInput(inputValue);
  return parsed.success ? parsed.data : dispatchInvalidAiInput(context, inputValue);
};

type AiRegistryResolution = {
  childCapabilityId: AiChildCapabilityId;
  entry: AiChildCapabilityRegistryEntry;
};

const resolveAiRegistryEntry = (
  context: AiExecutionContext,
  registry: ReturnType<typeof createAiCapabilityRegistry>,
  parsedData: ParsedAiAbilityInput,
): AiRegistryResolution | AiAbilityOutcome => {
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

const canExecuteDisabledPolicyRoute = (
  entry: AiChildCapabilityRegistryEntry,
) => entry.disabledPolicy === "disabled_by_policy";

const resolveExecutableAiEntry = (
  context: AiExecutionContext,
  parsedData: ParsedAiAbilityInput,
  resolvedEntry: AiRegistryResolution,
): AiRegistryResolution | AiAbilityOutcome => {
  if (!resolvedEntry.entry.executable && !canExecuteDisabledPolicyRoute(resolvedEntry.entry)) {
    return dispatchAiExecutableFailure(context, parsedData, resolvedEntry.childCapabilityId, resolvedEntry.entry.contract.providerKind);
  }

  if (resolvedEntry.entry.executable && !resolvedEntry.entry.implementation.execute) {
    return dispatchAiExecutableFailure(context, parsedData, resolvedEntry.childCapabilityId, resolvedEntry.entry.contract.providerKind);
  }

  return resolvedEntry;
};

const executeResolvedAiEntry = async (
  context: AiExecutionContext,
  parsedData: ParsedAiAbilityInput,
  resolvedEntry: AiRegistryResolution,
): Promise<AiAbilityOutcome> => {
  try {
    if (canExecuteDisabledPolicyRoute(resolvedEntry.entry)) {
      return AiResultSchema.parse(await executeAiChild({
        request: parsedData,
        childContract: resolvedEntry.entry.contract,
        context,
      }));
    }

    const execute = resolvedEntry.entry.implementation.execute;
    if (!execute) {
      return dispatchAiExecutableFailure(context, parsedData, resolvedEntry.childCapabilityId, resolvedEntry.entry.contract.providerKind);
    }

    return AiResultSchema.parse(await execute(parsedData, context));
  } catch (error) {
    await emitAiExecutionFailureDebug({
      context,
      rawInput: parsedData,
      childCapabilityId: resolvedEntry.childCapabilityId,
      error,
    });
    return dispatchAiExecutionFailure({
      context,
      rawInput: parsedData,
      childCapabilityId: resolvedEntry.childCapabilityId,
      providerKind: resolvedEntry.entry.contract.providerKind,
      error,
    });
  }
};

const executeAiRequest = async (
  context: AiExecutionContext,
  registry: ReturnType<typeof createAiCapabilityRegistry>,
  inputValue: unknown,
): Promise<AiAbilityOutcome> => {
  if (!context.emitDebugEvent) {
    return dispatchAiDebugEmitterMissing(context, inputValue);
  }
  await emitAiExecutionInputDebug(context, inputValue);
  const parsedData = parseAiExecutionInput(context, inputValue);
  if ("status" in parsedData) {
    return parsedData;
  }

  const resolvedEntry = resolveAiRegistryEntry(context, registry, parsedData);
  if ("status" in resolvedEntry) {
    return resolvedEntry;
  }

  const executableEntry = resolveExecutableAiEntry(context, parsedData, resolvedEntry);
  if ("status" in executableEntry) {
    return executableEntry;
  }

  return executeResolvedAiEntry(context, parsedData, executableEntry);
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
