import type { OpenChildCapabilityId, OpenPlatformId } from "./contract.js";
import { OPEN_LOCAL_CHILDREN } from "./open-local-registry-entries.js";
import { OPEN_PLATFORM_CHILDREN } from "./open-platform-registry-entries.js";
import type { OpenRegistryEntry } from "./runtime/open-runtime-types.js";

const OPEN_CHILDREN = [
  ...OPEN_PLATFORM_CHILDREN,
  ...OPEN_LOCAL_CHILDREN,
] as const satisfies readonly OpenRegistryEntry[];

export type OpenTargetDefaults = {
  targetProfileRef: string;
  targetUrl: string;
  targetTitle: string;
};

const isUrlBackedOpenEntry = (entry: OpenRegistryEntry): entry is Exclude<OpenRegistryEntry, { targetKind: "local-program" }> => (
  entry.targetKind !== "local-program"
);

const resolveTargetProfileRef = (entry: OpenRegistryEntry): string => (
  entry.targetKind === "local-program"
    ? entry.targetProfileRef
    : `open-target-profile:${entry.childCapabilityId}`
);

const toOpenTargetDefaults = (entry: OpenRegistryEntry): OpenTargetDefaults => ({
  targetProfileRef: resolveTargetProfileRef(entry),
  targetUrl: entry.targetKind === "local-program" ? entry.targetProfileRef : entry.defaultUrl,
  targetTitle: entry.defaultTitle,
});

export const createOpenRegistry = (): Map<OpenChildCapabilityId, OpenRegistryEntry> =>
  new Map(OPEN_CHILDREN.map((entry) => [entry.childCapabilityId, entry]));

export const listOpenChildren = (): OpenChildCapabilityId[] =>
  OPEN_CHILDREN.map((entry) => entry.childCapabilityId);

export const resolveOpenTargetDefaults = (targetProfileRef: string): OpenTargetDefaults | null => {
  const entry = OPEN_CHILDREN.find((candidate) => resolveTargetProfileRef(candidate) === targetProfileRef);
  return entry ? toOpenTargetDefaults(entry) : null;
};

export const resolveOpenTargetDefaultsForPlatform = (platformId: OpenPlatformId): OpenTargetDefaults | null => {
  const entry = OPEN_CHILDREN.find((candidate) => candidate.platformId === platformId && isUrlBackedOpenEntry(candidate));
  return entry && isUrlBackedOpenEntry(entry) ? toOpenTargetDefaults(entry) : null;
};
