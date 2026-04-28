export type MouseClickCoordinateSpace = "browserViewport" | "desktopScreen";
export type MouseClickButton = "left" | "right" | "middle";
export type MouseClickCount = 1 | 2;

export type MouseClickCoordinate = {
  x: number;
  y: number;
  coordinateSpace: MouseClickCoordinateSpace;
  boundsWidth: number;
  boundsHeight: number;
};