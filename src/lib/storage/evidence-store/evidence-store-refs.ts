import type { EvidenceRef, ImageEvidence } from "../../../types/evidence.js";
import type { ProductDiscoveryEvidencePacket } from "../../../types/evidence-packet.js";
import type { ActionLog } from "../../../types/platform-action.js";
import type { ProductOpportunityCandidate } from "../../../types/product-opportunity.js";

type AiEvidenceSource = {
  taskType: string;
  id?: string;
  createdAt?: string;
  runtimeProof?: {
    outputRefs?: string[];
  };
};

function resolveAiResultId(result: AiEvidenceSource): string {
  return result.id ?? result.runtimeProof?.outputRefs?.[0] ?? `ai-result:${result.createdAt ?? "unknown"}`;
}

export function toEvidenceRef(evidence: ImageEvidence): EvidenceRef {
  return { id: evidence.id, kind: evidence.kind, summary: evidence.summary, filePath: evidence.filePath };
}

export function toAiEvidenceRef(result: AiEvidenceSource): EvidenceRef {
  return { id: resolveAiResultId(result), kind: "ai-result", summary: `${result.taskType} result` };
}

export function toActionEvidenceRef(actionLog: ActionLog): EvidenceRef {
  return { id: actionLog.id, kind: "action-log", summary: actionLog.message };
}

export function toCandidateEvidenceRef(candidate: ProductOpportunityCandidate): EvidenceRef {
  return { id: candidate.id, kind: "product-candidate", summary: `${candidate.category} candidate` };
}

export function toEvidencePacketRef(packet: ProductDiscoveryEvidencePacket): EvidenceRef {
  return { id: packet.packetId, kind: "evidence-packet", summary: `${packet.roundOutcome} packet` };
}