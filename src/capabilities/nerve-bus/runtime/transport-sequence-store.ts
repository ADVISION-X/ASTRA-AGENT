import type {
  NerveBusSequenceCheckInput,
  NerveBusSequencePort,
  NerveBusSequenceScope,
} from "../ports/nerve-bus-sequence-port.js";

const ORCHESTRATION_OUTBOUND_CHANNELS = new Set([
  "orchestration-to-ability",
  "orchestration-to-ai",
  "orchestration-to-commander",
]);

const resolveSequenceChannelScope = (channelId: string) =>
  ORCHESTRATION_OUTBOUND_CHANNELS.has(channelId)
    ? "orchestration-outbound"
    : channelId;

const buildSequenceScopeKey = (scope: NerveBusSequenceScope) =>
  `${scope.missionId}:${scope.mapId}:${resolveSequenceChannelScope(scope.channelId)}`;

const acceptSequence = (lastSequenceByScope: Map<string, number>, key: string, sequenceNo: number) => {
  lastSequenceByScope.set(key, sequenceNo);
  return { ok: true as const, sequenceDecision: "accepted" as const };
};

const rejectDuplicateSequence = (input: NerveBusSequenceCheckInput) => ({
  ok: false as const,
  sequenceDecision: "duplicate" as const,
  reason: `Sequence ${input.sequenceNo} is already in flight for ${input.channelId}.`,
});

const rejectOutOfOrderSequence = (input: NerveBusSequenceCheckInput, expected: number) => ({
  ok: false as const,
  sequenceDecision: "out_of_order" as const,
  reason: `Sequence ${input.sequenceNo} is out of order; expected ${expected}.`,
});

const checkAndAdvanceSequence = (
  lastSequenceByScope: Map<string, number>,
  input: NerveBusSequenceCheckInput,
) => {
  const key = buildSequenceScopeKey(input);
  const previous = lastSequenceByScope.get(key);
  if (previous === undefined) {
    return acceptSequence(lastSequenceByScope, key, input.sequenceNo);
  }
  if (input.sequenceNo === previous) {
    return rejectDuplicateSequence(input);
  }
  if (input.sequenceNo !== previous + 1) {
    return rejectOutOfOrderSequence(input, previous + 1);
  }
  return acceptSequence(lastSequenceByScope, key, input.sequenceNo);
};

export function createInMemoryNerveBusSequencePort(): NerveBusSequencePort {
  const lastSequenceByScope = new Map<string, number>();

  return {
    checkAndAdvance(input: NerveBusSequenceCheckInput) {
      return checkAndAdvanceSequence(lastSequenceByScope, input);
    },
    reset(scope) {
      if (!scope) {
        lastSequenceByScope.clear();
        return;
      }

      lastSequenceByScope.delete(buildSequenceScopeKey(scope));
    },
  };
}
