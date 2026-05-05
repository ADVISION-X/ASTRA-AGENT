import { readFileSync } from "node:fs";
import { ZodError } from "zod";

import { MapPackageSchema } from "../schema/map-plugin-package.schema.js";
import type { MapPackage } from "../shared/map-package-types.js";

export class BuiltinMapPackageLoadError extends Error {
  readonly ownerResponsible = "map-plugin-package";
  readonly actionableMessage: string;
  readonly packageFile: string;
  readonly expectedPackageKind = "operational-map-package";
  readonly receivedPackageKind: string | null;

  constructor(input: {
    fileName: string;
    receivedPackageKind: string | null;
    cause: unknown;
  }) {
    super(`MAP_PACKAGE_BUILTIN_PARSE_FAILED packageFile=${input.fileName} ownerResponsible=map-plugin-package actionableMessage="Fix the builtin map package manifest.packageKind and rerun npm run audit:map-plugin-package."`);
    this.name = "BuiltinMapPackageLoadError";
    this.packageFile = input.fileName;
    this.receivedPackageKind = input.receivedPackageKind;
    this.actionableMessage = "Fix the builtin map package manifest.packageKind and rerun npm run audit:map-plugin-package.";
    this.cause = input.cause;
  }
}

const readPackageKind = (value: unknown): string | null => {
  if (!value || typeof value !== "object" || !("manifest" in value)) {
    return null;
  }
  const manifest = (value as { manifest?: unknown }).manifest;
  if (!manifest || typeof manifest !== "object" || !("packageKind" in manifest)) {
    return null;
  }
  const packageKind = (manifest as { packageKind?: unknown }).packageKind;
  return typeof packageKind === "string" ? packageKind : null;
};

const parseBuiltinPackage = (fileName: string, raw: unknown): MapPackage => {
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

function readBuiltin(fileName: string): MapPackage {
  const content = readFileSync(new URL(`./${fileName}`, import.meta.url), "utf8");
  return parseBuiltinPackage(fileName, JSON.parse(content));
}

export function loadBuiltinMapPackages(): MapPackage[] {
  return [
    readBuiltin("facebook-seeding-video-discovery.meta.map-package.json"),
    readBuiltin("iphone-mirroring-facebook-seeding-video-discovery.meta.map-package.json"),
    readBuiltin("iphone-mirroring-tiktok-seeding-video-discovery.meta.map-package.json"),
    readBuiltin("macos-local-program-open-smoke.meta.map-package.json"),
    readBuiltin("tiktok-seeding-video-discovery.meta.map-package.json")
  ];
}
