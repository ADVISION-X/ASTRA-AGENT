import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import { clickDesktopPoint, pressEscapeInChrome } from "./web-chat-clipboard.js";
import { findUploadMenuPoint } from "./web-chat-upload-page-actions.js";

const getDesktopPoint = (point: { x?: number; y?: number; status: string; message: string }) => {
  if (typeof point.x !== "number" || typeof point.y !== "number") {
    throw new Error(`${point.status}: ${point.message}`);
  }
  return { x: point.x, y: point.y };
};

const clickUploadMenuPoint = async (
  browser: BrowserController,
  context: AiProviderAdapterContext,
): Promise<"composer-plus" | "upload-menu-item"> => {
  const firstPoint = await findUploadMenuPoint(browser, context);
  await clickDesktopPoint(getDesktopPoint(firstPoint), context.abortSignal);
  await browser.wait(firstPoint.target === "composer-plus" ? 900 : 1_000);
  return firstPoint.target ?? "upload-menu-item";
};

const clickUploadMenuItemAfterPlus = async (
  browser: BrowserController,
  context: AiProviderAdapterContext,
): Promise<void> => {
  const menuPoint = await findUploadMenuPoint(browser, context);
  if (menuPoint.status !== "success" || menuPoint.target !== "upload-menu-item") {
    throw new Error(`${menuPoint.status}: ${menuPoint.message}`);
  }
  await clickDesktopPoint(getDesktopPoint(menuPoint), context.abortSignal);
  await browser.wait(1_000);
};

export const openProviderUploadMenu = async (
  browser: BrowserController,
  context: AiProviderAdapterContext,
): Promise<void> => {
  await pressEscapeInChrome(context.abortSignal).catch(() => undefined);
  await browser.wait(300);
  const target = await clickUploadMenuPoint(browser, context);
  if (target === "composer-plus") {
    await clickUploadMenuItemAfterPlus(browser, context);
  }
};