import path from "node:path";

import type { EvidenceStoreService } from "./evidence-store-service.js";
type ForensicsDurabilityMode = "durable" | "memory_only";

const MEMORY_ONLY_DURABILITY = "memory_only";

function resolveForensicsDurabilityMode(): ForensicsDurabilityMode {
  return process.env.GRASSEYE_FORENSICS_DURABILITY_MODE === MEMORY_ONLY_DURABILITY
    ? "memory_only"
    : "durable";
}

export function assertForensicsDurabilityReady(): void {
  if (process.env.GRASSEYE_PHASE_READY === "1" && resolveForensicsDurabilityMode() === "memory_only") {
    throw new Error("Forensics phase-ready mode requires durable storageRef-backed persistence.");
  }
}

export function buildEvidenceStoreStorageRef(input: {
  evidenceStore: EvidenceStoreService;
  collection: string;
  itemId: string;
}): string | null {
  if (resolveForensicsDurabilityMode() === "memory_only") {
    return null;
  }

  return `${path.join(input.evidenceStore.getDataDir(), "state.json")}#/${input.collection}/${input.itemId}`;
}
