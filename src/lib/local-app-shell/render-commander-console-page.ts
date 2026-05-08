import { renderCommanderMacShell } from "./CommanderMacShell.js";
import { getLocaleFromRequestUrl } from "../localization/locale.js";

export function renderCommanderConsolePage(input: Parameters<typeof renderCommanderMacShell>[0], requestUrl: URL): string {
  return renderCommanderMacShell(input, { locale: getLocaleFromRequestUrl(requestUrl), requestUrl });
}
