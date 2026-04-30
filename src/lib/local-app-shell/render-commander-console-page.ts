import type { CommanderMissionDashboardView } from "../../capabilities/commander-console/index.js";
import { renderCommanderMacShell } from "../../features/commander-console/CommanderMacShell.js";
import type { Locale } from "../localization/dictionaries.js";

export function renderCommanderConsolePage(dashboard: CommanderMissionDashboardView, options: {
  locale: Locale;
  requestUrl: URL;
}): string {
  return renderCommanderMacShell(dashboard, options);
}
