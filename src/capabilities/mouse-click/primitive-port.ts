import type { MouseClickButton, MouseClickCoordinateSpace, MouseClickCount } from "./shared/coordinate.js";

export type MouseClickPrimitiveInput = {
  x: number;
  y: number;
  coordinateSpace: MouseClickCoordinateSpace;
  button: MouseClickButton;
  clickCount: MouseClickCount;
  targetLabel: string;
  timeoutMs: number;
};

export type MouseClickPrimitiveResult = {
  ok: boolean;
  primitiveExecutionRef: string;
  message: string;
  startedAt: string;
  endedAt: string;
};

export interface MouseClickPrimitivePort {
  click(input: MouseClickPrimitiveInput): Promise<MouseClickPrimitiveResult>;
}