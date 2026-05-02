export type NerveBusSequenceScope = {
  missionId: string;
  mapId: string;
  channelId: string;
};

export type NerveBusSequenceCheckInput = NerveBusSequenceScope & {
  sequenceNo: number;
};

export type NerveBusSequenceCheckResult =
  | { ok: true; sequenceDecision: "accepted" }
  | { ok: false; sequenceDecision: "duplicate" | "out_of_order"; reason: string };

export interface NerveBusSequencePort {
  checkAndAdvance(input: NerveBusSequenceCheckInput): NerveBusSequenceCheckResult;
  reset(scope?: NerveBusSequenceScope): void;
}