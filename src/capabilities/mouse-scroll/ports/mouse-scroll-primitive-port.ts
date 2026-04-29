import type { z } from "zod";

import type { MouseScrollAnchorSchema, MouseScrollCoordinateSpaceSchema } from "../schema.js";

export type MouseScrollPrimitiveInput = {
  coordinateSpace: z.output<typeof MouseScrollCoordinateSpaceSchema>;
  anchorPoint: z.output<typeof MouseScrollAnchorSchema>;
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