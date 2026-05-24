const ENABLED = false as const;

if (ENABLED) {
  runOld();
}

export const live = 1;

console.log(live);

function runOld(): number {
  return 1;
}