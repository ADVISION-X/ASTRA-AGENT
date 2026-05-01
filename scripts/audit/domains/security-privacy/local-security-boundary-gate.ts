import { hasSensitiveExport } from "./sensitive-export-gate.js";

const hasLocalHostBinding = (serverSource: string): boolean =>
  serverSource.includes('process.env.GRASSEYE_HOST ?? "127.0.0.1"');

const hasLocalEvidenceStorage = (evidenceStoreSource: string): boolean =>
  evidenceStoreSource.includes("this.dataDir")
  && evidenceStoreSource.includes("artifactsDir")
  && !evidenceStoreSource.includes("cookie");

export const hasLocalSecurityBoundary = (serverSource: string, evidenceStoreSource: string): boolean =>
  hasLocalHostBinding(serverSource)
  && hasLocalEvidenceStorage(evidenceStoreSource)
  && !hasSensitiveExport(evidenceStoreSource);
