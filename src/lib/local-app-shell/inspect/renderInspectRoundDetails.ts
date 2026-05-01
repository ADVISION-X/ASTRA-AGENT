import type { CommanderConsoleInspectItem } from "../types.js";
import { renderJsonBlock } from "../render-advanced-utils.js";

export function renderInspectRoundDetails(item: CommanderConsoleInspectItem): string {
  return `${renderJsonBlock(item.json)}`;
}