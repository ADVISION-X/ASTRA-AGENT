const ownerlessGenericRoots = new Set([
  "common", "shared", "utils", "helpers", "services", "managers", "facades", "bridges", "adapters",
]);

export const isOwnerlessGenericTarget = (repoPath: string): boolean => {
  const [root, owner] = repoPath.split("/");
  return root === "src" && Boolean(owner) && ownerlessGenericRoots.has(owner!);
};
