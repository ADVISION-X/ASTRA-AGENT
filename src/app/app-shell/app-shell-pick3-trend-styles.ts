export const APP_SHELL_PICK3_TREND_STYLES = `
.pick3-trend-panel {
  display: grid;
  gap: 12px;
}
.pick3-trend-metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}
.pick3-trend-metrics div {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #f8fbfa;
  padding: 9px 10px;
}
.pick3-trend-metrics b {
  display: block;
  color: var(--muted);
  font-size: 11px;
  margin-bottom: 4px;
}
.pick3-trend-metrics span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ink);
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 720;
}
.pick3-trend-shell {
  position: relative;
  min-height: 420px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #ffffff;
  cursor: grab;
  user-select: none;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92);
}
.pick3-trend-shell.dragging {
  cursor: grabbing;
}
.pick3-trend-chart {
  min-height: 420px;
}
.pick3-trend-svg {
  width: 100%;
  min-width: 880px;
  height: 420px;
  display: block;
}
.pick3-trend-grid-line {
  stroke: #e3e9ee;
  stroke-width: 1;
}
.pick3-trend-line {
  fill: none;
  stroke: var(--trend-color);
  stroke-width: 3.2;
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: drop-shadow(0 2px 4px rgba(15, 23, 42, 0.12));
}
.pick3-trend-dot {
  fill: #ffffff;
  stroke: var(--trend-color);
  stroke-width: 2.4;
  cursor: crosshair;
}
.pick3-trend-dot:hover {
  fill: var(--trend-color);
}
.pick3-trend-row-label {
  fill: var(--ink);
  font-size: 13px;
  font-weight: 760;
}
.pick3-trend-axis-label,
.pick3-trend-phase-label {
  fill: var(--muted);
  font-size: 11px;
  font-family: var(--mono);
}
.pick3-trend-tooltip {
  position: absolute;
  z-index: 10;
  width: min(300px, calc(100% - 28px));
  display: grid;
  gap: 4px;
  border: 1px solid rgba(15, 23, 42, 0.18);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.18);
  padding: 9px 10px;
  pointer-events: none;
}
.pick3-trend-tooltip strong {
  color: var(--ink);
  font-size: 12px;
}
.pick3-trend-tooltip span {
  color: var(--muted);
  font-family: var(--mono);
  font-size: 11px;
}
@media (max-width: 960px) {
  .pick3-trend-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
`;
