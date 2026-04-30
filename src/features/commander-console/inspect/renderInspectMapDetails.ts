import type { CommanderConsoleInspectItem } from "../types.js";
import { renderJsonBlock } from "../render-utils.js";

export function renderInspectMapDetails(item: CommanderConsoleInspectItem): string {
  return `${renderJsonBlock(item.json)}`;
}