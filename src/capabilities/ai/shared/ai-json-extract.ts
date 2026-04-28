type JsonScanState = {
  stack: string[];
  inString: boolean;
  escaped: boolean;
};

function findJsonStartIndex(raw: string): number {
  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index];
    if (character === "{" || character === "[") {
      return index;
    }
  }

  throw new Error("AI output does not contain a JSON object or array.");
}

function handleStringCharacter(state: JsonScanState, character: string): boolean {
  if (!state.inString) {
    return false;
  }

  if (state.escaped) {
    state.escaped = false;
    return true;
  }
  if (character === "\\") {
    state.escaped = true;
    return true;
  }
  if (character === '"') {
    state.inString = false;
  }
  return true;
}

function handleStructureCharacter(state: JsonScanState, character: string): boolean {
  if (character === '"') {
    state.inString = true;
    return false;
  }
  if (character === "{" || character === "[") {
    state.stack.push(character);
  }
  return state.stack.length > 0;
}

function closeStructure(state: JsonScanState, character: string): boolean {
  if (character !== "}" && character !== "]") {
    return false;
  }

  const expected = character === "}" ? "{" : "[";
  const current = state.stack.pop();
  if (current !== expected) {
    throw new Error("AI output contains malformed JSON delimiters.");
  }

  return state.stack.length === 0;
}

export function extractFirstJsonBlock(raw: string): string {
  const startIndex = findJsonStartIndex(raw);
  const state: JsonScanState = {
    stack: [],
    inString: false,
    escaped: false,
  };

  for (let index = startIndex; index < raw.length; index += 1) {
    const character = raw[index]!;
    if (handleStringCharacter(state, character)) {
      continue;
    }

    if (handleStructureCharacter(state, character)) {
      continue;
    }
    if (closeStructure(state, character)) {
      return raw.slice(startIndex, index + 1);
    }
  }

  throw new Error("AI output contains an unterminated JSON block.");
}

export function parseExtractedJson<T>(raw: string): T {
  return JSON.parse(extractFirstJsonBlock(raw)) as T;
}