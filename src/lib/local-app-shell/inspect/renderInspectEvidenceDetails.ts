import type { CommanderConsoleInspectItem } from "../types.js";
import { renderJsonBlock } from "../render-advanced-utils.js";

export function renderInspectEvidenceDetails(item: CommanderConsoleInspectItem): string {
  return `${renderJsonBlock(item.json)}`;
}