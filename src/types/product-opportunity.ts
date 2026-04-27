import { z } from "zod";

import { EvidenceRefSchema } from "./evidence.js";
import { ReviewDispositionSchema } from "./task-run.js";

export const ProductOpportunityCandidateSchema = z.object({
  id: z.string().min(1),
  taskRunId: z.string().min(1),
  roundId: z.string().min(1),
  platformId: z.string().min(1),
  sourceVideoId: z.string().min(1),
  analysisStatus: z.literal("pending_analysis").default("pending_analysis"),
  category: z.string().min(1),
  useCase: z.string().min(1),
  sellingPoints: z.array(z.string().min(1)),
  painPoints: z.array(z.string().min(1)),
  purchaseIntent: z.enum(["low", "medium", "high"]),
  risk: z.enum(["low", "medium", "high"]),
  score: z.number().min(0).max(1),
  rationale: z.string().min(1),
  evidenceRefs: z.array(EvidenceRefSchema).min(1),
  reviewStatus: ReviewDispositionSchema,
  notes: z.array(z.string().min(1)).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type ProductOpportunityCandidate = z.infer<typeof ProductOpportunityCandidateSchema>;