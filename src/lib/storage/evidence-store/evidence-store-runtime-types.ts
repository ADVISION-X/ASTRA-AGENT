import { createId as externalCreateId } from "../../../lib/local-runtime/ids.js";
import type { StructuredLogBus as ExternalStructuredLogBus } from "../../../lib/local-runtime/structured-log-bus.js";

const createEvidenceStoreId = externalCreateId;
type EvidenceStoreStructuredLogBus = ExternalStructuredLogBus;

export {
  createEvidenceStoreId,
};

export type {
  EvidenceStoreStructuredLogBus,
};