import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { fail } from "../governance-runtime.js";

export const createQualityOutputDirectory = (): string => {
  const requested = process.env.GRASSEYE_QUALITY_OUTPUT_DIR?.trim();
  if (requested) {
    const absolute = resolve(requested);
    if (!absolute.startsWith(`${resolve(tmpdir())}/`)) fail("CI_OUTPUT_PATH_INVALID", absolute);
    mkdirSync(absolute, { recursive: true });
    return absolute;
  }
  return mkdtempSync(resolve(tmpdir(), "grasseye-quality-"));
};
