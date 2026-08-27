import { z } from "zod";

export const EvidenceKindSchema = z.enum([
  "screenshot",
  "coordinate-grid-screenshot",
  "ocr-text",
  "ai-result",
  "action-log",
  "forensics-record",
]);

export const EvidenceRefSchema = z.object({
  id: z.string().min(1),
  kind: EvidenceKindSchema,
  summary: z.string().min(1),
  filePath: z.string().min(1).optional(),
});
