import type { ScreenshotFailure } from "../contract.js";
import { SCREENSHOT_FAILURE_CODES } from "./screenshot-types.js";

export type ScreenshotFailureCode = typeof SCREENSHOT_FAILURE_CODES[number];

export type ScreenshotFailureLike<TCode extends ScreenshotFailureCode = ScreenshotFailureCode> = {
  code: TCode;
  message: string;
  detail?: string | null;
};

export function createScreenshotFailure<TCode extends ScreenshotFailureCode>(input: ScreenshotFailureLike<TCode>): ScreenshotFailure {
  return {
    code: input.code,
    message: input.message,
    detail: input.detail ?? null,
  };
}
