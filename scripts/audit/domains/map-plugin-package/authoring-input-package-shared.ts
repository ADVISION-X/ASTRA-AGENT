import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";

export const createAuthoringFinding = (
  lawId: string,
  file: string,
  message: string,
  detail?: string,
): Finding => createFinding({ lawId, file, line: 1, severity: "fatal", message, ...(detail ? { detail } : {}) });
