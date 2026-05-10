import { Node, type ObjectLiteralExpression } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import {
  RETIRED_ACTIVATION_REF_FIELD,
  RETIRED_PACKAGE_ID_FIELD,
  RETIRED_PACKAGE_VERSION_FIELD,
  RETIRED_SELECTION_ID_FIELD,
  RETIRED_SELECTION_VERSION_FIELD,
} from "./retired-map-field-names.js";

type PropertyBinding = {
  name: string;
  initializer: string;
};

const SHORT_CHAIN_BINDINGS: PropertyBinding[] = [
  { name: "missionId", initializer: "envelope.missionId" },
  { name: "runId", initializer: "envelope.runId" },
  { name: "sessionId", initializer: "envelope.sessionId" },
  { name: "roundId", initializer: "envelope.roundId" },
  { name: "videoVisitId", initializer: "envelope.videoVisitId" },
  { name: "stepId", initializer: "envelope.stepId" },
  { name: "capabilityCallId", initializer: "envelope.capabilityCallId" },
  { name: "nerveBusEnvelopeId", initializer: "envelope.nerveBusEnvelopeId" },
  { name: "inputRef", initializer: "envelope.inputRef" },
  { name: "idempotencyKey", initializer: "envelope.idempotencyKey" },
  { name: "timeoutMs", initializer: "resolveTransportTimeoutMs(envelope)" },
] as const;

const FORBIDDEN_COMMON_FIELD_NAMES = [
  RETIRED_PACKAGE_ID_FIELD,
  RETIRED_PACKAGE_VERSION_FIELD,
  RETIRED_SELECTION_ID_FIELD,
  RETIRED_SELECTION_VERSION_FIELD,
  RETIRED_ACTIVATION_REF_FIELD,
] as const;

function normalize(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function hasBinding(objectLiteral: ObjectLiteralExpression, binding: PropertyBinding) {
  const property = objectLiteral.getProperty(binding.name);
  if (!property || !Node.isPropertyAssignment(property)) {
    return false;
  }

  return normalize(property.getInitializer()?.getText() ?? "") === normalize(binding.initializer);
}

export function getMissingScreenshotShortChainFinding(
  commonFields: ObjectLiteralExpression | null,
  lawId: string,
  file: string,
): Finding[] {
  if (commonFields) {
    return [];
  }
  return [createFinding({
    lawId,
    file,
    line: 1,
    severity: "fatal",
    message: "Screenshot local-runtime dispatch adapter must expose a dedicated governed common-field builder.",
  })];
}

export function getScreenshotShortChainBindingFindings(
  commonFields: ObjectLiteralExpression,
  lawId: string,
  file: string,
): Finding[] {
  return SHORT_CHAIN_BINDINGS.every((binding) => hasBinding(commonFields, binding))
    && FORBIDDEN_COMMON_FIELD_NAMES.every((fieldName) => !commonFields.getProperty(fieldName))
    ? []
    : [createFinding({
      lawId,
      file,
      line: 1,
      severity: "fatal",
      message: "Screenshot local-runtime dispatch adapter must preserve short-chain mission fields, inputRef, idempotencyKey, and timeoutMs, and must not forward retired package, selection, or activation-binding fields into the Screenshot owner boundary.",
    })];
}