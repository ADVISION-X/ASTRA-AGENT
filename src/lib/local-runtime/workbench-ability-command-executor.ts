import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import type { WorkbenchPayloadDocument as NerveBusPayloadDocument } from "./workbench-payload.js";
import type { WorkbenchAbilityExecutionResult, WorkbenchRuntime } from "./workbench-contract.js";
import {
  buildGeometryGuardCommand,
  buildMouseClickCommand,
  buildMouseScrollCommand,
  buildScreenshotCommand,
  buildTextInputCommand,
  buildVisualTargetCommand,
} from "./workbench-action-dispatch-inputs.js";
import { buildForensicsRuntimeEventInput } from "./workbench-forensics-dispatch-input.js";
import { buildOpenAbilityInput } from "./workbench-open-dispatch-input.js";
import { buildPageStateDispatchInput } from "./workbench-page-state-dispatch-input.js";
import { buildPostActionVerificationInput } from "./workbench-post-action-dispatch-input.js";

const throwIfAborted = (signal: AbortSignal) => {
  if (signal.aborted) {
    throw new Error(typeof signal.reason === "string" ? signal.reason : "Transport aborted before ability execution completed.");
  }
};

const executeVisualAbilityCommand = async (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
): Promise<WorkbenchAbilityExecutionResult> => {
  switch (envelope.to) {
    case "open":
      return runtime.openAbilityGroup.execute(buildOpenAbilityInput(envelope, inputPayload));
    case "screenshot":
      return runtime.screenshotAbilityGroup.execute(buildScreenshotCommand(envelope, inputPayload));
    case "visual-target":
      return runtime.visualTargetAbilityGroup.execute(buildVisualTargetCommand(runtime, envelope, inputPayload));
    case "geometry-guard":
      return runtime.geometryGuardAbilityGroup.execute(await buildGeometryGuardCommand(runtime, envelope, inputPayload));
  }

  throw new Error(`Unsupported visual ability target: ${envelope.to}`);
};

const executePointerAbilityCommand = async (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
): Promise<WorkbenchAbilityExecutionResult> => {
  switch (envelope.to) {
    case "mouse-click":
      return runtime.mouseClickAbilityGroup.execute(await buildMouseClickCommand(runtime, envelope, inputPayload));
    case "text-input":
      return runtime.textInputAbilityGroup.execute(buildTextInputCommand(envelope, inputPayload));
    case "mouse-scroll":
      return runtime.mouseScrollAbilityGroup.execute(await buildMouseScrollCommand(runtime, envelope, inputPayload));
  }

  throw new Error(`Unsupported pointer ability target: ${envelope.to}`);
};

const executeRuntimeAbilityCommand = async (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
): Promise<WorkbenchAbilityExecutionResult> => {
  switch (envelope.to) {
    case "post-action-verification":
      return runtime.postActionVerificationAbilityGroup.execute(await buildPostActionVerificationInput(runtime, envelope, inputPayload));
    case "forensics-persistence":
      return runtime.forensicsPersistenceAbilityGroup.writeStructuredRuntimeEvent(buildForensicsRuntimeEventInput(envelope));
    case "page-state":
      return runtime.pageStateAbilityGroup.execute(await buildPageStateDispatchInput(runtime, envelope, inputPayload));
  }

  throw new Error(`Unsupported runtime ability target: ${envelope.to}`);
};

const ABILITY_COMMAND_EXECUTORS = {
  open: executeVisualAbilityCommand,
  screenshot: executeVisualAbilityCommand,
  "visual-target": executeVisualAbilityCommand,
  "geometry-guard": executeVisualAbilityCommand,
  "mouse-click": executePointerAbilityCommand,
  "text-input": executePointerAbilityCommand,
  "mouse-scroll": executePointerAbilityCommand,
  "post-action-verification": executeRuntimeAbilityCommand,
  "forensics-persistence": executeRuntimeAbilityCommand,
  "page-state": executeRuntimeAbilityCommand,
} as const;

export const executeAbilityCommand = async (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
  signal: AbortSignal,
): Promise<WorkbenchAbilityExecutionResult> => {
  throwIfAborted(signal);
  const result = await ABILITY_COMMAND_EXECUTORS[envelope.to](runtime, envelope, inputPayload);
  throwIfAborted(signal);
  return result;
};
