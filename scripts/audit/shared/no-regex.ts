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

export const containsAny = (text: string, tokens: readonly string[]): boolean =>
  tokens.some((token) => text.includes(token));

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

export const isTopLevelPluginFile = (repoPath: string): boolean => {
  const segments = pathSegments(repoPath);
  const fileName = segments[2] ?? "";
  return segments.length === 3
    && segments[0] === "src"
    && segments[1] === "plugins"
    && (fileName.endsWith(".ts") || fileName.endsWith(".tsx"));
};
