import type { MouseScrollCoordinateSpace, MouseScrollPoint } from "./shared/coordinate.js";

export type MouseScrollPrimitiveInput = {
  coordinateSpace: MouseScrollCoordinateSpace;
  anchorPoint: MouseScrollPoint;
  deltaX: number;
  deltaY: number;
  targetLabel: string;
  timeoutMs: number;
};

export type MouseScrollPrimitiveResult = {
  ok: boolean;
  primitiveExecutionRef: string;
  message: string;
  startedAt: string;
  endedAt: string;
};

export interface MouseScrollPrimitivePort {
  scroll(input: MouseScrollPrimitiveInput): Promise<MouseScrollPrimitiveResult>;
}