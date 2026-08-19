export type ExtensionTreeFile = Readonly<{
  path: string;
  size: number;
  sha256: string;
}>;

export function extensionTreeIdentity(extensionRoot: string): Promise<Readonly<{
  files: readonly ExtensionTreeFile[];
  sha256: string;
}>>;
