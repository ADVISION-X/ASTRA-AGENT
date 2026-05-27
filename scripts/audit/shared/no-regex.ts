const sourceExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs"] as const;

export const hasSourceExtension = (repoPath: string): boolean =>
  sourceExtensions.some((extension) => repoPath.endsWith(extension));

export const hasTypeScriptExtension = (repoPath: string): boolean =>
  repoPath.endsWith(".ts") || repoPath.endsWith(".tsx");

export const splitLines = (text: string): string[] => {
  const lines: string[] = [];
  let current = "";
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === "\r") {
      if (text[index + 1] === "\n") {
        index += 1;
      }
      lines.push(current);
      current = "";
      continue;
    }
    if (character === "\n") {
      lines.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  lines.push(current);
  return lines;
};

export const collapseWhitespace = (value: string): string => {
  const chunks: string[] = [];
  let current = "";
  for (const character of value) {
    if (character.trim() === "") {
      if (current.length > 0) {
        chunks.push(current);
        current = "";
      }
      continue;
    }
    current += character;
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks.join(" ");
};

export const normalizeMarkdownHeading = (value: string): string => {
  let index = 0;
  while (value[index] === "#") {
    index += 1;
  }
  return collapseWhitespace(value.slice(index).trim());
};

export const extractMarkdownHeadings = (text: string): ReadonlySet<string> => {
  const headings = new Set<string>();
  for (const line of splitLines(text)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("#")) {
      continue;
    }
    let markerLength = 0;
    while (trimmed[markerLength] === "#") {
      markerLength += 1;
    }
    if (markerLength < 1 || markerLength > 6 || trimmed[markerLength] !== " ") {
      continue;
    }
    headings.add(normalizeMarkdownHeading(trimmed));
  }
  return headings;
};

export const containsAny = (text: string, tokens: readonly string[]): boolean =>
  tokens.some((token) => text.includes(token));

export const containsAll = (text: string, tokens: readonly string[]): boolean =>
  tokens.every((token) => text.includes(token));

export const containsAnyCaseInsensitive = (text: string, tokens: readonly string[]): boolean => {
  const lowered = text.toLowerCase();
  return tokens.some((token) => lowered.includes(token.toLowerCase()));
};

export const escapeMarkdownCell = (value: string): string =>
  value.split("|").join("\\|").split("\n").join(" ");

export const pathSegments = (repoPath: string): string[] => repoPath.split("/").filter((segment) => segment.length > 0);

export const isPluginOwnerPath = (repoPath: string): boolean => {
  const segments = pathSegments(repoPath);
  return segments[0] === "src" && segments[1] === "plugins" && segments.length >= 3;
};

export const isCapabilityOwnerPath = (repoPath: string): boolean => {
  const segments = pathSegments(repoPath);
  return segments[0] === "src" && segments[1] === "capabilities" && segments.length >= 3;
};

export const isPrivateCapabilityRuntimePath = (repoPath: string): boolean => {
  const segments = pathSegments(repoPath);
  return isCapabilityOwnerPath(repoPath) && (segments[3] === "runtime" || segments[3] === "children");
};

export const isPublicCapabilityFacadePath = (repoPath: string): boolean => {
  const segments = pathSegments(repoPath);
  return isCapabilityOwnerPath(repoPath) && segments.length === 4 && segments[3] === "index.ts";
};

export const isPublicPluginFacadePath = (repoPath: string): boolean => {
  const segments = pathSegments(repoPath);
  if (!isPluginOwnerPath(repoPath) || segments.length !== 4) {
    return false;
  }
  const fileName = segments[3] ?? "";
  return fileName === "index.ts" || fileName.endsWith(".public.ts");
};

export const isTopLevelPluginFile = (repoPath: string): boolean => {
  const segments = pathSegments(repoPath);
  const fileName = segments[2] ?? "";
  return segments.length === 3
    && segments[0] === "src"
    && segments[1] === "plugins"
    && (fileName.endsWith(".ts") || fileName.endsWith(".tsx"));
};

export const splitIdentifierTokens = (value: string): string[] => {
  const tokens: string[] = [];
  let current = "";
  const pushCurrent = (): void => {
    if (current.length > 0) {
      tokens.push(current.toLowerCase());
      current = "";
    }
  };
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index] ?? "";
    const previous = value[index - 1] ?? "";
    const isLowerOrDigit = (previous >= "a" && previous <= "z") || (previous >= "0" && previous <= "9");
    const isUpper = character >= "A" && character <= "Z";
    const isAlphaNumeric = (character >= "a" && character <= "z")
      || isUpper
      || (character >= "0" && character <= "9");
    if (!isAlphaNumeric) {
      pushCurrent();
      continue;
    }
    if (isUpper && isLowerOrDigit) {
      pushCurrent();
    }
    current += character;
  }
  pushCurrent();
  return tokens;
};
