import { z } from "zod";

export const EvidenceKindSchema = z.enum([
  "video-screenshot",
  "comment-screenshot",
  "ocr-text",
  "ai-result",
  "action-log",
  "product-candidate",
  "evidence-packet"
]);

export const EvidenceRefSchema = z.object({
  id: z.string().min(1),
  kind: EvidenceKindSchema,
  summary: z.string().min(1),
  filePath: z.string().min(1).optional()
});

export const ImageEvidenceSchema = z.object({
  id: z.string().min(1),
  taskRunId: z.string().min(1),
  roundId: z.string().min(1),
  platformId: z.string().min(1),
  sourceId: z.string().min(1),
  sourceUrl: z.string().min(1),
  kind: z.enum(["video-screenshot", "comment-screenshot"]),
  summary: z.string().min(1),
  filePath: z.string().min(1),
  regionLabel: z.string().min(1),
  regionType: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  createdAt: z.string().datetime()
});

export const OcrTextResultSchema = z.object({
  id: z.string().min(1),
  taskRunId: z.string().min(1),
  roundId: z.string().min(1),
  evidenceRef: EvidenceRefSchema,
  confidence: z.number().min(0).max(1),
  cleanedComments: z.array(z.string().min(1)),
  ambiguousText: z.array(z.string().min(1)),
  createdAt: z.string().datetime()
});

export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;
export type ImageEvidence = z.infer<typeof ImageEvidenceSchema>;
export type OcrTextResult = z.infer<typeof OcrTextResultSchema>;