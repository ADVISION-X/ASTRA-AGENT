export const APP_SHELL_CORE_STYLES = `
:root {
  color-scheme: light;
  --app-bg: #edf0f3;
  --surface: #fbfcfd;
  --panel: #ffffff;
  --panel-subtle: #f6f8fa;
  --ink: #16202a;
  --muted: #65707d;
  --soft: #8b96a3;
  --line: #d9dee5;
  --line-strong: #c5ccd5;
  --accent: #0d7668;
  --accent-soft: #e8f5f2;
  --blue: #315f98;
  --amber: #97620d;
  --red: #a33d45;
  --green: #18714f;
  --mono: "SFMono-Regular", Consolas, monospace;
}
* { box-sizing: border-box; }
html, body { min-width: 1180px; }
body {
  margin: 0;
  min-height: 100vh;
  overflow: hidden;
  background: var(--app-bg);
  color: var(--ink);
  font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
button, input, select { font: inherit; }
button { color: inherit; }
h1, h2, h3, p { margin: 0; }
h1 { font-size: 23px; font-weight: 720; letter-spacing: 0; }
h2 { font-size: 15px; font-weight: 680; letter-spacing: 0; }
h3 { font-size: 12px; font-weight: 680; color: var(--muted); letter-spacing: 0; }
pre {
  margin: 0;
  max-height: 220px;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font: 11px/1.5 var(--mono);
}
.hidden { display: none !important; }
.muted { color: var(--muted); }
.eyebrow {
  display: block;
  margin-bottom: 4px;
  color: var(--soft);
  font-size: 11px;
  font-weight: 680;
  text-transform: uppercase;
}
.app-shell {
  height: 100vh;
  display: grid;
  grid-template-rows: 48px minmax(0, 1fr) 156px;
  background: var(--app-bg);
}
.command-bar {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 0 14px 0 16px;
  border-bottom: 1px solid var(--line);
  background: rgba(251, 252, 253, 0.96);
  backdrop-filter: blur(14px);
}
.command-brand {
  display: flex;
  align-items: baseline;
  gap: 9px;
}
.command-brand strong { font-size: 17px; }
.command-brand span { color: var(--muted); font-weight: 560; }
.command-context {
  display: flex;
  justify-content: center;
  gap: 8px;
  min-width: 0;
}
.command-actions { display: flex; justify-content: flex-end; gap: 8px; }
.icon-button {
  width: 32px;
  height: 32px;
  display: inline-grid;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--panel);
  color: var(--ink);
  cursor: pointer;
}
.icon-button:hover, .btn.secondary:hover { border-color: var(--line-strong); background: var(--panel-subtle); }
.app-shell-layout {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(210px, 230px) minmax(780px, 1fr) minmax(290px, 320px);
  border-bottom: 1px solid var(--line);
}
body.sidebar-collapsed .app-shell-layout { grid-template-columns: 64px minmax(940px, 1fr) minmax(290px, 320px); }
body.inspector-collapsed .app-shell-layout { grid-template-columns: minmax(210px, 230px) minmax(960px, 1fr) 0; }
body.sidebar-collapsed.inspector-collapsed .app-shell-layout { grid-template-columns: 64px minmax(1000px, 1fr) 0; }
.sidebar {
  min-width: 0;
  overflow: auto;
  resize: horizontal;
  border-right: 1px solid var(--line);
  background: #f7f9fb;
}
.sidebar-header {
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px 0 14px;
  color: var(--muted);
  font-weight: 680;
}
.skill-list {
  display: grid;
  gap: 6px;
  padding: 0 10px 14px;
}
.skill-nav-item {
  width: 100%;
  min-height: 58px;
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  padding: 9px 10px;
  text-align: left;
  cursor: pointer;
}
.skill-nav-item[aria-pressed="true"] {
  border-color: #b8c9d6;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(17, 24, 39, 0.05);
}
.skill-nav-item strong {
  display: block;
  margin-bottom: 2px;
  font-size: 13px;
}
.skill-nav-item small {
  display: -webkit-box;
  overflow: hidden;
  color: var(--muted);
  font-size: 11px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.sidebar-status-dot {
  width: 8px;
  height: 8px;
  margin-top: 5px;
  border-radius: 99px;
  background: var(--soft);
}
.sidebar-status-dot.status-active { background: var(--green); }
.sidebar-status-dot.status-planned { background: var(--amber); }
body.sidebar-collapsed .sidebar-header span,
body.sidebar-collapsed .skill-nav-copy { display: none; }
body.sidebar-collapsed .skill-nav-item { min-height: 42px; grid-template-columns: 1fr; place-items: center; }
body.sidebar-collapsed .sidebar { resize: none; }
`;
