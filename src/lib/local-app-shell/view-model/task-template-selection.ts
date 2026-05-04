import type { CommanderConsoleTaskTemplate } from "../types.js";

export function selectActiveTaskTemplate(
  taskTemplates: CommanderConsoleTaskTemplate[],
  _dashboard: unknown,
): CommanderConsoleTaskTemplate | null {
  return taskTemplates.find((template) => template.availability === "ready" && template.recommended)
    ?? taskTemplates.find((template) => template.availability === "ready")
    ?? null;
}
