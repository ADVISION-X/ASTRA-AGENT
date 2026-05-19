/**
 * grid-cell-to-bbox.ts — Thin re-export of screenshot grid-cell decoding for use
 * within the orchestration runtime. Keeps orchestration dependency on screenshot
 * contract explicit and narrow.
 */

export { decodeGridCell } from "../../screenshot/schema-grid.js";
export type {
  ScreenshotGridCell,
  ScreenshotGridSpec,
} from "../../screenshot/schema-grid.js";
