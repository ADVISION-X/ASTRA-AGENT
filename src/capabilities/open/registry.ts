import type { OpenChildCapabilityId } from "./contract.js";
import { OPEN_LOCAL_CHILDREN } from "./open-local-registry-entries.js";
import { OPEN_PLATFORM_CHILDREN } from "./open-platform-registry-entries.js";
import type { OpenRegistryEntry } from "./runtime/open-runtime-types.js";

const OPEN_CHILDREN = [
  ...OPEN_PLATFORM_CHILDREN,
  ...OPEN_LOCAL_CHILDREN,
] as const satisfies readonly OpenRegistryEntry[];

export const createOpenRegistry = (): Map<OpenChildCapabilityId, OpenRegistryEntry> =>
  new Map(OPEN_CHILDREN.map((entry) => [entry.childCapabilityId, entry]));

export const listOpenChildren = (): OpenChildCapabilityId[] =>
  OPEN_CHILDREN.map((entry) => entry.childCapabilityId);
