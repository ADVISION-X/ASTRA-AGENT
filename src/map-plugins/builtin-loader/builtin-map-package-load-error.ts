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
