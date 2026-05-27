import { z } from "zod";

export const AmazonFieldDisclosureReasonSchema = z.enum([
  "extracted",
  "not_present",
  "blocked",
  "unsupported_structure",
  "manual_required",
  "failed",
  "extractor_missing",
]);

export const AmazonFieldDisclosureSchema = z.object({
  reason: AmazonFieldDisclosureReasonSchema,
  detail: z.string().nullable().default(null),
}).strict();

export const AmazonFieldDisclosureMapSchema = z.record(z.string(), AmazonFieldDisclosureSchema).default({});