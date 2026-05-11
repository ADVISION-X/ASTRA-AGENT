import { z } from "zod";

import { extractFirstJsonObject } from "../../../lib/local-ai/runtime-adapters/runtime-adapter-utils.js";

const parseAiJsonOutput = <TOutput>(text: string, schema: z.ZodSchema<TOutput>) => {
  const extractedJson = extractFirstJsonObject(text);
  const parsed = JSON.parse(extractedJson) as unknown;
  return schema.parse(parsed);
};

export { parseAiJsonOutput };