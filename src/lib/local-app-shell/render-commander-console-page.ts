import { renderCommanderMacShell } from "../../features/commander-console/CommanderMacShell.js";
import { getLocaleFromRequestUrl } from "../localization/locale.js";

export function renderCommanderConsolePage(dashboard: Parameters<typeof renderCommanderMacShell>[0], requestUrl: URL): string {
  return renderCommanderMacShell(dashboard, { locale: getLocaleFromRequestUrl(requestUrl), requestUrl });
}
