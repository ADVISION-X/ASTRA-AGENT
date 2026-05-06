import { renderCommanderTokenCss } from "../commander-console.tokens.js";
import { commanderConsoleStylesTail } from "./commander-console-styles-tail.js";

export const commanderConsoleStyles = `
${renderCommanderTokenCss()}
*, *::before, *::after { box-sizing: border-box; }
:root {
  --cc-bg: #ece8df;
  --cc-panel: rgba(251, 249, 244, 0.96);
  --cc-panel-strong: rgba(255, 255, 252, 0.98);
  --cc-ink: #1c2e38;
  --cc-muted: #61717b;
  --cc-border: rgba(28, 46, 56, 0.12);
  --cc-border-strong: rgba(28, 46, 56, 0.18);
  --cc-accent: #1f6e63;
  --cc-good: #0f7b52;
  --cc-attention: #a96f14;
  --cc-blocked: #bd4f3a;
  --cc-shadow: 0 22px 56px rgba(34, 28, 23, 0.14);
  --cc-safe-top: max(env(safe-area-inset-top), 0px);
}
html, body {
  margin: 0;
  min-height: 100%;
  background:
    radial-gradient(circle at top left, rgba(31, 110, 99, 0.10), transparent 26%),
    radial-gradient(circle at bottom right, rgba(189, 79, 58, 0.08), transparent 24%),
    var(--cc-bg);
  color: var(--cc-ink);
  font-family: var(--cc-font-ui);
}
body { min-height: 100vh; overflow: hidden; font-size: var(--cc-text-md); line-height: var(--cc-line-md); }
.cc-theme-mac-shell { display: flex; align-items: stretch; justify-content: center; padding: calc(var(--cc-space-4) + var(--cc-safe-top)) var(--cc-space-4) var(--cc-space-4); }
.cc-mac-shell {
  width: min(calc(100vw - (var(--cc-space-4) * 2)), var(--cc-shell-max-width));
  min-width: min(100%, var(--cc-shell-min-width));
  height: min(calc(100vh - (var(--cc-space-4) * 2)), var(--cc-shell-max-height));
  min-height: min(calc(100vh - (var(--cc-space-4) * 2)), var(--cc-shell-max-height));
  background: rgba(252, 250, 246, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: calc(var(--cc-radius-large) + var(--cc-space-1));
  box-shadow: var(--cc-shadow);
  backdrop-filter: blur(18px);
  overflow: hidden;
  display: grid;
  grid-template-rows: minmax(var(--cc-titlebar-height), auto) minmax(var(--cc-toolbar-height), auto) minmax(0, 1fr) minmax(var(--cc-status-strip-height), auto);
  position: relative;
}
.cc-mac-titlebar {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--cc-space-4);
  min-height: var(--cc-titlebar-height);
  padding: 10px var(--cc-space-4);
  border-bottom: 1px solid var(--cc-border);
  background: rgba(255, 255, 255, 0.56);
}
.cc-mac-window-controls { display: flex; gap: 7px; }
.cc-window-dot { width: 12px; height: 12px; border-radius: 999px; display: inline-block; }
.cc-window-dot-close { background: #f15f56; }
.cc-window-dot-minimize { background: #f5be4f; }
.cc-window-dot-zoom { background: #51c547; }
.cc-mac-window-copy { min-width: 0; display: flex; justify-content: space-between; align-items: baseline; gap: var(--cc-space-3); }
.cc-mac-window-copy strong { font-size: var(--cc-text-sm); line-height: var(--cc-line-sm); }
.cc-mac-window-copy span { color: var(--cc-muted); font-size: var(--cc-text-xs); line-height: var(--cc-line-xs); }
.cc-locale-switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px;
  border: 1px solid var(--cc-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
}
.cc-locale-button {
  appearance: none;
  min-width: 52px;
  min-height: 28px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--cc-muted);
  cursor: pointer;
  font: 700 var(--cc-text-xs)/1 var(--cc-font-mono);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.cc-locale-button.is-active {
  background: rgba(31, 110, 99, 0.12);
  color: var(--cc-accent);
}
.cc-mac-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr) auto;
  gap: var(--cc-space-4);
  align-items: start;
  min-height: var(--cc-toolbar-height);
  padding: var(--cc-space-3) var(--cc-space-4);
  border-bottom: 1px solid var(--cc-border);
  background: linear-gradient(180deg, rgba(255, 253, 248, 0.96), rgba(250, 246, 239, 0.94));
}
.cc-toolbar-primary, .cc-toolbar-actions { display: flex; align-items: center; gap: var(--cc-space-3); min-width: 0; }
.cc-toolbar-primary { align-items: start; justify-content: space-between; }
.cc-toolbar-title-copy { min-width: 0; }
.cc-toolbar-title-copy h1 {
  margin: 3px 0 0;
  font-size: var(--cc-text-xl);
  line-height: 1.15;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  text-wrap: balance;
}
.cc-toolbar-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--cc-space-2); }
.cc-toolbar-metric, .cc-stat-tile, .cc-detail-block, .cc-list-row {
  min-width: 0;
  padding: var(--cc-space-3);
  border: 1px solid var(--cc-border);
  border-radius: var(--cc-radius);
  background: rgba(255, 255, 255, 0.82);
}
.cc-toolbar-metric span,
.cc-sidebar-nav-helper,
.cc-runtime-strip-copy span,
.cc-eyebrow,
.cc-section-title,
.cc-tab-button,
.cc-pill {
  font-size: var(--cc-text-xs);
  line-height: var(--cc-line-xs);
  font-family: var(--cc-font-mono);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.cc-toolbar-metric strong { display: block; margin-top: 6px; font-size: var(--cc-text-sm); line-height: var(--cc-line-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cc-mac-body { min-height: 0; display: grid; grid-template-columns: var(--cc-sidebar-width) minmax(0, 1fr); position: relative; }
.cc-left-sidebar {
  border-right: 1px solid var(--cc-border);
  background: rgba(245, 241, 233, 0.92);
  padding: var(--cc-space-4);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: var(--cc-space-4);
}
.cc-sidebar-nav { display: grid; gap: var(--cc-space-2); align-content: start; }
.cc-sidebar-nav-item {
  appearance: none;
  width: 100%;
  text-align: left;
  border: 1px solid transparent;
  border-radius: var(--cc-radius);
  background: transparent;
  color: inherit;
  padding: var(--cc-space-3);
  cursor: pointer;
  display: grid;
  gap: 4px;
}
.cc-sidebar-nav-item.is-active { background: rgba(31, 110, 99, 0.10); border-color: rgba(31, 110, 99, 0.22); }
.cc-sidebar-nav-label { font-size: 13px; line-height: 1.35; font-weight: 700; }
.cc-sidebar-note { color: var(--cc-muted); font-size: var(--cc-text-sm); line-height: var(--cc-line-sm); margin: 0; }
.cc-main-workspace { min-width: 0; min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); background: rgba(255, 251, 245, 0.76); }
.cc-main-workspace-header { padding: var(--cc-space-3) var(--cc-space-5) 0; }
.cc-main-workspace-body { min-height: 0; overflow: auto; padding: var(--cc-space-2) var(--cc-space-5) var(--cc-space-5); }
.cc-main-workspace:has(.cc-app-page-host[data-active-page="home"]) { grid-template-rows: minmax(0, 1fr); }
.cc-main-workspace:has(.cc-app-page-host[data-active-page="home"]) .cc-main-workspace-header { display: none; }
.cc-app-router, .cc-app-page-host { min-height: 100%; height: 100%; min-width: 0; }
.cc-app-page-host { max-width: var(--cc-page-max-width); }
.cc-app-page-host[data-active-page="home"] { max-width: none; height: 100%; }
.cc-runtime-strip {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--cc-space-4);
  align-items: center;
  padding: 0 var(--cc-space-4);
  border-top: 1px solid var(--cc-border);
  background: rgba(247, 243, 237, 0.92);
}
.cc-runtime-strip-copy { display: grid; gap: 2px; }
.cc-runtime-strip-copy strong { font-size: var(--cc-text-sm); }
.cc-runtime-strip-items { display: flex; gap: var(--cc-space-4); justify-content: flex-end; flex-wrap: wrap; font-size: var(--cc-text-sm); color: var(--cc-muted); }
${commanderConsoleStylesTail}
`;
