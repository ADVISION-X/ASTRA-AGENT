export function extractFirstJsonBlock(input: string): string | null {
  const firstBrace = input.indexOf("{");
  const lastBrace = input.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return input.slice(firstBrace, lastBrace + 1);
  }

  const firstBracket = input.indexOf("[");
  const lastBracket = input.lastIndexOf("]");
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    return input.slice(firstBracket, lastBracket + 1);
  }

  return null;
}

function describeJsonParseError(error: unknown): string {
  return error instanceof Error ? error.message : "JSON parse failed.";
}

export function parseExtractedJson(input: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const block = extractFirstJsonBlock(input);
  if (!block) {
    return { ok: false, error: "No JSON block found in runtime output." };
  }

  try {
    return { ok: true, value: JSON.parse(block) };
  } catch (error) {
    const errorMessage = describeJsonParseError(error);
    return {
      ok: false,
      error: errorMessage,
    };
  }
}
