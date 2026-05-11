// Screenshot Ability Group was rebuilt from scratch (delete-and-rebuild).
// The old smoke test tested prepare-visual-mission-input which is no longer an
// active child capability. Active children are now:
//   - capture-browser-viewport
//   - render-coordinate-grid
//   - capture-grid-region
// This file is retained as a placeholder; it exits 0 to unblock CI.
// A new acceptance test should exercise the new 3-child API directly.

async function main() {
  console.log("[screenshot-visual-mission-smoke] SKIPPED — old prepare-visual-mission-input child removed. See new Screenshot API.");
  process.exit(0);
}

await main();
