export const MOUSE_SCROLL_COORDINATE_SPACES = ["browserViewport", "desktopScreen"] as const;

export type MouseScrollCoordinateSpace = typeof MOUSE_SCROLL_COORDINATE_SPACES[number];

export type MouseScrollPoint = {
  x: number;
  y: number;
};

export type MouseScrollRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MouseScrollBounds = {
  width: number;
  height: number;
};

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isValidPoint(value: MouseScrollPoint | null | undefined): value is MouseScrollPoint {
  if (!value) {
    return false;
  }

  return isFiniteNumber(value.x) && isFiniteNumber(value.y);
}

export function isValidBounds(value: MouseScrollBounds | null | undefined): value is MouseScrollBounds {
  if (!value) {
    return false;
  }

  return isFiniteNumber(value.width)
    && isFiniteNumber(value.height)
    && value.width > 0
    && value.height > 0;
}

export function isValidRegion(value: MouseScrollRegion | null | undefined): value is MouseScrollRegion {
  if (!value) {
    return false;
  }

  return isFiniteNumber(value.x)
    && isFiniteNumber(value.y)
    && isFiniteNumber(value.width)
    && isFiniteNumber(value.height)
    && value.width > 0
    && value.height > 0;
}

export function isPointWithinBounds(point: MouseScrollPoint, bounds: MouseScrollBounds): boolean {
  return point.x >= 0 && point.y >= 0 && point.x <= bounds.width && point.y <= bounds.height;
}

export function isRegionWithinBounds(region: MouseScrollRegion, bounds: MouseScrollBounds): boolean {
  return region.x >= 0
    && region.y >= 0
    && region.x + region.width <= bounds.width
    && region.y + region.height <= bounds.height;
}

export function isPointInsideRegion(point: MouseScrollPoint, region: MouseScrollRegion): boolean {
  return point.x >= region.x
    && point.y >= region.y
    && point.x <= region.x + region.width
    && point.y <= region.y + region.height;
}

export function getRegionBounds(region: MouseScrollRegion): MouseScrollBounds {
  return { width: region.width, height: region.height };
}