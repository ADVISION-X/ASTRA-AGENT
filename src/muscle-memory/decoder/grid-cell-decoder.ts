import { decodeGridCell } from "../../capabilities/screenshot/shared/visual-mission-grid.js";
import type { ScreenshotGridCell, ScreenshotGridSpec } from "../../capabilities/screenshot/contract.js";

export function decodeMuscleMemoryGridCell(input: { gridSpec: ScreenshotGridSpec; gridCell: string }): ScreenshotGridCell {
  return decodeGridCell({ gridSpec: input.gridSpec, cellId: input.gridCell });
}