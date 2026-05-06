import { ZodError } from "zod";

import { MapPackageSchema } from "../schema/map-plugin-package.schema.js";
import type { MapPackage } from "../shared/map-package-types.js";
import { BuiltinMapPackageLoadError } from "./builtin-map-package-load-error.js";

const readPackageKind = (value: unknown): string | null => {
  if (!value || typeof value !== "object" || !("manifest" in value)) return null;
  const manifest = (value as { manifest?: unknown }).manifest;
  if (!manifest || typeof manifest !== "object" || !("packageKind" in manifest)) return null;
  const packageKind = (manifest as { packageKind?: unknown }).packageKind;
  return typeof packageKind === "string" ? packageKind : null;
};

export const parseBuiltinPackage = (fileName: string, raw: unknown): MapPackage => {
  try {
    return MapPackageSchema.parse(raw);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BuiltinMapPackageLoadError({
        fileName,
        receivedPackageKind: readPackageKind(raw),
        cause: error,
      });
    }
    throw error;
  }
};
