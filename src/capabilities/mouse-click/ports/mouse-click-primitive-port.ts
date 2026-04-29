import { MOUSE_CLICK_BUTTONS, MOUSE_CLICK_COORDINATE_SPACES, MOUSE_CLICK_COUNTS } from "../shared/mouse-click-types.js";

export type MouseClickCoordinateSpace = (typeof MOUSE_CLICK_COORDINATE_SPACES)[number];
export type MouseClickButton = (typeof MOUSE_CLICK_BUTTONS)[number];
export type MouseClickCount = (typeof MOUSE_CLICK_COUNTS)[number];

export type MouseClickPrimitiveInput = {
  actionExecutionRef: string;
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
  primitiveExecutionRef: string | null;
  message: string;
  startedAt: string | null;
  endedAt: string | null;
};

export interface MouseClickPrimitivePort {
  click(input: MouseClickPrimitiveInput): Promise<MouseClickPrimitiveResult>;
}