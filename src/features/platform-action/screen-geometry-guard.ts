export type ScreenGeometrySnapshot = {
  x: number;
  y: number;
  width: number;
  height: number;
  screenshotWidth: number;
  screenshotHeight: number;
  scaleFactor: number;
  capturedAt: string;
};

export type GeometryGuardResult = {
  ok: boolean;
  status: "calibrated" | "mismatch";
  reason: string;
};

export class ScreenGeometryGuard {
  constructor(
    private readonly baseline: ScreenGeometrySnapshot,
    private readonly tolerance = 4,
  ) {}

  verify(current: ScreenGeometrySnapshot): GeometryGuardResult {
    const drifted =
      Math.abs(current.x - this.baseline.x) > this.tolerance ||
      Math.abs(current.y - this.baseline.y) > this.tolerance ||
      Math.abs(current.width - this.baseline.width) > this.tolerance ||
      Math.abs(current.height - this.baseline.height) > this.tolerance ||
      Math.abs(current.screenshotWidth - current.width) > this.tolerance ||
      Math.abs(current.screenshotHeight - current.height) > this.tolerance ||
      Math.abs(current.scaleFactor - this.baseline.scaleFactor) > 0.01;

    if (drifted) {
      return {
        ok: false,
        status: "mismatch",
        reason: "browser geometry drift detected; stop or operator review required",
      };
    }

    return {
      ok: true,
      status: "calibrated",
      reason: "browser geometry guard passed",
    };
  }

  getBaseline(): ScreenGeometrySnapshot {
    return this.baseline;
  }
}