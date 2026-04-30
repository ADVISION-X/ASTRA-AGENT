import type {
  AbilityCommandEnvelope,
  AbilityResultEnvelope,
  NerveBusHandledResult,
  NerveBusPayloadDocument,
} from "../../capabilities/nerve-bus/index.js";
import type { WorkbenchAbilityExecutionResult, WorkbenchRuntime } from "./workbench-contract.js";
import { buildPayloadDocument, buildTransportEnvelopeBase } from "./workbench-payload.js";
import {
  buildForensicsRuntimeEventInput,
  buildGeometryGuardCommand,
  buildMouseClickCommand,
  buildMouseScrollCommand,
  buildOpenAbilityInput,
  buildPageStateDispatchInput,
  buildPostActionVerificationInput,
  buildScreenshotCommand,
  buildTextInputCommand,
  buildVisualTargetCommand,
} from "./workbench-ability-inputs.js";

const describeAbilityFailure = (
  failure: WorkbenchAbilityExecutionResult["failureReason"],
): string | null => {
  if (!failure) {
    return null;
  }
  return typeof failure === "string" ? failure : failure.message ?? failure.code ?? "Ability dispatch failed.";
};

const buildAbilityCommandResultEnvelope = (input: {
  envelope: AbilityCommandEnvelope;
  result: WorkbenchAbilityExecutionResult;
}): NerveBusHandledResult<AbilityResultEnvelope> => {
  const failureReason = describeAbilityFailure(input.result.failureReason);
  const status = input.result.status;
  const summary = status === "success"
    ? `${input.envelope.to} executed ${input.envelope.commandName}.`
    : failureReason ?? input.result.reviewRequiredReason ?? `${input.envelope.to} failed ${input.envelope.commandName}.`;
  const outputPayload = buildPayloadDocument({
    documentType: "ability.result",
    documentRef: `${input.envelope.commandId}:result:payload`,
    summary,
    content: {
      abilityGroupId: input.result.abilityGroupId,
      childCapabilityId: input.result.childCapabilityId ?? input.envelope.commandName,
      status,
      failureReason,
      reviewRequiredReason: input.result.reviewRequiredReason ?? null,
    },
  });
  return {
    envelope: {
      ...buildTransportEnvelopeBase({
        channelId: "ability-to-orchestration",
        envelopeId: `${input.envelope.envelopeId}:result`,
        missionId: input.envelope.missionId,
        mapId: input.envelope.mapId,
        stepId: input.envelope.stepId,
        inputRef: input.envelope.inputRef,
        payloadRefs: { output: outputPayload.documentRef },
        summary,
        tags: [input.envelope.to, input.envelope.commandName, status],
      }),
      envelopeKind: "ability_result",
      resultId: `${input.envelope.commandId}:result`,
      from: input.envelope.to,
      to: "orchestration",
      status,
      outputRef: status === "success" ? outputPayload.documentRef : null,
      diagnosticPayloadRef: status === "success" ? null : outputPayload.documentRef,
      failureReason: status === "failed" ? failureReason ?? "Ability dispatch failed." : null,
      reviewRequiredReason: status === "review_required" ? input.result.reviewRequiredReason ?? failureReason ?? "Ability dispatch requires review." : null,
    },
    outputPayload,
  };
};

export const dispatchAbilityCommandEnvelope = async (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
): Promise<NerveBusHandledResult<AbilityResultEnvelope>> => {
  try {
    const result = await (async () => {
      switch (envelope.to) {
        case "open": return runtime.openAbilityGroup.execute(buildOpenAbilityInput(envelope, inputPayload));
        case "screenshot": return runtime.screenshotAbilityGroup.execute(buildScreenshotCommand(envelope, inputPayload));
        case "visual-target": return runtime.visualTargetAbilityGroup.execute(buildVisualTargetCommand(envelope, inputPayload));
        case "geometry-guard": return runtime.geometryGuardAbilityGroup.execute(buildGeometryGuardCommand(envelope, inputPayload));
        case "mouse-click": return runtime.mouseClickAbilityGroup.execute(buildMouseClickCommand(envelope, inputPayload));
        case "text-input": return runtime.textInputAbilityGroup.execute(buildTextInputCommand(envelope, inputPayload));
        case "mouse-scroll": return runtime.mouseScrollAbilityGroup.execute(buildMouseScrollCommand(envelope, inputPayload));
        case "post-action-verification": return runtime.postActionVerificationAbilityGroup.execute(buildPostActionVerificationInput(envelope, inputPayload));
        case "forensics-persistence": return runtime.forensicsPersistenceAbilityGroup.writeStructuredRuntimeEvent(buildForensicsRuntimeEventInput(envelope));
        case "page-state": return runtime.pageStateAbilityGroup.execute(buildPageStateDispatchInput(runtime, envelope));
      }
    })();
    return buildAbilityCommandResultEnvelope({ envelope, result });
  } catch (error) {
    return buildAbilityCommandResultEnvelope({
      envelope,
      result: {
        abilityGroupId: envelope.to,
        childCapabilityId: envelope.commandName,
        status: "failed",
        failureReason: error instanceof Error ? error.message : "Ability dispatch failed.",
        reviewRequiredReason: null,
      },
    });
  }
};