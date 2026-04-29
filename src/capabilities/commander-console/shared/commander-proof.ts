import type { z } from "zod";

import type {
  CommanderCommandPrioritySchema,
  CommanderDataQualityFlagSchema,
  CommanderEvidenceRefSchema,
  RuntimeProofSchema,
} from "./commander-schema-base.js";

export type CommanderCommandPriority = z.infer<typeof CommanderCommandPrioritySchema>;
export type CommanderRuntimeProof = z.infer<typeof RuntimeProofSchema>;
export type CommanderEvidenceRef = z.infer<typeof CommanderEvidenceRefSchema>;
export type CommanderDataQualityFlag = z.infer<typeof CommanderDataQualityFlagSchema>;

export function commanderFlag(
  code: CommanderDataQualityFlag["code"],
  severity: CommanderDataQualityFlag["severity"],
  message: string,
): CommanderDataQualityFlag {
  return { code, severity, message };
}