export const APP_SHELL_CORE_STYLES = `
:root {
  color-scheme: light;
  --app-bg: #e7ebf0;
  --surface: #f4f6f9;
  --panel: #ffffff;
  --panel-subtle: #f0f3f7;
  --ink: #0f1923;
  --muted: #465565;
  --soft: #66758a;
  --line: #dce2ea;
  --line-strong: #c2cbd7;
  --accent: #0b7667;
  --accent-soft: #e1f3ef;
  --blue: #2a5d9f;
  --blue-soft: #e6eef9;
  --amber: #84540a;
  --amber-soft: #fcefce;
  --red: #a42f3a;
  --red-soft: #fbe9ec;
  --green: #17693f;
  --green-soft: #e3f2e9;
  --console-bg: #0d141c;
  --console-line: #202d3b;
  --console-ink: #d5dfea;
  --console-muted: #8999ab;
  --mono: "SF Mono", "SFMono-Regular", "JetBrains Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
  --radius: 10px;
  --radius-sm: 8px;
  --shadow-panel: 0 1px 2px rgba(15, 25, 35, 0.05);
  --shadow-drawer: -14px 0 32px rgba(15, 25, 35, 0.16);
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  min-height: 100vh;
  background: var(--app-bg);
  color: var(--ink);
  font: 14px/1.5 var(--sans);
  -webkit-font-smoothing: antialiased;
}
button, input, select { font: inherit; }
button { color: inherit; }
h1, h2, h3, p { margin: 0; }
h1 { font-size: 28px; line-height: 1.2; font-weight: 700; letter-spacing: 0.02em; }
h2 { font-size: 15px; line-height: 1.35; font-weight: 650; }
h3 { font-size: 12px; line-height: 1.4; font-weight: 650; color: var(--muted); }
pre {
  margin: 0;
  max-height: 220px;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font: 12px/1.6 var(--mono);
}
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.hidden { display: none !important; }
.muted { color: var(--muted); }
.eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.eyebrow::before { content: ""; width: 14px; height: 2px; border-radius: 2px; background: currentColor; }
.skip-link {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 20;
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  background: var(--ink);
  color: #fff;
  font-weight: 650;
  text-decoration: none;
  transform: translateY(-160%);
}
.skip-link:focus { transform: none; }
.app-shell {
  --console-h: 188px;
  height: 100vh;
  height: 100dvh;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) var(--console-h);
  background: var(--app-bg);
}
body.console-collapsed .app-shell { --console-h: 44px; }
.command-bar {
  position: relative;
  z-index: 5;
  display: grid;
  grid-template-columns: minmax(0, auto) minmax(0, 1fr) auto;
  grid-template-areas: "brand context actions";
  align-items: center;
  gap: 20px;
  min-height: 60px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
}
.command-brand { grid-area: brand; display: flex; align-items: center; gap: 10px; min-width: 0; }
.brand-mark {
  width: 32px;
  height: 32px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: var(--accent);
  color: #fff;
}
.brand-mark .icon { width: 20px; height: 20px; }
.command-brand strong { font-size: 17px; font-weight: 700; letter-spacing: 0.01em; }
.brand-product {
  padding-left: 12px;
  border-left: 1px solid var(--line-strong);
  color: var(--muted);
  font-size: 13px;
  white-space: nowrap;
}
.command-context { grid-area: context; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; min-width: 0; }
.command-actions { grid-area: actions; display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
.locale-toggle {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel-subtle);
}
.locale-toggle span { padding: 0 8px 0 7px; color: var(--muted); font-size: 12px; font-weight: 650; }
.locale-button {
  min-width: 52px;
  height: 28px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  cursor: pointer;
}
.locale-button:hover { color: var(--ink); }
.locale-button[aria-pressed="true"] {
  border-color: var(--line-strong);
  background: var(--panel);
  color: var(--accent);
  font-weight: 700;
  box-shadow: var(--shadow-panel);
}
.icon-group {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel-subtle);
}
.icon-button {
  width: 34px;
  height: 34px;
  display: inline-grid;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--panel);
  color: var(--ink);
  cursor: pointer;
  transition: background-color 120ms, border-color 120ms, color 120ms;
}
.icon-button:hover { border-color: var(--line-strong); background: var(--panel-subtle); }
.icon-group .icon-button { width: 30px; height: 28px; border-color: transparent; border-radius: 7px; background: transparent; color: var(--muted); }
.icon-group .icon-button:hover { background: var(--panel); color: var(--ink); }
.icon-group .icon-button[aria-expanded="true"] {
  border-color: var(--line-strong);
  background: var(--panel);
  color: var(--accent);
  box-shadow: var(--shadow-panel);
}
.icon-button-ghost { border-color: transparent; background: transparent; color: var(--muted); }
.icon-button-primary { border-color: var(--accent); background: var(--accent); color: #fff; }
.icon-button-primary:hover { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 86%, #000); }
.app-shell-layout {
  --sidebar-w: 264px;
  --inspector-w: 380px;
  position: relative;
  min-height: 0;
  display: grid;
  grid-template-columns: var(--sidebar-w) minmax(0, 1fr) var(--inspector-w);
}
body.sidebar-collapsed .app-shell-layout { --sidebar-w: 72px; }
body.inspector-collapsed .app-shell-layout { --inspector-w: 0px; }
.sidebar {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  border-right: 1px solid var(--line);
  background: var(--panel);
}
.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 16px 12px 8px 20px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
}
.skill-list { display: grid; gap: 4px; padding: 4px 12px 16px; }
.skill-nav-item {
  position: relative;
  width: 100%;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  padding: 10px;
  border: 1px solid transparent;
  border-radius: var(--radius);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background-color 120ms, border-color 120ms;
}
.skill-nav-item:hover { background: var(--panel-subtle); }
.skill-nav-item[aria-pressed="true"] {
  border-color: color-mix(in srgb, var(--accent) 30%, transparent);
  background: var(--accent-soft);
}
.skill-nav-item[aria-pressed="true"]::before {
  content: "";
  position: absolute;
  left: -12px;
  top: 10px;
  bottom: 10px;
  width: 4px;
  border-radius: 0 4px 4px 0;
  background: var(--accent);
}
.skill-nav-mark {
  position: relative;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border: 1px solid var(--line-strong);
  border-radius: 10px;
  background: var(--panel-subtle);
  font-size: 15px;
  font-weight: 700;
}
.skill-nav-item[aria-pressed="true"] .skill-nav-mark { border-color: var(--accent); background: var(--accent); color: #fff; }
.sidebar-status-dot {
  position: absolute;
  right: -4px;
  bottom: -4px;
  width: 12px;
  height: 12px;
  border: 2px solid var(--soft);
  border-radius: 50%;
  background: var(--panel);
  box-shadow: 0 0 0 2px var(--panel);
}
.sidebar-status-dot.status-active { border-color: var(--green); background: var(--green); }
.sidebar-status-dot.status-planned { border-color: var(--amber); background: var(--panel); }
.sidebar-status-dot.status-disabled { border-style: dashed; }
.skill-nav-copy { min-width: 0; display: grid; gap: 2px; }
.skill-nav-copy strong { font-size: 14px; font-weight: 650; }
.skill-nav-copy small {
  display: -webkit-box;
  overflow: hidden;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
body.sidebar-collapsed .sidebar-header { justify-content: center; padding: 16px 0 8px; }
body.sidebar-collapsed .sidebar-header > span { display: none; }
body.sidebar-collapsed .sidebar-header .icon { transform: rotate(180deg); }
body.sidebar-collapsed .skill-list { padding: 4px 0 16px; justify-items: center; }
body.sidebar-collapsed .skill-nav-item { width: 48px; grid-template-columns: 1fr; justify-items: center; padding: 6px; }
body.sidebar-collapsed .skill-nav-item[aria-pressed="true"]::before { left: 0; }
body.sidebar-collapsed .skill-nav-copy {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
@media (min-width: 900px) {
  body { overflow: hidden; }
}
@media (max-width: 1199px) {
  .app-shell-layout { grid-template-columns: var(--sidebar-w) minmax(0, 1fr); }
}
@media (max-width: 899px) {
  .app-shell { --console-h: 240px; height: auto; min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; }
  body.console-collapsed .app-shell { --console-h: 44px; }
  .command-bar {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas: "brand actions" "context context";
    gap: 10px 16px;
    padding: 10px 16px;
  }
  .app-shell-layout { display: flex; flex-direction: column; }
  .sidebar { overflow: visible; border-right: 0; border-bottom: 1px solid var(--line); }
  .sidebar-header { display: none; }
  .skill-list, body.sidebar-collapsed .skill-list { display: flex; justify-items: initial; overflow-x: auto; padding: 10px 16px; }
  .skill-nav-item, body.sidebar-collapsed .skill-nav-item { flex: 0 0 auto; width: min(300px, 82vw); grid-template-columns: 36px minmax(0, 1fr); justify-items: stretch; padding: 10px; }
  .skill-nav-item[aria-pressed="true"]::before { display: none; }
  body.sidebar-collapsed .skill-nav-copy { position: static; width: auto; height: auto; overflow: visible; clip-path: none; white-space: normal; }
  body.sidebar-collapsed .sidebar { display: none; }
  .runtime-console { height: var(--console-h); }
}
@media (max-width: 599px) {
  .command-bar { grid-template-columns: minmax(0, 1fr); grid-template-areas: "brand" "context" "actions"; }
  .command-actions { justify-content: space-between; flex-wrap: wrap; }
  .brand-product, .locale-toggle > span { display: none; }
  h1 { font-size: 24px; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition: none !important; scroll-behavior: auto !important; }
}
`;
