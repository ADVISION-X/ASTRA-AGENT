import type { NerveBusPayloadDocument } from "../../capabilities/nerve-bus/contract.js";

export type WorkbenchPayloadDocument = NerveBusPayloadDocument;

type TransportChannelId =
  | "commander-to-orchestration"
  | "orchestration-to-commander"
  | "orchestration-to-ability"
  | "ability-to-orchestration"
  | "orchestration-to-ai"
  | "ai-to-orchestration";

type PayloadRefRecord = Record<string, string | null>;

type MirroredRequestEnvelope = {
  transportId: string;
  traceId: string;
  attemptId: string;
  missionId: string;
  runId: string;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  mapId: string | null;
  mapPackageId: string | null;
  mapPackageVersion: string | null;
  selectedMapId: string | null;
  selectedMapVersion: string | null;
  activationId: string | null;
  activationSnapshotRef: string | null;
  stepId: string;
  capabilityCallId: string;
  sourceRef: string;
  idempotencyKey: string;
  sequenceNo: number;
  inputRef: string;
  expiresAt: string;
};

type TransportEnvelopeBaseInput<TChannelId extends TransportChannelId> = {
  channelId: TChannelId;
  envelopeId: string;
  missionId: string;
  runId: string;
  sessionId: string;
  roundId?: string | null;
  videoVisitId?: string | null;
  mapId: string | null;
  mapPackageId: string | null;
  mapPackageVersion: string | null;
  selectedMapVersion: string | null;
  activationId: string | null;
  activationSnapshotRef: string | null;
  stepId: string;
  capabilityCallId: string;
  sourceRef: string;
  inputRef: string;
  payloadRefs: PayloadRefRecord;
  summary: string;
  tags: string[];
  sequenceNo?: number;
  idempotencyKey?: string;
  createdAt?: string;
  expiresAt?: string;
};

type MirroredEnvelopeBaseInput<TChannelId extends TransportChannelId> = {
  channelId: TChannelId;
  envelopeId: string;
  requestEnvelope: MirroredRequestEnvelope;
  payloadRefs: PayloadRefRecord;
  summary: string;
  tags: string[];
  createdAt?: string;
};

const MAX_PAYLOAD_SUMMARY_LENGTH = 400;

const collectPayloadRefs = (payloadRefs: PayloadRefRecord): string[] => {
  return Object.values(payloadRefs).filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
};

const clampPayloadSummary = (summary: string): string => (
  summary.length <= MAX_PAYLOAD_SUMMARY_LENGTH
    ? summary
    : `${summary.slice(0, MAX_PAYLOAD_SUMMARY_LENGTH - 3)}...`
);

const buildPayloadMetadata = (summary: string, refs: string[], tags: string[]) => ({
  summary: clampPayloadSummary(summary),
  entityRefs: refs,
  evidenceRefs: refs,
  tags,
  attributes: [],
});

export const buildTransportEnvelopeBase = <TChannelId extends TransportChannelId>(input: TransportEnvelopeBaseInput<TChannelId>) => {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const expiresAt = input.expiresAt ?? new Date(Date.now() + 5 * 60_000).toISOString();
  const refs = collectPayloadRefs(input.payloadRefs);
  return {
    abilityGroupId: "nerve-bus" as const,
    channelId: input.channelId,
    envelopeId: input.envelopeId,
    nerveBusEnvelopeId: input.envelopeId,
    transportId: `${input.envelopeId}:transport`,
    traceId: `${input.missionId}:${input.mapId ?? "pending-start-chain"}:${input.runId}`,
    spanId: `${input.stepId}:${input.channelId}`,
    attemptId: `${input.envelopeId}:attempt:1`,
    missionId: input.missionId,
    runId: input.runId,
    sessionId: input.sessionId,
    roundId: input.roundId ?? null,
    videoVisitId: input.videoVisitId ?? null,
    mapId: input.mapId,
    mapPackageId: input.mapPackageId,
    mapPackageVersion: input.mapPackageVersion,
    selectedMapId: input.mapId,
    selectedMapVersion: input.selectedMapVersion,
    activationId: input.activationId,
    activationSnapshotRef: input.activationSnapshotRef,
    stepId: input.stepId,
    capabilityCallId: input.capabilityCallId,
    sourceRef: input.sourceRef,
    idempotencyKey: input.idempotencyKey ?? `${input.envelopeId}:idempotent`,
    sequenceNo: input.sequenceNo ?? 0,
    inputRef: input.inputRef,
    payloadRef: refs.length > 0 ? refs : [`${input.envelopeId}:payload`],
    payload: buildPayloadMetadata(input.summary, refs, input.tags),
    createdAt,
    expiresAt,
  };
};

export const buildMirroredEnvelopeBase = <TChannelId extends TransportChannelId>(input: MirroredEnvelopeBaseInput<TChannelId>) => {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const refs = collectPayloadRefs(input.payloadRefs);
  return {
    abilityGroupId: "nerve-bus" as const,
    channelId: input.channelId,
    envelopeId: input.envelopeId,
    nerveBusEnvelopeId: input.envelopeId,
    transportId: input.requestEnvelope.transportId,
    traceId: input.requestEnvelope.traceId,
    spanId: `${input.requestEnvelope.stepId}:${input.channelId}`,
    attemptId: input.requestEnvelope.attemptId,
    missionId: input.requestEnvelope.missionId,
    runId: input.requestEnvelope.runId,
    sessionId: input.requestEnvelope.sessionId,
    roundId: input.requestEnvelope.roundId,
    videoVisitId: input.requestEnvelope.videoVisitId,
    mapId: input.requestEnvelope.mapId,
    mapPackageId: input.requestEnvelope.mapPackageId,
    mapPackageVersion: input.requestEnvelope.mapPackageVersion,
    selectedMapId: input.requestEnvelope.selectedMapId,
    selectedMapVersion: input.requestEnvelope.selectedMapVersion,
    activationId: input.requestEnvelope.activationId,
    activationSnapshotRef: input.requestEnvelope.activationSnapshotRef,
    stepId: input.requestEnvelope.stepId,
    capabilityCallId: input.requestEnvelope.capabilityCallId,
    sourceRef: input.requestEnvelope.sourceRef,
    idempotencyKey: input.requestEnvelope.idempotencyKey,
    sequenceNo: input.requestEnvelope.sequenceNo,
    inputRef: input.requestEnvelope.inputRef,
    payloadRef: refs.length > 0 ? refs : [`${input.envelopeId}:payload`],
    payload: buildPayloadMetadata(input.summary, refs, input.tags),
    createdAt,
    expiresAt: input.requestEnvelope.expiresAt,
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
  summary: clampPayloadSummary(input.summary),
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