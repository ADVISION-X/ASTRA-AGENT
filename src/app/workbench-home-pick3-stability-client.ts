export const renderPick3StabilityClient = (): string => `
const renderPick3Stability = (stability) => {
  const list = qs("[data-pick3-stability-list]");
  if (!list) return;
  list.innerHTML = "";
  const results = Array.isArray(stability?.results) ? stability.results : [];
  for (const result of results) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "record-item";
    const title = document.createElement("strong");
    title.textContent = result.position + " · repeat " + result.repeatIndex + " · " + (result.visiblePredictionLabel || "-");
    const meta = document.createElement("div");
    meta.className = "record-meta";
    meta.textContent = "confidence " + (result.confidence ?? "-") + " · " + (result.parseStatus || "-");
    const proof = document.createElement("div");
    proof.textContent = result.rawOutputRef || "-";
    item.append(title, meta, proof);
    item.addEventListener("click", () => openInspector({ kind: "pick3 stability result", title: title.textContent, payload: result }));
    list.append(item);
  }
};
`;
