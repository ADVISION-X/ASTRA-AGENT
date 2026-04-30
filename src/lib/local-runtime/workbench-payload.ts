import type { NerveBusPayloadDocument } from "../../capabilities/nerve-bus/index.js";

export const buildTransportEnvelopeBase = <TChannelId extends
  | "commander-to-orchestration"
  | "orchestration-to-commander"
  | "orchestration-to-ability"
  | "ability-to-orchestration"
  | "orchestration-to-ai"
  | "ai-to-orchestration">(input: {
  channelId: TChannelId;
  envelopeId: string;
  missionId: string;
  mapId: string;
  stepId: string;
  inputRef: string;
  payloadRefs: Record<string, string | null>;
  summary: string;
  tags: string[];
}) => {
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  const refs = Object.values(input.payloadRefs).filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  return {
    abilityGroupId: "nerve-bus" as const,
    channelId: input.channelId,
    envelopeId: input.envelopeId,
    transportId: `${input.envelopeId}:transport`,
    traceId: `${input.missionId}:${input.mapId}`,
    spanId: `${input.stepId}:${input.channelId}`,
    attemptId: `${input.envelopeId}:attempt:1`,
    missionId: input.missionId,
    mapId: input.mapId,
    stepId: input.stepId,
    idempotencyKey: `${input.envelopeId}:idempotent`,
    sequenceNo: 0,
    inputRef: input.inputRef,
    payloadRef: refs.length > 0 ? refs : [`${input.envelopeId}:payload`],
    payload: {
      summary: input.summary,
      entityRefs: refs,
      evidenceRefs: refs,
      tags: input.tags,
      attributes: [],
    },
    createdAt,
    expiresAt,
  };
};

export const buildPayloadDocument = (input: {
  documentType: string;
  documentRef: string;
  summary: string;
  content: Record<string, string | number | boolean | null | undefined>;
}): NerveBusPayloadDocument => ({
  documentType: input.documentType,
  documentRef: input.documentRef,
  summary: input.summary,
  entityRefs: [],
  evidenceRefs: [],
  contentBlocks: Object.entries(input.content)
    .filter((entry): entry is [string, string | number | boolean | null] => entry[1] !== undefined)
    .map(([key, value]) => ({ key, value })),
});

export const payloadDocumentToObject = (
  payload: NerveBusPayloadDocument,
): Record<string, string | number | boolean | null> =>
  Object.fromEntries(payload.contentBlocks.map((block) => [block.key, block.value]));

export const payloadValueToString = (
  value: string | number | boolean | null | undefined,
): string | null => (typeof value === "string" ? value : null);

export const payloadValueToInteger = (
  value: string | number | boolean | null | undefined,
): number | null =>
  typeof value === "number" && Number.isInteger(value) ? value : null;