import { z } from "zod";

const CloudJsonEnvelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({
    code: z.string().min(1).optional(),
    message: z.string().min(1).optional(),
  }).strict().optional(),
}).strict();

export type XuanxueAiProductionJsonEnvelope = z.infer<typeof CloudJsonEnvelopeSchema>;

export const parseXuanxueAiProductionJsonEnvelope = (
  value: unknown,
): XuanxueAiProductionJsonEnvelope => CloudJsonEnvelopeSchema.parse(value);
