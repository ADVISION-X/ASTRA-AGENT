import { z } from "zod";

type JsonScannerState = {
  startIndex: number;
  depth: number;
  inString: boolean;
  escaping: boolean;
};

function extractFirstJsonObject(text: string): string {
  const state: JsonScannerState = { startIndex: -1, depth: 0, inString: false, escaping: false };
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === undefined) continue;
    if (state.escaping) { state.escaping = false; continue; }
    if (char === "\\") { state.escaping = true; continue; }
    if (char === '"') { state.inString = !state.inString; continue; }
    if (state.inString) continue;
    if (char === "{") {
      if (state.depth === 0) state.startIndex = i;
      state.depth += 1;
      continue;
    }
    if (char === "}") {
      state.depth -= 1;
      if (state.depth === 0 && state.startIndex >= 0) {
        return text.slice(state.startIndex, i + 1);
      }
    }
  }
  throw new Error("AI model output did not contain a JSON object.");
}

const parseAiJsonOutput = <TOutput>(text: string, schema: z.ZodSchema<TOutput>) => {
  const extractedJson = extractFirstJsonObject(text);
  const parsed = JSON.parse(extractedJson) as unknown;
  return schema.parse(parsed);
};

export { parseAiJsonOutput };