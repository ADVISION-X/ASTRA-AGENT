import { createHash } from "node:crypto";

import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import type { WorkbenchPayloadDocument as NerveBusPayloadDocument } from "./workbench-payload.js";
import { payloadDocumentToObject, payloadValueToString } from "./workbench-payload.js";

export type DispatchPayloadRecord = Record<string, string | number | boolean | null>;

export const toDispatchPayload = (
  inputPayload: NerveBusPayloadDocument,
): DispatchPayloadRecord => payloadDocumentToObject(inputPayload);

export const hashTextValue = (value: string): string => {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
};

export const resolvePayloadRef = (
  payload: DispatchPayloadRecord,
  keys: string[],
  fallback: string,
) => {
  for (const key of keys) {
    const value = payloadValueToString(payload[key]);
    if (value) {
      return value;
    }
  }

  return fallback;
};

export const collectPayloadEvidenceRefs = (payload: DispatchPayloadRecord) => {
  return [
    payloadValueToString(payload.sourceEvidenceRef),
    payloadValueToString(payload.screenshotEvidenceRef),
    payloadValueToString(payload.commentsEvidenceRef),
  ].filter((value): value is string => Boolean(value));
};

export const resolveGovernedTextSeed = (
  envelope: AbilityCommandEnvelope,
  payload: DispatchPayloadRecord,
) => {
  const commandInputText = payloadValueToString(payload.commandInputRef);
  if (commandInputText) {
    return {
      text: commandInputText,
      sourceKey: "commandInputRef",
      sourceRef: `${envelope.inputRef}:command-input`,
    };
  }

  const promptInputText = payloadValueToString(payload.promptInputRef);
  if (promptInputText) {
    return {
      text: promptInputText,
      sourceKey: "promptInputRef",
      sourceRef: `${envelope.inputRef}:prompt-input`,
    };
  }

  const targetUrlText = payloadValueToString(payload.targetUrl);
  if (targetUrlText) {
    return {
      text: targetUrlText,
      sourceKey: "targetUrl",
      sourceRef: `${envelope.inputRef}:target-url`,
    };
  }

  return {
    text: null,
    sourceKey: "missing",
    sourceRef: `${envelope.inputRef}:missing-text-source`,
  };
};