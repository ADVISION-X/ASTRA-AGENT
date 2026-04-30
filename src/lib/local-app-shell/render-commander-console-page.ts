import { renderCommanderMacShell } from "../../features/commander-console/CommanderMacShell.js";

export function renderCommanderConsolePage(...args: Parameters<typeof renderCommanderMacShell>): string {
  return renderCommanderMacShell(...args);
}
