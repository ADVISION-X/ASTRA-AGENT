import type { CommanderConsoleInspectItem } from "../types.js";

import { renderInspectDebugBundlePanel } from "./InspectDebugBundle.js";
import { renderInspectDeveloperRefs } from "./InspectDeveloperRefs.js";
import { renderInspectMission } from "./InspectMission.js";
import { renderInspectResult } from "./InspectResult.js";

export function renderInspectItemHtml(item: CommanderConsoleInspectItem): string {
  if (item.kind === "mission") {
    return renderInspectMission(item);
  }
  if (item.kind === "round" || item.kind === "log") {
    return renderInspectDebugBundlePanel(item);
  }
  if (item.kind === "evidence" || item.kind === "record" || item.kind === "export") {
    return renderInspectResult(item);
  }
  return renderInspectDeveloperRefs(item);
}