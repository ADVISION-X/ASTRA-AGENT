const PICK3_TARGET_CLIENT = `
const renderPick3LastTargetPhaseOptions = () => {
  const select = qs("[data-pick3-last-target-phase]");
  if (!select) return;
  const selected = select.value;
  const payload = state.pick3Trend || {};
  const draws = Array.isArray(payload.draws) ? payload.draws : [];
  const windowSize = payload.windowSize || 80;
  const eligible = draws.filter((draw, index) => draw?.phase && index >= windowSize).slice().reverse();
  select.innerHTML = "";
  const latest = document.createElement("option");
  latest.value = "";
  latest.textContent = "Latest stored target";
  select.append(latest);
  for (const draw of eligible) {
    const option = document.createElement("option");
    option.value = draw.phase;
    option.textContent = draw.phase + " · " + (draw.expectedPrizeTime || "-");
    select.append(option);
  }
  if (selected && eligible.some((draw) => draw.phase === selected)) {
    select.value = selected;
  }
};
`;

export const renderPick3TargetClient = (): string => PICK3_TARGET_CLIENT;
