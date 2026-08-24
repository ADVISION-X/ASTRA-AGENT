export type CapabilitySection =
  | "facade"
  | "runtime"
  | "children"
  | "providers"
  | "schema"
  | "contract"
  | "registry"
  | "storage-adapter"
  | "type-contracts"
  | "other";

export type RepoPathInfo =
  | { kind: "capability"; owner: string; path: string; section: CapabilitySection }
  | { kind: "plugin"; owner: string; path: string }
  | { kind: "local-runtime"; path: string }
  | { kind: "app"; path: string }
  | { kind: "mediator"; path: string }
  | { kind: "acceptance"; path: string }
  | { kind: "audit"; path: string }
  | { kind: "other"; path: string };

const splitRepoPath = (repoPath: string): string[] =>
  repoPath.split("/").filter((segment) => segment.length > 0);

const capabilityDirectorySections = new Set<CapabilitySection>([
  "runtime",
  "children",
  "providers",
]);

const capabilityFileSections: Partial<Record<string, CapabilitySection>> = {
  "index.ts": "facade",
  "schema.ts": "schema",
  "contract.ts": "contract",
  "registry.ts": "registry",
  "storage-adapter.ts": "storage-adapter",
  "type-contracts.ts": "type-contracts",
};

const resolveCapabilitySection = (segments: readonly string[]): CapabilitySection => {
  const sectionSegment = segments[3];
  if (!sectionSegment) return "other";
  if (capabilityDirectorySections.has(sectionSegment as CapabilitySection)) {
    return sectionSegment as CapabilitySection;
  }
  return segments.length === 4 ? capabilityFileSections[sectionSegment] ?? "other" : "other";
};

const resolveSrcRepoPathInfo = (
  segments: readonly string[],
  repoPath: string,
): RepoPathInfo | undefined => {
  if (segments[0] !== "src") return undefined;
  if (segments[1] === "capabilities" && segments[2]) {
    return {
      kind: "capability",
      owner: segments[2],
      path: repoPath,
      section: resolveCapabilitySection(segments),
    };
  }
  if (segments[1] === "plugins" && segments[2]) {
    return { kind: "plugin", owner: segments[2], path: repoPath };
  }
  if (segments[1] === "lib" && segments[2] === "local-runtime") {
    return { kind: "local-runtime", path: repoPath };
  }
  if (segments[1] === "app") return { kind: "app", path: repoPath };
  if (segments[1] === "mediator") return { kind: "mediator", path: repoPath };
  return undefined;
};

const resolveScriptRepoPathInfo = (
  segments: readonly string[],
  repoPath: string,
): RepoPathInfo | undefined => {
  if (segments[0] !== "scripts") return undefined;
  if (segments[1] === "acceptance") return { kind: "acceptance", path: repoPath };
  if (segments[1] === "audit") return { kind: "audit", path: repoPath };
  return undefined;
};

export const classifyRepoPath = (repoPath: string): RepoPathInfo => {
  const segments = splitRepoPath(repoPath);
  return resolveSrcRepoPathInfo(segments, repoPath)
    ?? resolveScriptRepoPathInfo(segments, repoPath)
    ?? { kind: "other", path: repoPath };
};

export const buildCapabilityRoot = (owner: string): string => `src/capabilities/${owner}`;

export const isCapabilityFacade = (
  pathInfo: RepoPathInfo,
): pathInfo is Extract<RepoPathInfo, { kind: "capability" }> & { section: "facade" } =>
  pathInfo.kind === "capability" && pathInfo.section === "facade";

export const isCapabilityPrivateImplementationSection = (pathInfo: RepoPathInfo): boolean =>
  pathInfo.kind === "capability"
  && (
    pathInfo.section === "runtime"
    || pathInfo.section === "children"
    || pathInfo.section === "providers"
    || pathInfo.section === "registry"
  );

export const isCapabilityNonFacade = (pathInfo: RepoPathInfo): boolean =>
  pathInfo.kind === "capability" && pathInfo.section !== "facade";

export const isExternalCapabilityConsumer = (pathInfo: RepoPathInfo): boolean =>
  pathInfo.kind === "plugin"
  || pathInfo.kind === "local-runtime"
  || pathInfo.kind === "app"
  || pathInfo.kind === "mediator"
  || pathInfo.kind === "acceptance";
