import { renderCommanderTokenCss } from "../commander-console.tokens.js";

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
.cc-main-workspace-header { padding: var(--cc-space-5) var(--cc-space-5) 0; }
.cc-main-workspace-body { min-height: 0; overflow: auto; padding: var(--cc-space-3) var(--cc-space-5) var(--cc-space-5); }
.cc-app-router, .cc-app-page-host { min-height: 100%; }
.cc-app-page-host { max-width: var(--cc-page-max-width); }
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
.cc-page { min-height: 100%; display: grid; grid-template-rows: auto minmax(0, 1fr); }
.cc-page-header { padding: var(--cc-space-2) 0 var(--cc-space-4); display: flex; justify-content: space-between; gap: var(--cc-space-4); align-items: end; }
.cc-page-header h2 { margin: 0; font-size: var(--cc-text-2xl); line-height: 1.2; }
.cc-page-header p { margin: 6px 0 0; color: var(--cc-muted); font-size: var(--cc-text-sm); line-height: var(--cc-line-sm); }
.cc-page-stack { display: grid; gap: var(--cc-card-gap); align-content: start; }
.cc-home-grid { grid-template-columns: minmax(0, 1.45fr) minmax(320px, 0.95fr); align-items: start; }
.cc-home-sidebar-stack { display: grid; gap: var(--cc-card-gap); }
.cc-card { background: linear-gradient(180deg, rgba(255, 254, 251, 0.98), rgba(248, 243, 236, 0.94)); border: 1px solid var(--cc-border); border-radius: calc(var(--cc-radius) + 2px); padding: var(--cc-card-padding); box-shadow: 0 10px 28px rgba(44, 33, 20, 0.07); }
.cc-card-header { display: flex; justify-content: space-between; gap: var(--cc-space-3); align-items: start; margin-bottom: var(--cc-space-3); }
.cc-card-header h3 { margin: 3px 0 0; font-size: var(--cc-text-lg); line-height: 1.3; }
.cc-stack, .cc-mini-list, .cc-home-form, .cc-home-section { display: grid; gap: var(--cc-space-3); }
.cc-section-copy { display: grid; gap: 4px; }
.cc-note, .cc-home-selected-copy, .cc-muted { margin: 0; color: var(--cc-muted); font-size: var(--cc-text-sm); line-height: var(--cc-line-sm); }
.cc-template-list { display: grid; gap: var(--cc-space-2); }
.cc-template-chip { border: 1px solid var(--cc-border); border-radius: var(--cc-radius); background: rgba(255, 255, 255, 0.88); padding: var(--cc-space-3); display: grid; gap: var(--cc-space-2); cursor: pointer; }
.cc-template-chip.is-selected { border-color: rgba(31, 110, 99, 0.4); background: rgba(31, 110, 99, 0.08); }
.cc-template-chip.is-disabled { opacity: 0.64; cursor: not-allowed; }
.cc-template-chip-main { display: flex; justify-content: space-between; gap: var(--cc-space-2); align-items: start; }
.cc-template-chip strong { display: block; font-size: 15px; line-height: 1.35; }
.cc-template-chip small { display: block; margin-top: 4px; color: var(--cc-muted); font-size: var(--cc-text-sm); line-height: var(--cc-line-sm); }
.cc-template-chip p { margin: 0; color: var(--cc-muted); font-size: var(--cc-text-sm); line-height: var(--cc-line-sm); }
.cc-task-template-input { position: absolute; opacity: 0; pointer-events: none; }
.cc-run-limit-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--cc-space-3); }
.cc-field { display: grid; gap: 6px; }
.cc-field input { width: 100%; min-width: 0; height: var(--cc-input-height); border: 1px solid var(--cc-border-strong); border-radius: 14px; background: rgba(255, 255, 255, 0.92); padding: 0 var(--cc-space-3); color: var(--cc-ink); font: 600 var(--cc-text-md)/1 var(--cc-font-ui); }
.cc-home-start-row, .cc-inline-actions { display: flex; flex-wrap: wrap; gap: var(--cc-space-2); }
.cc-home-start-row { justify-content: flex-start; align-items: center; }
.cc-button, .cc-inline-button, .cc-icon-button {
  appearance: none;
  min-height: var(--cc-button-height);
  border: 1px solid rgba(31, 110, 99, 0.24);
  border-radius: 12px;
  background: rgba(31, 110, 99, 0.07);
  color: var(--cc-accent);
  padding: 0 var(--cc-space-3);
  cursor: pointer;
  font: 700 var(--cc-text-sm)/1 var(--cc-font-ui);
}
.cc-button-tight, .cc-icon-button { min-height: 32px; }
.cc-button-large { min-width: 148px; justify-content: center; }
.cc-button-primary { color: var(--cc-good); border-color: rgba(15, 123, 82, 0.26); background: rgba(15, 123, 82, 0.08); }
.cc-button-danger { color: var(--cc-blocked); border-color: rgba(189, 79, 58, 0.26); background: rgba(189, 79, 58, 0.08); }
.cc-button[disabled] { opacity: 0.55; cursor: not-allowed; }
.cc-pill { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--cc-border); border-radius: 999px; padding: 7px 10px; background: rgba(255, 255, 255, 0.78); }
.cc-pill-ok, .cc-inline-ok { color: var(--cc-good); }
.cc-pill-attention, .cc-inline-attention { color: var(--cc-attention); }
.cc-pill-blocked, .cc-inline-blocked { color: var(--cc-blocked); }
.cc-summary-list { display: grid; gap: var(--cc-space-2); margin: 0; }
.cc-summary-row { display: flex; justify-content: space-between; gap: var(--cc-space-3); padding-bottom: var(--cc-space-2); border-bottom: 1px solid rgba(28, 46, 56, 0.08); }
.cc-summary-row:last-child { border-bottom: 0; padding-bottom: 0; }
.cc-summary-row dt { color: var(--cc-muted); font-size: var(--cc-text-sm); }
.cc-summary-row dd { margin: 0; text-align: right; max-width: 60%; font-size: var(--cc-text-sm); }
.cc-mission-card-top { justify-content: space-between; align-items: center; }
.cc-error-banner { margin: 0 0 var(--cc-card-gap); padding: var(--cc-space-3) var(--cc-space-4); border-radius: calc(var(--cc-radius) + 2px); border: 1px solid transparent; display: grid; gap: var(--cc-space-2); }
.cc-error-banner strong { display: block; font-size: var(--cc-text-md); }
.cc-error-banner p, .cc-error-banner small { margin: 5px 0 0; display: block; line-height: var(--cc-line-md); font-size: var(--cc-text-sm); }
.cc-tone-blocked { background: rgba(189, 79, 58, 0.08); border-color: rgba(189, 79, 58, 0.22); }
.cc-tone-attention { background: rgba(169, 111, 20, 0.08); border-color: rgba(169, 111, 20, 0.22); }
.cc-stat-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--cc-space-3); }
.cc-stat-tile span { display: block; color: var(--cc-muted); font-size: var(--cc-text-sm); }
.cc-stat-tile strong { display: block; margin-top: 6px; font-size: var(--cc-text-xl); }
.cc-detail-block strong { font-size: var(--cc-text-md); }
.cc-list-row { display: flex; justify-content: space-between; gap: var(--cc-space-3); align-items: start; }
.cc-list-row strong { display: block; font-size: var(--cc-text-md); line-height: var(--cc-line-md); }
.cc-list-row small { display: block; margin-top: 4px; color: var(--cc-muted); font-size: var(--cc-text-sm); line-height: var(--cc-line-sm); }
.cc-list-row-button { width: 100%; text-align: left; cursor: pointer; color: inherit; background: transparent; border: 0; padding: 0; }
.cc-tab-strip { display: flex; gap: var(--cc-space-2); padding: 0 0 var(--cc-space-3); overflow-x: auto; scrollbar-width: none; }
.cc-tab-strip::-webkit-scrollbar { display: none; }
.cc-tab-button { appearance: none; border: 1px solid var(--cc-border); border-radius: 999px; background: rgba(255, 255, 255, 0.7); color: var(--cc-muted); padding: 8px 12px; white-space: nowrap; cursor: pointer; }
.cc-tab-button.is-active { color: var(--cc-accent); border-color: rgba(31, 110, 99, 0.24); background: rgba(31, 110, 99, 0.09); }
.cc-tab-panel { padding: 0 0 var(--cc-space-3); }
.cc-empty { border: 1px dashed var(--cc-border); border-radius: var(--cc-radius); padding: var(--cc-space-4); color: var(--cc-muted); background: rgba(255, 255, 255, 0.66); font-size: var(--cc-text-sm); }
.cc-developer-grid { display: grid; gap: var(--cc-space-2); }
.cc-developer-grid div { display: flex; justify-content: space-between; gap: var(--cc-space-3); padding-bottom: var(--cc-space-2); border-bottom: 1px solid rgba(28, 46, 56, 0.08); }
.cc-developer-grid div:last-child { border-bottom: 0; padding-bottom: 0; }
.cc-developer-grid span { color: var(--cc-muted); font-size: var(--cc-text-sm); }
.cc-developer-grid strong { font: 700 var(--cc-text-sm)/var(--cc-line-sm) var(--cc-font-mono); text-align: right; }
.cc-json-block { margin: 0; padding: var(--cc-space-4); overflow: auto; border-radius: var(--cc-radius); background: #112630; color: #eff7f7; font: var(--cc-text-sm)/1.5 var(--cc-font-mono); }
.cc-right-inspector-shell[hidden] { display: none; }
.cc-right-inspector-shell { position: absolute; inset: calc(var(--cc-titlebar-height) + var(--cc-toolbar-height)) 0 var(--cc-status-strip-height) 0; z-index: 20; pointer-events: none; }
.cc-inspector-backdrop { position: absolute; inset: 0; background: rgba(8, 20, 26, 0.18); border: 0; padding: 0; opacity: 0; transition: opacity 160ms ease; }
.cc-right-inspector { position: absolute; top: 0; right: 0; bottom: 0; width: min(var(--cc-inspector-width), 36vw); background: rgba(252, 249, 243, 0.99); border-left: 1px solid var(--cc-border); display: grid; grid-template-rows: auto auto auto minmax(0, 1fr); gap: var(--cc-space-3); padding: var(--cc-space-4); box-shadow: -16px 0 36px rgba(8, 20, 26, 0.14); pointer-events: auto; }
.cc-right-inspector-header { display: flex; justify-content: space-between; gap: var(--cc-space-3); align-items: start; }
.cc-right-inspector-header h2 { margin: 3px 0 0; font-size: var(--cc-text-xl); line-height: 1.2; }
.cc-inspect-meta { display: grid; gap: var(--cc-space-2); padding: var(--cc-space-3); border-radius: var(--cc-radius); background: rgba(255, 255, 255, 0.74); border: 1px solid var(--cc-border); }
.cc-inspect-meta span { display: block; color: var(--cc-muted); font-size: var(--cc-text-sm); }
.cc-inspect-meta strong { display: block; margin-top: 5px; font-size: var(--cc-text-sm); line-height: var(--cc-line-sm); }
.cc-inspect-section { padding: var(--cc-space-3); border-radius: var(--cc-radius); background: rgba(255, 255, 255, 0.74); border: 1px solid var(--cc-border); overflow: auto; }
.cc-inspect-section h3 { margin: 0 0 10px; color: var(--cc-muted); }
.cc-inspect-body { min-height: 0; }
.cc-inspect-ref-row { display: flex; justify-content: space-between; gap: var(--cc-space-3); padding: 8px 0; border-bottom: 1px solid rgba(28, 46, 56, 0.08); }
.cc-inspect-ref-row:last-child { border-bottom: 0; padding-bottom: 0; }
.cc-inspect-ref-row span { color: var(--cc-muted); font-size: var(--cc-text-sm); }
.cc-toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%) translateY(10px); background: rgba(16, 34, 43, 0.92); color: #fefaf2; border-radius: 999px; padding: 10px 14px; font: 700 var(--cc-text-sm)/1 var(--cc-font-ui); opacity: 0; pointer-events: none; transition: transform 160ms ease, opacity 160ms ease; z-index: 30; }
.cc-toast.is-visible { opacity: 1; transform: translateX(-50%) translateY(0); }
@media (max-width: 1100px) {
  .cc-mac-toolbar { grid-template-columns: 1fr; padding: var(--cc-space-3) var(--cc-space-4); min-height: var(--cc-toolbar-height); height: auto; }
  .cc-toolbar-primary { align-items: start; }
}
@media (max-width: 980px) {
  body { overflow: auto; }
  .cc-theme-mac-shell { padding: var(--cc-safe-top) 0 0; }
  .cc-mac-shell { width: 100%; min-width: 0; min-height: 100vh; border-radius: 0; }
  .cc-mac-body { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr); }
  .cc-left-sidebar { border-right: 0; border-bottom: 1px solid var(--cc-border); }
  .cc-sidebar-nav { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .cc-runtime-strip { grid-template-columns: 1fr; padding: var(--cc-space-2) var(--cc-space-4); height: auto; }
  .cc-runtime-strip-items { justify-content: flex-start; }
  .cc-home-grid { grid-template-columns: 1fr; }
  .cc-right-inspector-shell { inset: 0; }
  .cc-inspector-backdrop { opacity: 1; pointer-events: auto; }
  .cc-right-inspector { width: min(100vw, 420px); }
  .cc-mac-titlebar { grid-template-columns: auto 1fr; }
  .cc-locale-switch { grid-column: 1 / -1; justify-self: start; }
}
@media (max-width: 760px) {
  .cc-sidebar-nav { grid-template-columns: 1fr 1fr; }
  .cc-toolbar-metrics, .cc-run-limit-grid, .cc-stat-grid { grid-template-columns: 1fr; }
  .cc-page-header { align-items: start; }
  .cc-right-inspector { width: 100vw; }
}
`;