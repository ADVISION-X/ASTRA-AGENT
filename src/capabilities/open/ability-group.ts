/**
 * ability-group.ts — Open Ability Group factory.
 *
 * Creates the Open ability group with its two active children:
 *   - open-platform-entry-once
 *   - open-local-workbench-once
 *
 * The ability group is the only public API for Open execution.
 */

import type { BrowserOpenPort, WorkbenchOpenPort } from "./browser-open-port.js";
import {
  OPEN_ABILITY_GROUP_ID,
  type OpenChildCapabilityId,
  type OpenInput,
  type OpenResult,
} from "./schema.js";
import { openLocalWorkbenchOnce, openPlatformEntryOnce } from "./open-target.js";

// ─── Ability Group Interface ─────────────────────────────────────────────────

export interface OpenAbilityGroup {
  readonly abilityGroupId: typeof OPEN_ABILITY_GROUP_ID;
  readonly activeChildren: readonly OpenChildCapabilityId[];
  execute(input: OpenInput): Promise<OpenResult>;
}

// ─── Ports ──────────────────────────────────────────────────────────────────

export interface OpenAbilityGroupPorts {
  browserOpenPort: BrowserOpenPort;
  workbenchOpenPort?: WorkbenchOpenPort;
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createOpenAbilityGroup(ports: OpenAbilityGroupPorts): OpenAbilityGroup {
  return {
    abilityGroupId: OPEN_ABILITY_GROUP_ID,
    activeChildren: ["open-platform-entry-once", "open-local-workbench-once"],

    async execute(input: OpenInput): Promise<OpenResult> {
      switch (input.childCapabilityId) {
        case "open-platform-entry-once":
          return openPlatformEntryOnce(input, ports.browserOpenPort);

        case "open-local-workbench-once": {
          const workbenchPort = ports.workbenchOpenPort ?? {
            openWorkbench: (opts) => ports.browserOpenPort.openUrl(opts),
          };
          return openLocalWorkbenchOnce(input, workbenchPort);
        }
      }
    },
  };
}
