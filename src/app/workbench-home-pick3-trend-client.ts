const PICK3_TREND_CLIENT = `
const pick3TrendPositions = [
  { id: "hundreds", label: "hundreds", color: "#0d7668" },
  { id: "tens", label: "tens", color: "#1d4ed8" },
  { id: "ones", label: "ones", color: "#b45309" },
];
const pick3TrendView = { startIndex: 0, dragStartX: 0, dragStartIndex: 0, dragging: false };
const clampPick3TrendStart = (startIndex) => {
  const payload = state.pick3Trend || {};
  const draws = Array.isArray(payload.draws) ? payload.draws : [];
  const windowSize = payload.windowSize || 80;
  return Math.max(0, Math.min(startIndex, Math.max(0, draws.length - windowSize)));
};
const pick3TrendWindow = () => {
  const payload = state.pick3Trend || {};
  const draws = Array.isArray(payload.draws) ? payload.draws : [];
  const windowSize = payload.windowSize || 80;
  const startIndex = clampPick3TrendStart(pick3TrendView.startIndex);
  return {
    draws: draws.slice(startIndex, startIndex + windowSize),
    startIndex,
    windowSize,
    total: draws.length,
  };
};
const formatPick3TrendInfo = (draw) => {
  if (!draw) return "-";
  return "期号 " + draw.phase + " | 开奖号码 " + draw.numbers + " | " + (draw.expectedPrizeTime || "-");
};
const showPick3TrendTooltip = (event, draw, position, digit) => {
  const tooltip = qs("[data-pick3-trend-tooltip]");
  if (!tooltip) return;
  tooltip.innerHTML = "";
  const title = document.createElement("strong");
  title.textContent = position.label + " = " + digit;
  const meta = document.createElement("span");
  meta.textContent = formatPick3TrendInfo(draw);
  tooltip.append(title, meta);
  tooltip.classList.remove("hidden");
  const shell = qs("[data-pick3-trend-shell]");
  const rect = shell?.getBoundingClientRect();
  const left = rect ? event.clientX - rect.left + 14 : 20;
  const top = rect ? event.clientY - rect.top + 14 : 20;
  tooltip.style.left = Math.min(left, Math.max(20, (rect?.width || 900) - 260)) + "px";
  tooltip.style.top = Math.max(16, top) + "px";
};
const hidePick3TrendTooltip = () => {
  qs("[data-pick3-trend-tooltip]")?.classList.add("hidden");
};
const buildPick3TrendSvg = () => {
  const view = pick3TrendWindow();
  const width = 1180;
  const rowHeight = 128;
  const topPad = 34;
  const leftPad = 62;
  const rightPad = 24;
  const plotWidth = width - leftPad - rightPad;
  const height = topPad + rowHeight * 3 + 28;
  const pointsPerWindow = Math.max(1, view.windowSize - 1);
  const xFor = (index) => leftPad + (index * plotWidth / pointsPerWindow);
  const yFor = (rowIndex, digit) => topPad + rowIndex * rowHeight + 94 - (digit * 8.8);
  const parts = [
    '<svg class="pick3-trend-svg" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Pick3 80 draw trend chart">',
    '<defs><linearGradient id="pick3TrendPaper" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#f4faf8"/></linearGradient></defs>',
    '<rect x="0" y="0" width="' + width + '" height="' + height + '" rx="16" fill="url(#pick3TrendPaper)"/>',
  ];
  for (const [rowIndex, position] of pick3TrendPositions.entries()) {
    const rowTop = topPad + rowIndex * rowHeight;
    parts.push('<g class="pick3-trend-row">');
    parts.push('<text x="22" y="' + (rowTop + 56) + '" class="pick3-trend-row-label">' + position.label + '</text>');
    for (const digit of [0, 5, 9]) {
      const y = yFor(rowIndex, digit);
      parts.push('<line x1="' + leftPad + '" y1="' + y + '" x2="' + (width - rightPad) + '" y2="' + y + '" class="pick3-trend-grid-line"/>');
      parts.push('<text x="' + (leftPad - 28) + '" y="' + (y + 4) + '" class="pick3-trend-axis-label">' + digit + '</text>');
    }
    const path = view.draws.map((draw, index) => {
      const digit = draw.positions?.[position.id] ?? 0;
      return (index === 0 ? "M " : "L ") + xFor(index).toFixed(1) + " " + yFor(rowIndex, digit).toFixed(1);
    }).join(" ");
    parts.push('<path d="' + path + '" class="pick3-trend-line" style="--trend-color:' + position.color + '"/>');
    for (const [index, draw] of view.draws.entries()) {
      const digit = draw.positions?.[position.id] ?? 0;
      parts.push('<circle class="pick3-trend-dot" data-trend-point="true" data-trend-index="' + index + '" data-trend-position="' + position.id + '" cx="' + xFor(index).toFixed(1) + '" cy="' + yFor(rowIndex, digit).toFixed(1) + '" r="4.2" style="--trend-color:' + position.color + '"/>');
    }
    parts.push("</g>");
  }
  const first = view.draws[0];
  const last = view.draws[view.draws.length - 1];
  parts.push('<text x="' + leftPad + '" y="' + (height - 10) + '" class="pick3-trend-phase-label">' + (first?.phase || "-") + '</text>');
  parts.push('<text x="' + (width - rightPad) + '" y="' + (height - 10) + '" text-anchor="end" class="pick3-trend-phase-label">' + (last?.phase || "-") + '</text>');
  parts.push("</svg>");
  return parts.join("");
};
const renderPick3Trend = () => {
  const chart = qs("[data-pick3-trend-chart]");
  if (!chart) return;
  const view = pick3TrendWindow();
  const payload = state.pick3Trend || {};
  pick3TrendView.startIndex = view.startIndex;
  chart.innerHTML = buildPick3TrendSvg();
  const endIndex = view.draws.length ? view.startIndex + view.draws.length - 1 : 0;
  setText("[data-pick3-trend-window]", view.draws.length + "/" + view.windowSize);
  setText("[data-pick3-trend-range]", view.draws[0]?.phase && view.draws[view.draws.length - 1]?.phase ? view.draws[0].phase + "..." + view.draws[view.draws.length - 1].phase : "-");
  setText("[data-pick3-trend-total]", String(view.total));
  setText("[data-pick3-trend-latest]", payload.latestPhase || "-");
  setText("[data-pick3-trend-offset]", String(Math.max(0, view.total - 1 - endIndex)));
  chart.querySelectorAll("[data-trend-point]").forEach((node) => {
    node.addEventListener("mousemove", (event) => {
      const draw = view.draws[Number(node.dataset.trendIndex)];
      const position = pick3TrendPositions.find((item) => item.id === node.dataset.trendPosition) || pick3TrendPositions[0];
      showPick3TrendTooltip(event, draw, position, draw?.positions?.[position.id] ?? "-");
    });
    node.addEventListener("mouseleave", hidePick3TrendTooltip);
  });
};
const refreshPick3Trend = async () => {
  state.pick3Trend = await readJson("/api/pick3-is-blind-eval/trend");
  pick3TrendView.startIndex = state.pick3Trend.latestWindowStartIndex || 0;
  if (typeof renderPick3LastTargetPhaseOptions === "function") renderPick3LastTargetPhaseOptions();
  renderPick3Trend();
};
const bindPick3TrendDrag = () => {
  const shell = qs("[data-pick3-trend-shell]");
  if (!shell || shell.dataset.pick3TrendDragBound === "true") return;
  shell.dataset.pick3TrendDragBound = "true";
  shell.addEventListener("pointerdown", (event) => {
    pick3TrendView.dragging = true;
    pick3TrendView.dragStartX = event.clientX;
    pick3TrendView.dragStartIndex = pick3TrendView.startIndex;
    shell.classList.add("dragging");
    shell.setPointerCapture?.(event.pointerId);
  });
  shell.addEventListener("pointermove", (event) => {
    if (!pick3TrendView.dragging) return;
    const deltaSteps = Math.trunc((event.clientX - pick3TrendView.dragStartX) / 18);
    const nextStart = clampPick3TrendStart(pick3TrendView.dragStartIndex - deltaSteps);
    if (nextStart !== pick3TrendView.startIndex) {
      pick3TrendView.startIndex = nextStart;
      renderPick3Trend();
    }
  });
  const stopDrag = () => {
    pick3TrendView.dragging = false;
    shell.classList.remove("dragging");
  };
  shell.addEventListener("pointerup", stopDrag);
  shell.addEventListener("pointercancel", stopDrag);
  shell.addEventListener("mouseleave", () => {
    hidePick3TrendTooltip();
    stopDrag();
  });
};
`;

export const renderPick3TrendClient = (): string => PICK3_TREND_CLIENT;
