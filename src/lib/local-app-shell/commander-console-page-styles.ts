export const commanderConsolePageStyles = `
*, *::before, *::after { box-sizing: border-box; }
:root {
  --bg: #0f1117;
  --panel: #171d28;
  --panel-2: #1f2735;
  --border: #31405b;
  --text: #dbe5f4;
  --muted: #91a2bf;
  --accent: #4aa3ff;
  --good: #31c26b;
  --warn: #f6b94f;
  --danger: #ef6a6a;
  --mono: "SF Mono", "Fira Code", monospace;
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
html, body { margin: 0; min-height: 100%; background: radial-gradient(circle at top, #1d2740 0%, #0f1117 48%); color: var(--text); font-family: var(--sans); }
body { padding: 24px; }
main { display: grid; gap: 16px; grid-template-columns: repeat(12, minmax(0, 1fr)); }
.card { background: rgba(23, 29, 40, 0.94); border: 1px solid var(--border); border-radius: 14px; padding: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.25); }
.hero { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 16px; justify-content: space-between; align-items: flex-start; }
.hero h1 { margin: 0; font-size: 28px; }
.hero p { margin: 6px 0 0; color: var(--muted); }
.actions { display: flex; gap: 8px; flex-wrap: wrap; }
button, a.action-link { border: 1px solid var(--border); border-radius: 999px; background: var(--panel-2); color: var(--text); padding: 9px 14px; cursor: pointer; text-decoration: none; font: inherit; }
button.primary { background: rgba(74,163,255,0.18); border-color: var(--accent); }
button.warn { background: rgba(246,185,79,0.14); border-color: var(--warn); }
button.danger { background: rgba(239,106,106,0.14); border-color: var(--danger); }
.language-switch { display: flex; gap: 8px; align-items: center; color: var(--muted); font-size: 13px; }
.status-line { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 12px; }
.badge { border-radius: 999px; padding: 4px 10px; font-family: var(--mono); font-size: 12px; border: 1px solid var(--border); }
.grid-4 { grid-column: 1 / -1; display: grid; gap: 16px; grid-template-columns: repeat(4, minmax(0, 1fr)); }
.grid-3 { grid-column: 1 / -1; display: grid; gap: 16px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.span-8 { grid-column: span 8; }
.span-4 { grid-column: span 4; }
.span-6 { grid-column: span 6; }
.section-title { margin: 0 0 12px; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.metric-list { display: grid; gap: 10px; }
.metric-row { display: flex; justify-content: space-between; gap: 10px; border-bottom: 1px solid rgba(49,64,91,0.45); padding-bottom: 8px; }
.metric-row:last-child { border-bottom: none; padding-bottom: 0; }
.metric-label { color: var(--muted); font-size: 13px; }
.metric-value { font-family: var(--mono); }
.tone-good { color: var(--good); }
.tone-warn { color: var(--warn); }
.tone-danger { color: var(--danger); }
.tone-muted { color: var(--muted); }
.record-list { display: grid; gap: 10px; }
.record { border: 1px solid rgba(49,64,91,0.5); border-radius: 12px; padding: 12px; background: rgba(31,39,53,0.7); }
.record h3 { margin: 0 0 6px; font-size: 15px; }
.record p { margin: 0; color: var(--muted); font-size: 13px; }
.record code { font-family: var(--mono); font-size: 12px; }
.record-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
.log-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.log-table th, .log-table td { text-align: left; padding: 8px 0; border-bottom: 1px solid rgba(49,64,91,0.45); vertical-align: top; }
.log-table th { color: var(--muted); font-weight: 600; font-size: 12px; text-transform: uppercase; }
.empty { color: var(--muted); font-size: 13px; }
@media (max-width: 1100px) {
  .grid-4, .grid-3 { grid-template-columns: 1fr; }
  .span-8, .span-6, .span-4 { grid-column: span 1; }
}
`;
