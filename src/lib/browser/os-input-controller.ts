import type { BrowserActionResult, BrowserController } from "./browser-controller.js";

export class OsInputController {
  constructor(private readonly browserController: BrowserController) {}

  async focusBrowser(): Promise<BrowserActionResult> {
    return this.browserController.wait(50);
  }

  async clickCoordinate(input: { x: number; y: number; label: string; fallbackUsed?: boolean }): Promise<BrowserActionResult> {
    return this.browserController.click({
      targetLabel: `${input.label} @ (${Math.round(input.x)}, ${Math.round(input.y)})`,
      point: {
        x: input.x,
        y: input.y,
      },
      fallbackUsed: input.fallbackUsed ?? false,
    });
  }

  async scrollViewport(direction: "forward" | "backward"): Promise<BrowserActionResult> {
    return this.browserController.scroll({ direction });
  }
}