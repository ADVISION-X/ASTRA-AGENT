export const renderPick3StabilityClient = (): string => `
const renderPick3Stability = (stability) => {
  const list = qs("[data-pick3-stability-list]");
  if (!list) return;
  list.innerHTML = "";
  const consensus = Array.isArray(stability?.consensus) ? stability.consensus : [];
  for (const entry of consensus) {
    const item = document.createElement("div");
    item.className = "record-item" + (entry.isStable ? " pick3-consensus-stable" : " pick3-consensus-unstable");
    item.setAttribute("data-pick3-consensus-position", entry.position);
    const title = document.createElement("strong");
    title.textContent = entry.isStable
      ? entry.position + " · 一致 · " + entry.consensusLabel
      : entry.position + " · 不一致，不可用 · [" + entry.labels.join(", ") + "]";
    const meta = document.createElement("div");
    meta.className = "record-meta";
    meta.textContent = entry.isStable ? "all repeats agree" : "repeats disagree — do not act on this position";
    item.append(title, meta);
    list.append(item);
  }
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
