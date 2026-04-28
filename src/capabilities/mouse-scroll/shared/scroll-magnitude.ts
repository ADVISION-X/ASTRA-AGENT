import type { MouseScrollBounds } from "./coordinate.js";

export const MOUSE_SCROLL_DIRECTIONS = ["up", "down", "left", "right"] as const;
export const MOUSE_SCROLL_MAGNITUDES = ["small", "halfPage", "onePage", "twoPages", "customDelta"] as const;
export const DEFAULT_SMALL_SCROLL_PX = 300;
export const DEFAULT_HALF_PAGE_RATIO = 0.5;
export const DEFAULT_ONE_PAGE_RATIO = 0.85;
export const DEFAULT_TWO_PAGES_RATIO = 1.7;
export const GLOBAL_MOUSE_SCROLL_MAX_REPEAT = 3;

export type MouseScrollDirection = typeof MOUSE_SCROLL_DIRECTIONS[number];
export type MouseScrollMagnitude = typeof MOUSE_SCROLL_MAGNITUDES[number];

type CustomDelta = {
  deltaX: number;
  deltaY: number;
};

function clampDelta(value: number): number {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function resolveAxisMagnitude(magnitude: MouseScrollMagnitude, span: number): number {
  switch (magnitude) {
    case "small":
      return DEFAULT_SMALL_SCROLL_PX;
    case "halfPage":
      return span * DEFAULT_HALF_PAGE_RATIO;
    case "onePage":
      return span * DEFAULT_ONE_PAGE_RATIO;
    case "twoPages":
      return span * DEFAULT_TWO_PAGES_RATIO;
    default:
      return 0;
  }
}

export function resolveMouseScrollDelta(input: {
  direction: MouseScrollDirection;
  magnitude: MouseScrollMagnitude;
  customDelta: CustomDelta | null;
  bounds: MouseScrollBounds;
}): { deltaX: number; deltaY: number } {
  if (input.magnitude === "customDelta") {
    return {
      deltaX: clampDelta(input.customDelta?.deltaX ?? 0),
      deltaY: clampDelta(input.customDelta?.deltaY ?? 0),
    };
  }

  if (input.direction === "left" || input.direction === "right") {
    const magnitude = clampDelta(resolveAxisMagnitude(input.magnitude, input.bounds.width));
    return {
      deltaX: input.direction === "right" ? magnitude : -magnitude,
      deltaY: 0,
    };
  }

  const magnitude = clampDelta(resolveAxisMagnitude(input.magnitude, input.bounds.height));
  return {
    deltaX: 0,
    deltaY: input.direction === "down" ? magnitude : -magnitude,
  };
}