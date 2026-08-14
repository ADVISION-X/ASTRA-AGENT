const MODE: string = "new" as const;

if (MODE === "old") {
  oldPath();
}

export const live = 1;

console.log(live);

function oldPath(): number {
  return 1;
}