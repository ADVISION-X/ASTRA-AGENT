import type {
  AiRequestEnvelope,
  AiResponseEnvelope,
  CommandEnvelope,
  HumanCommandEnvelope,
  HumanCommandResultEnvelope,
  ResultEnvelope,
} from "./envelope.js";
import type { TransferProof } from "./transport-proof.js";

export type AbilityTransportResult = {
  commandEnvelope: CommandEnvelope;
  resultEnvelope: ResultEnvelope;
  proofs: [TransferProof, TransferProof];
};

export type AiTransportResult = {
  requestEnvelope: AiRequestEnvelope;
  responseEnvelope: AiResponseEnvelope;
  proofs: [TransferProof, TransferProof];
};

export type HumanCommandTransportResult = {
  commandEnvelope: HumanCommandEnvelope;
  resultEnvelope: HumanCommandResultEnvelope;
  proofs: [TransferProof, TransferProof];
};